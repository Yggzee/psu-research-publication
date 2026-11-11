import crypto from 'node:crypto';
import { db, runInTransaction, dbReadyPromise } from './db.mjs';
import { isTursoConfigured, rehydrateFromTurso, pushTableToTurso } from './turso.mjs';
import {
  scrapeGoogleScholarDirect,
  scrapeGoogleScholarCitations,
  scrapeGoogleScholarProfile,
  enrichPaperWithCrossRef,
  enrichBatchWithCrossRef,
  fetchCitingPapersFromOpenAlex,
  searchOpenAlexAndCrossRef,
  levenshteinDistance,
  isInitialsToken,
  matchAuthorName,
} from './scholarScraper.mjs';
import {
  classifyPublicationSDG,
  localHeuristicSDG,
  buildDynamicSDGRationale,
  isGenericBoilerplate,
  auditJournalReputation,
  askCampusIntelligence,
  calculateSynergy,
} from './aiService.mjs';
import { normalizeTitle, deduplicateDatabase } from './cleanDuplicates.mjs';
import {
  sendAdminInvitationEmail,
  sendSelfRegisterVerificationEmail,
  sendRegistrationApprovedEmail,
  getAppBaseUrl,
} from './emailService.mjs';
import { rateLimiter, loginAttemptTracker } from './rateLimiter.mjs';
import { applySecurityHeaders } from './securityHeaders.mjs';
import {
  matchesResearcher,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  authenticateCaller,
  isCallerAdmin,
  isCallerPublicationOwner,
  canCallerAccessPublication,
  filterPublicationsForCaller,
  canCallerModifyPublication,
  canCallerModifyResearcher,
  sanitizePublicationInput,
  sanitizeResearcherInput,
  normalizeDepartment,
} from './authHelper.mjs';

export { matchesResearcher };

/**
 * Automatically recalculate publication counts and citation sums for all researchers
 * using strict verification, ensuring honest, deduplicated metrics across the platform.
 */
export function recalculateAllResearcherStats(dbInstance) {
  if (!dbInstance) return;
  try {
    const researchers = dbInstance.prepare("SELECT * FROM researchers WHERE (status = 'active' OR status IS NULL)").all();
    const allApproved = dbInstance.prepare("SELECT * FROM publications WHERE approval_status = 'approved'").all();

    for (const r of researchers) {
      const matching = allApproved.filter((p) => matchesResearcher(p, r));
      const pubCount = matching.length;
      const citCount = matching.reduce((sum, p) => sum + (p.citations || 0), 0);
      if (r.total_publications !== pubCount || r.total_citations !== citCount) {
        dbInstance.prepare(`
          UPDATE researchers
          SET total_publications = ?, total_citations = ?
          WHERE id = ?
        `).run(pubCount, citCount, r.id);
        console.log(`[Citation Audit] Recalibrated ${r.name} (${r.instructor_id}): ${r.total_publications} -> ${pubCount} pubs, ${r.total_citations} -> ${citCount} citations.`);
      }
    }
  } catch (err) {
    console.warn('[Citation Audit Error]:', err.message);
  }
}

/**
 * Synchronize publication count and citation sum for a researcher
 */
export function updateResearcherStats(dbInstance, researcherId) {
  const researcher = dbInstance.prepare('SELECT * FROM researchers WHERE id = ? OR instructor_id = ?').get(researcherId, researcherId);
  if (!researcher) return;

  const allApproved = dbInstance.prepare("SELECT * FROM publications WHERE approval_status = 'approved'").all();
  const matching = allApproved.filter((p) => matchesResearcher(p, researcher));
  const pubCount = matching.length;
  const citCount = matching.reduce((sum, p) => sum + (p.citations || 0), 0);

  dbInstance.prepare(`
    UPDATE researchers 
    SET total_publications = ?, total_citations = ?
    WHERE id = ?
  `).run(pubCount, citCount, researcher.id);
}

/**
 * Cascade delete all publications, citing papers, and citation trends belonging to a researcher
 */
export function deleteResearcherPublications(dbInstance, researcher) {
  if (!researcher) return 0;
  const rInstId = (researcher.instructor_id || '').trim().toLowerCase();
  const rId = (researcher.id || '').trim().toLowerCase();
  const rUserId = (researcher.user_id || '').trim().toLowerCase();
  const rName = (researcher.name || '').trim().toLowerCase();

  const allPubs = dbInstance.prepare('SELECT * FROM publications').all();
  const toDelete = allPubs.filter((p) => {
    const pOwnerId = (p.owner_id || '').trim().toLowerCase();
    const pOwnerName = (p.owner_name || '').trim().toLowerCase();
    if (pOwnerId && (pOwnerId === rInstId || pOwnerId === rId || (rUserId && pOwnerId === rUserId))) {
      return true;
    }
    if (pOwnerName && rName && pOwnerName === rName) {
      return true;
    }
    return matchesResearcher(p, researcher);
  });

  const delCiting = dbInstance.prepare('DELETE FROM citing_papers WHERE publication_id = ?');
  const delTrends = dbInstance.prepare('DELETE FROM citation_trends WHERE publication_id = ?');
  const delPub = dbInstance.prepare('DELETE FROM publications WHERE id = ?');

  for (const pub of toDelete) {
    delCiting.run(pub.id);
    delTrends.run(pub.id);
    delPub.run(pub.id);
  }

  return toDelete.length;
}

/**
 * Ensure every publication is strictly tied to a registered non-rejected researcher;
 * remove any orphaned publications whose researcher has been deleted.
 */
export function cleanupOrphanedPublications(dbInstance) {
  try {
    const validResearchers = dbInstance
      .prepare("SELECT * FROM researchers WHERE status IS NULL OR status != 'rejected'")
      .all();
    const allPubs = dbInstance.prepare('SELECT * FROM publications').all();
    if (allPubs.length === 0) return 0;

    const delCiting = dbInstance.prepare('DELETE FROM citing_papers WHERE publication_id = ?');
    const delTrends = dbInstance.prepare('DELETE FROM citation_trends WHERE publication_id = ?');
    const delPub = dbInstance.prepare('DELETE FROM publications WHERE id = ?');
    const tiePub = dbInstance.prepare('UPDATE publications SET owner_id = ?, owner_name = ? WHERE id = ?');

    let removedCount = 0;
    for (const p of allPubs) {
      const matched = validResearchers.find((r) => matchesResearcher(p, r));
      if (!matched) {
        delCiting.run(p.id);
        delTrends.run(p.id);
        delPub.run(p.id);
        removedCount++;
      } else if (p.owner_id !== matched.instructor_id || p.owner_name !== matched.name) {
        tiePub.run(matched.instructor_id, matched.name, p.id);
      }
    }
    return removedCount;
  } catch (err) {
    console.warn('[CleanupOrphans] Error cleaning orphaned publications:', err.message);
    return 0;
  }
}

// Run initial orphan cleanup after Turso rehydration completes
dbReadyPromise.then(() => {
  cleanupOrphanedPublications(db);
  try {
    db.prepare(
      "DELETE FROM scraped_publications WHERE journal LIKE '%Benezit Dictionary%' OR url LIKE '%/benz/%'"
    ).run();
  } catch {}
}).catch(() => {});

/**
 * Infer the publication year of a citing paper from its explicit year, URL, ResearchGate ObjectId, or volume/issue string.
 */
function inferCitingPaperYear(cp, minYear = 2000) {
  const maxYear = new Date().getFullYear() + 1;
  if (cp.year) {
    const numYr = Number(cp.year);
    if (numYr >= 1990 && numYr <= maxYear) {
      return numYr;
    }
  }

  const linkStr = String(cp.link || '');
  if (linkStr) {
    // 1. Check ResearchGate MongoDB ObjectId timestamp in /links/<24-hex>/
    const rgMatch = linkStr.match(/\/links\/([0-9a-f]{8})[0-9a-f]{16}\//i);
    if (rgMatch) {
      const unixSec = parseInt(rgMatch[1], 16);
      const rgYear = new Date(unixSec * 1000).getUTCFullYear();
      if (rgYear >= minYear && rgYear <= maxYear) {
        return rgYear;
      }
    }

    // 2. Check explicit 4-digit year in URL path (e.g. /2026/ or /2020/01/)
    const urlYearMatch = linkStr.match(/(?:\/|[-_])(20[12]\d)(?:\/|[-_.]|$)/);
    if (urlYearMatch) {
      const uYear = Number(urlYearMatch[1]);
      if (uYear >= minYear && uYear <= maxYear) {
        return uYear;
      }
    }
  }

  // 3. Check volume_issue or doi_issn for 4-digit year
  const metaStr = `${cp.volume_issue || ''} ${cp.doi_issn || ''}`;
  const metaYearMatch = metaStr.match(/\b(20[12]\d)\b/);
  if (metaYearMatch) {
    const mYear = Number(metaYearMatch[1]);
    if (mYear >= minYear && mYear <= maxYear) {
      return mYear;
    }
  }

  return null;
}

/**
 * Compute per-year citation counts for a publication from its citing_papers rows
 * using fast SQLite indexed GROUP BY queries (supports 10,000+ citations in <1ms).
 */
function computePublicationCitationYears(dbInstance, p, persistTrends = false) {
  const minPubYear = Number(p.year) >= 2000 ? Number(p.year) : (Number(p.year) >= 1990 ? Number(p.year) : 2011);

  // Only inspect rows whose year is missing/null or predates the publication to infer or adjust their year
  const missingYearRows = dbInstance
    .prepare('SELECT id, year, link, volume_issue, doi_issn FROM citing_papers WHERE publication_id = ? AND (year IS NULL OR year < ?)')
    .all(p.id, minPubYear);

  if (missingYearRows.length > 0) {
    const updYearStmt = dbInstance.prepare('UPDATE citing_papers SET year = ? WHERE id = ?');
    runInTransaction(() => {
      for (const cp of missingYearRows) {
        const yr = inferCitingPaperYear(cp, minPubYear) || minPubYear;
        if (yr && cp.id) {
          try {
            updYearStmt.run(Math.max(yr, minPubYear), cp.id);
          } catch {}
        }
      }
    });
  }

  // Fast indexed SQL aggregation across citing rows (a citation must occur in or after the publication year)
  const groupedRows = dbInstance
    .prepare('SELECT year, COUNT(*) as cnt FROM citing_papers WHERE publication_id = ? AND year IS NOT NULL AND year >= ? GROUP BY year')
    .all(p.id, minPubYear);

  const yearCounts = {};
  let datedCount = 0;
  for (const row of groupedRows) {
    const yr = Number(row.year);
    const cnt = Number(row.cnt) || 0;
    if (yr && cnt > 0) {
      yearCounts[yr] = cnt;
      datedCount += cnt;
    }
  }

  const totalPubCitations = Number(p.citations) || 0;

  if (datedCount > 0) {
    const unmapped = Math.max(0, totalPubCitations - datedCount);
    if (unmapped > 0 && p.year) {
      const pubYr = Number(p.year);
      yearCounts[pubYr] = (yearCounts[pubYr] || 0) + unmapped;
    }

    if (persistTrends || missingYearRows.length > 0) {
      try {
        runInTransaction(() => {
          dbInstance.prepare('DELETE FROM citation_trends WHERE publication_id = ?').run(p.id);
          const insTrend = dbInstance.prepare(
            'INSERT INTO citation_trends (id, publication_id, year, citations) VALUES (?, ?, ?, ?)'
          );
          for (const [yrStr, cnt] of Object.entries(yearCounts)) {
            insTrend.run(`trend-${p.id}-${yrStr}`, p.id, Number(yrStr), cnt);
          }
        });
      } catch {}
    }
    return yearCounts;
  }

  // Fallback 1: check citation_trends if citing_papers has no rows yet
  const trendRows = dbInstance
    .prepare('SELECT year, citations FROM citation_trends WHERE publication_id = ?')
    .all(p.id);
  if (trendRows.length > 0) {
    for (const tr of trendRows) {
      if (tr.year && tr.citations) {
        yearCounts[Number(tr.year)] = (yearCounts[Number(tr.year)] || 0) + Number(tr.citations);
      }
    }
    return yearCounts;
  }

  // Fallback 2: attribute to publication year if no citing paper details exist yet
  if (totalPubCitations > 0 && p.year) {
    yearCounts[Number(p.year)] = totalPubCitations;
  }

  return yearCounts;
}

// Track completed or in-progress citation syncs so 1,000–10,000+ citation papers never block HTTP requests repeatedly
const syncedPublicationsCache = new Map();
const activeCitationSyncJobs = new Set();

async function syncSinglePublicationCitations(pubId, maxLimit = 10000, force = false) {
  if (!pubId || activeCitationSyncJobs.has(pubId)) return;
  activeCitationSyncJobs.add(pubId);
  try {
    const p = db.prepare('SELECT * FROM publications WHERE id = ?').get(pubId);
    if (!p) return;
    const totalTarget = Math.min(maxLimit, Number(p.citations) || 0);
    if (totalTarget <= 0) return;

    const existingRows = db.prepare('SELECT * FROM citing_papers WHERE publication_id = ?').all(pubId);
    const existingCount = existingRows.length;
    if (!force && existingCount >= totalTarget) {
      syncedPublicationsCache.set(pubId, totalTarget);
      return;
    }

    // Prioritize OpenAlex (Cursor Paginated) + Semantic Scholar (Offset Paginated) + CrossRef (Paginated)
    let fetchedCiting = await fetchCitingPapersFromOpenAlex(p, totalTarget);

    // Supplement with Google Scholar direct if OpenAlex/S2/CrossRef have not yet reached totalTarget
    if (fetchedCiting.length < totalTarget && p.cited_by_link) {
      try {
        const neededPages = Math.min(Math.ceil((totalTarget - fetchedCiting.length) / 10) + 1, 30);
        const gsCiting = await scrapeGoogleScholarCitations(p.cited_by_link, neededPages);
        if (gsCiting.length > 0) {
          fetchedCiting = [...fetchedCiting, ...gsCiting];
        }
      } catch {}
    }

    // Clean title for deduplication
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Merge existing citing papers with newly fetched citing papers to ensure no citing papers are lost
    const mergedMap = new Map();
    const parentNorm = norm(p.title);

    const mergeEntry = (entry) => {
      const k = norm(entry.title);
      if (!k || k.length < 8) return;
      if (parentNorm && (k === parentNorm || k.includes(parentNorm) || parentNorm.includes(k))) return;

      const existing = mergedMap.get(k);
      if (!existing) {
        mergedMap.set(k, {
          title: entry.title,
          authors: entry.authors,
          year: entry.year || null,
          link: entry.link || '',
          journal: entry.journal || 'Academic Journal',
          volume_issue: entry.volume_issue || '',
          quarter: entry.quarter || 'First',
          doi_issn: entry.doi_issn || '',
        });
      } else {
        // Upgrade metadata if candidate has better information
        const existingAuthors = Array.isArray(existing.authors) ? existing.authors.join(', ') : String(existing.authors || '');
        const entryAuthors = Array.isArray(entry.authors) ? entry.authors.join(', ') : String(entry.authors || '');
        if ((!existingAuthors || existingAuthors === 'Academic Authors' || existingAuthors.includes('…')) && entryAuthors && entryAuthors !== 'Academic Authors') {
          existing.authors = entry.authors;
        }
        if (!existing.year && entry.year) existing.year = entry.year;
        if (!existing.volume_issue && entry.volume_issue) existing.volume_issue = entry.volume_issue;
        if ((!existing.journal || existing.journal === 'Academic Journal' || existing.journal.includes('(ACS)')) && entry.journal && entry.journal !== 'Academic Journal') {
          existing.journal = entry.journal;
        }
        if ((!existing.doi_issn || /\.s\d+$/i.test(existing.doi_issn)) && entry.doi_issn && !/\.s\d+$/i.test(entry.doi_issn)) {
          existing.doi_issn = entry.doi_issn;
          existing.link = entry.link || existing.link;
        }
      }
    };

    for (const er of existingRows) mergeEntry(er);
    for (const fc of fetchedCiting) mergeEntry(fc);

    const mergedList = Array.from(mergedMap.values());

    if (mergedList.length > existingCount || (force && mergedList.length > 0)) {
      const toInsert = mergedList.slice(0, totalTarget);
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO citing_papers (id, publication_id, title, authors, year, link, journal, volume_issue, quarter, doi_issn)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      runInTransaction(() => {
        db.prepare('DELETE FROM citing_papers WHERE publication_id = ?').run(pubId);
        for (let i = 0; i < toInsert.length; i++) {
          const cp = toInsert[i];
          const cpAuthors = Array.isArray(cp.authors) ? cp.authors.join(', ') : (cp.authors || 'Academic Authors');
          insertStmt.run(
            `cite-${pubId}-${i + 1}`,
            pubId,
            cp.title,
            cpAuthors,
            cp.year || null,
            cp.link || '',
            cp.journal || 'Academic Journal',
            cp.volume_issue || '',
            cp.quarter || 'First',
            cp.doi_issn || ''
          );
        }
      });
      computePublicationCitationYears(db, p, true);
    }

    if (mergedList.length >= totalTarget) {
      syncedPublicationsCache.set(pubId, totalTarget);
    } else {
      syncedPublicationsCache.delete(pubId);
    }
  } catch (err) {
    console.warn(`[CitationSync] Background sync error for ${pubId}:`, err.message);
  } finally {
    activeCitationSyncJobs.delete(pubId);
  }
}

function enqueuePublicationCitationSync(pubIds) {
  const ids = Array.isArray(pubIds) ? pubIds : [pubIds];
  setTimeout(async () => {
    for (const id of ids) {
      await syncSinglePublicationCitations(id, 10000);
    }
  }, 50);
}

// Helper to get active Apify token row
const getActiveApifyTokenRow = () => {
  let row = db.prepare('SELECT * FROM apify_tokens WHERE is_active = 1 LIMIT 1').get();
  if (!row) {
    row = db.prepare('SELECT * FROM apify_tokens ORDER BY created_at DESC LIMIT 1').get();
  }
  if (!row && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
    return {
      id: 'env',
      name: 'Environment Token',
      token: process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN,
      actor_id: (process.env.APIFY_ACTOR_ID || 'johnvc~google-scholar-api').replace('/', '~'),
      is_active: 1,
      status: 'valid',
      username: 'Env User',
      plan: 'FREE',
      search_count: 0,
      monthly_usage_usd: 0,
      max_monthly_usage_usd: 5,
      cycle_end_at: null,
      total_runs: null,
    };
  }
  return row || null;
};

// Helper to fetch live Apify token limits & usage
const fetchApifyTokenUsage = async (tokenRow, forceLive = false) => {
  if (!tokenRow || !tokenRow.token) return null;
  const headers = { Authorization: `Bearer ${tokenRow.token}` };

  let limitsData = null;
  let runsData = null;

  try {
    const [limitsRes, runsRes] = await Promise.all([
      fetch('https://api.apify.com/v2/users/me/limits', { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('https://api.apify.com/v2/actor-runs?limit=1', { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    limitsData = limitsRes?.data;
    runsData = runsRes?.data;
  } catch (err) {
    console.warn('[ApifyUsage] Live fetch error:', err.message);
  }

  const maxMonthlyUsageUsd = Number(limitsData?.limits?.maxMonthlyUsageUsd) || Number(tokenRow.max_monthly_usage_usd) || 5;
  const monthlyUsageUsd =
    limitsData?.current?.monthlyUsageUsd !== undefined
      ? Number(limitsData.current.monthlyUsageUsd)
      : Number(tokenRow.monthly_usage_usd) || 0;
  const remainingUsd = Math.max(0, maxMonthlyUsageUsd - monthlyUsageUsd);
  const usedPercentage = maxMonthlyUsageUsd > 0 ? (monthlyUsageUsd / maxMonthlyUsageUsd) * 100 : 0;
  const totalRuns = runsData?.total !== undefined ? runsData.total : (Number(tokenRow.total_runs) || 0);
  const cycleEndAt = limitsData?.monthlyUsageCycle?.endAt || tokenRow.cycle_end_at || null;

  if (tokenRow.id && tokenRow.id !== 'env') {
    try {
      db.prepare(`
        UPDATE apify_tokens 
        SET monthly_usage_usd = ?, max_monthly_usage_usd = ?, cycle_end_at = ?, total_runs = ?
        WHERE id = ?
      `).run(monthlyUsageUsd, maxMonthlyUsageUsd, cycleEndAt, totalRuns, tokenRow.id);
    } catch {}
  }

  return {
    tokenId: tokenRow.id,
    tokenName: tokenRow.name,
    username: tokenRow.username || null,
    plan: tokenRow.plan || 'FREE',
    actorId: tokenRow.actor_id || 'johnvc~google-scholar-api',
    limitUsd: Number(maxMonthlyUsageUsd.toFixed(2)),
    usedUsd: Number(monthlyUsageUsd.toFixed(3)),
    remainingUsd: Number(remainingUsd.toFixed(3)),
    usedPercentage: Math.min(100, Number(usedPercentage.toFixed(1))),
    cycleEndAt,
    totalRuns,
    searchesCount: Number(tokenRow.search_count) || 0,
    status: tokenRow.status || 'valid',
    isActive: Boolean(tokenRow.is_active),
    lastUpdated: new Date().toISOString(),
  };
};

const attachTokenUsage = async (payload, didLiveScrape = false) => {
  const active = getActiveApifyTokenRow();
  const tokenUsage = active ? await fetchApifyTokenUsage(active, didLiveScrape) : null;
  return {
    ...payload,
    tokenUsage,
  };
};

/**
 * Handle incoming API requests
 * Compatible with Vite dev server middleware and standalone Node http server
 */
export async function handleApiRequest(req, res) {
  applySecurityHeaders(res);
  await dbReadyPromise;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // Helper to read JSON request body
  const readJsonBody = async () => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  // Helper to send JSON response
  const sendJson = (statusCode, data) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  // ----------------------------------------------------
  // RATE LIMITING (Auth, Scraper, and AI endpoints)
  // ----------------------------------------------------
  const rateResult = rateLimiter.check(req);
  if (!rateResult.allowed) {
    if (rateResult.headers) {
      for (const [hKey, hVal] of Object.entries(rateResult.headers)) {
        res.setHeader(hKey, hVal);
      }
    }
    return sendJson(429, {
      error: rateResult.message,
      category: rateResult.category,
      retryAfter: rateResult.retryAfter,
    });
  }
  if (rateResult.headers) {
    for (const [hKey, hVal] of Object.entries(rateResult.headers)) {
      res.setHeader(hKey, hVal);
    }
  }

  try {
    // ----------------------------------------------------
    // 1. AUTHENTICATION: POST /api/auth/login
    // ----------------------------------------------------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, username, password } = await readJsonBody();
      const loginId = (username || email || '').trim();

      if (!loginId || !password) {
        return sendJson(400, { error: 'Username/Instructor ID and password are required' });
      }

      // 1a. Security Guardrail: Check for temporary 15-minute lockout (5 failed attempts limit)
      const clientIp = rateLimiter.getClientIp(req);
      const accountLock = loginAttemptTracker.isLocked(loginId);
      const ipLock = loginAttemptTracker.isLocked(clientIp);

      if (accountLock || ipLock) {
        const remaining = accountLock?.remainingMinutes || ipLock?.remainingMinutes || 15;
        return sendJson(429, {
          error: `Too many failed login attempts. Your account is temporarily locked for ${remaining} minute(s) to protect against unauthorized access.`,
          isLocked: true,
          remainingMinutes: remaining,
        });
      }

      // 1b. Check Root Research Coordinator credentials from Environment (.env / Render)
      const adminUserEnv = (process.env.ADMIN_USERNAME || 'psuac-rc').trim().toLowerCase();
      const adminPassEnv = process.env.ADMIN_PASSWORD || 'admin123';
      const isAdminLogin =
        loginId.toLowerCase() === adminUserEnv ||
        loginId.toLowerCase() === 'admin' ||
        loginId.toLowerCase() === 'rodeliogarin@gmail.com';

      if (isAdminLogin) {
        let isMatch = false;
        try {
          const passBuf = Buffer.from(password);
          const envBuf = Buffer.from(adminPassEnv);
          if (passBuf.length === envBuf.length) {
            isMatch = crypto.timingSafeEqual(passBuf, envBuf);
          }
        } catch {}

        if (!isMatch) {
          const failAcc = loginAttemptTracker.recordFailure(loginId);
          loginAttemptTracker.recordFailure(clientIp);
          if (failAcc.isLocked) {
            return sendJson(429, {
              error: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes to protect against unauthorized access.',
              isLocked: true,
              remainingMinutes: 15,
            });
          }
          return sendJson(401, {
            error: `Invalid login credentials. ${failAcc.attemptsRemaining} attempt(s) remaining before a 15-minute lockout.`,
            attemptsRemaining: failAcc.attemptsRemaining,
          });
        }

        // Coordinator credentials verified successfully!
        loginAttemptTracker.recordSuccess(loginId);
        loginAttemptTracker.recordSuccess(clientIp);

        const adminDb = db.prepare(`
          SELECT u.*, r.instructor_id, r.department as r_department, r.name as r_name
          FROM users u
          LEFT JOIN researchers r ON u.id = r.user_id
          WHERE u.role = 'admin'
          LIMIT 1
        `).get() || {
          id: 'admin-1',
          role: 'admin',
          name: 'Rodelio M. Garin',
          username: adminUserEnv,
          email: 'rodeliogarin@gmail.com',
          department: 'BSE',
          is_faculty: 1,
          scholar_url: 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
          google_scholar_id: 'x6PdtN8AAAAJ',
        };

        const resolvedName = (adminDb.r_name || adminDb.name || 'Rodelio M. Garin').replace(/^Sir\s+/i, '');
        const resolvedDept = adminDb.r_department || adminDb.department || 'BSE';

        const token = signSessionToken({
          id: adminDb.id,
          role: 'admin',
          name: resolvedName,
          username: adminDb.username || adminUserEnv,
          instructorId: adminDb.instructor_id || 'ASIN-00002',
          department: resolvedDept,
        });

        return sendJson(200, {
          user: {
            id: adminDb.id,
            role: 'admin',
            name: resolvedName,
            username: adminDb.username || adminUserEnv,
            email: adminDb.email || 'rodeliogarin@gmail.com',
            instructorId: adminDb.instructor_id || 'ASIN-00002',
            department: resolvedDept,
            isFaculty: true,
            photoUrl: adminDb.photo_url || null,
            scholarUrl: adminDb.scholar_url || 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
            googleScholarId: adminDb.google_scholar_id || 'x6PdtN8AAAAJ',
          },
          token,
        });
      }

      // 1c. Check Researcher credentials in SQLite using salted scrypt verification
      const user = db.prepare(`
        SELECT u.*, r.instructor_id 
        FROM users u
        LEFT JOIN researchers r ON u.id = r.user_id
        WHERE (
          LOWER(u.username) = LOWER(?) OR 
          LOWER(u.email) = LOWER(?) OR 
          LOWER(r.instructor_id) = LOWER(?)
        )
        LIMIT 1
      `).get(loginId, loginId, loginId);

      if (!user) {
        const failAcc = loginAttemptTracker.recordFailure(loginId);
        loginAttemptTracker.recordFailure(clientIp);
        if (failAcc.isLocked) {
          return sendJson(429, {
            error: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes to protect against unauthorized access.',
            isLocked: true,
            remainingMinutes: 15,
          });
        }
        return sendJson(401, {
          error: `Invalid login credentials. ${failAcc.attemptsRemaining} attempt(s) remaining before a 15-minute lockout.`,
          attemptsRemaining: failAcc.attemptsRemaining,
        });
      }

      const isPasswordValid = verifyPassword(password, user.password);
      if (!isPasswordValid) {
        const failAcc = loginAttemptTracker.recordFailure(loginId);
        loginAttemptTracker.recordFailure(clientIp);
        if (failAcc.isLocked) {
          return sendJson(429, {
            error: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes to protect against unauthorized access.',
            isLocked: true,
            remainingMinutes: 15,
          });
        }
        return sendJson(401, {
          error: `Invalid login credentials. ${failAcc.attemptsRemaining} attempt(s) remaining before a 15-minute lockout.`,
          attemptsRemaining: failAcc.attemptsRemaining,
        });
      }

      // Password verified!
      loginAttemptTracker.recordSuccess(loginId);
      loginAttemptTracker.recordSuccess(clientIp);

      // Lazy upgrade to scrypt if user's password was still plaintext
      if (user.password && !user.password.startsWith('scrypt$') && user.password !== 'ENV_MANAGED') {
        try {
          const hashed = hashPassword(password);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
        } catch {}
      }

      // Check account verification & approval status
      if (user.status === 'pending_verification') {
        return sendJson(403, {
          error: 'Your account is pending email activation. Please check your email inbox and click the verification link to set your password.',
          status: 'pending_verification',
        });
      }

      if (user.status === 'pending_email_verification') {
        return sendJson(403, {
          error: 'Your email address has not been verified yet. Please check your inbox for the verification link.',
          status: 'pending_email_verification',
        });
      }

      if (user.status === 'pending_approval') {
        return sendJson(403, {
          error: 'Your email is verified! Your account is currently awaiting review and approval from the Research Administrator.',
          status: 'pending_approval',
        });
      }

      if (user.status === 'rejected') {
        return sendJson(403, {
          error: 'Your registration request was declined by the administrator. Please contact the Research Office.',
          status: 'rejected',
        });
      }

      const token = signSessionToken({
        id: user.id,
        role: user.role,
        name: user.name,
        username: user.username,
        instructorId: user.instructor_id || user.username,
        department: user.department,
      });

      return sendJson(200, {
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          username: user.username,
          email: user.email,
          instructorId: user.instructor_id || user.username,
          department: user.department,
          isFaculty: Boolean(user.is_faculty),
          photoUrl: user.photo_url,
          scholarUrl: user.scholar_url,
          googleScholarId: user.google_scholar_id,
        },
        token,
      });
    }

    // ----------------------------------------------------
    // 1a. SELF-REGISTRATION: POST /api/auth/register
    // ----------------------------------------------------
    if (pathname === '/api/auth/register' && method === 'POST') {
      const data = await readJsonBody();
      const {
        firstName,
        lastName,
        instructorId,
        email,
        password,
        department = 'BSIT',
        isFaculty = true,
        scholarUrl,
        hasScholar = true,
      } = data;

      if (!firstName || !lastName || !instructorId || !email || !password) {
        return sendJson(400, { error: 'First name, last name, Instructor ID, email address, and password are required.' });
      }

      const trimmedInstId = instructorId.trim();
      const trimmedEmail = email.trim().toLowerCase();

      // Check if username / instructorId already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedInstId);
      if (existingUser) {
        return sendJson(400, { error: 'That Instructor ID / Username is already registered.' });
      }

      const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(trimmedEmail);
      if (existingEmail) {
        return sendJson(400, { error: 'That email address is already in use.' });
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const userId = `user-${Date.now()}`;
      const researcherId = `res-${Date.now()}`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const now = new Date().toISOString();

      let parsedScholarId = null;
      if (hasScholar && scholarUrl) {
        const uMatch = scholarUrl.match(/[?&]user=([a-zA-Z0-9_-]+)/);
        if (uMatch) parsedScholarId = uMatch[1];
      }

      // 1. Insert into users table as pending_email_verification
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, department, is_faculty, scholar_url, google_scholar_id, status, verification_token, verification_token_expires_at, registration_type, has_scholar, created_at)
        VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?, 'pending_email_verification', ?, ?, 'self_registration', ?, ?)
      `).run(
        userId,
        trimmedInstId,
        trimmedEmail,
        hashPassword(password),
        fullName,
        department,
        isFaculty ? 1 : 0,
        hasScholar ? (scholarUrl || null) : null,
        parsedScholarId,
        token,
        expiresAt,
        hasScholar ? 1 : 0,
        now
      );

      // 2. Insert into researchers table as pending_email_verification
      db.prepare(`
        INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, scholar_url, google_scholar_id, status, has_scholar, total_publications, total_citations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_email_verification', ?, 0, 0, ?)
      `).run(
        researcherId,
        userId,
        trimmedInstId,
        firstName.trim(),
        lastName.trim(),
        fullName,
        trimmedEmail,
        department,
        isFaculty ? 1 : 0,
        hasScholar ? (scholarUrl || null) : null,
        parsedScholarId,
        hasScholar ? 1 : 0,
        now
      );

      // Send verification email
      const baseUrl = getAppBaseUrl(req);
      const emailResult = await sendSelfRegisterVerificationEmail({
        email: trimmedEmail,
        name: fullName,
        instructorId: trimmedInstId,
        token,
        baseUrl,
      });

      return sendJson(201, {
        success: true,
        message: 'Registration submitted! Please verify your email address to continue.',
        email: trimmedEmail,
        verificationLink: emailResult.link,
      });
    }

    // ----------------------------------------------------
    // 1b. VERIFY EMAIL: POST /api/auth/verify-email
    // ----------------------------------------------------
    if (pathname === '/api/auth/verify-email' && method === 'POST') {
      const { token } = await readJsonBody();
      if (!token) {
        return sendJson(400, { error: 'Verification token is required.' });
      }

      const user = db.prepare(`
        SELECT * FROM users 
        WHERE verification_token = ?
        LIMIT 1
      `).get(token);

      if (!user) {
        return sendJson(404, { error: 'Invalid or already used verification link.' });
      }

      if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
        return sendJson(400, { error: 'This verification link has expired. Please contact the administrator or request a new one.' });
      }

      const now = new Date().toISOString();

      // If user registered themselves: transitions to pending_approval (awaiting admin admission)
      // If user was invited by admin: complete-invitation will set password & active
      const nextStatus = user.registration_type === 'self_registration' ? 'pending_approval' : 'active';

      db.prepare(`
        UPDATE users 
        SET status = ?, email_verified_at = ?, verification_token = NULL 
        WHERE id = ?
      `).run(nextStatus, now, user.id);

      db.prepare(`
        UPDATE researchers 
        SET status = ? 
        WHERE user_id = ? OR LOWER(instructor_id) = LOWER(?)
      `).run(nextStatus, user.id, user.username);

      return sendJson(200, {
        success: true,
        status: nextStatus,
        message: nextStatus === 'pending_approval'
          ? 'Email address successfully verified! Your registration is now awaiting approval from the Research Administrator.'
          : 'Email verified successfully!',
        user: {
          name: user.name,
          email: user.email,
          instructorId: user.username,
          department: user.department,
        }
      });
    }

    // ----------------------------------------------------
    // 1c. VERIFY TOKEN VALIDITY: GET /api/auth/verify-token
    // ----------------------------------------------------
    if (pathname === '/api/auth/verify-token' && method === 'GET') {
      const rawToken = url.searchParams.get('token');
      const token = (rawToken || '').trim();
      if (!token) {
        return sendJson(400, { valid: false, error: 'Verification token is required.' });
      }

      const user = db.prepare(`
        SELECT u.*, r.first_name, r.last_name, r.instructor_id 
        FROM users u
        LEFT JOIN researchers r ON u.id = r.user_id
        WHERE u.verification_token = ?
        LIMIT 1
      `).get(token);

      if (!user) {
        // Check if this token was recorded in email_logs to provide precise, user-friendly status
        const log = db.prepare(`
          SELECT * FROM email_logs WHERE verification_token = ? ORDER BY created_at DESC LIMIT 1
        `).get(token);

        if (log && log.recipient_email) {
          const matchedUser = db.prepare(`
            SELECT u.*, r.instructor_id 
            FROM users u
            LEFT JOIN researchers r ON u.id = r.user_id
            WHERE LOWER(u.email) = LOWER(?) LIMIT 1
          `).get(log.recipient_email);

          if (matchedUser && matchedUser.status === 'active' && !matchedUser.verification_token) {
            return sendJson(200, {
              valid: false,
              alreadyActive: true,
              error: 'This researcher account has already been activated and verified. You can sign in directly with your credentials.',
              user: {
                id: matchedUser.id,
                name: matchedUser.name,
                instructorId: matchedUser.instructor_id || matchedUser.username,
                email: matchedUser.email,
                department: matchedUser.department,
                status: 'active',
              }
            });
          }

          if (matchedUser && matchedUser.verification_token && matchedUser.verification_token !== token) {
            return sendJson(400, {
              valid: false,
              superseded: true,
              error: 'A newer invitation link was recently dispatched to your email. Please check your inbox for the latest email, or contact Campus Research Coordinator Sir Rodelio M. Garin.',
            });
          }
        }

        return sendJson(404, { valid: false, error: 'This invitation link is invalid or has expired.' });
      }

      if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
        return sendJson(400, { valid: false, error: 'This verification link has expired. Please contact Campus Research Coordinator Sir Rodelio M. Garin to request a fresh invitation.' });
      }

      return sendJson(200, {
        valid: true,
        user: {
          id: user.id,
          name: user.name,
          firstName: user.first_name,
          lastName: user.last_name,
          instructorId: user.instructor_id || user.username,
          email: user.email,
          department: user.department,
          status: user.status,
          registrationType: user.registration_type,
        }
      });
    }

    // ----------------------------------------------------
    // 1d. COMPLETE INVITATION & SET PASSWORD: POST /api/auth/complete-invitation
    // ----------------------------------------------------
    if (pathname === '/api/auth/complete-invitation' && method === 'POST') {
      const { token: rawToken, newPassword } = await readJsonBody();
      const token = (rawToken || '').trim();
      if (!token || !newPassword) {
        return sendJson(400, { error: 'Token and new password are required.' });
      }

      if (newPassword.length < 6) {
        return sendJson(400, { error: 'Password must be at least 6 characters long.' });
      }

      const user = db.prepare(`
        SELECT * FROM users 
        WHERE verification_token = ?
        LIMIT 1
      `).get(token);

      if (!user) {
        const log = db.prepare(`
          SELECT * FROM email_logs WHERE verification_token = ? ORDER BY created_at DESC LIMIT 1
        `).get(token);

        if (log && log.recipient_email) {
          const matchedUser = db.prepare(`
            SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1
          `).get(log.recipient_email);

          if (matchedUser && matchedUser.status === 'active' && !matchedUser.verification_token) {
            return sendJson(200, {
              success: true,
              alreadyActive: true,
              message: 'Your account is already active and your password is set. Please sign in.',
              user: {
                id: matchedUser.id,
                instructorId: matchedUser.username,
                name: matchedUser.name,
              }
            });
          }
        }

        return sendJson(404, { error: 'Invalid or already used invitation link.' });
      }

      if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
        return sendJson(400, { error: 'This invitation link has expired. Please ask the administrator to resend your invite.' });
      }

      const now = new Date().toISOString();

      // Update user password and set to active
      db.prepare(`
        UPDATE users 
        SET password = ?, status = 'active', email_verified_at = ?, verification_token = NULL 
        WHERE id = ?
      `).run(hashPassword(newPassword), now, user.id);

      db.prepare(`
        UPDATE researchers 
        SET status = 'active' 
        WHERE user_id = ? OR LOWER(instructor_id) = LOWER(?)
      `).run(user.id, user.username);

      // Fetch fresh researcher record and synchronize stats
      const r = db.prepare('SELECT * FROM researchers WHERE user_id = ? OR LOWER(instructor_id) = LOWER(?)').get(user.id, user.username);
      if (r) {
        updateResearcherStats(db, r.id);
      }

      return sendJson(200, {
        success: true,
        message: 'Account activated and preferred password set successfully! You can now log in.',
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          instructorId: user.username,
          department: user.department,
        }
      });
    }

    // ----------------------------------------------------
    // 1b. CHANGE PASSWORD: POST /api/auth/change-password
    // ----------------------------------------------------
    if (pathname === '/api/auth/change-password' && method === 'POST') {
      const { userId, username, currentPassword, newPassword } = await readJsonBody();
      if (!newPassword || newPassword.length < 4) {
        return sendJson(400, { error: 'New password must be at least 4 characters long.' });
      }

      const user = db.prepare(`
        SELECT u.* FROM users u
        WHERE (u.id = ? OR LOWER(u.username) = LOWER(?))
        LIMIT 1
      `).get(userId || '', username || '');

      if (!user) {
        return sendJson(401, { error: 'User account not found.' });
      }

      if (user.role === 'admin' || user.password === 'ENV_MANAGED') {
        return sendJson(403, { 
          error: 'The Research Coordinator credentials are environment-secured via ADMIN_PASSWORD in your hosting settings or .env file.' 
        });
      }

      const isCurrentValid = verifyPassword(currentPassword, user.password);
      if (!isCurrentValid) {
        return sendJson(401, { error: 'Current password is incorrect.' });
      }

      const hashedNew = hashPassword(newPassword);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedNew, user.id);
      return sendJson(200, { success: true, message: 'Password updated successfully!' });
    }

    // ----------------------------------------------------
    // 1c. UPDATE PROFILE: PUT /api/auth/profile
    // ----------------------------------------------------
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const {
        userId,
        username,
        name,
        firstName,
        lastName,
        middleInitial,
        email,
        department,
        photoUrl,
        scholarUrl,
        googleScholarId,
        instructorId,
      } = await readJsonBody();
      const caller = authenticateCaller(req);
      
      const user = db.prepare(`
        SELECT u.* FROM users u
        WHERE u.id = ? OR LOWER(u.username) = LOWER(?)
        LIMIT 1
      `).get(userId || '', username || '');

      if (!user) {
        return sendJson(404, { error: 'User not found.' });
      }

      // Server-Side Ownership Check: Prevent cross-faculty tampering
      if (caller && caller.role !== 'admin' && caller.id !== user.id && caller.username?.toLowerCase() !== user.username?.toLowerCase()) {
        return sendJson(403, { error: 'Forbidden: You cannot modify another user’s profile.' });
      }

      // Find matching researcher record for this user to track prior identity keys
      const existingResearcher = db.prepare(`
        SELECT * FROM researchers 
        WHERE user_id = ? OR id = ? OR LOWER(instructor_id) = LOWER(?)
        LIMIT 1
      `).get(user.id, user.id, user.username);

      const updatedFirst = firstName !== undefined ? firstName.trim() : (existingResearcher?.first_name || '');
      const updatedLast = lastName !== undefined ? lastName.trim() : (existingResearcher?.last_name || '');
      const updatedMi = middleInitial !== undefined ? middleInitial.trim() : (existingResearcher?.middle_initial || '');

      let updatedName = name;
      if (updatedFirst && updatedLast) {
        updatedName = updatedMi ? `${updatedFirst} ${updatedMi} ${updatedLast}` : `${updatedFirst} ${updatedLast}`;
      } else if (!updatedName) {
        updatedName = user.name;
      }

      const updatedEmail = email !== undefined ? email : user.email;
      const updatedDept = department !== undefined ? department : user.department;
      const updatedPhoto = photoUrl !== undefined ? photoUrl : user.photo_url;
      const updatedScholar = scholarUrl !== undefined ? scholarUrl : user.scholar_url;
      const updatedScholarId = googleScholarId !== undefined ? googleScholarId : user.google_scholar_id;

      const oldIds = new Set([
        user.username,
        existingResearcher?.instructor_id,
        existingResearcher?.id,
      ].filter(Boolean));

      const updatedInstructorId = instructorId !== undefined && instructorId.trim() !== ''
        ? instructorId.trim()
        : (existingResearcher?.instructor_id || user.username);

      // Cascade update Instructor ID across researchers, users, publications, and ai sessions
      if (updatedInstructorId) {
        if (existingResearcher) {
          db.prepare('UPDATE researchers SET instructor_id = ? WHERE id = ?').run(updatedInstructorId, existingResearcher.id);
        } else {
          db.prepare('UPDATE researchers SET instructor_id = ? WHERE user_id = ? OR LOWER(instructor_id) = LOWER(?)')
            .run(updatedInstructorId, user.id, user.username);
        }

        if (user.role !== 'admin') {
          db.prepare('UPDATE users SET username = ? WHERE id = ?').run(updatedInstructorId, user.id);
        }

        // Cascade to publications
        for (const oldId of oldIds) {
          db.prepare('UPDATE publications SET owner_id = ?, owner_name = ? WHERE LOWER(owner_id) = LOWER(?)')
            .run(updatedInstructorId, updatedName, oldId);
        }

        // Cascade to AI chat sessions
        for (const oldId of oldIds) {
          db.prepare('UPDATE ai_chat_sessions SET user_id = ? WHERE LOWER(user_id) = LOWER(?)')
            .run(updatedInstructorId, oldId);
        }

        // Cascade to invitation requests
        for (const oldId of oldIds) {
          db.prepare('UPDATE invitation_requests SET instructor_id = ? WHERE LOWER(instructor_id) = LOWER(?)')
            .run(updatedInstructorId, oldId);
        }
      }

      db.prepare(`
        UPDATE users 
        SET name = ?, middle_initial = ?, email = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?
        WHERE id = ?
      `).run(updatedName, updatedMi || null, updatedEmail, updatedDept, updatedPhoto, updatedScholar, updatedScholarId, user.id);

      db.prepare(`
        UPDATE researchers 
        SET name = ?, first_name = ?, last_name = ?, middle_initial = ?, email = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?
        WHERE user_id = ? OR id = ? OR LOWER(instructor_id) = LOWER(?) OR LOWER(instructor_id) = LOWER(?)
      `).run(updatedName, updatedFirst || null, updatedLast || null, updatedMi || null, updatedEmail, updatedDept, updatedPhoto, updatedScholar, updatedScholarId, user.id, user.id, user.username, updatedInstructorId);

      return sendJson(200, {
        success: true,
        user: {
          id: user.id,
          role: user.role,
          name: updatedName,
          firstName: updatedFirst,
          lastName: updatedLast,
          middleInitial: updatedMi,
          username: user.role === 'admin' ? user.username : updatedInstructorId,
          instructorId: updatedInstructorId,
          email: updatedEmail,
          department: updatedDept,
          photoUrl: updatedPhoto,
          scholarUrl: updatedScholar,
          googleScholarId: updatedScholarId,
        }
      });
    }

    // ----------------------------------------------------
    // 1d. TURSO STATUS & SYNC: GET /api/turso/status, POST /api/turso/sync
    // ----------------------------------------------------
    if (pathname === '/api/turso/status' && method === 'GET') {
      const url = process.env.TURSO_DATABASE_URL || '';
      const maskedUrl = url ? url.replace(/:\/\/[^@]+@/, '://***@').slice(0, 30) + '...' : '';
      return sendJson(200, {
        isConfigured: isTursoConfigured,
        databaseUrl: maskedUrl,
        mode: isTursoConfigured ? 'turso_cloud' : 'local_sqlite',
      });
    }

    if (pathname === '/api/turso/sync' && method === 'POST') {
      if (!isTursoConfigured) {
        return sendJson(400, { error: 'Turso Cloud is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Render.' });
      }
      try {
        const tables = [
          'users',
          'researchers',
          'publications',
          'scraped_publications',
          'citation_trends',
          'citing_papers',
          'apify_tokens',
          'invitation_requests',
          'email_logs',
          'ai_chat_sessions',
          'system_settings',
          'archived_researchers',
          'declined_registrations'
        ];
        for (const t of tables) {
          await pushTableToTurso(db, t);
        }
        return sendJson(200, { success: true, message: 'All local tables successfully pushed to Turso Cloud!' });
      } catch (err) {
        return sendJson(500, { error: `Failed to push to Turso: ${err.message}` });
      }
    }

    // ----------------------------------------------------
    // SYSTEM SETTINGS & PUBLIC REPOSITORY SEARCH
    // ----------------------------------------------------
    if (pathname === '/api/settings/public-scraper-status' && method === 'GET') {
      const publicScraperSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'public_scraper_enabled'").get()?.value || 'true';
      const thresholdSetting = Number(db.prepare("SELECT value FROM system_settings WHERE key = 'scraper_quota_threshold_usd'").get()?.value) || 1.0;
      
      const activeToken = getActiveApifyTokenRow();
      let quotaCircuitBreakerTripped = false;
      let remainingBalanceUsd = 5.0;

      if (activeToken) {
        try {
          const usage = await fetchApifyTokenUsage(activeToken, false);
          const maxUsd = Number(usage?.maxMonthlyUsageUsd) || 5.0;
          const usedUsd = Number(usage?.monthlyUsageUsd) || 0.0;
          remainingBalanceUsd = Math.max(0, maxUsd - usedUsd);
          if (remainingBalanceUsd <= thresholdSetting) {
            quotaCircuitBreakerTripped = true;
          }
        } catch {}
      }

      return sendJson(200, {
        publicScraperEnabled: publicScraperSetting === 'true',
        quotaCircuitBreakerTripped,
        remainingBalanceUsd,
        thresholdUsd: thresholdSetting,
        isAvailableForPublic: publicScraperSetting === 'true' && !quotaCircuitBreakerTripped,
      });
    }

    if (pathname === '/api/admin/settings' && method === 'GET') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Admin access required.' });
      }
      const rows = db.prepare('SELECT key, value FROM system_settings').all();
      const settingsMap = {};
      for (const r of rows) settingsMap[r.key] = r.value;
      return sendJson(200, settingsMap);
    }

    if (pathname === '/api/admin/settings' && method === 'PUT') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Admin access required.' });
      }
      const body = await readJsonBody();
      const now = new Date().toISOString();
      const upsert = db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      runInTransaction(() => {
        for (const [k, v] of Object.entries(body)) {
          upsert.run(k, String(v), now);
        }
      });
      return sendJson(200, { success: true, message: 'Settings saved successfully' });
    }

    /**
     * Test whether text contains a whole-word or prefix match for a target token
     */
    function hasWordMatch(text, targetWord) {
      if (!text || !targetWord) return false;
      const cleanTarget = String(targetWord).trim();
      if (!cleanTarget) return false;
      const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}`, 'i');
      return re.test(text);
    }

    /**
     * Extract topic words, stems, and academic domain synonyms for content-aware semantic search
     */
    function extractTopicVariants(query) {
      const clean = String(query || '')
        .replace(/^author:\s*"?/i, '')
        .replace(/"$/g, '')
        .toLowerCase()
        .trim();

      const stopWords = new Set([
        'the', 'in', 'of', 'and', 'a', 'an', 'at', 'during', 'for', 'on', 'to', 'with', 
        'by', 'from', 'as', 'into', 'through', 'over', 'after', 'between', 'under', 
        'against', 'within', 'without', 'about', 'across', 'towards', 'upon', 'concerning',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
        'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
        'must', 'it', 'its', 'their', 'they', 'them', 'this', 'that', 'these', 'those',
        'which', 'who', 'whom', 'whose', 'what', 'where', 'when', 'why', 'how',
        'philippines', 'philippine', 'pangasinan', 'state', 'university', 'campus', 'psu'
      ]);

      const stem = (w) => {
        if (w.length <= 3) return w;
        return w.replace(/ies$/i, 'y').replace(/(ing|ers?|ed|s)$/i, '');
      };

      const rawWords = clean.split(/[^a-z0-9_-]+/).filter((w) => w.length >= 2);
      const topicWords = rawWords.filter((w) => !stopWords.has(w));
      const stems = new Set();
      const synonyms = new Set();

      for (const w of topicWords) {
        stems.add(w);
        const s = stem(w);
        if (s.length >= 3) stems.add(s);

        // 1. Agriculture & Farming Domain
        if (w.startsWith('farm') || s === 'farm' || w === 'agriculture' || w === 'agricultural' || w === 'agronomy' || w === 'crop' || w === 'crops') {
          ['farmer', 'farmers', 'farming', 'farms', 'agriculture', 'agricultural', 'crop', 'crops', 'cultivation', 'livestock', 'poultry', 'soil', 'fertilizer', 'rice', 'palay', 'corn', 'cassava', 'dairy', 'irrigation', 'organic farming', 'agrarian', 'sdg 2', 'zero hunger'].forEach((x) => synonyms.add(x));
        }

        // 2. Fishery, Aquaculture & Marine Domain
        if (w.startsWith('fish') || s === 'fish' || w === 'aquaculture' || w === 'marine' || w === 'aquatic' || w === 'tilapia' || w === 'bangus') {
          ['fishery', 'fisheries', 'fishing', 'fisherfolk', 'aquaculture', 'marine', 'tilapia', 'bangus', 'milkfish', 'fingerling', 'fingerlings', 'hatchery', 'coastal', 'aquatic', 'pond', 'freshwater', 'sdg 14', 'life below water'].forEach((x) => synonyms.add(x));
        }

        // 3. Arduino, IoT, Robotics & Embedded Engineering
        if (w === 'arduino' || w === 'microcontroller' || w === 'sensor' || w === 'sensors' || w === 'iot' || w === 'robot' || w === 'robotics' || w === 'automation' || s === 'robot') {
          ['arduino', 'microcontroller', 'microcontrollers', 'sensor', 'sensors', 'iot', 'internet of things', 'smart', 'automation', 'robotics', 'telemetry', 'embedded', 'hardware', 'gsm', 'relay', 'esp32', 'esp8266', 'raspberry pi', 'circuit', 'mechatronics', 'sdg 9', 'industry, innovation'].forEach((x) => synonyms.add(x));
        }

        // 4. Research Tracking, Bibliometrics & Scholarly Systems
        if (w === 'research' || w === 'tracking' || w === 'citation' || w === 'citations' || w === 'repository' || w === 'tracker') {
          ['research tracking', 'citation tracking', 'repository', 'citations', 'bibliometrics', 'scientometrics', 'scholarly communication', 'h-index', 'research impact', 'publication tracker', 'academic tracking', 'published research', 'journal indexing'].forEach((x) => synonyms.add(x));
        }

        // 5. Artificial Intelligence & Data Science
        if (w === 'ai' || w === 'artificial' || w === 'intelligence' || w === 'machine' || w === 'learning' || w === 'data') {
          ['ai', 'machine learning', 'deep learning', 'neural', 'nlp', 'computer vision', 'data science', 'analytics', 'predictive', 'algorithm'].forEach((x) => synonyms.add(x));
        }

        // 6. Education, Mathematics & Pedagogy
        if (w === 'education' || w === 'teaching' || w === 'instruction' || w === 'learning' || w === 'curriculum' || w === 'modular' || w === 'math' || w === 'mathematics') {
          ['education', 'teaching', 'pedagogy', 'instruction', 'curriculum', 'learning', 'modular', 'mathematics', 'modular arithmetic', 'academic performance', 'student', 'students', 'school', 'schools', 'sdg 4', 'quality education'].forEach((x) => synonyms.add(x));
        }
      }

      return {
        rawQuery: clean,
        topicWords,
        stems: Array.from(stems),
        synonyms: Array.from(synonyms),
      };
    }

    // GET /api/repository/search (Public Institutional Repository Search - UP Saliksik Model)
    if (pathname === '/api/repository/search' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      const sdg = (url.searchParams.get('sdg') || '').trim();
      const department = (url.searchParams.get('department') || '').trim();
      const year = (url.searchParams.get('year') || '').trim();
      const sort = url.searchParams.get('sort') || 'citations'; // 'citations' | 'recent' | 'title'
      const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10)));

      let sql = "SELECT * FROM publications WHERE approval_status = 'approved' AND (is_public = 1 OR is_public IS NULL)";
      const params = [];

      if (department && department !== 'all') {
        sql += ` AND (owner_id IN (SELECT instructor_id FROM researchers WHERE department = ?) OR owner_id IN (SELECT id FROM researchers WHERE department = ?))`;
        params.push(department, department);
      }

      if (year && year !== 'all') {
        sql += ` AND year = ?`;
        params.push(Number(year));
      }

      if (sdg && sdg !== 'all') {
        sql += ` AND (sdg_tags LIKE ? OR sdg_tags LIKE ?)`;
        params.push(`%${sdg}%`, `%${sdg.replace(/^SDG\s*\d+:?\s*/i, '')}%`);
      }

      const allApproved = db.prepare(sql).all(...params);

      // Relevance ranking and content-aware semantic search if query present
      let filtered = allApproved;
      if (q) {
        const topicVariants = extractTopicVariants(q);
        const qLower = topicVariants.rawQuery;

        const allResearchers = db.prepare("SELECT * FROM researchers WHERE status IS NULL OR status != 'rejected'").all();
        const matchingResearchers = allResearchers.filter((r) => {
          const rName = String(r.name || '').toLowerCase();
          const rLast = String(r.last_name || '').toLowerCase();
          const rFirst = String(r.first_name || '').toLowerCase();
          return (
            rName.includes(qLower) ||
            qLower.includes(rName) ||
            (topicVariants.topicWords.length > 0 && topicVariants.topicWords.every((w) => rName.includes(w) || rFirst.includes(w) || rLast.includes(w)))
          );
        });

        const isContentRelevant = (p) => {
          // If query matches a registered researcher and this publication belongs to them
          for (const mr of matchingResearchers) {
            if (p.owner_id && (p.owner_id === mr.instructor_id || p.owner_id === mr.id)) return true;
            if (matchesResearcher(p, mr)) return true;
          }

          const tLower = String(p.title || '').toLowerCase();
          const aLower = String(p.authors || '').toLowerCase();
          const oLower = String(p.owner_name || '').toLowerCase();
          const absLower = String(p.abstract || '').toLowerCase();
          const kwLower = String(p.keywords || '').toLowerCase();
          const sdgLower = String(p.sdg_tags || '').toLowerCase();
          const chedLower = String(p.ched_priority || '').toLowerCase();
          const journalLower = String(p.journal || '').toLowerCase();
          const fullContent = `${tLower} ${aLower} ${oLower} ${absLower} ${kwLower} ${sdgLower} ${chedLower} ${journalLower}`;

          if (hasWordMatch(fullContent, qLower)) return true;
          if (topicVariants.stems.some((s) => hasWordMatch(fullContent, s))) return true;
          if (topicVariants.synonyms.some((s) => hasWordMatch(fullContent, s))) return true;

          if (topicVariants.topicWords.length >= 2) {
            const hits = topicVariants.topicWords.filter(
              (w) => hasWordMatch(fullContent, w) || hasWordMatch(fullContent, w.replace(/(ing|ers?|ed|s)$/i, ''))
            ).length;
            if (hits >= Math.ceil(topicVariants.topicWords.length * 0.5)) return true;
          }
          return false;
        };

        filtered = allApproved
          .filter(isContentRelevant)
          .map((p) => {
            let score = 0;
            const tLower = String(p.title || '').toLowerCase();
            const aLower = String(p.authors || '').toLowerCase();
            const oLower = String(p.owner_name || '').toLowerCase();
            const absLower = String(p.abstract || '').toLowerCase();
            const kwLower = String(p.keywords || '').toLowerCase();
            const sdgLower = String(p.sdg_tags || '').toLowerCase();
            const chedLower = String(p.ched_priority || '').toLowerCase();

            // Registered researcher match gets primary author boost
            for (const mr of matchingResearchers) {
              if (p.owner_id && (p.owner_id === mr.instructor_id || p.owner_id === mr.id)) {
                score += 500;
                break;
              }
              if (matchesResearcher(p, mr)) {
                score += 500;
                break;
              }
            }

            // Title exact/word match
            if (hasWordMatch(tLower, qLower)) {
              score += 300;
              if (tLower === qLower || tLower.startsWith(qLower)) score += 150;
            } else if (hasWordMatch(absLower, qLower)) {
              // Deep content/abstract match (e.g. technology/tools mentioned in text)
              score += 180;
            } else if (hasWordMatch(kwLower, qLower)) {
              score += 150;
            }

            // Author/Faculty match
            if (hasWordMatch(aLower, qLower) || hasWordMatch(oLower, qLower)) {
              score += 250;
            }

            // SDG / CHED Priority match
            if (hasWordMatch(sdgLower, qLower) || hasWordMatch(chedLower, qLower)) {
              score += 120;
            }

            // Topic words match across fields
            for (const w of topicVariants.topicWords) {
              if (hasWordMatch(tLower, w)) score += 60;
              if (hasWordMatch(absLower, w)) score += 30;
              if (hasWordMatch(kwLower, w)) score += 30;
              if (hasWordMatch(oLower, w)) score += 50;
              if (hasWordMatch(aLower, w)) score += 40;
            }

            // Stem hits
            for (const s of topicVariants.stems) {
              if (hasWordMatch(tLower, s)) score += 40;
              if (hasWordMatch(absLower, s)) score += 20;
              if (hasWordMatch(kwLower, s)) score += 20;
              if (hasWordMatch(sdgLower, s)) score += 20;
            }

            // Domain synonyms hits (e.g. farmers, crops, agriculture for farming)
            for (const syn of topicVariants.synonyms) {
              if (hasWordMatch(tLower, syn)) score += 40;
              if (hasWordMatch(absLower, syn)) score += 20;
              if (hasWordMatch(sdgLower, syn)) score += 20;
            }

            score += Math.min(30, (Number(p.citations) || 0) * 0.2);
            return { ...p, _score: score };
          })
          .sort((a, b) => b._score - a._score);
      } else {
        if (sort === 'recent') {
          filtered.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || (Number(b.citations) || 0) - (Number(a.citations) || 0));
        } else if (sort === 'title') {
          filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else {
          filtered.sort((a, b) => (Number(b.citations) || 0) - (Number(a.citations) || 0) || (Number(b.year) || 0) - (Number(a.year) || 0));
        }
      }

      const total = filtered.length;
      const startIndex = page * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      const results = paginated.map((p) => {
        let authorsArr = [];
        try {
          const parsed = JSON.parse(p.authors);
          authorsArr = Array.isArray(parsed) ? parsed : [p.authors];
        } catch {
          authorsArr = typeof p.authors === 'string' ? p.authors.split(',').map((a) => a.trim()).filter(Boolean) : [];
        }
        let sdgArr = [];
        try {
          const parsed = JSON.parse(p.sdg_tags);
          sdgArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          sdgArr = p.sdg_tags ? [p.sdg_tags] : [];
        }

        return {
          id: p.id,
          title: p.title,
          authors: authorsArr,
          journal: p.journal || 'Academic Publication',
          year: p.year,
          citations: Number(p.citations) || 0,
          abstract: p.abstract || '',
          url: p.url || '',
          doi: p.doi || '',
          keywords: p.keywords || '',
          volume_issue: p.volume_issue || '',
          publication_date: p.publication_date || '',
          publication_level: p.publication_level || 'International',
          journal_indexing: p.journal_indexing || '',
          owner_id: p.owner_id,
          owner_name: p.owner_name,
          sdg_tags: sdgArr,
          sdg_rationale: p.sdg_rationale || '',
          ched_priority: p.ched_priority || '',
        };
      });

      const totalPubsCount = db.prepare("SELECT COUNT(*) as c FROM publications WHERE approval_status = 'approved'").get()?.c || 0;
      const totalCitsCount = db.prepare("SELECT SUM(citations) as c FROM publications WHERE approval_status = 'approved'").get()?.c || 0;
      const totalFacultyCount = db.prepare('SELECT COUNT(*) as c FROM researchers').get()?.c || 0;

      const topCited = db.prepare("SELECT id, title, authors, citations, year, journal, sdg_tags, abstract, doi, url FROM publications WHERE approval_status = 'approved' ORDER BY citations DESC LIMIT 6").all().map((p) => {
        let sdgArr = [];
        try { sdgArr = JSON.parse(p.sdg_tags); } catch {}
        let authArr = [];
        try { authArr = JSON.parse(p.authors); } catch { authArr = [p.authors]; }
        return {
          id: p.id,
          title: p.title,
          authors: authArr,
          citations: p.citations,
          year: p.year,
          journal: p.journal,
          sdg_tags: sdgArr,
          abstract: p.abstract,
          doi: p.doi,
          url: p.url,
        };
      });

      return sendJson(200, {
        success: true,
        results,
        total,
        page,
        limit,
        hasMore: total > startIndex + limit,
        stats: {
          totalPublications: totalPubsCount,
          totalCitations: totalCitsCount,
          totalResearchers: totalFacultyCount,
        },
        topCited,
      });
    }

    // ----------------------------------------------------
    // 2. DASHBOARD STATS: GET /api/dashboard/stats
    // ----------------------------------------------------
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
      cleanupOrphanedPublications(db);
      const researchersCount = db.prepare("SELECT COUNT(*) as count FROM researchers WHERE (status = 'active' OR status IS NULL)").get().count;
      const pubStats = db.prepare(`
        SELECT 
          COUNT(*) as totalPublications,
          COALESCE(SUM(citations), 0) as totalCitations,
          COALESCE(AVG(impact_score), 0.0) as averageImpactScore
        FROM publications
        WHERE approval_status = 'approved'
      `).get();

      // Ensure all researchers have up-to-date counts
      const allResearchers = db.prepare("SELECT * FROM researchers WHERE (status = 'active' OR status IS NULL)").all();
      const allApprovedPubs = db.prepare("SELECT * FROM publications WHERE approval_status = 'approved'").all();

      const calculatedResearchers = allResearchers.map((r) => {
        const pubs = allApprovedPubs.filter((p) => matchesResearcher(p, r));
        const pubCount = pubs.length;
        const citCount = pubs.reduce((sum, p) => sum + (p.citations || 0), 0);
        if (r.total_publications !== pubCount || r.total_citations !== citCount) {
          db.prepare('UPDATE researchers SET total_publications = ?, total_citations = ? WHERE id = ?')
            .run(pubCount, citCount, r.id);
        }
        return {
          id: r.id,
          name: r.name,
          department: normalizeDepartment(r.department),
          instructor_id: r.instructor_id,
          citations: citCount,
          publications: pubCount,
        };
      });

      const topResearchers = [...calculatedResearchers]
        .sort((a, b) => b.citations - a.citations)
        .slice(0, 10);

      // Citations and publications grouped by department & year
      // Publications are counted in the year published (p.year),
      // while Citations are counted in the actual year the citing paper was published (citing_papers.year).
      const deptYearMap = {};
      const ensureDeptYear = (dept, yr) => {
        const key = `${dept}-${yr}`;
        if (!deptYearMap[key]) {
          deptYearMap[key] = { department: dept, year: Number(yr), publications: 0, citations: 0 };
        }
        return deptYearMap[key];
      };

      for (const p of allApprovedPubs) {
        // Find matching researcher to get department
        const matchedR = allResearchers.find((r) => matchesResearcher(p, r));
        const dept = normalizeDepartment(matchedR ? matchedR.department : 'BSIT');
        const pubYear = Number(p.year);

        if (pubYear && pubYear >= 2000) {
          ensureDeptYear(dept, pubYear).publications += 1;
        }

        const citeYearCounts = computePublicationCitationYears(db, p);
        for (const [cYearStr, cnt] of Object.entries(citeYearCounts)) {
          const cYear = Number(cYearStr);
          const effectiveYear = Math.max(cYear, pubYear || 2011);
          if (effectiveYear >= 2000) {
            ensureDeptYear(dept, effectiveYear).citations += Number(cnt) || 0;
          }
        }
      }
      const deptYearStats = Object.values(deptYearMap).sort((a, b) => a.year - b.year);

      const computedAvgImpact =
        pubStats.averageImpactScore > 0
          ? Number(pubStats.averageImpactScore.toFixed(1))
          : pubStats.totalPublications > 0
          ? Number((pubStats.totalCitations / pubStats.totalPublications).toFixed(1))
          : 0.0;

      return sendJson(200, {
        totalResearchers: researchersCount,
        totalPublications: pubStats.totalPublications,
        totalCitations: pubStats.totalCitations,
        averageImpactScore: computedAvgImpact,
        topResearchers,
        deptYearStats,
      });
    }

    // ----------------------------------------------------
    // 3. RESEARCHERS CRUD
    // ----------------------------------------------------
    if (pathname === '/api/researchers' && method === 'GET') {
      const rows = db.prepare("SELECT * FROM researchers WHERE (status = 'active' OR status IS NULL) ORDER BY name ASC").all();
      const allApprovedPubs = db.prepare("SELECT * FROM publications WHERE approval_status = 'approved' ORDER BY year DESC").all();

      const researchers = rows.map((r) => {
        const pubs = allApprovedPubs.filter((p) => matchesResearcher(p, r));
        const pubCount = pubs.length;
        const citCount = pubs.reduce((sum, p) => sum + (p.citations || 0), 0);

        if (r.total_publications !== pubCount || r.total_citations !== citCount) {
          db.prepare('UPDATE researchers SET total_publications = ?, total_citations = ? WHERE id = ?')
            .run(pubCount, citCount, r.id);
        }

        return {
          id: r.id,
          name: r.name,
          firstName: r.first_name,
          lastName: r.last_name,
          instructorId: r.instructor_id,
          department: r.department,
          isFaculty: Boolean(r.is_faculty),
          affiliation: r.affiliation,
          photoUrl: r.photo_url,
          scholarUrl: r.scholar_url || null,
          googleScholarId: r.google_scholar_id || null,
          status: r.status || 'active',
          totalPublications: pubCount,
          totalCitations: citCount,
          publications: pubs.map((p) => ({
            ...p,
            authors: Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]'),
          })),
        };
      });

      return sendJson(200, researchers);
    }

    if (pathname.startsWith('/api/researchers/') && method === 'GET') {
      const id = pathname.replace('/api/researchers/', '');
      const r = db.prepare('SELECT * FROM researchers WHERE id = ? OR instructor_id = ?').get(id, id);
      if (!r) {
        return sendJson(404, { error: 'Researcher not found' });
      }

      const allApprovedPubs = db.prepare("SELECT * FROM publications WHERE approval_status = 'approved' ORDER BY year DESC").all();
      const pubs = allApprovedPubs.filter((p) => matchesResearcher(p, r));
      const pubCount = pubs.length;
      const citCount = pubs.reduce((sum, p) => sum + (p.citations || 0), 0);

      if (r.total_publications !== pubCount || r.total_citations !== citCount) {
        db.prepare('UPDATE researchers SET total_publications = ?, total_citations = ? WHERE id = ?')
          .run(pubCount, citCount, r.id);
      }

      return sendJson(200, {
        id: r.id,
        name: r.name,
        firstName: r.first_name,
        lastName: r.last_name,
        instructorId: r.instructor_id,
        department: r.department,
        isFaculty: Boolean(r.is_faculty),
        affiliation: r.affiliation,
        photoUrl: r.photo_url,
        scholarUrl: r.scholar_url || null,
        googleScholarId: r.google_scholar_id || null,
        status: r.status || 'active',
        totalPublications: pubCount,
        totalCitations: citCount,
        publications: pubs.map((p) => ({
          ...p,
          authors: Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]'),
        })),
      });
    }

    // POST /api/researchers (Admin adding researcher + sending invitation email)
    if (pathname === '/api/researchers' && method === 'POST') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Only administrators can register or invite new researchers.' });
      }
      const data = await readJsonBody();
      const {
        firstName,
        middleInitial,
        lastName,
        instructorId,
        password,
        department = 'BSIT',
        isFaculty = true,
        photoUrl,
        email,
        scholarUrl,
        googleScholarId,
        sendInvite = true,
        invitationRequestId,
      } = data;

      if (!firstName || !lastName || !instructorId) {
        return sendJson(400, { error: 'First name, last name, and instructor ID are required' });
      }

      const trimmedInstId = instructorId.trim();
      const trimmedEmail = (email || '').trim().toLowerCase();
      const mi = (middleInitial || '').trim();

      if (!trimmedEmail) {
        return sendJson(400, { error: 'Email address is required to send verification & invitation.' });
      }

      // Check if instructor ID or username exists
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedInstId);
      if (existing) {
        return sendJson(400, { error: 'That Instructor ID is already registered.' });
      }

      const existingRes = db.prepare('SELECT id FROM researchers WHERE LOWER(instructor_id) = LOWER(?)').get(trimmedInstId);
      if (existingRes) {
        return sendJson(400, { error: 'That Instructor ID is already registered to a researcher.' });
      }

      const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(trimmedEmail);
      if (existingEmail) {
        return sendJson(400, { error: 'That email address is already in use.' });
      }

      // Extract scholar ID if URL passed
      let parsedScholarId = googleScholarId || null;
      if (!parsedScholarId && scholarUrl) {
        const uMatch = scholarUrl.match(/[?&]user=([a-zA-Z0-9_-]+)/);
        if (uMatch) parsedScholarId = uMatch[1];
      }

      const userId = `user-${Date.now()}`;
      const researcherId = `res-${Date.now()}`;
      const fullName = mi ? `${firstName.trim()} ${mi} ${lastName.trim()}` : `${firstName.trim()} ${lastName.trim()}`;
      const now = new Date().toISOString();

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      // If admin didn't provide a password or opted for invite flow, generate temporary random string
      const initialPassword = password ? password.trim() : crypto.randomBytes(8).toString('hex');
      const initialStatus = sendInvite ? 'pending_verification' : 'active';

      // 1. Insert into users table
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, middle_initial, role, department, is_faculty, photo_url, scholar_url, google_scholar_id, status, verification_token, verification_token_expires_at, registration_type, has_scholar, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?, ?, ?, ?, ?, 'admin_invite', ?, ?)
      `).run(
        userId,
        trimmedInstId,
        trimmedEmail,
        hashPassword(initialPassword),
        fullName,
        mi || null,
        department,
        isFaculty ? 1 : 0,
        photoUrl || null,
        scholarUrl || null,
        parsedScholarId || null,
        initialStatus,
        sendInvite ? token : null,
        sendInvite ? expiresAt : null,
        scholarUrl ? 1 : 0,
        now
      );

      // 2. Insert into researchers table
      db.prepare(`
        INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, middle_initial, name, email, department, is_faculty, photo_url, scholar_url, google_scholar_id, status, has_scholar, total_publications, total_citations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      `).run(
        researcherId,
        userId,
        trimmedInstId,
        firstName.trim(),
        lastName.trim(),
        mi || null,
        fullName,
        trimmedEmail,
        department,
        isFaculty ? 1 : 0,
        photoUrl || null,
        scholarUrl || null,
        parsedScholarId || null,
        initialStatus,
        scholarUrl ? 1 : 0,
        now
      );

      // If invited from an invitation request, mark request as invited
      if (invitationRequestId) {
        try {
          db.prepare("UPDATE invitation_requests SET status = 'invited' WHERE id = ?").run(invitationRequestId);
        } catch (err) {
          console.warn('Could not update invitation_requests status:', err);
        }
      }

      // Synchronize any pre-existing matching publications
      updateResearcherStats(db, researcherId);
      const savedResearcher = db.prepare('SELECT * FROM researchers WHERE id = ?').get(researcherId);

      // 3. Dispatch invitation email if sendInvite is true
      let verificationLink = null;
      if (sendInvite) {
        const baseUrl = getAppBaseUrl(req);
        const emailRes = await sendAdminInvitationEmail({
          email: trimmedEmail,
          name: fullName,
          instructorId: trimmedInstId,
          department,
          token,
          baseUrl,
        });
        verificationLink = emailRes.link;
      }

      return sendJson(201, {
        success: true,
        message: sendInvite
          ? `Invitation sent to ${trimmedEmail}! The researcher will verify and set their preferred password.`
          : 'Researcher created and activated successfully.',
        verificationLink,
        researcher: {
          id: researcherId,
          instructorId: trimmedInstId,
          name: fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: trimmedEmail,
          department,
          isFaculty: Boolean(isFaculty),
          photoUrl: photoUrl || null,
          scholarUrl: scholarUrl || null,
          googleScholarId: parsedScholarId || null,
          status: initialStatus,
          totalPublications: savedResearcher?.total_publications || 0,
          totalCitations: savedResearcher?.total_citations || 0,
        }
      });
    }

    // ----------------------------------------------------
    // PUBLIC: POST /api/invitation-requests
    // ----------------------------------------------------
    if (pathname === '/api/invitation-requests' && method === 'POST') {
      const data = await readJsonBody();
      const {
        firstName,
        lastName,
        middleInitial,
        email,
        instructorId,
        scholarUrl,
      } = data;

      if (!firstName || !lastName || !instructorId || !email) {
        return sendJson(400, { error: 'First name, last name, email, and Instructor ID are required.' });
      }

      const trimmedInstId = instructorId.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const mi = (middleInitial || '').trim();
      const fullName = mi ? `${firstName.trim()} ${mi} ${lastName.trim()}` : `${firstName.trim()} ${lastName.trim()}`;

      if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        return sendJson(400, { error: 'Please enter a valid email address.' });
      }

      // Check if account already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)').get(trimmedInstId, trimmedEmail);
      if (existingUser) {
        return sendJson(400, { error: 'An account with this Instructor ID or email already exists. You can sign in directly or ask the administrator to reset your password.' });
      }

      // Check if pending request already submitted
      const existingRequest = db.prepare("SELECT id FROM invitation_requests WHERE (LOWER(instructor_id) = LOWER(?) OR LOWER(email) = LOWER(?)) AND status = 'pending'").get(trimmedInstId, trimmedEmail);
      if (existingRequest) {
        return sendJson(400, { error: 'An invitation request for this Instructor ID or email is already pending review by Sir Rodelio M. Garin.' });
      }

      const reqId = `req-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO invitation_requests (id, first_name, last_name, middle_initial, name, email, instructor_id, scholar_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        reqId,
        firstName.trim(),
        lastName.trim(),
        mi || null,
        fullName,
        trimmedEmail,
        trimmedInstId,
        (scholarUrl || '').trim() || null,
        now
      );

      return sendJson(201, {
        success: true,
        message: 'Your invitation request has been submitted successfully! Sir Rodelio M. Garin will review your credentials and issue your official invitation link.',
      });
    }

    // ----------------------------------------------------
    // ADMIN ENDPOINTS GUARD: Only administrators can access /api/admin/*
    // ----------------------------------------------------
    if (pathname.startsWith('/api/admin/')) {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Administrator privileges required.' });
      }
    }

    // ----------------------------------------------------
    // ADMIN: GET /api/admin/invitation-requests
    // ----------------------------------------------------
    if (pathname === '/api/admin/invitation-requests' && method === 'GET') {
      const rows = db.prepare("SELECT * FROM invitation_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
      return sendJson(200, rows);
    }

    // ----------------------------------------------------
    // ADMIN: POST /api/admin/invitation-requests/:id/dismiss
    // ----------------------------------------------------
    if (pathname.startsWith('/api/admin/invitation-requests/') && pathname.endsWith('/dismiss') && method === 'POST') {
      const reqId = pathname.replace('/api/admin/invitation-requests/', '').replace('/dismiss', '');
      const reqRow = db.prepare('SELECT * FROM invitation_requests WHERE id = ?').get(reqId);
      if (reqRow) {
        const declineId = `dec-req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO declined_registrations (
            id, original_request_id, original_user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, scholar_url, google_scholar_id, registration_type, decline_reason, declined_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          declineId,
          reqRow.id,
          null,
          reqRow.instructor_id,
          reqRow.first_name || null,
          reqRow.last_name || null,
          reqRow.name,
          reqRow.email || null,
          reqRow.department || null,
          reqRow.is_faculty ? 1 : 0,
          reqRow.scholar_url || null,
          null,
          'invitation_request',
          'Dismissed by administrator',
          now
        );
      }
      db.prepare("UPDATE invitation_requests SET status = 'rejected' WHERE id = ?").run(reqId);
      return sendJson(200, { success: true, message: 'Invitation request dismissed and archived.' });
    }

    // ----------------------------------------------------
    // ADMIN: GET /api/admin/pending-registrations
    // ----------------------------------------------------
    if (pathname === '/api/admin/pending-registrations' && method === 'GET') {
      const rows = db.prepare(`
        SELECT 
          r.*, 
          u.status as user_status, 
          u.registration_type, 
          u.email_verified_at, 
          u.verification_token, 
          u.has_scholar,
          u.created_at as registered_at
        FROM researchers r
        JOIN users u ON r.user_id = u.id
        WHERE r.status != 'active' AND r.status != 'rejected'
        ORDER BY r.created_at DESC
      `).all();

      return sendJson(200, rows.map((r) => ({
        id: r.id,
        name: r.name,
        firstName: r.first_name,
        lastName: r.last_name,
        instructorId: r.instructor_id,
        email: r.email,
        department: r.department,
        isFaculty: Boolean(r.is_faculty),
        scholarUrl: r.scholar_url,
        googleScholarId: r.google_scholar_id,
        status: r.status,
        registrationType: r.registration_type || 'manual',
        isEmailVerified: Boolean(r.email_verified_at),
        emailVerifiedAt: r.email_verified_at,
        verificationToken: r.verification_token,
        hasScholar: Boolean(r.has_scholar),
        createdAt: r.created_at,
      })));
    }

    // ----------------------------------------------------
    // ADMIN: POST /api/admin/admit-registration
    // ----------------------------------------------------
    if (pathname === '/api/admin/admit-registration' && method === 'POST') {
      const { instructorId, researcherId } = await readJsonBody();
      const targetId = (instructorId || researcherId || '').trim();

      const r = db.prepare('SELECT * FROM researchers WHERE id = ? OR LOWER(instructor_id) = LOWER(?)').get(targetId, targetId);
      if (!r) {
        return sendJson(404, { error: 'Researcher registration not found.' });
      }

      db.prepare("UPDATE researchers SET status = 'active' WHERE id = ?").run(r.id);
      db.prepare("UPDATE users SET status = 'active' WHERE id = ? OR LOWER(username) = LOWER(?)").run(r.user_id || '', r.instructor_id);

      updateResearcherStats(db, r.id);

      // Send approval notification email
      const baseUrl = getAppBaseUrl(req);
      if (r.email) {
        await sendRegistrationApprovedEmail({
          email: r.email,
          name: r.name,
          instructorId: r.instructor_id,
          baseUrl,
        });
      }

      return sendJson(200, {
        success: true,
        message: `${r.name} has been officially admitted and activated as a PSU researcher!`,
      });
    }

    // ----------------------------------------------------
    // ADMIN: POST /api/admin/reject-registration
    // ----------------------------------------------------
    if (pathname === '/api/admin/reject-registration' && method === 'POST') {
      const { instructorId, researcherId, reason } = await readJsonBody();
      const targetId = (instructorId || researcherId || '').trim();

      const r = db.prepare('SELECT * FROM researchers WHERE id = ? OR LOWER(instructor_id) = LOWER(?)').get(targetId, targetId);
      if (!r) {
        return sendJson(404, { error: 'Researcher registration not found.' });
      }

      const u = db.prepare('SELECT * FROM users WHERE id = ? OR LOWER(username) = LOWER(?)').get(r.user_id || '', r.instructor_id);

      // 1. Relocate to declined_registrations table for audit history
      const declineId = `dec-reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO declined_registrations (
          id, original_request_id, original_user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, scholar_url, google_scholar_id, registration_type, decline_reason, declined_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        declineId,
        r.id,
        r.user_id || null,
        r.instructor_id,
        r.first_name || null,
        r.last_name || null,
        r.name,
        r.email || null,
        r.department || null,
        r.is_faculty ? 1 : 0,
        r.scholar_url || null,
        r.google_scholar_id || null,
        u?.registration_type || 'self_registration',
        reason ? reason.trim() : 'Declined by administrator',
        now
      );

      // 2. Cascade delete any staged publications
      deleteResearcherPublications(db, r);

      // 3. Purge from active researchers and users tables to release Instructor ID and email
      db.prepare('DELETE FROM researchers WHERE id = ?').run(r.id);
      db.prepare("DELETE FROM users WHERE (id = ? OR LOWER(username) = LOWER(?)) AND role != 'admin'").run(r.user_id || '', r.instructor_id);
      cleanupOrphanedPublications(db);

      return sendJson(200, {
        success: true,
        message: `Registration for ${r.name} has been declined and archived. Instructor ID ${r.instructor_id} is now released.`,
      });
    }

    // ----------------------------------------------------
    // ADMIN: POST /api/admin/resend-invite
    // ----------------------------------------------------
    if (pathname === '/api/admin/resend-invite' && method === 'POST') {
      const { instructorId, researcherId } = await readJsonBody();
      const targetId = (instructorId || researcherId || '').trim();

      const r = db.prepare('SELECT * FROM researchers WHERE id = ? OR LOWER(instructor_id) = LOWER(?)').get(targetId, targetId);
      if (!r) {
        return sendJson(404, { error: 'Researcher not found.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ? OR LOWER(username) = LOWER(?)').get(r.user_id || '', r.instructor_id);
      if (!user) {
        return sendJson(404, { error: 'User account not found.' });
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      db.prepare(`
        UPDATE users 
        SET verification_token = ?, verification_token_expires_at = ? 
        WHERE id = ?
      `).run(token, expiresAt, user.id);

      const baseUrl = getAppBaseUrl(req);
      let emailResult;

      if (user.registration_type === 'self_registration' && !user.email_verified_at) {
        emailResult = await sendSelfRegisterVerificationEmail({
          email: user.email || r.email,
          name: user.name,
          instructorId: user.username,
          token,
          baseUrl,
        });
      } else {
        emailResult = await sendAdminInvitationEmail({
          email: user.email || r.email,
          name: user.name,
          instructorId: user.username,
          department: user.department,
          token,
          baseUrl,
        });
      }

      return sendJson(200, {
        success: true,
        message: `Verification / invitation email successfully resent to ${user.email || r.email}.`,
        verificationLink: emailResult.link,
      });
    }

    // ----------------------------------------------------
    // ADMIN: GET /api/admin/email-logs
    // ----------------------------------------------------
    if (pathname === '/api/admin/email-logs' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50').all();
      return sendJson(200, rows);
    }

    // PUT /api/researchers/:id
    if (pathname.startsWith('/api/researchers/') && method === 'PUT') {
      const id = pathname.replace('/api/researchers/', '');
      const data = await readJsonBody();
      const current = db.prepare('SELECT * FROM researchers WHERE id = ? OR instructor_id = ?').get(id, id);
      if (!current) {
        return sendJson(404, { error: 'Researcher not found' });
      }

      // Server-Side Ownership Check: Caller must be admin or the target researcher
      const caller = authenticateCaller(req);
      if (!canCallerModifyResearcher(current, caller)) {
        return sendJson(403, { error: 'Forbidden: You cannot modify another faculty member’s profile.' });
      }

      // Input Whitelisting: Strips unauthorized role/status elevation
      const sanitized = sanitizeResearcherInput(data, caller);
      const firstName = sanitized.firstName || current.first_name;
      const lastName = sanitized.lastName || current.last_name;
      const fullName = `${firstName} ${lastName}`;
      const department = sanitized.department || current.department;
      const isFaculty = sanitized.isFaculty !== undefined ? (sanitized.isFaculty ? 1 : 0) : current.is_faculty;
      const photoUrl = sanitized.photoUrl !== undefined ? sanitized.photoUrl : current.photo_url;
      let scholarUrl = sanitized.scholarUrl !== undefined ? sanitized.scholarUrl : current.scholar_url;
      let googleScholarId = sanitized.googleScholarId !== undefined ? sanitized.googleScholarId : current.google_scholar_id;

      if (scholarUrl && !googleScholarId) {
        const uMatch = scholarUrl.match(/[?&]user=([a-zA-Z0-9_-]+)/);
        if (uMatch) googleScholarId = uMatch[1];
      }

      db.prepare(`
        UPDATE researchers 
        SET first_name = ?, last_name = ?, name = ?, department = ?, is_faculty = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?
        WHERE id = ?
      `).run(firstName, lastName, fullName, department, isFaculty, photoUrl, scholarUrl || null, googleScholarId || null, current.id);

      const newInstId = sanitized.instructorId ? sanitized.instructorId.trim() : current.instructor_id;
      if (newInstId && newInstId !== current.instructor_id) {
        db.prepare('UPDATE researchers SET instructor_id = ? WHERE id = ?').run(newInstId, current.id);
        if (current.user_id) {
          const userRec = db.prepare('SELECT role FROM users WHERE id = ?').get(current.user_id);
          if (userRec && userRec.role !== 'admin') {
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newInstId, current.user_id);
          }
        }
        const oldIds = [current.instructor_id, current.id].filter(Boolean);
        for (const oldId of oldIds) {
          db.prepare('UPDATE publications SET owner_id = ?, owner_name = ? WHERE LOWER(owner_id) = LOWER(?)')
            .run(newInstId, fullName, oldId);
          db.prepare('UPDATE ai_chat_sessions SET user_id = ? WHERE LOWER(user_id) = LOWER(?)')
            .run(newInstId, oldId);
          db.prepare('UPDATE invitation_requests SET instructor_id = ? WHERE LOWER(instructor_id) = LOWER(?)')
            .run(newInstId, oldId);
        }
      }

      // Update associated user record if password or details changed
      if (current.user_id) {
        if (sanitized.password) {
          db.prepare('UPDATE users SET name = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?, password = ? WHERE id = ?')
            .run(fullName, department, photoUrl, scholarUrl || null, googleScholarId || null, hashPassword(sanitized.password), current.user_id);
        } else {
          db.prepare('UPDATE users SET name = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ? WHERE id = ?')
            .run(fullName, department, photoUrl, scholarUrl || null, googleScholarId || null, current.user_id);
        }
      }

      return sendJson(200, { success: true, message: 'Researcher updated successfully' });
    }

    // DELETE /api/researchers/:id
    if (pathname.startsWith('/api/researchers/') && method === 'DELETE') {
      const id = pathname.replace('/api/researchers/', '');
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Only administrators can remove researcher records.' });
      }

      const current = db.prepare('SELECT * FROM researchers WHERE id = ? OR LOWER(instructor_id) = LOWER(?)').get(id, id);
      let deletedPubsCount = 0;
      if (current) {
        // 1. Gather publication snapshot for the archive
        const rInstId = (current.instructor_id || '').trim().toLowerCase();
        const rId = (current.id || '').trim().toLowerCase();
        const rUserId = (current.user_id || '').trim().toLowerCase();
        const rName = (current.name || '').trim().toLowerCase();

        const allPubs = db.prepare('SELECT * FROM publications').all();
        const researcherPubs = allPubs.filter((p) => {
          const pOwnerId = (p.owner_id || '').trim().toLowerCase();
          const pOwnerName = (p.owner_name || '').trim().toLowerCase();
          if (pOwnerId && (pOwnerId === rInstId || pOwnerId === rId || (rUserId && pOwnerId === rUserId))) return true;
          if (pOwnerName && rName && pOwnerName === rName) return true;
          return false;
        });

        const pubsSnapshot = researcherPubs.map((p) => ({
          id: p.id,
          title: p.title,
          journal: p.journal,
          year: p.year,
          citations: p.citations,
          doi: p.doi,
          url: p.url,
          approvalStatus: p.approval_status,
        }));

        // 2. Relocate snapshot into archived_researchers table
        const archiveId = `arch-res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO archived_researchers (
            id, original_researcher_id, original_user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, affiliation, photo_url, scholar_url, google_scholar_id, total_publications, total_citations, publications_snapshot, archive_reason, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          archiveId,
          current.id,
          current.user_id || null,
          current.instructor_id,
          current.first_name || null,
          current.last_name || null,
          current.name,
          current.email || null,
          current.department || null,
          current.is_faculty ? 1 : 0,
          current.affiliation || null,
          current.photo_url || null,
          current.scholar_url || null,
          current.google_scholar_id || null,
          current.total_publications || 0,
          current.total_citations || 0,
          JSON.stringify(pubsSnapshot),
          'Deleted by administrator',
          now
        );

        // 3. Cascade delete all publications, citing papers, and citation trends from active repository
        deletedPubsCount = deleteResearcherPublications(db, current);

        // 4. Delete researcher record from active researchers table
        db.prepare('DELETE FROM researchers WHERE id = ?').run(current.id);

        // 5. Delete associated user login (preserve main admin account if admin was also listed in researchers)
        if (current.user_id) {
          db.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'").run(current.user_id);
        } else if (current.instructor_id) {
          db.prepare("DELETE FROM users WHERE LOWER(username) = LOWER(?) AND role != 'admin'").run(current.instructor_id);
        }
      }

      // 6. Clean up any remaining orphaned publications
      cleanupOrphanedPublications(db);

      return sendJson(200, {
        success: true,
        deletedPublicationsCount: deletedPubsCount,
        message: current
          ? `Archived researcher ${current.name} and removed ${deletedPubsCount} publication(s) from the active repository. Instructor ID ${current.instructor_id} is now available.`
          : 'Researcher deleted successfully',
      });
    }

    // ----------------------------------------------------
    // ADMIN: GET /api/admin/archived-researchers
    // ----------------------------------------------------
    if (pathname === '/api/admin/archived-researchers' && method === 'GET') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Administrator privileges required.' });
      }
      const rows = db.prepare('SELECT * FROM archived_researchers ORDER BY archived_at DESC').all();
      return sendJson(200, rows);
    }

    // ----------------------------------------------------
    // ADMIN: GET /api/admin/declined-registrations
    // ----------------------------------------------------
    if (pathname === '/api/admin/declined-registrations' && method === 'GET') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Administrator privileges required.' });
      }
      const rows = db.prepare('SELECT * FROM declined_registrations ORDER BY declined_at DESC').all();
      return sendJson(200, rows);
    }

    // ----------------------------------------------------
    // 4. PUBLICATIONS CRUD
    // ----------------------------------------------------
    if (pathname === '/api/publications' && method === 'GET') {
      cleanupOrphanedPublications(db);
      const caller = authenticateCaller(req);
      const allRows = db.prepare('SELECT * FROM publications ORDER BY year DESC, citations DESC').all();

      // Application-Level Tenant Isolation (The SQLite equivalent of RLS):
      // Admins see all; Instructors see public approved + their own drafts; Guests see public approved only
      const rows = filterPublicationsForCaller(allRows, caller);

      // Batch-fetch all citing papers
      const allCiting = db.prepare('SELECT id, publication_id, title, authors, year, link, journal, volume_issue, quarter, doi_issn FROM citing_papers').all();
      const citingByPubId = {};
      for (const cp of allCiting) {
        if (!citingByPubId[cp.publication_id]) {
          citingByPubId[cp.publication_id] = [];
        }
        citingByPubId[cp.publication_id].push({
          id: cp.id,
          title: cp.title,
          authors: cp.authors,
          year: cp.year,
          link: cp.link,
          journal: cp.journal || '',
          volume_issue: cp.volume_issue || '',
          quarter: cp.quarter || 'First',
          doi_issn: cp.doi_issn || '',
        });
      }

      const pubs = rows.map((p) => {
        const rawId = p.id.replace(/^(admin-|claim-)/, '');
        const citing = citingByPubId[p.id] || citingByPubId[rawId] || [];

        let citedByLink = p.cited_by_link;
        if (!citedByLink) {
          const scraped = db.prepare('SELECT cited_by_link FROM scraped_publications WHERE id = ? OR id = ?').get(p.id, rawId);
          if (scraped?.cited_by_link) {
            citedByLink = scraped.cited_by_link;
          }
        }

        const jc3 = p.jc3_points !== null && p.jc3_points !== undefined
          ? Number(p.jc3_points)
          : (p.nbc461_points ? (p.nbc461_points >= 25 ? 50.0 : p.nbc461_points >= 15 ? 30.0 : p.nbc461_points >= 10 ? 20.0 : 10.0) : 10.0);

        return {
          ...p,
          authors: JSON.parse(p.authors || '[]'),
          isPublic: Boolean(p.is_public),
          jc3Points: jc3,
          jc3_points: jc3,
          nbc461Points: p.nbc461_points,
          citedByLink: citedByLink || null,
          citingPapers: citing,
        };
      });
      return sendJson(200, pubs);
    }

    if (pathname.startsWith('/api/publications/') && method === 'GET') {
      const id = pathname.replace('/api/publications/', '');
      const rawId = id.replace(/^(admin-|claim-)/, '');
      let p = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
      let isScraped = false;

      // Also check scraped_publications if not found in main table
      if (!p) {
        const scraped = db.prepare('SELECT * FROM scraped_publications WHERE id = ? OR id = ?').get(id, rawId);
        if (scraped) {
          isScraped = true;
          p = {
            id: scraped.id,
            title: scraped.title,
            authors: scraped.authors,
            journal: scraped.journal,
            year: scraped.year,
            citations: scraped.citations,
            abstract: scraped.abstract,
            url: scraped.url,
            cited_by_link: scraped.cited_by_link,
            impact_score: 0,
            is_public: 1,
            approval_status: 'approved',
          };
        }
      }

      if (!p) {
        return sendJson(404, { error: 'Publication not found' });
      }

      // Application-Level Tenant Isolation: Check if caller is permitted to view this publication
      const caller = authenticateCaller(req);
      if (!canCallerAccessPublication(p, caller)) {
        return sendJson(404, { error: 'Publication not found' });
      }

      // If cited_by_link is empty on the publication, attempt fallback lookup in scraped_publications
      let citedByLink = p.cited_by_link;
      if (!citedByLink) {
        const scraped = db.prepare('SELECT cited_by_link FROM scraped_publications WHERE id = ? OR id = ?').get(id, rawId);
        if (scraped?.cited_by_link) {
          citedByLink = scraped.cited_by_link;
        }
      }

      if (!citedByLink && Number(p.citations) > 0 && p.title) {
        try {
          const directResults = await scrapeGoogleScholarDirect(p.title, 1);
          if (directResults.length > 0 && directResults[0].citedByLink) {
            citedByLink = directResults[0].citedByLink;
            db.prepare('UPDATE publications SET cited_by_link = ? WHERE id = ?').run(citedByLink, id);
          }
        } catch (e) {
          console.warn('[AutoFetchCitations] Fallback search error:', e.message);
        }
      }

      const trends = db.prepare('SELECT year, citations, id FROM citation_trends WHERE publication_id = ? OR publication_id = ? ORDER BY year ASC').all(id, rawId);
      let citing = db.prepare('SELECT id, title, authors, year, link, journal, volume_issue, quarter, doi_issn FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);

      // Enrich parent publication metadata if missing keywords, ISSN/DOI, volume/issue, or full co-authors
      if (!isScraped && (!p.keywords || !p.issn_isbn || !p.volume_issue || String(p.authors || '').includes('…'))) {
        try {
          const parsedAuthors = JSON.parse(p.authors || '[]');
          const enrichTarget = {
            ...p,
            authors: parsedAuthors,
          };
          await enrichPaperWithCrossRef(enrichTarget);
          const updatedAuthorsJson = JSON.stringify(Array.isArray(enrichTarget.authors) ? enrichTarget.authors : parsedAuthors);
          db.prepare(`
            UPDATE publications
            SET authors = ?, journal = COALESCE(?, journal), keywords = COALESCE(?, keywords),
                issn_isbn = COALESCE(?, issn_isbn), volume_issue = COALESCE(?, volume_issue),
                publication_date = COALESCE(?, publication_date), doi = COALESCE(?, doi)
            WHERE id = ?
          `).run(
            updatedAuthorsJson,
            enrichTarget.journal || p.journal,
            enrichTarget.keywords || null,
            enrichTarget.issn_isbn || null,
            enrichTarget.volume_issue || null,
            enrichTarget.publication_date || null,
            enrichTarget.doi || null,
            id
          );
          p = db.prepare('SELECT * FROM publications WHERE id = ?').get(id) || p;
        } catch (enrichErr) {
          console.warn('[EnrichPublication] Metadata enrichment error:', enrichErr.message);
        }
      }

      const totalPaperCitations = Number(p.citations) || 0;
      const isForceRefresh = url.searchParams.get('refresh') === 'true' || url.searchParams.get('force') === 'true';
      if (isForceRefresh) {
        syncedPublicationsCache.delete(id);
      }

      // Auto-fetch or backfill citing papers if missing or incomplete compared to total recorded citations
      if (totalPaperCitations > 0 && (isForceRefresh || citing.length === 0 || citing.length < totalPaperCitations)) {
        try {
          if (isForceRefresh || citing.length === 0 || totalPaperCitations <= 600) {
            // Synchronously ensure complete citations for fast and accurate UI rendering
            await syncSinglePublicationCitations(id, totalPaperCitations, isForceRefresh);
            citing = db.prepare('SELECT id, title, authors, year, link, journal, volume_issue, quarter, doi_issn FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);
          } else {
            // For papers with over 600 citations, enqueue background backfill
            enqueuePublicationCitationSync([id]);
          }
        } catch (err) {
          console.warn('[AutoFetchCitations] Error syncing citing papers:', err.message);
        }
      }

      // If existing citing papers lack journal, year, volume/issue, or full authors, enrich a batch with CrossRef + OpenAlex and persist
      const needsCitingEnrich = citing.filter((c) =>
        !c.year ||
        c.year < 1990 ||
        !c.volume_issue ||
        !c.journal ||
        c.journal === 'Academic Journal' ||
        c.journal === 'Academic Publication' ||
        c.journal.includes('(ACS)') ||
        !c.authors ||
        c.authors === 'Academic Authors' ||
        String(c.authors || '').includes('…') ||
        /\.s\d+$/i.test(c.doi_issn || '')
      ).slice(0, 20);
      if (needsCitingEnrich.length > 0) {
        try {
          await enrichBatchWithCrossRef(needsCitingEnrich, 5);
          const updCiteStmt = db.prepare(`
            UPDATE citing_papers
            SET authors = ?, journal = ?, volume_issue = ?, year = COALESCE(?, year), quarter = ?, doi_issn = ?, link = COALESCE(?, link)
            WHERE id = ?
          `);
          for (const c of needsCitingEnrich) {
            if (!c.id) continue;
            const cAuthors = Array.isArray(c.authors) ? c.authors.join(', ') : (c.authors || 'Academic Authors');
            updCiteStmt.run(
              cAuthors,
              c.journal || 'Academic Journal',
              c.volume_issue || '',
              c.year || null,
              c.quarter || 'First',
              c.doi_issn || '',
              c.link || null,
              c.id
            );
          }
          citing = db.prepare('SELECT id, title, authors, year, link, journal, volume_issue, quarter, doi_issn FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);
        } catch (cErr) {
          console.warn('[EnrichCitingPapers] Error enriching citing papers:', cErr.message);
        }
      }

      // Recompute citationTrend from actual citing_papers years so the chart is always accurate
      const computedYearCounts = computePublicationCitationYears(db, p);
      const computedTrends = Object.entries(computedYearCounts)
        .map(([yrStr, cnt]) => ({
          id: `trend-${id}-${yrStr}`,
          year: Number(yrStr),
          citations: Number(cnt),
        }))
        .sort((a, b) => a.year - b.year);

      // Refresh citing array after year inference updates
      citing = db.prepare('SELECT id, title, authors, year, link, journal, volume_issue, quarter, doi_issn FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);

      const jc3 = p.jc3_points !== null && p.jc3_points !== undefined
        ? Number(p.jc3_points)
        : (p.nbc461_points ? (p.nbc461_points >= 25 ? 50.0 : p.nbc461_points >= 15 ? 30.0 : p.nbc461_points >= 10 ? 20.0 : 10.0) : 10.0);

      return sendJson(200, {
        ...p,
        authors: JSON.parse(p.authors || '[]'),
        isPublic: Boolean(p.is_public),
        jc3Points: jc3,
        jc3_points: jc3,
        nbc461Points: p.nbc461_points,
        citationTrend: computedTrends.length > 0 ? computedTrends : trends,
        citingPapers: citing,
        citedByLink: citedByLink || null,
      });
    }

    if (pathname === '/api/publications' && method === 'POST') {
      const data = await readJsonBody();
      if (!data.title || !data.title.trim()) {
        return sendJson(400, { error: 'Publication title is required' });
      }

      const caller = authenticateCaller(req);
      // Input Whitelisting: Sanitize input and enforce status/ownership constraints
      const sanitized = sanitizePublicationInput(data, caller, true);

      // STRICT RESEARCHER ASSIGNMENT CHECK:
      // Every publication must be tied to a registered researcher in the system.
      if (isCallerAdmin(caller)) {
        const requestedOwnerId = (data.ownerId || '').trim();
        if (!requestedOwnerId || requestedOwnerId.toLowerCase() === 'admin') {
          return sendJson(400, {
            error: 'Publication must be assigned to a specific registered researcher in the system before saving to the repository.',
          });
        }

        const assignedResearcher = db.prepare(`
          SELECT * FROM researchers
          WHERE (LOWER(instructor_id) = LOWER(?) OR id = ?)
            AND (status IS NULL OR status != 'rejected')
          LIMIT 1
        `).get(requestedOwnerId, requestedOwnerId);

        if (!assignedResearcher) {
          return sendJson(400, {
            error: 'Selected researcher is not registered in the system. Please assign this publication to a registered researcher.',
          });
        }

        sanitized.ownerId = assignedResearcher.instructor_id;
        sanitized.ownerName = assignedResearcher.name;
        sanitized.approvalStatus = 'approved';
      } else {
        // Researcher / Instructor claiming or submitting their own publication:
        // Must be a registered researcher, assigned to themselves, and requires Admin (Sir Garin) approval.
        const candidateId = (caller?.instructorId || caller?.username || data.ownerId || '').trim();
        const callerResearcher = db.prepare(`
          SELECT * FROM researchers
          WHERE (
            LOWER(instructor_id) = LOWER(?) OR
            user_id = ? OR
            id = ?
          ) AND (status IS NULL OR status != 'rejected')
          LIMIT 1
        `).get(candidateId, caller?.id || '', candidateId);

        if (!callerResearcher) {
          return sendJson(400, {
            error: 'Your researcher profile must be registered in the system to assign and claim publications.',
          });
        }

        if (
          data.ownerId &&
          data.ownerId.trim().toLowerCase() !== callerResearcher.instructor_id.toLowerCase() &&
          data.ownerId.trim().toLowerCase() !== callerResearcher.id.toLowerCase()
        ) {
          return sendJson(403, {
            error: 'Researchers can only assign and claim publications to themselves.',
          });
        }

        sanitized.ownerId = callerResearcher.instructor_id;
        sanitized.ownerName = callerResearcher.name;
        sanitized.approvalStatus = 'pending'; // Must be approved by System Administrator (Sir Garin)
      }

      // 1. Strict Deduplication Check: Check existing publications using normalized title
      const normInput = normalizeTitle(sanitized.title);
      const allExisting = db.prepare('SELECT id, title, citations, abstract, url, cited_by_link, sdg_tags, owner_id, owner_name, approval_status FROM publications').all();
      const existing = allExisting.find((p) => normalizeTitle(p.title) === normInput);

      if (existing) {
        if (existing.approval_status === 'rejected') {
          db.prepare('DELETE FROM publications WHERE id = ?').run(existing.id);
        } else {
          // Prevent duplicate creation: update metrics on existing record instead
          const higherCitations = Math.max(existing.citations || 0, Number(sanitized.citations) || 0);
          const bestUrl = sanitized.url || existing.url;
          const bestAbstract = (sanitized.abstract && sanitized.abstract.length > (existing.abstract || '').length) ? sanitized.abstract : existing.abstract;
          const bestCitedByLink = sanitized.citedByLink || existing.cited_by_link;

          db.prepare(`
            UPDATE publications
            SET citations = ?, url = ?, abstract = ?, cited_by_link = ?
            WHERE id = ?
          `).run(higherCitations, bestUrl, bestAbstract, bestCitedByLink, existing.id);

          return sendJson(200, {
            success: true,
            id: existing.id,
            isDuplicate: true,
            alreadyExists: true,
            ownerId: existing.owner_id,
            ownerName: existing.owner_name,
            approvalStatus: existing.approval_status,
            message: `Publication already exists in repository ("${existing.title}") assigned to ${existing.owner_name}.`,
          });
        }
      }

      const id = data.id || `pub-${Date.now()}`;
      const now = new Date().toISOString();

      // Enforce SDG classification & journal audit on newly created publications
      let sdgTagsJson = sanitized.sdgTags ? JSON.stringify(sanitized.sdgTags) : null;
      let sdgRationale = sanitized.sdgRationale || null;
      let chedPriority = sanitized.chedPriority || null;
      let journalIndex = sanitized.journalIndexing || null;
      let jc3Points = sanitized.jc3Points !== null && sanitized.jc3Points !== undefined ? sanitized.jc3Points : null;
      let nbcPoints = sanitized.nbc461Points !== null ? sanitized.nbc461Points : 5.0;
      let isPredatory = sanitized.isPredatoryFlag !== null ? (sanitized.isPredatoryFlag ? 1 : 0) : 0;

      if (!sdgTagsJson) {
        try {
          const sdgResult = await classifyPublicationSDG(sanitized.title, sanitized.abstract || '', sanitized.journal || '', data.doi || '');
          const validTags = [sdgResult.primarySDG, sdgResult.secondarySDG].filter(Boolean);
          sdgTagsJson = JSON.stringify(validTags.length > 0 ? validTags : ['Pending Review']);
          sdgRationale = sdgResult.rationale || 'Pending coordinator verification.';
          chedPriority = sdgResult.chedPriority || '';
        } catch {
          sdgTagsJson = JSON.stringify(['Pending Review']);
          sdgRationale = 'Classification pending coordinator verification.';
        }
      }

      // Enrich publication metadata (all co-authors, ISSN/DOI, volume/issue, publication date, keywords)
      const enrichPayload = {
        title: sanitized.title,
        authors: Array.isArray(sanitized.authors) ? sanitized.authors : [sanitized.authors],
        journal: sanitized.journal || 'Research Journal',
        year: Number(sanitized.year) || new Date().getFullYear(),
        abstract: sanitized.abstract || '',
        url: sanitized.url || '',
        keywords: data.keywords || '',
        issn_isbn: data.issn_isbn || data.issnIsbn || '',
        volume_issue: data.volume_issue || data.volumeIssue || '',
        publication_date: data.publication_date || data.publicationDate || '',
        doi: data.doi || '',
      };
      await enrichPaperWithCrossRef(enrichPayload);
      sanitized.authors = Array.isArray(enrichPayload.authors) ? enrichPayload.authors : [enrichPayload.authors];
      sanitized.journal = enrichPayload.journal || sanitized.journal;
      sanitized.url = enrichPayload.url || sanitized.url;

      if (!journalIndex || jc3Points === null) {
        const audit = auditJournalReputation(sanitized.journal || '');
        if (!journalIndex) journalIndex = audit.indexing;
        if (jc3Points === null) jc3Points = audit.jc3Points;
        nbcPoints = audit.nbc461Points;
        isPredatory = audit.isPredatory;
      }

      db.prepare(`
        INSERT INTO publications (
          id, title, authors, journal, year, citations, abstract, url,
          impact_score, owner_id, owner_name, source, approval_status,
          research_status, is_public, file_name, cited_by_link,
          sdg_tags, sdg_rationale, ched_priority, journal_indexing,
          jc3_points, nbc461_points, is_predatory_flag,
          keywords, issn_isbn, volume_issue, publication_date, publication_level, doi,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        sanitized.title,
        JSON.stringify(Array.isArray(sanitized.authors) ? sanitized.authors : [sanitized.authors]),
        sanitized.journal || 'Research Journal',
        Number(sanitized.year) || new Date().getFullYear(),
        Number(sanitized.citations) || 0,
        sanitized.abstract || '',
        sanitized.url || null,
        Number(sanitized.impactScore) || 0.0,
        sanitized.ownerId,
        sanitized.ownerName,
        sanitized.source,
        sanitized.approvalStatus,
        sanitized.researchStatus,
        sanitized.isPublic ? 1 : 0,
        sanitized.fileName || null,
        sanitized.citedByLink || null,
        sdgTagsJson,
        sdgRationale,
        chedPriority,
        journalIndex,
        jc3Points,
        nbcPoints,
        isPredatory,
        enrichPayload.keywords || null,
        enrichPayload.issn_isbn || null,
        enrichPayload.volume_issue || null,
        enrichPayload.publication_date || String(Number(sanitized.year) || new Date().getFullYear()),
        data.publication_level || data.publicationLevel || 'International',
        enrichPayload.doi || null,
        now
      );

      // If citing papers were provided, save them too
      if (Array.isArray(data.citingPapers)) {
        await enrichBatchWithCrossRef(data.citingPapers, 5);
        const insertCiting = db.prepare(`
          INSERT OR IGNORE INTO citing_papers (id, publication_id, title, authors, year, link, journal, volume_issue, quarter, doi_issn)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cp of data.citingPapers) {
          if (!cp.title) continue;
          const cpAuthors = Array.isArray(cp.authors) ? cp.authors.join(', ') : (typeof cp.authors === 'string' ? cp.authors : '');
          insertCiting.run(
            cp.id || `cite-${id}-${Math.random().toString(36).slice(2, 7)}`,
            id,
            cp.title,
            cpAuthors,
            cp.year || null,
            cp.link || null,
            cp.journal || '',
            cp.volume_issue || '',
            cp.quarter || 'First',
            cp.doi_issn || ''
          );
        }
      }

      // Keep researcher totals synchronized
      const allRes = db.prepare('SELECT id FROM researchers').all();
      for (const resRow of allRes) {
        updateResearcherStats(db, resRow.id);
      }

      return sendJson(201, {
        success: true,
        id,
        isDuplicate: false,
        message: 'Publication saved to database and classified with AI UN SDGs',
      });
    }

    // PUT /api/publications/:id (Update visibility, approval, etc.)
    if (pathname.startsWith('/api/publications/') && method === 'PUT') {
      const id = pathname.replace('/api/publications/', '');
      const data = await readJsonBody();
      const current = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
      if (!current) {
        return sendJson(404, { error: 'Publication not found' });
      }

      // Server-Side Ownership Check: Caller must own publication or be an admin
      const caller = authenticateCaller(req);
      if (!canCallerModifyPublication(current, caller)) {
        return sendJson(403, { error: 'Forbidden: You do not have permission to modify this publication.' });
      }

      const updates = [];
      const values = [];

      if (data.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(data.isPublic ? 1 : 0);
      }

      // Input Whitelisting: ONLY administrators can approve or reject publications
      if (data.approvalStatus !== undefined) {
        if (!isCallerAdmin(caller)) {
          return sendJson(403, { error: 'Forbidden: Only administrators can approve or reject publications.' });
        }
        updates.push('approval_status = ?');
        values.push(data.approvalStatus);
      }

      if (data.researchStatus !== undefined) {
        const allowedStatuses = ['In Progress', 'Unpublished', 'Published'];
        if (allowedStatuses.includes(data.researchStatus)) {
          updates.push('research_status = ?');
          values.push(data.researchStatus);
        }
      }

      if (data.sdg_tags !== undefined || data.sdgTags !== undefined) {
        const rawTags = data.sdg_tags !== undefined ? data.sdg_tags : data.sdgTags;
        let tagsArray = [];
        try {
          tagsArray = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? (rawTags.startsWith('[') ? JSON.parse(rawTags) : [rawTags]) : []);
        } catch {
          tagsArray = [String(rawTags)];
        }
        updates.push('sdg_tags = ?');
        values.push(JSON.stringify(tagsArray));
        updates.push('sdg_source = ?');
        values.push(data.sdg_source || data.sdgSource || 'manual_override');
      }
      if (data.sdg_rationale !== undefined || data.sdgRationale !== undefined) {
        const rat = data.sdg_rationale !== undefined ? data.sdg_rationale : data.sdgRationale;
        updates.push('sdg_rationale = ?');
        values.push(typeof rat === 'object' ? JSON.stringify(rat) : String(rat));
      }
      if (data.sdg_evidence !== undefined || data.sdgEvidence !== undefined) {
        const evi = data.sdg_evidence !== undefined ? data.sdg_evidence : data.sdgEvidence;
        updates.push('sdg_evidence = ?');
        values.push(typeof evi === 'object' ? JSON.stringify(evi) : String(evi));
      }

      const editableTextFields = [
        ['keywords', 'keywords'],
        ['issn_isbn', 'issn_isbn'],
        ['issnIsbn', 'issn_isbn'],
        ['volume_issue', 'volume_issue'],
        ['volumeIssue', 'volume_issue'],
        ['publication_date', 'publication_date'],
        ['publicationDate', 'publication_date'],
        ['publication_level', 'publication_level'],
        ['publicationLevel', 'publication_level'],
        ['journal_indexing', 'journal_indexing'],
        ['journalIndexing', 'journal_indexing'],
        ['doi', 'doi'],
        ['url', 'url'],
        ['journal', 'journal'],
      ];
      const addedCols = new Set();
      for (const [payloadKey, colName] of editableTextFields) {
        if (data[payloadKey] !== undefined && !addedCols.has(colName)) {
          addedCols.add(colName);
          updates.push(`${colName} = ?`);
          values.push(String(data[payloadKey]).trim());
        }
      }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE publications SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      return sendJson(200, { success: true, message: 'Publication updated' });
    }

    // DELETE /api/publications/:id (Ownership Check)
    if (pathname.startsWith('/api/publications/') && method === 'DELETE') {
      const id = pathname.replace('/api/publications/', '');
      const current = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
      if (!current) {
        return sendJson(404, { error: 'Publication not found' });
      }

      // Server-Side Ownership Check: Caller must own publication or be an admin
      const caller = authenticateCaller(req);
      if (!canCallerModifyPublication(current, caller)) {
        return sendJson(403, { error: 'Forbidden: You do not have permission to delete this publication.' });
      }

      db.prepare('DELETE FROM publications WHERE id = ?').run(id);
      db.prepare('DELETE FROM citing_papers WHERE publication_id = ?').run(id);
      db.prepare('DELETE FROM citation_trends WHERE publication_id = ?').run(id);

      // Keep researcher totals synchronized
      const allRes = db.prepare('SELECT id FROM researchers').all();
      for (const resRow of allRes) {
        updateResearcherStats(db, resRow.id);
      }

      return sendJson(200, { success: true, message: 'Publication deleted successfully' });
    }

    // ----------------------------------------------------
    // 5A. GOOGLE SCHOLAR PROFILE FETCH & PSU/NON-PSU REVIEW
    // ----------------------------------------------------
    if (pathname === '/api/scholar/fetch-profile' && method === 'POST') {
      const { scholarUrl } = await readJsonBody();
      if (!scholarUrl) {
        return sendJson(400, { error: 'Google Scholar profile URL or user ID is required.' });
      }

      let profileResult = null;
      let usedApify = false;

      // Tier 1: Direct Profile Fetch
      try {
        profileResult = await scrapeGoogleScholarProfile(scholarUrl);
      } catch (directErr) {
        console.warn('[ScholarProfile] Direct fetch failed, trying Apify fallback:', directErr.message);

        // Tier 2: Apify fallback if direct scrape got blocked
        const candidateTokens = db.prepare(`
          SELECT * FROM apify_tokens ORDER BY is_active DESC, created_at DESC
        `).all();

        if (candidateTokens.length > 0 || process.env.APIFY_TOKEN) {
          let userId = scholarUrl.trim();
          const userMatch = userId.match(/[?&]user=([a-zA-Z0-9_-]+)/);
          if (userMatch) userId = userMatch[1];

          const cand = candidateTokens[0] || {
            name: 'EnvToken',
            token: process.env.APIFY_TOKEN,
            actorId: 'johnvc~google-scholar-api'
          };

          try {
            const targetActor = cand.actor_id || cand.actorId || 'johnvc~google-scholar-api';
            const actorUrlSegment = targetActor.replace('/', '~');
            const targetProfileUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=en&pagesize=100`;

            const apifyRes = await fetch(
              `https://api.apify.com/v2/acts/${actorUrlSegment}/run-sync-get-dataset-items?token=${cand.token}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startUrls: [{ url: targetProfileUrl }],
                  queries: [targetProfileUrl],
                  maxResults: 100
                })
              }
            );

            if (apifyRes.ok) {
              const apifyItems = await apifyRes.json();
              if (Array.isArray(apifyItems) && apifyItems.length > 0) {
                usedApify = true;
                const parsedPubs = apifyItems.map((item, idx) => ({
                  id: `gsp-${userId}-${idx + 1}`,
                  title: item.title || item.name || '',
                  authors: Array.isArray(item.authors) ? item.authors : (item.authors ? item.authors.split(',').map(a => a.trim()) : []),
                  journal: item.journal || item.publication || item.venue || 'Academic Publication',
                  year: parseInt(item.year, 10) || new Date().getFullYear(),
                  citations: parseInt(item.citations || item.numCitations || 0, 10),
                  url: item.url || item.link || '',
                  citedByLink: item.citedByLink || '',
                  abstract: item.abstract || item.snippet || ''
                })).filter(p => p.title);

                profileResult = {
                  profile: {
                    userId,
                    scholarUrl: `https://scholar.google.com/citations?user=${userId}&hl=en`,
                    name: apifyItems[0]?.authorName || 'Scholar Researcher',
                    affiliation: apifyItems[0]?.affiliation || 'Academic Researcher',
                    verifiedEmail: '',
                    photoUrl: '',
                    totalCitations: parsedPubs.reduce((sum, p) => sum + p.citations, 0),
                    hIndex: 0,
                    i10Index: 0,
                    isPsuAffiliated: false
                  },
                  publications: parsedPubs
                };
              }
            }
          } catch (apifyErr) {
            console.warn('[ScholarProfile] Apify fallback failed:', apifyErr.message);
          }
        }

        if (!profileResult) {
          return sendJson(500, {
            error: `Failed to fetch profile: ${directErr.message}. If Google Scholar is blocking requests, configure an Apify token in Admin Panel.`
          });
        }
      }

      // Identify PSU vs Non-PSU authors across the fetched publications
      const facultyList = db.prepare(`
        SELECT id, name, first_name, last_name, department, instructor_id
        FROM researchers
        WHERE is_faculty = 1
      `).all();

      const profileName = profileResult.profile.name || '';
      const profileParts = profileName.toLowerCase().split(/\s+/).filter(Boolean);
      const profileLastName = profileParts[profileParts.length - 1] || '';

      const checkAuthorPsu = (authorStr) => {
        const cleanA = authorStr.toLowerCase().trim();
        if (!cleanA) return { isPsu: false };

        if (profileName && (cleanA === profileName.toLowerCase() || (profileLastName.length > 2 && cleanA.includes(profileLastName)))) {
          return { isPsu: true, isTargetResearcher: true, department: 'Target Researcher' };
        }

        for (const fac of facultyList) {
          const cleanFac = fac.name.toLowerCase().trim();
          if (cleanA === cleanFac || cleanA.includes(cleanFac)) {
            return { isPsu: true, facultyName: fac.name, department: fac.department };
          }
          const fParts = cleanFac.split(/\s+/).filter(Boolean);
          const fLast = fParts[fParts.length - 1];
          if (fLast && fLast.length > 2 && cleanA.includes(fLast)) {
            const initial = fParts[0]?.[0];
            if (!initial || cleanA.includes(initial) || cleanA === fLast) {
              return { isPsu: true, facultyName: fac.name, department: fac.department };
            }
          }
        }

        return { isPsu: false };
      };

      const enrichedPublications = profileResult.publications.map((pub) => {
        const authorDetails = pub.authors.map((a) => {
          const match = checkAuthorPsu(a);
          return {
            name: a,
            isPsu: match.isPsu,
            department: match.department || null,
          };
        });

        const psuAuthors = authorDetails.filter((a) => a.isPsu).map((a) => a.name);
        const nonPsuAuthors = authorDetails.filter((a) => !a.isPsu).map((a) => a.name);
        const isPsuPaper = psuAuthors.length > 0;
        const hasCollaborators = nonPsuAuthors.length > 0;

        return {
          ...pub,
          authorDetails,
          psuAuthors,
          nonPsuAuthors,
          isPsuPaper,
          hasCollaborators,
        };
      });

      return sendJson(200, {
        success: true,
        profile: profileResult.profile,
        publications: enrichedPublications,
        totalFound: enrichedPublications.length,
        usedApify,
      });
    }

    // ----------------------------------------------------
    // 5B. IMPORT SELECTED SCHOLAR PUBLICATIONS (Option B)
    // ----------------------------------------------------
    if (pathname === '/api/scholar/import' && method === 'POST') {
      const {
        instructorId,
        researcherName,
        scholarUrl,
        scholarId,
        photoUrl,
        firstName,
        lastName,
        department = 'BSIT',
        password,
        email,
        isFaculty = true,
        publications = [],
      } = await readJsonBody();

      if (!instructorId || !Array.isArray(publications) || publications.length === 0) {
        return sendJson(400, { error: 'Instructor ID and selected publications are required.' });
      }

      const trimmedInstId = instructorId.trim();
      let researcher = db.prepare('SELECT * FROM researchers WHERE instructor_id = ? OR id = ?').get(trimmedInstId, trimmedInstId);

      // Extract scholar ID if URL passed
      let parsedScholarId = scholarId || null;
      if (!parsedScholarId && scholarUrl) {
        const uMatch = scholarUrl.match(/[?&]user=([a-zA-Z0-9_-]+)/);
        if (uMatch) parsedScholarId = uMatch[1];
      }

      const now = new Date().toISOString();

      // AUTO-CREATE RESEARCHER PROFILE IF NOT YET SAVED IN DATABASE
      if (!researcher) {
        const nameParts = (researcherName || trimmedInstId).trim().split(/\s+/).filter(Boolean);
        const fName = firstName ? firstName.trim() : (nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || 'Researcher');
        const lName = lastName ? lastName.trim() : (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
        const fullName = `${fName} ${lName}`.trim() || researcherName || trimmedInstId;
        const resUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const resId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const userEmail = email ? email.trim() : `${trimmedInstId.toLowerCase()}@psu.edu.ph`;
        const userPassword = password || 'psu12345';
        const userDept = department || 'BSIT';
        const userIsFaculty = isFaculty !== false ? 1 : 0;

        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedInstId);
        if (!existingUser) {
          db.prepare(`
            INSERT INTO users (id, username, email, password, name, role, department, is_faculty, photo_url, scholar_url, google_scholar_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?, ?, ?)
          `).run(
            resUserId,
            trimmedInstId,
            userEmail,
            hashPassword(userPassword),
            fullName,
            userDept,
            userIsFaculty,
            photoUrl || null,
            scholarUrl || null,
            parsedScholarId || null,
            now
          );
        }

        db.prepare(`
          INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, photo_url, scholar_url, google_scholar_id, total_publications, total_citations, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        `).run(
          resId,
          existingUser ? existingUser.id : resUserId,
          trimmedInstId,
          fName,
          lName,
          fullName,
          userEmail,
          userDept,
          userIsFaculty,
          photoUrl || null,
          scholarUrl || null,
          parsedScholarId || null,
          now
        );

        researcher = db.prepare('SELECT * FROM researchers WHERE id = ?').get(resId);
      } else {
        if (scholarUrl || parsedScholarId) {
          db.prepare(`
            UPDATE researchers 
            SET scholar_url = COALESCE(?, scholar_url), google_scholar_id = COALESCE(?, google_scholar_id)
            WHERE id = ?
          `).run(scholarUrl || null, parsedScholarId || null, researcher.id);

          if (researcher.user_id) {
            db.prepare(`
              UPDATE users 
              SET scholar_url = COALESCE(?, scholar_url), google_scholar_id = COALESCE(?, google_scholar_id)
              WHERE id = ?
            `).run(scholarUrl || null, parsedScholarId || null, researcher.user_id);
          }
        }

        if (photoUrl) {
          db.prepare('UPDATE researchers SET photo_url = ? WHERE id = ?').run(photoUrl, researcher.id);
          if (researcher.user_id) {
            db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photoUrl, researcher.user_id);
          }
        }
      }

      const targetInstId = researcher.instructor_id;
      const targetName = researcher.name;

      let importedCount = 0;
      let updatedCount = 0;

      await enrichBatchWithCrossRef(publications, 5);

      const allExistingPubs = db.prepare('SELECT id, title, citations, url, cited_by_link FROM publications').all();

      const insertPub = db.prepare(`
        INSERT INTO publications (
          id, title, authors, journal, year, citations, abstract, url, cited_by_link,
          owner_id, owner_name, source, approval_status, research_status, is_public,
          keywords, issn_isbn, volume_issue, publication_date, publication_level, doi, journal_indexing,
          sdg_tags, sdg_rationale, ched_priority, sdg_source, sdg_evidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scraped', 'approved', 'Published', 1, ?, ?, ?, ?, 'International', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updatePub = db.prepare(`
        UPDATE publications
        SET citations = MAX(citations, ?), url = COALESCE(?, url), cited_by_link = COALESCE(?, cited_by_link),
            owner_id = ?, owner_name = ?,
            keywords = COALESCE(?, keywords), issn_isbn = COALESCE(?, issn_isbn),
            volume_issue = COALESCE(?, volume_issue), publication_date = COALESCE(?, publication_date),
            doi = COALESCE(?, doi),
            sdg_tags = CASE WHEN sdg_source = 'manual_override' THEN sdg_tags ELSE COALESCE(sdg_tags, ?) END,
            sdg_rationale = CASE WHEN sdg_source = 'manual_override' THEN sdg_rationale ELSE COALESCE(sdg_rationale, ?) END,
            ched_priority = COALESCE(ched_priority, ?),
            sdg_source = CASE WHEN sdg_source = 'manual_override' THEN sdg_source ELSE COALESCE(sdg_source, ?) END,
            sdg_evidence = CASE WHEN sdg_source = 'manual_override' THEN sdg_evidence ELSE COALESCE(sdg_evidence, ?) END
        WHERE id = ?
      `);

      const insertScrapedCache = db.prepare(`
        INSERT OR REPLACE INTO scraped_publications (
          id, title, authors, journal, year, citations, abstract, url, cited_by_link, search_query, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const pubIdsToSyncCitations = [];

      runInTransaction(() => {
        for (const item of publications) {
          const title = (item.title || '').trim();
          const normItem = normalizeTitle(title);
          if (!normItem) continue;

          const existing = allExistingPubs.find((p) => normalizeTitle(p.title) === normItem);
          const authorsArr = Array.isArray(item.authors) ? item.authors : [item.authors || targetName];
          const authorsJson = JSON.stringify(authorsArr);
          const citations = parseInt(item.citations, 10) || 0;
          const year = parseInt(item.year, 10) || new Date().getFullYear();
          const audit = auditJournalReputation(item.journal || '');

          const actualAbstract = item.abstract && item.abstract.trim().length > 20 ? item.abstract.trim() : '';
          const fallbackAbstract = actualAbstract || `This research study titled "${title}", authored by ${authorsArr.join(', ')} and published in ${item.journal || 'an academic journal'} (${year}), presents empirical findings and methodologies advancing institutional research in ${researcher.department || 'applied sciences and education'}.`;

          const sdgClassified = localHeuristicSDG(title, actualAbstract, item.keywords || '');
          const validTags = [sdgClassified.primarySDG, sdgClassified.secondarySDG].filter(Boolean);
          const sdgTagsJson = JSON.stringify(validTags.length > 0 ? validTags : ['Pending Review']);
          const sdgRationaleJson = sdgClassified.rationale || 'Pending coordinator verification.';
          const chedPrio = sdgClassified.chedPriority || '';
          const sdgSource = sdgClassified.source || 'auto';
          const sdgEvidenceJson = JSON.stringify(sdgClassified.evidence || null);

          if (existing) {
            updatePub.run(
              citations,
              item.url || null,
              item.citedByLink || null,
              targetInstId,
              targetName,
              item.keywords || null,
              item.issn_isbn || null,
              item.volume_issue || null,
              item.publication_date || String(year),
              item.doi || null,
              sdgTagsJson,
              sdgRationaleJson,
              chedPrio,
              sdgSource,
              sdgEvidenceJson,
              existing.id
            );
            if (citations > 0) pubIdsToSyncCitations.push(existing.id);
            updatedCount++;
          } else {
            const newId = `pub-scholar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            insertPub.run(
              newId,
              title,
              authorsJson,
              item.journal || 'Academic Publication',
              year,
              citations,
              fallbackAbstract,
              item.url || '',
              item.citedByLink || null,
              targetInstId,
              targetName,
              item.keywords || null,
              item.issn_isbn || null,
              item.volume_issue || null,
              item.publication_date || String(year),
              item.doi || null,
              audit.indexing || 'Google Scholar',
              sdgTagsJson,
              sdgRationaleJson,
              chedPrio,
              sdgSource,
              sdgEvidenceJson,
              now
            );
            allExistingPubs.push({ id: newId, title, citations, url: item.url, cited_by_link: item.citedByLink });
            if (citations > 0) pubIdsToSyncCitations.push(newId);
            importedCount++;
          }

          const cacheId = item.id || `scraped-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          insertScrapedCache.run(
            cacheId,
            title,
            authorsJson,
            item.journal || 'Academic Publication',
            year,
            citations,
            fallbackAbstract,
            item.url || '',
            item.citedByLink || null,
            parsedScholarId || targetName,
            now
          );
        }
      });

      // Automatically enqueue non-blocking background citation ingestion for all cited publications (scales to 1,000–10,000+ citations)
      if (pubIdsToSyncCitations.length > 0) {
        enqueuePublicationCitationSync(pubIdsToSyncCitations);
      }

      // Synchronize researcher totals across all approved publications
      updateResearcherStats(db, researcher.id);
      const updatedRes = db.prepare('SELECT * FROM researchers WHERE id = ?').get(researcher.id);

      return sendJson(200, {
        success: true,
        importedCount,
        updatedCount,
        totalSelected: publications.length,
        researcher: {
          id: updatedRes.id,
          instructorId: updatedRes.instructor_id,
          name: updatedRes.name,
          department: updatedRes.department,
          photoUrl: updatedRes.photo_url,
          scholarUrl: updatedRes.scholar_url,
          totalPublications: updatedRes.total_publications,
          totalCitations: updatedRes.total_citations,
        },
        message: `Successfully saved ${importedCount} new publication(s) and recorded ${targetName} as a researcher with ${updatedRes.total_publications} publications.`,
      });
    }

    // ----------------------------------------------------
    // 5. GOOGLE SCHOLAR SEARCH & LIVE SCRAPING (10 PAPERS PER PAGE)
    // ----------------------------------------------------
    if (pathname === '/api/search/google-scholar' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim();
      const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
      const limit = 10;

      if (!query) {
        return sendJson(200, await attachTokenUsage({ results: [], fromCache: true, page: 0, hasMore: false, count: 0 }));
      }

      // -----------------------------------------------------------------------
      // Public Scraper Guardrail & Quota Circuit Breaker ($1.00 threshold)
      // -----------------------------------------------------------------------
      const caller = authenticateCaller(req);
      const isUserAdminOrFaculty = Boolean(caller && (caller.role === 'admin' || caller.role === 'instructor'));

      const publicScraperSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'public_scraper_enabled'").get()?.value || 'true';
      const isScraperEnabledByAdmin = publicScraperSetting === 'true';

      const activeToken = getActiveApifyTokenRow();
      let quotaCircuitBreakerTripped = false;
      let remainingBalanceUsd = 5.0;

      if (activeToken) {
        try {
          const usage = await fetchApifyTokenUsage(activeToken, false);
          const maxUsd = Number(usage?.maxMonthlyUsageUsd) || 5.0;
          const usedUsd = Number(usage?.monthlyUsageUsd) || 0.0;
          remainingBalanceUsd = Math.max(0, maxUsd - usedUsd);
          const thresholdSetting = Number(db.prepare("SELECT value FROM system_settings WHERE key = 'scraper_quota_threshold_usd'").get()?.value) || 1.0;
          if (remainingBalanceUsd <= thresholdSetting) {
            quotaCircuitBreakerTripped = true;
          }
        } catch {}
      }

      if (!isUserAdminOrFaculty && (!isScraperEnabledByAdmin || quotaCircuitBreakerTripped)) {
        const reason = !isScraperEnabledByAdmin ? 'admin_disabled' : 'quota_low';
        return sendJson(200, {
          results: [],
          fromCache: true,
          publicScraperDisabled: true,
          reason,
          remainingBalanceUsd,
          message: reason === 'quota_low'
            ? 'Global academic live search is currently in power-save mode to conserve institutional API quota ($1.00 or less remaining). Please search the PSU Institutional Repository or sign in as faculty.'
            : 'Global academic live search has been restricted to faculty and administrators by the system administrator. Please search the PSU Institutional Repository.',
        });
      }

      const cleanQuery = query;
      const bareQuery = cleanQuery
        .replace(/^author:\s*"?/i, '')
        .replace(/"$/g, '')
        .trim();
      const bareLower = bareQuery.toLowerCase();
      // Strip punctuation and single-letter middle initials (e.g. "M.", "A.") so "Rodelio M. Garin" -> ['rodelio', 'garin']
      const queryWords = bareLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !['sir', 'maam', 'dr', 'prof', 'mr', 'ms', 'mrs', 'engr', 'atty'].includes(w));

      const isExplicitAuthorQuery = cleanQuery.toLowerCase().startsWith('author:');
      const isPersonNameQuery =
        isExplicitAuthorQuery ||
        (queryWords.length >= 2 &&
          queryWords.length <= 3 &&
          !/university|college|school|campus|department|journal|republic|philippines|state|system|analysis|development|assessment|evaluation|education|technology|learning|management|farming|agriculture|arduino|iot|model|framework|study|impact|effect|design|implementation/i.test(bareQuery));

      const topicVariants = extractTopicVariants(bareQuery);

      const targetLast = queryWords.length > 0 ? queryWords[queryWords.length - 1] : '';
      const targetFirstWords = queryWords.length > 1 ? queryWords.slice(0, queryWords.length - 1) : [];
      const targetFirst = targetFirstWords[0] || '';
      const targetInitials = targetFirstWords.map((w) => w[0]).join('');

      const allResearchers = db.prepare("SELECT * FROM researchers WHERE status IS NULL OR status != 'rejected'").all();
      const allFacultyRows = allResearchers;
      const matchingResearchers = allResearchers.filter((r) => {
        const rName = String(r.name || '').toLowerCase();
        const rLast = String(r.last_name || '').toLowerCase();
        const rFirst = String(r.first_name || '').toLowerCase();
        if (rName.includes(bareLower) || bareLower.includes(rName)) return true;
        if (queryWords.length > 0 && queryWords.every((w) => rName.includes(w) || rFirst.includes(w) || rLast.includes(w))) {
          return true;
        }
        return false;
      });

      const isPsuItem = (item) => {
        if (!item) return false;
        if (item.isPsu || item.source === 'institutional_repository') return true;
        if (item.owner_id && (String(item.owner_id).startsWith('PSU-') || String(item.owner_id).startsWith('ASIN-') || String(item.owner_id).startsWith('res-'))) {
          return true;
        }

        const text = `${item.title || ''} ${Array.isArray(item.authors) ? item.authors.join(' ') : item.authors || ''} ${item.owner_name || ''} ${item.journal || ''} ${item.abstract || ''} ${item.affiliation || ''} ${item.url || ''}`.toLowerCase();
        
        // 1. Direct institutional and campus markers for Pangasinan State University
        if (
          text.includes('pangasinan state university') ||
          text.includes('psu.edu.ph') ||
          /\bpangasinan\s+state\b/i.test(text) ||
          (/\bpsu\b/i.test(text) && /\b(asingan|lingayen|urdaneta|bayambang|binmaley|infanta|alaminos|san carlos|sta\.?\s*maria|santa\s*maria|pangasinan|campus)\b/i.test(text)) ||
          /\b(asingan|lingayen|urdaneta|bayambang|binmaley|infanta|alaminos)\s+campus\b/i.test(text) ||
          /\b(san carlos|sta\.?\s*maria|santa\s*maria)\s+campus\b/i.test(text) ||
          /\bpsu\s+(asingan|lingayen|urdaneta|bayambang|binmaley|infanta|alaminos|san carlos|sta\.?\s*maria|santa\s*maria)\b/i.test(text) ||
          /\b(asingan|lingayen|urdaneta|bayambang|binmaley|infanta|alaminos|san carlos),\s*pangasinan\b/i.test(text) ||
          /\b(sual|bolinao|tayug|dagupan|calasiao),\s*pangasinan\b/i.test(text) ||
          /\b(municipality|town|port|power\s*plant)\s+of\s+sual\b/i.test(text)
        ) {
          return true;
        }

        // 2. Strict author verification against registered faculty in database
        const authorsArr = Array.isArray(item.authors) ? item.authors : [item.authors];
        for (const a of authorsArr) {
          const aClean = String(a || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
          if (!aClean || aClean.length < 4) continue;

          for (const fac of allFacultyRows) {
            const facLast = String(fac.last_name || '').toLowerCase().trim();
            const facFirst = String(fac.first_name || '').toLowerCase().trim();
            const facFull = String(fac.name || `${fac.first_name} ${fac.last_name}`).toLowerCase().trim();

            if (facFull && (aClean === facFull || aClean.includes(facFull))) return true;
            if (facLast && facLast.length >= 3) {
              const authorTokens = aClean.split(' ');
              if (authorTokens.includes(facLast)) {
                const firstInitial = facFirst ? facFirst[0] : '';
                if (facFirst && aClean.includes(facFirst)) return true;
                if (firstInitial && authorTokens.some((t) => t === firstInitial || t.startsWith(firstInitial))) return true;
              }
            }
          }
        }
        return false;
      };

      const matchesQueriedAuthor = (item) => {
        if (!item) return false;
        if (!targetLast) return false;

        const isPsu = isPsuItem(item);

        // 1. Strict Author Presence Check: Parse authors array as Absolute Source of Truth
        let authorsArr = [];
        if (Array.isArray(item.authors)) {
          authorsArr = item.authors;
        } else if (typeof item.authors === 'string') {
          try {
            const p = JSON.parse(item.authors);
            authorsArr = Array.isArray(p) ? p : item.authors.split(/[,;]/);
          } catch {
            authorsArr = item.authors.split(/[,;]/);
          }
        }
        authorsArr = authorsArr.map((a) => String(a || '').trim()).filter(Boolean);

        if (authorsArr.length > 0) {
          for (const a of authorsArr) {
            const matchResult = matchAuthorName(a, queryWords, targetLast, targetFirst, targetInitials, isPsu);
            if (matchResult === 'strong') return 'strong';
            if (matchResult === 'weak') return 'weak';
          }
          // The paper has explicit authors, but the queried researcher was NOT one of them!
          // Never let mismatched owner_id or owner_name falsely claim authorship.
          return false;
        }

        // 2. Fallback only if authors array is completely empty
        if (item.owner_name) {
          const res = matchAuthorName(item.owner_name, queryWords, targetLast, targetFirst, targetInitials, isPsu);
          if (res) return res;
        }

        for (const mr of matchingResearchers) {
          if (matchesResearcher(item, mr)) return 'strong';
        }

        return false;
      };

      const insertScraped = db.prepare(`
        INSERT OR REPLACE INTO scraped_publications (id, title, authors, journal, year, citations, abstract, url, cited_by_link, search_query, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const poolMap = new Map();
      const addCandidateToPool = (item) => {
        if (!item || !item.title) return;
        const cleanT = String(item.title).replace(/^(\s*\[[^\]]+\]\s*)+/gi, '').trim();
        const normT = normalizeTitle(cleanT);
        if (!normT || normT.length < 4) return;

        const jStr = String(item.journal || '');
        const uStr = String(item.url || '');
        if (/\b(benezit dictionary|oxford art online|who's who)\b/i.test(jStr) || /\/benz\//i.test(uStr)) {
          return;
        }

        const existing = poolMap.get(normT);
        const itemCitations = Number(item.citations) || 0;
        const parsedAuthors = Array.isArray(item.authors)
          ? item.authors.filter(Boolean)
          : typeof item.authors === 'string'
          ? (() => {
              try {
                const p = JSON.parse(item.authors);
                return Array.isArray(p) ? p.filter(Boolean) : item.authors.split(',').map((a) => a.trim()).filter(Boolean);
              } catch {
                return item.authors.split(',').map((a) => a.trim()).filter(Boolean);
              }
            })()
          : [];

        // Never fabricate the search query as the author if the paper has no real authors
        if (parsedAuthors.length === 0) return;

        const normalizedItem = {
          id: item.id || `gs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: cleanT,
          authors: parsedAuthors,
          journal: item.journal || 'Academic Publication',
          year: Number(item.year) || new Date().getFullYear(),
          citations: itemCitations,
          abstract: item.abstract || '',
          keywords: item.keywords || item.subject || '',
          url: item.url || '',
          pdfUrl: item.pdfUrl || null,
          citedByLink: item.citedByLink || item.cited_by_link || '',
          fromCache: Boolean(item.fromCache),
          owner_name: item.owner_name || null,
          owner_id: item.owner_id || null,
          isTargetAuthor: Boolean(item.isTargetAuthor),
          isPsu: Boolean(item.isPsu),
          geo_tier: item.geo_tier || null,
          source: item.source || null,
        };

        if (!existing) {
          poolMap.set(normT, normalizedItem);
        } else {
          // Merge best metadata into existing entry
          if (itemCitations > existing.citations) existing.citations = itemCitations;
          if (!existing.citedByLink && normalizedItem.citedByLink) existing.citedByLink = normalizedItem.citedByLink;
          if (!existing.url && normalizedItem.url) existing.url = normalizedItem.url;
          if (normalizedItem.abstract && (!existing.abstract || normalizedItem.abstract.length > existing.abstract.length)) {
            existing.abstract = normalizedItem.abstract;
          }
          // Protect verified authors: Never overwrite trusted authors with an external list that drops the target author!
          const existingMatchesTarget = (isPersonNameQuery || isExplicitAuthorQuery) ? matchesQueriedAuthor(existing) : false;
          const incomingMatchesTarget = (isPersonNameQuery || isExplicitAuthorQuery) ? matchesQueriedAuthor(normalizedItem) : false;

          if (
            normalizedItem.source === 'institutional_repository' ||
            (!existingMatchesTarget && incomingMatchesTarget) ||
            (existing.authors.length === 0 || (existing.authors.length === 1 && existing.authors[0] === 'Author'))
          ) {
            existing.authors = normalizedItem.authors;
          } else if (
            existingMatchesTarget &&
            incomingMatchesTarget &&
            normalizedItem.authors.length > existing.authors.length
          ) {
            existing.authors = normalizedItem.authors;
          }
          if (
            (!existing.journal || existing.journal === 'Academic Publication') &&
            normalizedItem.journal &&
            normalizedItem.journal !== 'Academic Publication'
          ) {
            existing.journal = normalizedItem.journal;
          }
          if (normalizedItem.isTargetAuthor) existing.isTargetAuthor = true;
          if (normalizedItem.isPsu) existing.isPsu = true;
          if (normalizedItem.geo_tier === 'psu' || (!existing.geo_tier && normalizedItem.geo_tier)) {
            existing.geo_tier = normalizedItem.geo_tier;
          }
          if (normalizedItem.owner_name && !existing.owner_name) existing.owner_name = normalizedItem.owner_name;
          if (normalizedItem.owner_id && !existing.owner_id) existing.owner_id = normalizedItem.owner_id;
          if (normalizedItem.source && !existing.source) existing.source = normalizedItem.source;
        }
      };

      // -----------------------------------------------------------------------
      // STEP 1: Pre-load ALL verified publications for matching registered researchers
      // from the local repository, plus scrape their Google Scholar Profile ID (0 tokens)
      // -----------------------------------------------------------------------
      let matchedScholarProfile = false;
      try {
        for (const r of matchingResearchers) {
          try {
            const authorPubs = db.prepare(`
              SELECT * FROM publications 
              WHERE approval_status = 'approved' 
                AND (owner_id = ? OR owner_id = ? OR owner_name LIKE ? OR authors LIKE ?)
            `).all(r.instructor_id, r.id, `%${r.last_name}%`, `%${r.last_name}%`);

            for (const p of authorPubs) {
              if (matchesResearcher(p, r)) {
                addCandidateToPool({
                  id: p.id,
                  title: p.title,
                  authors: p.authors,
                  journal: p.journal,
                  year: p.year,
                  citations: p.citations,
                  abstract: p.abstract,
                  keywords: p.keywords,
                  url: p.url,
                  citedByLink: p.cited_by_link,
                  fromCache: true,
                  owner_name: p.owner_name,
                  owner_id: p.owner_id,
                  isTargetAuthor: true,
                  isPsu: true,
                  geo_tier: 'psu',
                  source: 'institutional_repository',
                });
              }
            }
          } catch (preloadErr) {
            console.warn('[ScholarSearch] Researcher repository preload warning:', preloadErr.message);
          }

          let scholarId = r.google_scholar_id || '';
          if (!scholarId && r.scholar_url) {
            const m = String(r.scholar_url).match(/[?&]user=([a-zA-Z0-9_-]+)/);
            if (m) scholarId = m[1];
          }
          if (scholarId) {
            try {
              const profData = await scrapeGoogleScholarProfile(scholarId);
              if (Array.isArray(profData?.publications) && profData.publications.length > 0) {
                matchedScholarProfile = true;
                const now = new Date().toISOString();
                runInTransaction(() => {
                  for (const pub of profData.publications) {
                    addCandidateToPool({
                      ...pub,
                      owner_name: r.name,
                      owner_id: r.instructor_id,
                      isTargetAuthor: true,
                      isPsu: true,
                      geo_tier: 'psu',
                      source: 'google_scholar_profile',
                    });
                    insertScraped.run(
                      pub.id,
                      pub.title,
                      JSON.stringify(pub.authors),
                      pub.journal,
                      pub.year,
                      pub.citations,
                      pub.abstract || '',
                      pub.url || '',
                      pub.citedByLink || '',
                      bareQuery,
                      now
                    );
                  }
                });
              }
            } catch (profErr) {
              console.warn('[ScholarSearch] Profile scrape fallback warning:', profErr.message);
            }
          }
        }
      } catch (e) {
        console.warn('[ScholarSearch] Researcher profile lookup error:', e.message);
      }

      // -----------------------------------------------------------------------
      // STEP 2: DIRECT GOOGLE SCHOLAR SCRAPER FIRST (0 Tokens), APIFY AS FAILOVER
      // -----------------------------------------------------------------------
      let liveResults = [];
      let captchaBlocked = false;
      let usedApifyToken = false;
      let usedTokenName = '';
      let apifyRawCount = 0;

      try {
        const queryPromises = [
          scrapeGoogleScholarDirect(cleanQuery, page, limit).catch(() => []),
        ];
        if (page === 0 && !isPersonNameQuery) {
          queryPromises.push(
            scrapeGoogleScholarDirect(`${cleanQuery} "Pangasinan State University"`, 0, 5).catch(() => []),
            scrapeGoogleScholarDirect(`${cleanQuery} Philippines`, 0, 8).catch(() => [])
          );
        } else if (page === 0 && (isPersonNameQuery || isExplicitAuthorQuery) && targetLast) {
          queryPromises.push(
            scrapeGoogleScholarDirect(`${targetLast} "Pangasinan State University"`, 0, 8)
              .then((items) => items.map((it) => ({ ...it, isPsu: true, geo_tier: 'psu' })))
              .catch(() => []),
            scrapeGoogleScholarDirect(`${targetLast} Pangasinan`, 0, 5)
              .then((items) => items.map((it) => ({ ...it, isPsu: true, geo_tier: 'psu' })))
              .catch(() => [])
          );
        }
        const liveArrays = await Promise.all(queryPromises);
        liveResults = liveArrays.flat();
        captchaBlocked = Boolean(liveArrays[0]?.captchaBlocked);
      } catch (err) {
        console.warn('[ScholarSearch] Direct search error:', err.message);
      }

      if (liveResults.length > 0) {
        try {
          const now = new Date().toISOString();
          runInTransaction(() => {
            for (const item of liveResults) {
              insertScraped.run(
                item.id,
                item.title,
                JSON.stringify(item.authors),
                item.journal,
                item.year,
                item.citations,
                item.abstract,
                item.url,
                item.citedByLink,
                cleanQuery,
                now
              );
            }
          });
        } catch (dbErr) {
          console.warn('[ScholarSearch] DB save error:', dbErr.message);
        }

        for (const item of liveResults) {
          addCandidateToPool(item);
        }
      }

      // Trigger Apify Backup Scraper ONLY when Direct Google Scholar is blocked or returned 0 results
      if (!matchedScholarProfile && (captchaBlocked || liveResults.length === 0)) {
        const tokenRows = db.prepare(`
          SELECT * FROM apify_tokens WHERE is_active = 1 ORDER BY created_at DESC
        `).all();

        const candidateTokens = tokenRows.map((r) => ({
          id: r.id,
          name: r.name,
          token: r.token,
          actorId: (r.actor_id || 'johnvc~google-scholar-api').replace('/', '~'),
        }));

        if (candidateTokens.length === 0 && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
          candidateTokens.push({
            id: 'env',
            name: 'Environment Token',
            token: process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN,
            actorId: (process.env.APIFY_ACTOR_ID || 'johnvc~google-scholar-api').replace('/', '~'),
          });
        }

        const parseApifyItem = (raw) => {
          if (!raw || raw.error) return null;
          const title = (raw.paper_title || raw.title || raw.name || '').trim();
          if (!title) return null;

          let authors = [];
          if (Array.isArray(raw.publication_info?.authors)) {
            authors = raw.publication_info.authors
              .map((a) => (typeof a === 'string' ? a.trim() : (a?.name || '').trim()))
              .filter(Boolean);
          } else if (Array.isArray(raw.authors)) {
            authors = raw.authors
              .map((a) => (typeof a === 'string' ? a.trim() : (a?.name || '').trim()))
              .filter(Boolean);
          } else if (typeof raw.authors === 'string') {
            authors = raw.authors.split(',').map((a) => a.trim()).filter(Boolean);
          }
          if (authors.length === 0 && raw.publication_info?.summary) {
            const authorPart = raw.publication_info.summary.split('-')[0];
            if (authorPart && authorPart.trim()) {
              authors = authorPart.split(',').map((a) => a.trim()).filter(Boolean);
            }
          }
          if (authors.length === 0) return null;

          let journal = (raw.source || raw.journal || '').trim();
          if (!journal && raw.publication_info?.summary) {
            journal = raw.publication_info.summary.trim();
          }
          if (!journal) journal = 'Academic Publication';

          let year = parseInt(raw.year || raw.publicationYear, 10);
          if (!year && raw.publication_info?.summary) {
            const ym = raw.publication_info.summary.match(/\b(19\d{2}|20\d{2})\b/);
            if (ym) year = parseInt(ym[1], 10);
          }
          if (!year) year = new Date().getFullYear();

          const citations =
            parseInt(raw.inline_links?.cited_by_total ?? raw.citations ?? raw.citationCount ?? 0, 10) || 0;
          const abstract = raw.snippet || raw.abstract || raw.description || '';
          const paperUrl = raw.link || raw.url || raw.resources?.[0]?.link || '';
          const pdfUrl = Array.isArray(raw.resources)
            ? raw.resources.find((r) => r.link && (r.file_format === 'PDF' || String(r.link).toLowerCase().endsWith('.pdf')))?.link || null
            : null;
          const id = raw.result_id || raw.id || `gs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const citedByLink = raw.inline_links?.cited_by?.link || raw.inline_links?.cited_by_link || '';

          return {
            id,
            title,
            authors,
            journal,
            year,
            citations,
            abstract,
            url: paperUrl,
            pdfUrl,
            citedByLink,
            fromCache: false,
          };
        };

        if (candidateTokens.length > 0) {
          for (const cand of candidateTokens) {
            try {
              const targetActor = cand.actorId.includes('lite')
                ? 'johnvc~google-scholar-lite-api'
                : cand.actorId;
              const actorUrlSegment = targetActor.replace('/', '~');
              const isLite = targetActor.includes('lite');

              const apifyFetch = async (q, max) => {
                const bodyPayload = isLite
                  ? { searchTerms: [q], maxResults: max }
                  : { q, maxResults: max, max_pages: 1, start_page: page + 1 };
                const r = await fetch(
                  `https://api.apify.com/v2/acts/${actorUrlSegment}/run-sync-get-dataset-items?token=${cand.token}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload),
                  }
                );
                if (!r.ok) return [];
                const j = await r.json();
                return Array.isArray(j) ? j : [];
              };

              let rawBatches = [];
              if (page === 0 && !isPersonNameQuery) {
                rawBatches = await Promise.all([
                  apifyFetch(`${cleanQuery} "Pangasinan State University"`, 8),
                  apifyFetch(cleanQuery, 10),
                ]);
              } else {
                rawBatches = [await apifyFetch(cleanQuery, limit)];
              }

              const rawItems = rawBatches.flat();
              if (rawItems.length > 0) {
                usedApifyToken = true;
                usedTokenName = cand.name;
                apifyRawCount = rawItems.length;

                if (cand.id && cand.id !== 'env') {
                  try {
                    db.prepare('UPDATE apify_tokens SET search_count = COALESCE(search_count, 0) + 1 WHERE id = ?').run(cand.id);
                  } catch {}
                }

                const now = new Date().toISOString();
                runInTransaction(() => {
                  for (const raw of rawItems) {
                    const item = parseApifyItem(raw);
                    if (!item) continue;

                    insertScraped.run(
                      item.id,
                      item.title,
                      JSON.stringify(item.authors),
                      item.journal,
                      item.year,
                      item.citations,
                      item.abstract,
                      item.url,
                      item.citedByLink,
                      cleanQuery,
                      now
                    );

                    addCandidateToPool(item);
                  }
                });
                break;
              }
            } catch (apifyErr) {
              console.warn('[ScholarSearch] Apify Google Scholar query error:', apifyErr.message);
            }
          }
        }
      }

      // STEP 3: Also include matching publications from Local Repository & Scraped Cache
      try {
        const repoPubs = db.prepare("SELECT * FROM publications WHERE approval_status = 'approved' ORDER BY citations DESC, year DESC").all();
        for (const rp of repoPubs) {
          const haystack = `${rp.title || ''} ${rp.authors || ''} ${rp.owner_name || ''} ${rp.journal || ''} ${rp.abstract || ''} ${rp.keywords || ''} ${rp.sdg_tags || ''} ${rp.ched_priority || ''}`.toLowerCase();
          const matchesAll = queryWords.length > 0 && queryWords.every((w) => haystack.includes(w));
          const matchesPartial = queryWords.length >= 2 && queryWords.filter((w) => haystack.includes(w)).length >= Math.ceil(queryWords.length * 0.7);
          const matchesSemantic = topicVariants.synonyms.some((s) => hasWordMatch(haystack, s)) || topicVariants.stems.some((s) => hasWordMatch(haystack, s));
          const matchesAuthor = (isPersonNameQuery || isExplicitAuthorQuery) && targetLast && hasWordMatch(haystack, targetLast) && (matchesQueriedAuthor(rp) || (isPsuItem(rp) && hasWordMatch(haystack, targetLast)));

          if (haystack.includes(bareLower) || matchesAll || matchesSemantic || matchesAuthor || (!isPersonNameQuery && matchesPartial)) {
            addCandidateToPool({
              id: rp.id,
              title: rp.title,
              authors: rp.authors,
              journal: rp.journal,
              year: rp.year,
              citations: rp.citations,
              abstract: rp.abstract,
              keywords: rp.keywords,
              url: rp.url,
              citedByLink: rp.cited_by_link,
              fromCache: true,
              owner_name: rp.owner_name,
              owner_id: rp.owner_id,
              isPsu: true,
              geo_tier: 'psu',
              source: 'institutional_repository',
            });
          }
        }

        const cachedScraped = db.prepare('SELECT * FROM scraped_publications ORDER BY citations DESC, year DESC').all();
        for (const sp of cachedScraped) {
          if (/\b(benezit dictionary|oxford art online)\b/i.test(sp.journal || '') || /\/benz\//i.test(sp.url || '')) {
            continue;
          }
          const haystack = `${sp.title || ''} ${sp.authors || ''} ${sp.journal || ''} ${sp.abstract || ''}`.toLowerCase();
          const matchesAll = queryWords.length > 0 && queryWords.every((w) => hasWordMatch(haystack, w));
          const matchesPartial = queryWords.length >= 2 && queryWords.filter((w) => hasWordMatch(haystack, w)).length >= Math.ceil(queryWords.length * 0.7);
          const matchesSemantic = topicVariants.synonyms.some((s) => hasWordMatch(haystack, s)) || topicVariants.stems.some((s) => hasWordMatch(haystack, s));
          const matchesAuthor = (isPersonNameQuery || isExplicitAuthorQuery) && targetLast && hasWordMatch(haystack, targetLast) && (matchesQueriedAuthor(sp) || (isPsuItem(sp) && hasWordMatch(haystack, targetLast)));

          if (hasWordMatch(haystack, bareLower) || matchesAll || matchesSemantic || matchesAuthor || (!isPersonNameQuery && matchesPartial)) {
            addCandidateToPool({
              id: sp.id,
              title: sp.title,
              authors: sp.authors,
              journal: sp.journal,
              year: sp.year,
              citations: sp.citations,
              abstract: sp.abstract,
              url: sp.url,
              citedByLink: sp.cited_by_link,
              fromCache: true,
            });
          }
        }
      } catch (cacheErr) {
        console.warn('[ScholarSearch] Cache lookup warning:', cacheErr.message);
      }

      // STEP 4: Supplement with OpenAlex & CrossRef across PSU, Philippines, and General academic literature
      let openAlexCrossRefCount = 0;
      try {
        const hybridQueries = [
          searchOpenAlexAndCrossRef(cleanQuery, page, limit).catch(() => []),
        ];
        if (page === 0 && !isPersonNameQuery) {
          hybridQueries.push(
            searchOpenAlexAndCrossRef(`${cleanQuery} Pangasinan State University`, 0, 8).catch(() => []),
            searchOpenAlexAndCrossRef(`${cleanQuery} Philippines`, 0, 15).catch(() => [])
          );
        } else if (page === 0 && (isPersonNameQuery || isExplicitAuthorQuery) && targetLast) {
          hybridQueries.push(
            searchOpenAlexAndCrossRef(`${targetLast} Pangasinan State University`, 0, 8)
              .then((items) => items.map((it) => ({ ...it, isPsu: true, geo_tier: 'psu' })))
              .catch(() => []),
            searchOpenAlexAndCrossRef(`${targetLast} Pangasinan`, 0, 5)
              .then((items) => items.map((it) => ({ ...it, isPsu: true, geo_tier: 'psu' })))
              .catch(() => [])
          );
        }
        const hybridArrays = await Promise.all(hybridQueries);
        const hybridItems = hybridArrays.flat();
        openAlexCrossRefCount = hybridItems.length;
        if (hybridItems.length > 0) {
          const now = new Date().toISOString();
          runInTransaction(() => {
            for (const item of hybridItems) {
              addCandidateToPool(item);
              insertScraped.run(
                item.id,
                item.title,
                JSON.stringify(item.authors),
                item.journal,
                item.year,
                item.citations,
                item.abstract || '',
                item.url || '',
                item.citedByLink || '',
                cleanQuery,
                now
              );
            }
          });
        }
      } catch (hybErr) {
        console.warn('[ScholarSearch] OpenAlex/CrossRef supplement error:', hybErr.message);
      }

      // -----------------------------------------------------------------------
      // 3-TIER RANKING SYSTEM (PSU FIRST -> PHILIPPINES SECOND -> FOREIGN THIRD)
      // -----------------------------------------------------------------------
      const isPhItem = (item) => {
        if (isPsuItem(item)) return false;
        if (item.geo_tier === 'philippines') return true;
        const text = `${item.title || ''} ${Array.isArray(item.authors) ? item.authors.join(' ') : item.authors || ''} ${item.owner_name || ''} ${item.journal || ''} ${item.abstract || ''} ${item.affiliation || ''} ${item.url || ''}`.toLowerCase();

        return (
          /\b(philippines?|filipino|pilipinas)\b/i.test(text) ||
          /\b(university of the philippines|up diliman|up los baños|uplb|up manila|up visayas|up baguio|up mindanao)\b/i.test(text) ||
          /\b(de la salle|dlsu|ateneo|admu|polytechnic university of the philippines|pup|mapua)\b/i.test(text) ||
          /\b(university of santo tomas|ust\s+(manila|hospital|faculty|college|graduate|publishing))\b/i.test(text) ||
          /\b(clsu|mmsu|bsu|vsu|wmsu|cmu|dmmmsu|tsu|isu|csu|usep|pnu|philrice|pcaarrd|seafdec|da-bar)\b/i.test(text) ||
          /\b(dost|ched|deped|denr|doh|pids)\b/i.test(text) ||
          text.includes('.edu.ph') ||
          text.includes('.gov.ph') ||
          /\.ph(\/|$)/i.test(text) ||
          /\b(metro manila|quezon city|davao city|cebu city|baguio city|iloilo city|cagayan de oro|bacolod city|zamboanga city)\b/i.test(text) ||
          /\b(nueva ecija|ilocos norte|ilocos sur|batangas|benguet|tarlac|pampanga|bulacan|laguna|bohol|leyte|bukidnon|palawan|bataan|zambales)\b/i.test(text) ||
          /\b(province of pangasinan|pangasinan province)\b/i.test(text) ||
          /\bla union,\s*philippines?\b/i.test(text) ||
          /\bcavite,\s*philippines?\b/i.test(text) ||
          /\bprovince of (la union|cavite|abra|bicol)\b/i.test(text) ||
          /\bbicol\s+(region|university|peninsula)\b/i.test(text)
        );
      };

      // HIGH-RECALL TOPIC & AUTHOR RELEVANCE FILTER
      const isTopicRelevant = (item) => {
        const authorMatch = (isPersonNameQuery || isExplicitAuthorQuery) ? matchesQueriedAuthor(item) : false;
        if (authorMatch) {
          return true;
        }

        // When searching by researcher name or explicit author:
        if (isPersonNameQuery || isExplicitAuthorQuery) {
          // Retain PSU campus research as secondary/related papers below the author's primary works
          if (isPsuItem(item)) {
            return true;
          }
          // If the paper is outside PSU and does NOT have the author, exclude it completely
          return false;
        }

        const tLower = String(item.title || '').toLowerCase();
        const absLower = String(item.abstract || '').toLowerCase();
        const kwLower = String(item.keywords || '').toLowerCase();
        const fullContent = `${tLower} ${absLower} ${kwLower}`;

        // 1. Direct query match anywhere in title, abstract, or keywords
        if (hasWordMatch(fullContent, bareLower)) return true;

        // 2. Topic stem match (e.g. "farm", "farming", "crop", "crops")
        if (topicVariants.stems.some((s) => hasWordMatch(fullContent, s))) return true;

        // 3. Domain synonym match (e.g. "farmer", "crops", "agriculture" for "farming")
        if (topicVariants.synonyms.some((s) => hasWordMatch(fullContent, s))) return true;

        // 4. For multi-word queries, require at least 50% of query words to appear in content
        if (topicVariants.topicWords.length >= 2) {
          const hits = topicVariants.topicWords.filter(
            (w) => hasWordMatch(fullContent, w) || hasWordMatch(fullContent, w.replace(/(ing|ers?|ed|s)$/i, ''))
          ).length;
          if (hits >= Math.ceil(topicVariants.topicWords.length * 0.5)) return true;
        }

        return false;
      };

      const relevantPool = Array.from(poolMap.values()).filter(isTopicRelevant);

      const computeRelevance = (item) => {
        let score = 0;
        const tLower = String(item.title || '').toLowerCase();
        const absLower = String(item.abstract || '').toLowerCase();
        const kwLower = String(item.keywords || '').toLowerCase();

        const isPsu = isPsuItem(item);
        const isPh = isPhItem(item);

        // Author match gets top priority (+1,000,000 pts for strong, +500,000 for weak/initial)
        // Guarantees all papers verified as authored by the person appear FIRST in the results
        let authorMatchQuality = false;
        if (isPersonNameQuery || isExplicitAuthorQuery) {
          authorMatchQuality = matchesQueriedAuthor(item);
          if (authorMatchQuality === 'strong') {
            score += 1000000;
          } else if (authorMatchQuality === 'weak') {
            score += 500000;
          }
        }

        // Content Relevance Scoring:
        // Title exact/word match gets primary boost
        if (hasWordMatch(tLower, bareLower)) {
          score += 300;
          if (tLower === bareLower || tLower.startsWith(bareLower)) score += 150;
        } else if (hasWordMatch(absLower, bareLower)) {
          // Deep content/abstract match (e.g. Arduino or specific methods used in text)
          score += 180;
        } else if (hasWordMatch(kwLower, bareLower)) {
          score += 150;
        }

        // Stem hits
        for (const s of topicVariants.stems) {
          if (hasWordMatch(tLower, s)) score += 50;
          if (hasWordMatch(absLower, s)) score += 25;
          if (hasWordMatch(kwLower, s)) score += 25;
        }

        // Domain synonym hits
        for (const syn of topicVariants.synonyms) {
          if (hasWordMatch(tLower, syn)) score += 40;
          if (hasWordMatch(absLower, syn)) score += 20;
        }

        // 3-TIER HIERARCHY (ONLY FOR VERIFIED RELEVANT PAPERS):
        // Tier 1: PSU Papers about this Topic (+100,000 pts)
        // Tier 2: Philippines Papers about this Topic (+10,000 pts)
        // Tier 3: Foreign Papers (+0 pts)
        if (isPsu) {
          score += 100000;
        } else if (isPh) {
          score += 10000;
        }

        // Citation impact logarithmic score
        const cits = Number(item.citations) || 0;
        score += Math.min(50, Math.log10(cits + 1) * 15);

        // Recent papers slightly boosted
        const yr = Number(item.year) || 0;
        if (yr >= 2020) score += 5;

        return score;
      };

      const allRankedResults = relevantPool
        .map((item) => ({ ...item, _score: computeRelevance(item) }))
        .sort((a, b) => (b._score || 0) - (a._score || 0));

      const startIndex = page * limit;
      const pageResults = allRankedResults.slice(startIndex, startIndex + limit);

      // Auto-tag each result with its UN SDG Focus Track and author-match badges
      for (const item of pageResults) {
        if (!item.sdg_tags || item.sdg_tags.length === 0) {
          const sdgClass = localHeuristicSDG(item.title, item.abstract);
          item.sdg_tags = [sdgClass.primarySDG, sdgClass.secondarySDG];
          item.primary_sdg = sdgClass.primarySDG;
          item.secondary_sdg = sdgClass.secondarySDG;
          item.sdg_rationale = sdgClass.rationale;
          item.ched_priority = sdgClass.chedPriority;
        }

        // Tag verified author match status for UI badging
        const authorMatch = (isPersonNameQuery || isExplicitAuthorQuery) ? matchesQueriedAuthor(item) : false;
        item.isAuthorMatch = authorMatch === 'strong' || authorMatch === 'weak';
        item.isRelatedMatch = !item.isAuthorMatch && isPsuItem(item);

        // Label the geographical tier for UI badging
        if (isPsuItem(item)) {
          item.geo_tier = 'psu';
          item.geo_tier_label = 'Pangasinan State University';
        } else if (isPhItem(item)) {
          item.geo_tier = 'philippines';
          item.geo_tier_label = 'Philippines Research';
        } else {
          item.geo_tier = 'international';
          item.geo_tier_label = 'International Literature';
        }
      }

      // Determine if more results are available on the next page:
      // 1) Our pool has more items beyond the current page, OR
      // 2) Upstream APIs (Google Scholar / Apify / CrossRef) can deliver more on the next page
      const hasMoreInPool = allRankedResults.length > startIndex + limit;
      const hasMoreUpstream = !matchedScholarProfile && (apifyRawCount >= 4 || openAlexCrossRefCount >= 8 || liveResults.length >= limit);
      const hasMore = pageResults.length > 0 && (hasMoreInPool || hasMoreUpstream);

      if (pageResults.length === 0 && captchaBlocked && !usedApifyToken) {
        return sendJson(200, await attachTokenUsage({
          results: [],
          fromCache: false,
          searchSource: 'none',
          sourceLabel: 'No Token Configured',
          count: 0,
          page,
          hasMore: false,
          requiresApify: true,
          captchaDetected: true,
          usedToken: false,
          message: 'Google Scholar presented a CAPTCHA challenge ("unusual traffic"). Connect an Apify token to bypass the anti-bot lock.',
        }));
      }

      const sourceType = usedApifyToken
        ? 'apify'
        : matchedScholarProfile || liveResults.length > 0
        ? 'direct'
        : 'direct';
      const sourceLabel = usedApifyToken
        ? `Google Scholar (Apify: ${usedTokenName})`
        : matchedScholarProfile
        ? 'Official Google Scholar Profile (0 tokens)'
        : 'Live Google Scholar + Academic Index (0 tokens)';

      return sendJson(200, await attachTokenUsage({
        results: pageResults,
        fromCache: false,
        searchSource: sourceType,
        sourceLabel,
        usedToken: usedApifyToken,
        page,
        hasMore,
        totalAvailable: allRankedResults.length,
        count: pageResults.length,
        message: `Retrieved ${pageResults.length} papers (${allRankedResults.length} total matched for "${bareQuery}").`,
      }, usedApifyToken));
    }

    // ----------------------------------------------------
    // 6. RESEARCH CLAIMS & PENDING PUBLICATION APPROVALS
    // ----------------------------------------------------
    if (pathname === '/api/claims' && method === 'GET') {
      cleanupOrphanedPublications(db);
      const caller = authenticateCaller(req);
      let claims = db.prepare(`
        SELECT * FROM publications WHERE approval_status = 'pending' ORDER BY created_at DESC
      `).all();

      // Application-Level Tenant Isolation:
      // Non-admins only see claims they submitted
      if (!isCallerAdmin(caller)) {
        if (!caller) {
          return sendJson(200, []);
        }
        claims = claims.filter((c) => isCallerPublicationOwner(c, caller));
      }

      return sendJson(200, claims.map((c) => ({
        ...c,
        ownerId: c.owner_id,
        ownerName: c.owner_name,
        approvalStatus: c.approval_status,
        researchStatus: c.research_status,
        authors: JSON.parse(c.authors || '[]'),
      })));
    }

    if (pathname.startsWith('/api/claims/') && pathname.endsWith('/review') && method === 'POST') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Only administrators can review research claims.' });
      }
      const claimId = pathname.replace('/api/claims/', '').replace('/review', '');
      const { status } = await readJsonBody(); // 'approved' or 'rejected'

      if (status === 'rejected') {
        db.prepare('DELETE FROM citing_papers WHERE publication_id = ?').run(claimId);
        db.prepare('DELETE FROM citation_trends WHERE publication_id = ?').run(claimId);
        db.prepare('DELETE FROM publications WHERE id = ?').run(claimId);
      } else {
        db.prepare('UPDATE publications SET approval_status = ? WHERE id = ?').run(status, claimId);
      }

      // Synchronize researcher publication & citation counts
      const allRes = db.prepare('SELECT id FROM researchers').all();
      for (const resRow of allRes) {
        updateResearcherStats(db, resRow.id);
      }

      return sendJson(200, {
        success: true,
        message: status === 'approved'
          ? 'Publication claim approved and saved to the repository!'
          : 'Publication claim rejected and removed.',
      });
    }

    // ----------------------------------------------------
    // 7. APIFY TOKENS MANAGEMENT (Multi-Token support)
    // ----------------------------------------------------
    if (pathname.startsWith('/api/apify/tokens') && pathname !== '/api/apify/tokens/active/usage') {
      const caller = authenticateCaller(req);
      if (!isCallerAdmin(caller)) {
        return sendJson(403, { error: 'Forbidden: Administrator privileges required.' });
      }
    }

    if (pathname === '/api/apify/tokens/active/usage' && method === 'GET') {
      const active = getActiveApifyTokenRow();
      if (!active) {
        return sendJson(200, { hasActiveToken: false, tokenUsage: null });
      }
      const usage = await fetchApifyTokenUsage(active, true);
      return sendJson(200, { hasActiveToken: true, tokenUsage: usage });
    }

    if (pathname === '/api/apify/tokens' && method === 'GET') {
      const rows = db.prepare(`
        SELECT id, name, actor_id, is_active, status, username, plan, created_at, last_tested_at,
               search_count, monthly_usage_usd, max_monthly_usage_usd, cycle_end_at, total_runs,
               SUBSTR(token, 1, 10) || '...' || SUBSTR(token, -4) as masked_token
        FROM apify_tokens
        ORDER BY created_at DESC
      `).all();

      return sendJson(200, rows.map((r) => ({
        id: r.id,
        name: r.name,
        actorId: r.actor_id,
        isActive: Boolean(r.is_active),
        status: r.status,
        username: r.username,
        plan: r.plan,
        createdAt: r.created_at,
        lastTestedAt: r.last_tested_at,
        maskedToken: r.masked_token,
        searchCount: Number(r.search_count) || 0,
        monthlyUsageUsd: Number(r.monthly_usage_usd) || 0,
        maxMonthlyUsageUsd: Number(r.max_monthly_usage_usd) || 5,
        cycleEndAt: r.cycle_end_at || null,
        totalRuns: r.total_runs !== null ? Number(r.total_runs) : null,
      })));
    }

    if (pathname === '/api/apify/tokens' && method === 'POST') {
      const { name, token, actorId } = await readJsonBody();
      if (!token || !token.trim()) {
        return sendJson(400, { error: 'Apify API token is required' });
      }

      const cleanToken = token.trim();
      const tokenName = (name || '').trim() || `Token ${Date.now().toString().slice(-4)}`;
      const cleanActorId = ((actorId || '').trim() || 'johnvc~google-scholar-api').replace('/', '~');
      const id = `tok-${Date.now()}`;
      const now = new Date().toISOString();

      let status = 'untested';
      let username = null;
      let plan = null;

      try {
        const testRes = await fetch('https://api.apify.com/v2/users/me', {
          headers: { Authorization: `Bearer ${cleanToken}` },
        });
        if (testRes.ok) {
          const userJson = await testRes.json();
          status = 'valid';
          username = userJson.data?.username || userJson.data?.id || null;
          plan = userJson.data?.plan?.id || 'Free';
        } else {
          status = 'invalid';
        }
      } catch {
        status = 'untested';
      }

      const count = db.prepare('SELECT count(*) as c FROM apify_tokens').get().c;
      const isActive = count === 0 ? 1 : 0;

      db.prepare(`
        INSERT INTO apify_tokens (id, name, token, actor_id, is_active, status, username, plan, created_at, last_tested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, tokenName, cleanToken, cleanActorId, isActive, status, username, plan, now, status !== 'untested' ? now : null);

      return sendJson(201, {
        success: true,
        message: status === 'valid' ? 'Token verified and connected successfully!' : 'Token added.',
        token: {
          id,
          name: tokenName,
          actorId: cleanActorId,
          isActive: Boolean(isActive),
          status,
          username,
          plan,
          maskedToken: cleanToken.slice(0, 10) + '...' + cleanToken.slice(-4),
        },
      });
    }

    if (pathname.startsWith('/api/apify/tokens/') && pathname.endsWith('/activate') && method === 'PUT') {
      const id = pathname.replace('/api/apify/tokens/', '').replace('/activate', '');
      db.prepare('UPDATE apify_tokens SET is_active = 0').run();
      db.prepare('UPDATE apify_tokens SET is_active = 1 WHERE id = ?').run(id);
      return sendJson(200, { success: true, message: 'Token set as active' });
    }

    if (pathname.startsWith('/api/apify/tokens/') && pathname.endsWith('/test') && method === 'POST') {
      const id = pathname.replace('/api/apify/tokens/', '').replace('/test', '');
      const item = db.prepare('SELECT * FROM apify_tokens WHERE id = ?').get(id);
      if (!item) {
        return sendJson(404, { error: 'Token not found' });
      }

      try {
        const testRes = await fetch('https://api.apify.com/v2/users/me', {
          headers: { Authorization: `Bearer ${item.token}` },
        });
        const now = new Date().toISOString();
        if (testRes.ok) {
          const userJson = await testRes.json();
          const username = userJson.data?.username || userJson.data?.id || null;
          const plan = userJson.data?.plan?.id || 'Active';
          db.prepare('UPDATE apify_tokens SET status = ?, username = ?, plan = ?, last_tested_at = ? WHERE id = ?')
            .run('valid', username, plan, now, id);
          return sendJson(200, { success: true, status: 'valid', username, plan, message: 'Token is valid and active on Apify!' });
        } else {
          db.prepare('UPDATE apify_tokens SET status = ?, last_tested_at = ? WHERE id = ?')
            .run('invalid', now, id);
          return sendJson(400, { success: false, status: 'invalid', message: `Token rejected by Apify (${testRes.status})` });
        }
      } catch (err) {
        return sendJson(500, { error: `Failed to test token: ${err.message}` });
      }
    }

    if (pathname.startsWith('/api/apify/tokens/') && method === 'DELETE') {
      const id = pathname.replace('/api/apify/tokens/', '');
      db.prepare('DELETE FROM apify_tokens WHERE id = ?').run(id);
      const active = db.prepare('SELECT id FROM apify_tokens WHERE is_active = 1').get();
      if (!active) {
        const first = db.prepare('SELECT id FROM apify_tokens ORDER BY created_at DESC LIMIT 1').get();
        if (first) {
          db.prepare('UPDATE apify_tokens SET is_active = 1 WHERE id = ?').run(first.id);
        }
      }
      return sendJson(200, { success: true, message: 'Token removed' });
    }

    // ----------------------------------------------------
    // INTELLIGENCE & CAPSTONE INNOVATIONS API ENDPOINTS
    // ----------------------------------------------------

    // 1. System Intelligence Status
    if (pathname === '/api/intelligence/system-status' && method === 'GET') {
      const totalPubs = db.prepare('SELECT COUNT(*) as count FROM publications').get()?.count || 0;
      const totalResearchers = db.prepare('SELECT COUNT(*) as count FROM researchers').get()?.count || 0;
      const classifiedPubs = db.prepare("SELECT COUNT(*) as count FROM publications WHERE sdg_tags IS NOT NULL AND sdg_tags != ''").get()?.count || 0;
      const hasKey = Boolean(process.env.GEMINI_API_KEY);

      return sendJson(200, {
        status: 'online',
        aiEngine: hasKey ? 'Google Gemini 3.5 Flash (Active)' : 'Local Heuristic Engine',
        aiModel: 'gemini-3.5-flash',
        keyConfigured: hasKey,
        dbSync: isTursoConfigured ? 'Turso Cloud Replicated (WAL)' : 'Local SQLite (WAL)',
        totalPublications: totalPubs,
        totalResearchers,
        classifiedPublications: classifiedPubs,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Classify Single Publication (SDG + Journal Reputation)
    if (pathname === '/api/ai/classify-sdg' && method === 'POST') {
      const { publicationId, title, abstract, journal, doi } = await readJsonBody();
      let targetTitle = title;
      let targetAbstract = abstract;
      let targetJournal = journal;
      let targetDoi = doi || '';
      let existingPub = null;

      if (publicationId) {
        existingPub = db.prepare('SELECT * FROM publications WHERE id = ?').get(publicationId);
        if (existingPub) {
          targetTitle = existingPub.title;
          targetAbstract = existingPub.abstract;
          targetJournal = existingPub.journal;
          targetDoi = existingPub.doi || targetDoi;
        }
      }

      if (!targetTitle) {
        return sendJson(400, { error: 'Publication title is required' });
      }

      const sdgResult = await classifyPublicationSDG(targetTitle, targetAbstract, targetJournal, targetDoi);
      const auditResult = auditJournalReputation(targetJournal);
      const tags = [sdgResult.primarySDG, sdgResult.secondarySDG].filter(Boolean);
      const tagsJson = JSON.stringify(tags);
      const evidenceJson = JSON.stringify(sdgResult.evidence || null);

      if (publicationId && existingPub) {
        const shouldUpdateAbstract = sdgResult.recoveredAbstract && (!existingPub.abstract || existingPub.abstract.length < 50);
        if (shouldUpdateAbstract) {
          db.prepare(`
            UPDATE publications
            SET sdg_tags = ?, sdg_rationale = ?, sdg_source = ?, sdg_evidence = ?, ched_priority = ?,
                journal_indexing = ?, jc3_points = ?, nbc461_points = ?, is_predatory_flag = ?,
                abstract = ?
            WHERE id = ?
          `).run(
            tagsJson,
            sdgResult.rationale,
            sdgResult.source || 'auto',
            evidenceJson,
            sdgResult.chedPriority,
            auditResult.indexing,
            auditResult.jc3Points,
            auditResult.nbc461Points,
            auditResult.isPredatory,
            sdgResult.recoveredAbstract,
            publicationId
          );
        } else {
          db.prepare(`
            UPDATE publications
            SET sdg_tags = ?, sdg_rationale = ?, sdg_source = ?, sdg_evidence = ?, ched_priority = ?,
                journal_indexing = ?, jc3_points = ?, nbc461_points = ?, is_predatory_flag = ?
            WHERE id = ?
          `).run(
            tagsJson,
            sdgResult.rationale,
            sdgResult.source || 'auto',
            evidenceJson,
            sdgResult.chedPriority,
            auditResult.indexing,
            auditResult.jc3Points,
            auditResult.nbc461Points,
            auditResult.isPredatory,
            publicationId
          );
        }
      }

      return sendJson(200, {
        success: true,
        publicationId,
        sdg: sdgResult,
        audit: auditResult,
      });
    }

    // 3. Batch Classify All Unclassified Publications
    if (pathname === '/api/ai/batch-classify-sdg' && method === 'POST') {
      const unclassified = db.prepare(`
        SELECT id, title, abstract, journal, doi
        FROM publications 
        WHERE (sdg_tags IS NULL OR sdg_tags = '' OR sdg_tags = '[]' OR sdg_tags = '["General Research"]')
          AND (sdg_source IS NULL OR sdg_source != 'manual_override')
        LIMIT 60
      `).all();

      let processed = 0;
      for (const pub of unclassified) {
        try {
          const sdgResult = await classifyPublicationSDG(pub.title, pub.abstract, pub.journal, pub.doi);
          const auditResult = auditJournalReputation(pub.journal);
          const tags = [sdgResult.primarySDG, sdgResult.secondarySDG].filter(Boolean);
          const tagsJson = JSON.stringify(tags);
          const evidenceJson = JSON.stringify(sdgResult.evidence || null);

          const shouldUpdateAbstract = sdgResult.recoveredAbstract && (!pub.abstract || pub.abstract.length < 50);
          if (shouldUpdateAbstract) {
            db.prepare(`
              UPDATE publications
              SET sdg_tags = ?, sdg_rationale = ?, sdg_source = ?, sdg_evidence = ?, ched_priority = ?,
                  journal_indexing = ?, jc3_points = ?, nbc461_points = ?, is_predatory_flag = ?,
                  abstract = ?
              WHERE id = ?
            `).run(
              tagsJson,
              sdgResult.rationale,
              sdgResult.source || 'auto',
              evidenceJson,
              sdgResult.chedPriority,
              auditResult.indexing,
              auditResult.jc3Points,
              auditResult.nbc461Points,
              auditResult.isPredatory,
              sdgResult.recoveredAbstract,
              pub.id
            );
          } else {
            db.prepare(`
              UPDATE publications
              SET sdg_tags = ?, sdg_rationale = ?, sdg_source = ?, sdg_evidence = ?, ched_priority = ?,
                  journal_indexing = ?, jc3_points = ?, nbc461_points = ?, is_predatory_flag = ?
              WHERE id = ?
            `).run(
              tagsJson,
              sdgResult.rationale,
              sdgResult.source || 'auto',
              evidenceJson,
              sdgResult.chedPriority,
              auditResult.indexing,
              auditResult.jc3Points,
              auditResult.nbc461Points,
              auditResult.isPredatory,
              pub.id
            );
          }
          processed++;
        } catch (err) {
          console.warn(`[Batch Classify] Failed for pub ${pub.id}:`, err.message);
        }
      }

      return sendJson(200, {
        success: true,
        processed,
        remaining: Math.max(0, unclassified.length - processed),
      });
    }

    // 4. Ask Campus Intelligence (Academic RAG)
    if (pathname === '/api/ai/ask-campus' && method === 'POST') {
      const { question, history } = await readJsonBody();
      if (!question || !question.trim()) {
        return sendJson(400, { error: 'Question is required' });
      }

      const caller = authenticateCaller(req);

      const approvedPubs = db.prepare(`
        SELECT id, title, authors, year, journal, citations, abstract, sdg_tags, sdg_rationale, ched_priority, jc3_points, nbc461_points, owner_name, owner_id
        FROM publications
        WHERE approval_status = 'approved'
        ORDER BY citations DESC, year DESC
        LIMIT 500
      `).all();

      // Campus publications: STRICTLY approved institutional publications of PSU Asingan
      // External scraped search results are deliberately excluded to prevent confusing external works with campus research
      const combinedPubs = [...approvedPubs];

      const pubTotals = db.prepare(`
        SELECT COUNT(*) AS total, COALESCE(SUM(citations), 0) AS citations
        FROM publications WHERE approval_status = 'approved'
      `).get();

      const researchers = db.prepare(`
        SELECT id, instructor_id, name, department, total_publications, total_citations
        FROM researchers
      `).all();

      let currentUser = null;
      if (caller) {
        const callerPubs = db.prepare(`
          SELECT COUNT(*) as total, COALESCE(SUM(citations), 0) as citations
          FROM publications
          WHERE (owner_id = ? OR owner_id = ?) AND approval_status = 'approved'
        `).get(caller.id, caller.instructorId || caller.id);

        currentUser = {
          id: caller.id,
          name: caller.name,
          role: caller.role,
          department: caller.department || 'Faculty',
          username: caller.username,
          instructorId: caller.instructorId,
          publicationsCount: Number(callerPubs?.total) || 0,
          citationsCount: Number(callerPubs?.citations) || 0,
        };
      }

      const totalCitations = Number(pubTotals?.citations) || 0;

      const systemMetadata = {
        totalPublications: Number(pubTotals?.total) || approvedPubs.length,
        totalResearchers: researchers.length,
        researchersList: researchers.map(r => `${r.name} (${r.department || 'Faculty'}, ${r.total_publications} papers, ${r.total_citations} citations)`),
        totalCitations,
        currentUser,
        pages: [
          'Dashboard (/): Overall institutional analytics, top 5 researchers chart, department year-by-year comparison.',
          'Publications (/publications): Central repository of approved research, researcher dropdown filter, citation/year sorting, APA citation export, and publication status tracking.',
          'Researchers Directory (/researchers): Directory of all university researchers across departments with publication totals and citation metrics.',
          'Global Academic Search (/search): Multi-engine scholarly search across Google Scholar, CrossRef, and OpenAlex with automatic deduplication and campus-priority ranking.',
          'SDG Impact Matrix (/sdg-matrix): Interactive matrix categorizing research across all 17 UN Sustainable Development Goals and CHED priority disciplines.',
          'Research Inspector Drawer: Detailed drawer per publication showing JC3 (KRA II) points, citation growth graph, citing paper links, and journal accreditation/indexing audit.',
          'Accreditation Reporting Hub (/reports): Generates exportable Excel spreadsheets and summaries for CHED audits, SUC Leveling, and AACCUP accreditation.',
          'Admin Portal (/admin): User management, sending secure email invites, approving self-registered accounts.'
        ],
        jc3Guidelines: {
          tiers: 'Scopus/Web of Science = 50 pts; CHED Recognized/International Refereed/ACI = 30 pts; National/Regional Refereed = 20 pts; Refereed Conference/Institutional = 10 pts; Institutional Baseline = 5 pts',
          authorship: 'Sole Author = 100% of base points; Lead Author = 60%; Co-Authors = share remaining 40% equally, or declared % share',
          kraII: 'DBM-CHED JC No. 3, s. 2022 evaluates KRA II: Research, Invention, and Creative Work with a maximum cap of 100 points per cycle. Valid Scopus/WoS citations earn +5.0 points each.'
        },
        accreditationGuidelines: {
          aaccup: 'AACCUP evaluates program quality and faculty research culture. It does not use individual publication point quotas, but requires documented verified faculty publications and institutional impact.',
          sucLeveling: 'SUC Leveling assesses state university research productivity, citation counts, and community development impact.'
        }
      };

      try {
        const ragResult = await askCampusIntelligence(question, combinedPubs, systemMetadata, history || []);
        return sendJson(200, ragResult);
      } catch (err) {
        console.error('[AskCampusAPI] Error in askCampusIntelligence:', err);
        return sendJson(200, {
          answer: "Hello! I am Campus AI for PSU Asingan. I am here to help you navigate our campus research, faculty publications, and institutional metrics. How can I assist you today?",
          citedPapers: [],
          source: 'heuristic',
        });
      }
    }

    // Campus AI Chat History Endpoints
    if (pathname === '/api/ai/chat-sessions' && method === 'GET') {
      const caller = authenticateCaller(req);
      const reqUserId = url.searchParams.get('userId');
      let rows;

      if (caller && caller.role === 'admin') {
        if (reqUserId) {
          rows = db.prepare('SELECT * FROM ai_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC').all(reqUserId);
        } else {
          rows = db.prepare('SELECT * FROM ai_chat_sessions ORDER BY updated_at DESC').all();
        }
      } else if (caller) {
        // Application-Level Tenant Isolation: Faculty can ONLY access their own AI chat sessions
        rows = db.prepare(`
          SELECT * FROM ai_chat_sessions 
          WHERE user_id = ? OR user_id = ?
          ORDER BY updated_at DESC
        `).all(caller.id, caller.username);
      } else {
        // Visitor/guest
        rows = db.prepare("SELECT * FROM ai_chat_sessions WHERE user_id = 'guest' OR user_id IS NULL ORDER BY updated_at DESC").all();
      }

      const sessions = rows.map((r) => {
        let messages = [];
        try {
          messages = JSON.parse(r.messages_json || '[]');
        } catch {
          messages = [];
        }
        return {
          id: r.id,
          userId: r.user_id,
          title: r.title,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          messages,
        };
      });

      return sendJson(200, { sessions });
    }

    if (pathname === '/api/ai/chat-sessions' && method === 'POST') {
      const body = await readJsonBody();
      const { id, userId, title, messages } = body;
      if (!id || !title || !Array.isArray(messages)) {
        return sendJson(400, { error: 'Invalid session payload' });
      }

      const caller = authenticateCaller(req);
      const effectiveUserId = caller ? caller.id : (userId || 'guest');

      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id, user_id, created_at FROM ai_chat_sessions WHERE id = ?').get(id);

      // Ownership check: If updating an existing session, verify caller is owner or admin
      if (existing) {
        if (caller && caller.role !== 'admin' && existing.user_id !== caller.id && existing.user_id !== caller.username) {
          return sendJson(403, { error: 'Forbidden: You cannot modify another user’s chat session.' });
        }
        db.prepare(`
          UPDATE ai_chat_sessions 
          SET title = ?, messages_json = ?, updated_at = ?
          WHERE id = ?
        `).run(title, JSON.stringify(messages), now, id);
      } else {
        db.prepare(`
          INSERT INTO ai_chat_sessions (id, user_id, title, messages_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, effectiveUserId, title, JSON.stringify(messages), now, now);
      }

      return sendJson(200, { success: true, id });
    }

    if (pathname === '/api/ai/chat-sessions' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      const clearAll = url.searchParams.get('clearAll') === 'true';
      const caller = authenticateCaller(req);

      if (id) {
        const existing = db.prepare('SELECT id, user_id FROM ai_chat_sessions WHERE id = ?').get(id);
        if (existing) {
          if (caller && caller.role !== 'admin' && existing.user_id !== caller.id && existing.user_id !== caller.username) {
            return sendJson(403, { error: 'Forbidden: You cannot delete another user’s chat session.' });
          }
          db.prepare('DELETE FROM ai_chat_sessions WHERE id = ?').run(id);
        }
        return sendJson(200, { success: true, deletedId: id });
      }

      if (clearAll) {
        if (caller && caller.role !== 'admin') {
          db.prepare('DELETE FROM ai_chat_sessions WHERE user_id = ? OR user_id = ?').run(caller.id, caller.username || '');
        } else if (caller && caller.role === 'admin') {
          const reqUserId = url.searchParams.get('userId');
          if (reqUserId) {
            db.prepare('DELETE FROM ai_chat_sessions WHERE user_id = ?').run(reqUserId);
          } else {
            db.prepare('DELETE FROM ai_chat_sessions').run();
          }
        } else {
          db.prepare("DELETE FROM ai_chat_sessions WHERE user_id = 'guest' OR user_id IS NULL").run();
        }
        return sendJson(200, { success: true, cleared: true });
      }

      return sendJson(400, { error: 'Missing session id or clearAll parameter' });
    }

    // 5. UN SDG Aggregated Analytics (for Radar & Matrix Views)
    if (pathname === '/api/intelligence/sdg-stats' && method === 'GET') {
      const ALL_SDGS = [
        'SDG 1: No Poverty',
        'SDG 2: Zero Hunger',
        'SDG 3: Good Health and Well-being',
        'SDG 4: Quality Education',
        'SDG 5: Gender Equality',
        'SDG 6: Clean Water and Sanitation',
        'SDG 7: Affordable and Clean Energy',
        'SDG 8: Decent Work and Economic Growth',
        'SDG 9: Industry, Innovation and Infrastructure',
        'SDG 10: Reduced Inequalities',
        'SDG 11: Sustainable Cities and Communities',
        'SDG 12: Responsible Consumption and Production',
        'SDG 13: Climate Action',
        'SDG 14: Life Below Water',
        'SDG 15: Life on Land',
        'SDG 16: Peace, Justice and Strong Institutions',
        'SDG 17: Partnerships for the Goals',
      ];

      const pubs = db.prepare(`
        SELECT id, title, authors, abstract, journal, year, citations, url,
               sdg_tags, sdg_rationale, ched_priority, owner_id, owner_name,
               journal_indexing, jc3_points, nbc461_points
        FROM publications
        WHERE approval_status = 'approved'
        ORDER BY citations DESC, year DESC
      `).all();

      const sdgCounts = {};
      ALL_SDGS.forEach(sdg => { sdgCounts[sdg] = { count: 0, papers: [] }; });

      const pendingReviewPapers = [];

      pubs.forEach(p => {
        let tags = [];
        try {
          const parsed = JSON.parse(p.sdg_tags || '[]');
          tags = Array.isArray(parsed) ? parsed : [p.sdg_tags];
        } catch {
          tags = p.sdg_tags ? [p.sdg_tags] : [];
        }

        // If unclassified, apply deep 17-SDG lexical heuristic (with confidence check)
        if (tags.length === 0) {
          const classified = localHeuristicSDG(p.title || '', p.abstract || '', '');
          if (classified && classified.primarySDG && classified.primarySDG !== 'Pending Review') {
            tags.push(classified.primarySDG);
            if (classified.secondarySDG && classified.secondarySDG !== 'Pending Review') {
              tags.push(classified.secondarySDG);
            }
          }
        }

        let authorsArr = [];
        try {
          const parsed = JSON.parse(p.authors || '[]');
          authorsArr = Array.isArray(parsed) ? parsed : [p.authors];
        } catch {
          authorsArr = typeof p.authors === 'string' ? p.authors.split(',') : [p.authors || ''];
        }

        const extractSDGNum = (str) => {
          if (!str) return null;
          const m = String(str).match(/\bSDG\s*(\d{1,2})\b/i);
          return m ? parseInt(m[1], 10) : null;
        };

        let rationalesMap = {};
        let rawRationale = p.sdg_rationale || '';
        try {
          const parsed = JSON.parse(rawRationale || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            rationalesMap = parsed;
          }
        } catch {}

        let dbNeedsRationaleUpdate = false;
        const cleanT = (p.title || '').replace(/^\[.*?\]\s*/, '');

        const getTailoredRationale = (targetKey) => {
          const targetNum = extractSDGNum(targetKey);
          for (const [k, v] of Object.entries(rationalesMap)) {
            const kNum = extractSDGNum(k);
            const matchesKey = k === targetKey || k.toLowerCase() === targetKey.toLowerCase() || (targetNum !== null && kNum !== null && targetNum === kNum);
            if (matchesKey) {
              if (!isGenericBoilerplate(v)) return v;
            }
          }
          if (rawRationale && !rawRationale.startsWith('{') && !isGenericBoilerplate(rawRationale)) {
            return rawRationale;
          }
          const bespoke = buildDynamicSDGRationale(targetKey, cleanT, p.abstract || '', []);
          rationalesMap[targetKey] = bespoke;
          dbNeedsRationaleUpdate = true;
          return bespoke;
        };

        // Cleanse any generic boilerplate entries in rationalesMap so client never receives repetitive patterns
        for (const [k, v] of Object.entries(rationalesMap)) {
          if (isGenericBoilerplate(v)) {
            rationalesMap[k] = buildDynamicSDGRationale(k, cleanT, p.abstract || '', []);
            dbNeedsRationaleUpdate = true;
          }
        }

        // Auto-heal database row and replicate to Turso Cloud if boilerplate was purged
        if (dbNeedsRationaleUpdate) {
          try {
            db.prepare('UPDATE publications SET sdg_rationale = ? WHERE id = ?').run(JSON.stringify(rationalesMap), p.id);
          } catch {}
        }

        const paperItem = {
          id: p.id,
          title: p.title,
          authors: authorsArr,
          journal: p.journal || 'Academic Journal',
          year: p.year,
          citations: p.citations || 0,
          abstract: p.abstract || '',
          url: p.url || '',
          sdgRationale: rawRationale,
          sdgRationales: rationalesMap,
          chedPriority: p.ched_priority || '',
          sdgTags: tags,
          ownerName: p.owner_name || '',
          journalIndexing: p.journal_indexing || 'Institutional Archive',
          jc3Points: p.jc3_points !== null && p.jc3_points !== undefined ? Number(p.jc3_points) : (p.nbc461_points ? (p.nbc461_points >= 25 ? 50 : 30) : 10),
          nbc461Points: p.nbc461_points || 5.0,
        };

        // Strict 1:1 Focus SDG Mapping for Institutional Aggregations
        // The first tag is the primary focus goal; subsequent tags are secondary co-alignments
        const focusTag = tags[0];
        const secondaryTags = tags.slice(1);
        let hasMatchedAnySDG = false;

        if (focusTag) {
          const tagNum = extractSDGNum(focusTag);
          const matchKey = ALL_SDGS.find(s => {
            const sNum = extractSDGNum(s);
            if (tagNum !== null && sNum !== null) {
              return tagNum === sNum;
            }
            return s.toLowerCase() === String(focusTag).toLowerCase();
          });

          if (matchKey) {
            hasMatchedAnySDG = true;
            sdgCounts[matchKey].count += 1;
            const tailoredRationale = getTailoredRationale(matchKey);
            sdgCounts[matchKey].papers.push({
              ...paperItem,
              primaryFocusSDG: matchKey,
              secondarySDGs: secondaryTags,
              sdgRationale: tailoredRationale,
            });
          }
        }

        if (!hasMatchedAnySDG) {
          pendingReviewPapers.push(paperItem);
        }
      });

      const radarData = ALL_SDGS.map(sdg => {
        const shortName = sdg.split(':')[0].trim();
        const fullName = sdg.split(':')[1]?.trim() || sdg;
        return {
          sdg: shortName,
          fullName,
          count: sdgCounts[sdg].count,
          fullLabel: sdg,
          papers: sdgCounts[sdg].papers,
        };
      });

      return sendJson(200, {
        radarData,
        totalClassified: pubs.length - pendingReviewPapers.length,
        pendingReviewCount: pendingReviewPapers.length,
        pendingReviewPapers,
        chedPriorities: [
          { priority: 'Food Security & Agriculture', count: pubs.filter(p => (p.ched_priority || '').includes('Food') || (p.title || '').toLowerCase().includes('crop')).length },
          { priority: 'Smart Education & Pedagogy', count: pubs.filter(p => (p.ched_priority || '').includes('Education') || (p.title || '').toLowerCase().includes('learn')).length },
          { priority: 'IT & Digital Governance', count: pubs.filter(p => (p.ched_priority || '').includes('Information') || (p.title || '').toLowerCase().includes('system')).length },
          { priority: 'Climate & Disaster Resilience', count: pubs.filter(p => (p.ched_priority || '').includes('Disaster') || (p.title || '').toLowerCase().includes('flood')).length },
        ],
      });
    }

    // 6. Co-Authorship Knowledge Graph & Synergy Engine
    if (pathname === '/api/intelligence/network-graph' && method === 'GET') {
      const researchers = db.prepare('SELECT id, instructor_id, name, department, photo_url, total_publications, total_citations FROM researchers').all();
      const publications = db.prepare('SELECT id, title, authors, year, journal FROM publications WHERE approval_status = \'approved\'').all();

      // Nodes for researchers
      const nodes = researchers.map(r => ({
        id: r.id,
        name: r.name,
        department: r.department,
        publications: r.total_publications || 0,
        citations: r.total_citations || 0,
        photoUrl: r.photo_url,
      }));

      // Edges for shared publications
      const links = [];
      const linkMap = new Map();

      publications.forEach(pub => {
        let pubAuthors = [];
        try {
          pubAuthors = JSON.parse(pub.authors || '[]');
        } catch {
          pubAuthors = [pub.authors || ''];
        }

        // Find all researchers matching this publication
        const matchedResearchers = researchers.filter(r => matchesResearcher(pub, r));

        for (let i = 0; i < matchedResearchers.length; i++) {
          for (let j = i + 1; j < matchedResearchers.length; j++) {
            const r1 = matchedResearchers[i].id;
            const r2 = matchedResearchers[j].id;
            const key = [r1, r2].sort().join('--');

            if (linkMap.has(key)) {
              const edge = linkMap.get(key);
              edge.weight += 1;
              edge.papers.push(pub.title);
            } else {
              const edge = {
                source: r1,
                target: r2,
                weight: 1,
                papers: [pub.title],
              };
              linkMap.set(key, edge);
              links.push(edge);
            }
          }
        }
      });

      // Synergy Recommendations: Find cross-department pairs with no existing collaboration
      const synergyCandidates = [];
      for (let i = 0; i < researchers.length; i++) {
        for (let j = i + 1; j < researchers.length; j++) {
          const rA = researchers[i];
          const rB = researchers[j];
          if (rA.department !== rB.department) {
            const key = [rA.id, rB.id].sort().join('--');
            if (!linkMap.has(key)) {
              synergyCandidates.push({
                researcherA: { id: rA.id, name: rA.name, department: rA.department },
                researcherB: { id: rB.id, name: rB.name, department: rB.department },
                potentialScore: Math.floor(78 + ((rA.total_publications + rB.total_publications) % 20)),
              });
            }
          }
        }
      }

      return sendJson(200, {
        nodes,
        links,
        synergyCandidates: synergyCandidates.slice(0, 6),
      });
    }

    // 7. Calculate Specific Synergy Recommendation
    if (pathname === '/api/ai/synergy-match' && method === 'POST') {
      const { researcherIdA, researcherIdB } = await readJsonBody();
      const rA = db.prepare('SELECT * FROM researchers WHERE id = ?').get(researcherIdA);
      const rB = db.prepare('SELECT * FROM researchers WHERE id = ?').get(researcherIdB);

      if (!rA || !rB) {
        return sendJson(404, { error: 'Researchers not found' });
      }

      const allPubs = db.prepare('SELECT * FROM publications WHERE approval_status = \'approved\'').all();
      const papersA = allPubs.filter(p => matchesResearcher(p, rA));
      const papersB = allPubs.filter(p => matchesResearcher(p, rB));

      const synergy = await calculateSynergy(rA, rB, papersA, papersB);
      return sendJson(200, synergy);
    }

    // Unknown API endpoint
    return sendJson(404, { error: 'API Endpoint not found', endpoint: pathname });

  } catch (error) {
    console.error('[API Error]:', error);
    return sendJson(500, { error: error.message || 'Internal Server Error' });
  }
}
