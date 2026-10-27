/**
 * Rate Limiter for PSU Research Publication Tracking System
 * Sliding-window in-memory rate limiter to protect:
 * 1. Authentication endpoints (prevents brute force, credential stuffing)
 * 2. Scraper endpoints (prevents Apify token exhaustion and budget depletion)
 * 3. AI endpoints (prevents Gemini API quota exhaustion)
 */

class SlidingWindowRateLimiter {
  constructor() {
    // Map of key -> array of timestamps (ms)
    this.hits = new Map();

    // Configuration rules per category
    this.rules = {
      auth: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,     // 10 requests / minute
        message: 'Too many authentication attempts. Please wait before retrying.',
      },
      scraper: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 12,     // 12 requests / minute (protects Apify budget)
        message: 'Scraper rate limit exceeded to protect institutional Apify budget. Please wait a minute before retrying.',
      },
      ai: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,     // 20 requests / minute
        message: 'AI assistant rate limit reached. Please wait a moment before sending more queries.',
      },
      default: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,    // 100 requests / minute
        message: 'Too many requests. Please slow down.',
      },
    };

    // Clean up expired entries every 3 minutes to avoid memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 3 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Extract client IP address from Node.js HTTP request
   */
  getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
    return req.headers['x-real-ip'] ||
           req.socket?.remoteAddress ||
           req.connection?.remoteAddress ||
           '127.0.0.1';
  }

  /**
   * Determine the rate-limit category for a given pathname
   */
  getCategory(pathname) {
    if (
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/register' ||
      pathname === '/api/auth/change-password'
    ) {
      return 'auth';
    }

    if (
      pathname.startsWith('/api/scholar/') ||
      pathname === '/api/search/google-scholar'
    ) {
      return 'scraper';
    }

    if (
      pathname.startsWith('/api/ai/') ||
      pathname.startsWith('/api/intelligence/')
    ) {
      return 'ai';
    }

    return null; // No special throttling for regular read routes
  }

  /**
   * Check rate limit for an incoming request
   * @returns {{ allowed: boolean, statusCode: number, headers: object, message?: string }}
   */
  check(req, explicitCategory = null) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const category = explicitCategory || this.getCategory(url.pathname);

    // If no category rule applies, allow immediately
    if (!category || !this.rules[category]) {
      return { allowed: true };
    }

    const rule = this.rules[category];
    const clientIp = this.getClientIp(req);
    const key = `${category}:${clientIp}`;
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    // Get existing timestamps and discard those outside the sliding window
    let timestamps = this.hits.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= rule.maxRequests) {
      const earliest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((earliest + rule.windowMs - now) / 1000));
      const resetTime = Math.ceil((earliest + rule.windowMs) / 1000);

      return {
        allowed: false,
        statusCode: 429,
        category,
        retryAfter: retryAfterSec,
        message: rule.message,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(rule.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime),
        },
      };
    }

    // Add current timestamp and save
    timestamps.push(now);
    this.hits.set(key, timestamps);

    const remaining = rule.maxRequests - timestamps.length;
    const resetTime = Math.ceil((now + rule.windowMs) / 1000);

    return {
      allowed: true,
      category,
      remaining,
      headers: {
        'X-RateLimit-Limit': String(rule.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetTime),
      },
    };
  }

  /**
   * Periodic memory cleanup
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const category = key.split(':')[0];
      const windowMs = this.rules[category]?.windowMs || 60000;
      const valid = timestamps.filter((t) => t > now - windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  /**
   * Reset limits (useful for testing)
   */
  reset() {
    this.hits.clear();
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();
