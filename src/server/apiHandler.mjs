import crypto from 'node:crypto';
import { db } from './db.mjs';
import { isTursoConfigured, rehydrateFromTurso, pushTableToTurso } from './turso.mjs';
import { scrapeGoogleScholarDirect, scrapeGoogleScholarCitations, scrapeGoogleScholarProfile } from './scholarScraper.mjs';
import {
  classifyPublicationSDG,
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
import { rateLimiter } from './rateLimiter.mjs';
import {
  matchesResearcher,
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
} from './authHelper.mjs';

export { matchesResearcher };

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
 * Handle incoming API requests
 * Compatible with Vite dev server middleware and standalone Node http server
 */
export async function handleApiRequest(req, res) {
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

      // Check users table (matches username, email, or instructor ID)
      const user = db.prepare(`
        SELECT u.*, r.instructor_id 
        FROM users u
        LEFT JOIN researchers r ON u.id = r.user_id
        WHERE (
          LOWER(u.username) = LOWER(?) OR 
          LOWER(u.email) = LOWER(?) OR 
          LOWER(r.instructor_id) = LOWER(?)
        ) AND u.password = ?
        LIMIT 1
      `).get(loginId, loginId, loginId, password);

      if (!user) {
        return sendJson(401, { error: 'Invalid login credentials.' });
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
        password,
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
      const token = url.searchParams.get('token');
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
        return sendJson(404, { valid: false, error: 'Invalid or expired verification link.' });
      }

      if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
        return sendJson(400, { valid: false, error: 'This verification link has expired.' });
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
      const { token, newPassword } = await readJsonBody();
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
      `).run(newPassword, now, user.id);

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
        WHERE (u.id = ? OR LOWER(u.username) = LOWER(?)) AND u.password = ?
        LIMIT 1
      `).get(userId || '', username || '', currentPassword);

      if (!user) {
        return sendJson(401, { error: 'Current password is incorrect.' });
      }

      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, user.id);
      return sendJson(200, { success: true, message: 'Password updated successfully!' });
    }

    // ----------------------------------------------------
    // 1c. UPDATE PROFILE: PUT /api/auth/profile
    // ----------------------------------------------------
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const { userId, username, name, email, department, photoUrl, scholarUrl, googleScholarId } = await readJsonBody();
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

      const updatedName = name || user.name;
      const updatedEmail = email !== undefined ? email : user.email;
      const updatedDept = department !== undefined ? department : user.department;
      const updatedPhoto = photoUrl !== undefined ? photoUrl : user.photo_url;
      const updatedScholar = scholarUrl !== undefined ? scholarUrl : user.scholar_url;
      const updatedScholarId = googleScholarId !== undefined ? googleScholarId : user.google_scholar_id;

      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?
        WHERE id = ?
      `).run(updatedName, updatedEmail, updatedDept, updatedPhoto, updatedScholar, updatedScholarId, user.id);

      db.prepare(`
        UPDATE researchers
        SET name = ?, email = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?
        WHERE user_id = ? OR LOWER(instructor_id) = LOWER(?)
      `).run(updatedName, updatedEmail, updatedDept, updatedPhoto, updatedScholar, updatedScholarId, user.id, user.username);

      return sendJson(200, {
        success: true,
        user: {
          id: user.id,
          role: user.role,
          name: updatedName,
          username: user.username,
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
        const tables = ['users', 'researchers', 'publications', 'scraped_publications', 'citation_trends', 'citing_papers', 'apify_tokens'];
        for (const t of tables) {
          await pushTableToTurso(db, t);
        }
        return sendJson(200, { success: true, message: 'All local tables successfully pushed to Turso Cloud!' });
      } catch (err) {
        return sendJson(500, { error: `Failed to push to Turso: ${err.message}` });
      }
    }

    // ----------------------------------------------------
    // 2. DASHBOARD STATS: GET /api/dashboard/stats
    // ----------------------------------------------------
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
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
          department: r.department,
          instructor_id: r.instructor_id,
          citations: citCount,
          publications: pubCount,
        };
      });

      const topResearchers = [...calculatedResearchers]
        .sort((a, b) => b.citations - a.citations)
        .slice(0, 10);

      // Citations and publications grouped by department & year
      const deptYearMap = {};
      for (const p of allApprovedPubs) {
        if (!p.year) continue;
        // Find matching researcher to get department
        const matchedR = allResearchers.find((r) => matchesResearcher(p, r));
        const dept = matchedR ? matchedR.department : 'General';
        const key = `${dept}-${p.year}`;
        if (!deptYearMap[key]) {
          deptYearMap[key] = { department: dept, year: p.year, publications: 0, citations: 0 };
        }
        deptYearMap[key].publications += 1;
        deptYearMap[key].citations += (p.citations || 0);
      }
      const deptYearStats = Object.values(deptYearMap).sort((a, b) => a.year - b.year);

      return sendJson(200, {
        totalResearchers: researchersCount,
        totalPublications: pubStats.totalPublications,
        totalCitations: pubStats.totalCitations,
        averageImpactScore: Number(pubStats.averageImpactScore.toFixed(1)),
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
      } = data;

      if (!firstName || !lastName || !instructorId) {
        return sendJson(400, { error: 'First name, last name, and instructor ID are required' });
      }

      const trimmedInstId = instructorId.trim();
      const trimmedEmail = (email || '').trim().toLowerCase();

      if (!trimmedEmail) {
        return sendJson(400, { error: 'Email address is required to send verification & invitation.' });
      }

      // Check if instructor ID or username exists
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedInstId);
      if (existing) {
        return sendJson(400, { error: 'That Instructor ID is already registered.' });
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
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const now = new Date().toISOString();

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      // If admin didn't provide a password or opted for invite flow, generate temporary random string
      const initialPassword = password ? password.trim() : crypto.randomBytes(8).toString('hex');
      const initialStatus = sendInvite ? 'pending_verification' : 'active';

      // 1. Insert into users table
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, department, is_faculty, photo_url, scholar_url, google_scholar_id, status, verification_token, verification_token_expires_at, registration_type, has_scholar, created_at)
        VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?, ?, ?, ?, ?, 'admin_invite', ?, ?)
      `).run(
        userId,
        trimmedInstId,
        trimmedEmail,
        initialPassword,
        fullName,
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
        INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, photo_url, scholar_url, google_scholar_id, status, has_scholar, total_publications, total_citations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
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
        photoUrl || null,
        scholarUrl || null,
        parsedScholarId || null,
        initialStatus,
        scholarUrl ? 1 : 0,
        now
      );

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
          totalPublications: savedResearcher.total_publications || 0,
          totalCitations: savedResearcher.total_citations || 0,
        }
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

      db.prepare("UPDATE researchers SET status = 'rejected' WHERE id = ?").run(r.id);
      db.prepare("UPDATE users SET status = 'rejected' WHERE id = ? OR LOWER(username) = LOWER(?)").run(r.user_id || '', r.instructor_id);

      return sendJson(200, {
        success: true,
        message: `Registration for ${r.name} has been rejected.`,
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

      // Update associated user record if password or details changed
      if (current.user_id) {
        if (sanitized.password) {
          db.prepare('UPDATE users SET name = ?, department = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?, password = ? WHERE id = ?')
            .run(fullName, department, photoUrl, scholarUrl || null, googleScholarId || null, sanitized.password, current.user_id);
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

      const current = db.prepare('SELECT * FROM researchers WHERE id = ? OR instructor_id = ?').get(id, id);
      if (current) {
        db.prepare('DELETE FROM researchers WHERE id = ?').run(current.id);
        if (current.user_id) {
          db.prepare('DELETE FROM users WHERE id = ?').run(current.user_id);
        }
      }
      return sendJson(200, { success: true, message: 'Researcher deleted successfully' });
    }

    // ----------------------------------------------------
    // 4. PUBLICATIONS CRUD
    // ----------------------------------------------------
    if (pathname === '/api/publications' && method === 'GET') {
      const caller = authenticateCaller(req);
      const allRows = db.prepare('SELECT * FROM publications ORDER BY year DESC, citations DESC').all();

      // Application-Level Tenant Isolation (The SQLite equivalent of RLS):
      // Admins see all; Instructors see public approved + their own drafts; Guests see public approved only
      const rows = filterPublicationsForCaller(allRows, caller);

      // Batch-fetch all citing papers
      const allCiting = db.prepare('SELECT publication_id, title, authors, year, link FROM citing_papers').all();
      const citingByPubId = {};
      for (const cp of allCiting) {
        if (!citingByPubId[cp.publication_id]) {
          citingByPubId[cp.publication_id] = [];
        }
        citingByPubId[cp.publication_id].push({
          title: cp.title,
          authors: cp.authors,
          year: cp.year,
          link: cp.link,
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

        return {
          ...p,
          authors: JSON.parse(p.authors || '[]'),
          isPublic: Boolean(p.is_public),
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
      let citing = db.prepare('SELECT title, authors, year, link FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);

      const totalPaperCitations = Number(p.citations) || 0;
      // Auto-fetch or backfill citing papers if cached count is less than recorded citations
      if ((citing.length === 0 || citing.length < totalPaperCitations) && citedByLink) {
        try {
          const fetchedCiting = await scrapeGoogleScholarCitations(citedByLink, 50);
          if (fetchedCiting.length > citing.length) {
            // Delete old partial preview citations and insert complete set
            db.prepare('DELETE FROM citing_papers WHERE publication_id = ? OR publication_id = ?').run(id, rawId);
            const insertStmt = db.prepare('INSERT OR IGNORE INTO citing_papers (id, publication_id, title, authors, year, link) VALUES (?, ?, ?, ?, ?, ?)');
            for (let i = 0; i < fetchedCiting.length; i++) {
              const cp = fetchedCiting[i];
              insertStmt.run(`cite-${id}-${i + 1}`, id, cp.title, cp.authors, cp.year, cp.link);
            }
            citing = db.prepare('SELECT title, authors, year, link FROM citing_papers WHERE publication_id = ? OR publication_id = ?').all(id, rawId);
          }
        } catch (err) {
          console.warn('[AutoFetchCitations] Error scraping citing papers:', err.message);
        }
      }

      return sendJson(200, {
        ...p,
        authors: JSON.parse(p.authors || '[]'),
        isPublic: Boolean(p.is_public),
        citationTrend: trends,
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

      // 1. Strict Deduplication Check: Check existing publications using normalized title
      const normInput = normalizeTitle(sanitized.title);
      const allExisting = db.prepare('SELECT id, title, citations, abstract, url, cited_by_link, sdg_tags FROM publications').all();
      const existing = allExisting.find((p) => normalizeTitle(p.title) === normInput);

      if (existing) {
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
          message: `Publication already exists in repository ("${existing.title}"). Duplicate save prevented, metrics updated.`,
        });
      }

      const id = data.id || `pub-${Date.now()}`;
      const now = new Date().toISOString();

      // Enforce SDG classification & journal audit on newly created publications
      let sdgTagsJson = sanitized.sdgTags ? JSON.stringify(sanitized.sdgTags) : null;
      let sdgRationale = sanitized.sdgRationale || null;
      let chedPriority = sanitized.chedPriority || null;
      let journalIndex = sanitized.journalIndexing || null;
      let nbcPoints = sanitized.nbc461Points !== null ? sanitized.nbc461Points : 5.0;
      let isPredatory = sanitized.isPredatoryFlag !== null ? (sanitized.isPredatoryFlag ? 1 : 0) : 0;

      if (!sdgTagsJson) {
        try {
          const sdgResult = await classifyPublicationSDG(sanitized.title, sanitized.abstract || '', sanitized.journal || '');
          sdgTagsJson = JSON.stringify([sdgResult.primarySDG, sdgResult.secondarySDG].filter(Boolean));
          sdgRationale = sdgResult.rationale;
          chedPriority = sdgResult.chedPriority;
        } catch {
          sdgTagsJson = JSON.stringify(['SDG 4: Quality Education']);
        }
      }

      if (!journalIndex) {
        const audit = auditJournalReputation(sanitized.journal || '');
        journalIndex = audit.indexing;
        nbcPoints = audit.nbc461Points;
        isPredatory = audit.isPredatory;
      }

      db.prepare(`
        INSERT INTO publications (
          id, title, authors, journal, year, citations, abstract, url,
          impact_score, owner_id, owner_name, source, approval_status,
          research_status, is_public, file_name, cited_by_link,
          sdg_tags, sdg_rationale, ched_priority, journal_indexing,
          nbc461_points, is_predatory_flag, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        nbcPoints,
        isPredatory,
        now
      );

      // If citing papers were provided, save them too
      if (Array.isArray(data.citingPapers)) {
        const insertCiting = db.prepare(`
          INSERT OR IGNORE INTO citing_papers (id, publication_id, title, authors, year, link)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const cp of data.citingPapers) {
          if (!cp.title) continue;
          insertCiting.run(
            cp.id || `cite-${id}-${Math.random().toString(36).slice(2, 7)}`,
            id,
            cp.title,
            typeof cp.authors === 'string' ? cp.authors : JSON.stringify(cp.authors || []),
            cp.year || null,
            cp.link || null
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
            userPassword,
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

        if (photoUrl && (!researcher.photo_url || researcher.photo_url === '')) {
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

      const allExistingPubs = db.prepare('SELECT id, title, citations, url, cited_by_link FROM publications').all();

      const insertPub = db.prepare(`
        INSERT INTO publications (
          id, title, authors, journal, year, citations, abstract, url, cited_by_link,
          owner_id, owner_name, source, approval_status, research_status, is_public, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scraped', 'approved', 'Published', 1, ?)
      `);

      const updatePub = db.prepare(`
        UPDATE publications
        SET citations = MAX(citations, ?), url = COALESCE(?, url), cited_by_link = COALESCE(?, cited_by_link)
        WHERE id = ?
      `);

      const insertScrapedCache = db.prepare(`
        INSERT OR REPLACE INTO scraped_publications (
          id, title, authors, journal, year, citations, abstract, url, cited_by_link, search_query, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of publications) {
        const title = (item.title || '').trim();
        const normItem = normalizeTitle(title);
        if (!normItem) continue;

        const existing = allExistingPubs.find((p) => normalizeTitle(p.title) === normItem);
        const authorsJson = JSON.stringify(Array.isArray(item.authors) ? item.authors : [item.authors || targetName]);
        const citations = parseInt(item.citations, 10) || 0;
        const year = parseInt(item.year, 10) || new Date().getFullYear();

        if (existing) {
          updatePub.run(citations, item.url || null, item.citedByLink || null, existing.id);
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
            item.abstract || '',
            item.url || '',
            item.citedByLink || null,
            targetInstId,
            targetName,
            now
          );
          allExistingPubs.push({ id: newId, title, citations, url: item.url, cited_by_link: item.citedByLink });
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
          item.abstract || '',
          item.url || '',
          item.citedByLink || null,
          parsedScholarId || targetName,
          now
        );
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
          totalPublications: updatedRes.total_publications,
          totalCitations: updatedRes.total_citations,
        },
        message: `Successfully saved ${importedCount} new publication(s) and recorded ${targetName} as a researcher with ${updatedRes.total_publications} publications.`,
      });
    }

    // ----------------------------------------------------
    // 5. GOOGLE SCHOLAR SEARCH & PERSISTENT SCRAPING CACHE
    // ----------------------------------------------------
    if (pathname === '/api/search/google-scholar' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim();
      const forceRefresh = url.searchParams.get('refresh') === 'true';

      if (!query) {
        return sendJson(200, await attachTokenUsage({ results: [], fromCache: true }));
      }

      // Query normalization for smart searching (e.g. "Lastname, Firstname" -> "Firstname Lastname")
      let cleanQuery = query.trim();
      if (cleanQuery.includes(',') && !cleanQuery.includes('AND') && !cleanQuery.includes('OR')) {
        const parts = cleanQuery.split(',').map((p) => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          cleanQuery = `${parts[1]} ${parts[0]}`;
        }
      }

      // STEP 1: Check database cache FIRST (exact or like match on title, authors, or query)
      const cached = db.prepare(`
        SELECT id, title, authors, journal, year, citations, abstract, url, cited_by_link 
        FROM scraped_publications 
        WHERE LOWER(title) LIKE LOWER(?) 
           OR LOWER(authors) LIKE LOWER(?) 
           OR LOWER(search_query) LIKE LOWER(?)
      `).all(`%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`);

      // Also check local institutional publications database
      const localPubs = db.prepare(`
        SELECT id, title, authors, journal, year, citations, abstract, url, cited_by_link
        FROM publications 
        WHERE LOWER(title) LIKE LOWER(?) 
           OR LOWER(authors) LIKE LOWER(?) 
           OR LOWER(owner_name) LIKE LOWER(?)
      `).all(`%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`);

      const combinedCached = [];
      const seenTitles = new Set();

      for (const p of [...cached, ...localPubs]) {
        const normTitle = (p.title || '').trim().toLowerCase();
        if (!normTitle || seenTitles.has(normTitle)) continue;
        seenTitles.add(normTitle);

        let parsedAuthors = [];
        try {
          parsedAuthors = Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]');
        } catch {
          parsedAuthors = typeof p.authors === 'string' ? p.authors.split(',').map((a) => a.trim()) : [];
        }

        combinedCached.push({
          ...p,
          authors: parsedAuthors,
          citedByLink: p.cited_by_link || null,
          fromCache: true,
        });
      }

      // If we have 10 or more cached results and no force-refresh requested, return immediately
      if (!forceRefresh && combinedCached.length >= 10) {
        return sendJson(200, await attachTokenUsage({
          results: combinedCached,
          fromCache: true,
          searchSource: 'cache',
          sourceLabel: 'Local Database Cache',
          count: combinedCached.length,
          message: `Loaded ${combinedCached.length} publications instantly from local database cache (0 token credits used)`,
        }));
      }

      // STEP 2: Live Fetch from Google Scholar (Direct + Apify fallback)
      // Prioritize the free built-in direct scraper first to preserve Apify token credits as much as possible
      let liveResults = [];
      let captchaBlocked = false;
      try {
        liveResults = await scrapeGoogleScholarDirect(cleanQuery, 2);
        captchaBlocked = Boolean(liveResults.captchaBlocked);
      } catch (err) {
        console.warn('[ScholarSearch] Direct search fallback:', err.message);
      }

      // If direct scraping gave good results, save and return immediately without consuming any Apify token
      if (liveResults.length > 0) {
        const insertScraped = db.prepare(`
          INSERT OR REPLACE INTO scraped_publications (id, title, authors, journal, year, citations, abstract, url, cited_by_link, search_query, scraped_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();

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

        // Merge with existing local publications
        for (const p of localPubs) {
          const normTitle = (p.title || '').trim().toLowerCase();
          if (!seenTitles.has(normTitle)) {
            seenTitles.add(normTitle);
            let parsedAuthors = [];
            try {
              parsedAuthors = Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]');
            } catch {
              parsedAuthors = typeof p.authors === 'string' ? p.authors.split(',').map((a) => a.trim()) : [];
            }
            liveResults.push({
              ...p,
              authors: parsedAuthors,
              citedByLink: p.cited_by_link || null,
              fromCache: true,
            });
          }
        }

        return sendJson(200, await attachTokenUsage({
          results: liveResults,
          fromCache: false,
          searchSource: 'direct',
          sourceLabel: 'Built-in Direct Search (Free)',
          count: liveResults.length,
          message: `Retrieved ${liveResults.length} publications directly from Google Scholar via built-in scraper (0 Apify token credits used)`,
        }));
      }

      // STEP 3: Fallback to Apify Google Scholar Scraper (Only used if direct scraping failed or hit CAPTCHA)
      const tokenRows = db.prepare(`
        SELECT * FROM apify_tokens ORDER BY is_active DESC, created_at DESC
      `).all();

      const candidateTokens = tokenRows.map((r) => ({
        id: r.id,
        name: r.name,
        token: r.token,
        actorId: (r.actor_id || 'johnvc~google-scholar-lite-api').replace('/', '~')
      }));

      if (candidateTokens.length === 0 && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
        candidateTokens.push({
          id: 'env',
          name: 'Environment Token',
          token: process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN,
          actorId: (process.env.APIFY_ACTOR_ID || 'johnvc~google-scholar-lite-api').replace('/', '~')
        });
      }

      if (candidateTokens.length === 0) {
        // If no Apify tokens, return whatever cache we had
        if (combinedCached.length > 0) {
          return sendJson(200, await attachTokenUsage({
            results: combinedCached,
            fromCache: true,
            searchSource: 'cache',
            sourceLabel: 'Local Database Cache',
            captchaDetected: captchaBlocked,
            count: combinedCached.length,
            message: captchaBlocked
              ? `Google Scholar anti-bot CAPTCHA detected. Loaded ${combinedCached.length} publications from local database cache.`
              : `Loaded ${combinedCached.length} publications from local database cache`,
          }));
        }
        return sendJson(200, await attachTokenUsage({
          results: [],
          fromCache: false,
          searchSource: 'none',
          sourceLabel: 'No Service Available',
          count: 0,
          requiresApify: true,
          captchaDetected: captchaBlocked,
          message: captchaBlocked
            ? 'Google Scholar presented a CAPTCHA challenge ("unusual traffic"). Connect an Apify token to bypass the anti-bot lock.'
            : 'Google Scholar search returned 0 results. Connect an Apify token for additional redundancy.',
        }));
      }

      let lastError = null;
      let rawItems = null;
      let usedTokenName = '';

      // Try tokens in order
      for (const cand of candidateTokens) {
        try {
          const targetActor = cand.actorId.includes('lite')
            ? 'johnvc~google-scholar-lite-api'
            : cand.actorId;
          const actorUrlSegment = targetActor.replace('/', '~');

          const isLite = targetActor.includes('lite');
          const bodyPayload = isLite
            ? { searchTerms: [cleanQuery], maxResults: 100 }
            : { q: cleanQuery, query: cleanQuery, queries: [cleanQuery], max_pages: 5, maxResults: 100 };

          const apifyRes = await fetch(
            `https://api.apify.com/v2/acts/${actorUrlSegment}/run-sync-get-dataset-items?token=${cand.token}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload),
            }
          );

          if (!apifyRes.ok) {
            const errText = await apifyRes.text();
            lastError = `Token "${cand.name}" failed (${apifyRes.status}): ${errText}`;
            continue;
          }

          rawItems = await apifyRes.json();
          usedTokenName = cand.name;

          if (cand.id && cand.id !== 'env') {
            try {
              db.prepare('UPDATE apify_tokens SET search_count = COALESCE(search_count, 0) + 1 WHERE id = ?').run(cand.id);
            } catch {}
          }
          break;
        } catch (err) {
          lastError = err.message;
        }
      }

      if (!rawItems) {
        // Fallback to cache if Apify failed
        if (combinedCached.length > 0) {
          return sendJson(200, await attachTokenUsage({
            results: combinedCached,
            fromCache: true,
            count: combinedCached.length,
            message: `Loaded ${combinedCached.length} publications from local cache`,
          }));
        }
        return sendJson(502, await attachTokenUsage({
          error: `Google Scholar scraping failed: ${lastError}`,
          results: [],
          fromCache: false,
        }));
      }

      const items = Array.isArray(rawItems) ? rawItems : [];

      // Save every scraped publication to SQLite cache so we never scrape it again!
      const insertScraped = db.prepare(`
        INSERT OR IGNORE INTO scraped_publications (id, title, authors, journal, year, citations, abstract, url, cited_by_link, search_query, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Also save citing papers when available
      const insertCitingPaper = db.prepare(`
        INSERT OR IGNORE INTO citing_papers (id, publication_id, title, authors, year, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const formattedResults = [];
      const now = new Date().toISOString();

      for (const raw of items) {
        if (!raw || raw.error) continue;

        const title = (raw.paper_title || raw.title || raw.name || '').trim();
        if (!title) continue;

        // Smart author extraction
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
            authors = [authorPart.trim()];
          }
        }

        if (authors.length === 0) {
          authors = [cleanQuery];
        }

        // Journal and Year extraction
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

        const citations = parseInt(
          raw.inline_links?.cited_by_total ?? raw.citations ?? raw.citationCount ?? 0,
          10
        ) || 0;

        const abstract = raw.snippet || raw.abstract || raw.description || '';
        const paperUrl = raw.link || raw.url || raw.resources?.[0]?.link || '';
        const id = raw.result_id || raw.id || `gs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Extract cited_by link early so we can save it with the scraped publication
        const citedByLink = raw.inline_links?.cited_by?.link || raw.inline_links?.cited_by_link || '';
        const citedByTotal = parseInt(raw.inline_links?.cited_by_total ?? raw.inline_links?.cited_by?.total ?? 0, 10) || 0;

        insertScraped.run(
          id,
          title,
          JSON.stringify(authors),
          journal,
          year,
          citations,
          abstract,
          paperUrl,
          citedByLink,
          cleanQuery,
          now
        );

        // Extract and save citing papers (papers that cite this one)

        // Some scrapers return related_articles or cited_by_results directly
        const citingResults = raw.cited_by_results || raw.inline_links?.cited_by_results || [];
        if (Array.isArray(citingResults)) {
          for (const cite of citingResults) {
            if (!cite || !cite.title) continue;
            const citeId = cite.result_id || cite.id || `cite-${id}-${Math.random().toString(36).slice(2, 7)}`;
            const citeAuthors = Array.isArray(cite.authors)
              ? cite.authors.map(a => typeof a === 'string' ? a : a?.name || '').filter(Boolean).join(', ')
              : (cite.publication_info?.summary?.split('-')?.[0]?.trim() || cite.authors || '');
            const citeYear = parseInt(cite.year || '', 10) || null;
            const citeLink = cite.link || cite.url || '';
            insertCitingPaper.run(citeId, id, cite.title, citeAuthors, citeYear, citeLink);
          }
        }

        formattedResults.push({
          id,
          title,
          authors,
          journal,
          year,
          citations,
          abstract,
          url: paperUrl,
          citedByLink,
          citedByTotal,
          fromCache: false,
        });
      }

      return sendJson(200, await attachTokenUsage({
        results: formattedResults,
        fromCache: false,
        searchSource: 'apify',
        sourceLabel: `Apify Token (${usedTokenName})`,
        count: formattedResults.length,
        message: `Direct search was challenged by Google CAPTCHA. Successfully routed through Apify Token "${usedTokenName}" to retrieve ${formattedResults.length} publications.`,
      }, true));
    }

    // ----------------------------------------------------
    // 6. RESEARCH CLAIMS
    // ----------------------------------------------------
    if (pathname === '/api/claims' && method === 'GET') {
      const caller = authenticateCaller(req);
      let claims = db.prepare(`
        SELECT * FROM publications WHERE source = 'claim' ORDER BY created_at DESC
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

      db.prepare('UPDATE publications SET approval_status = ? WHERE id = ?').run(status, claimId);
      return sendJson(200, { success: true, message: `Claim marked as ${status}` });
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
      const { publicationId, title, abstract, journal } = await readJsonBody();
      let targetTitle = title;
      let targetAbstract = abstract;
      let targetJournal = journal;

      if (publicationId) {
        const pub = db.prepare('SELECT * FROM publications WHERE id = ?').get(publicationId);
        if (pub) {
          targetTitle = pub.title;
          targetAbstract = pub.abstract;
          targetJournal = pub.journal;
        }
      }

      if (!targetTitle) {
        return sendJson(400, { error: 'Publication title is required' });
      }

      const sdgResult = await classifyPublicationSDG(targetTitle, targetAbstract, targetJournal);
      const auditResult = auditJournalReputation(targetJournal);
      const tagsJson = JSON.stringify([sdgResult.primarySDG, sdgResult.secondarySDG]);

      if (publicationId) {
        db.prepare(`
          UPDATE publications
          SET sdg_tags = ?, sdg_rationale = ?, ched_priority = ?,
              journal_indexing = ?, nbc461_points = ?, is_predatory_flag = ?
          WHERE id = ?
        `).run(
          tagsJson,
          sdgResult.rationale,
          sdgResult.chedPriority,
          auditResult.indexing,
          auditResult.nbc461Points,
          auditResult.isPredatory,
          publicationId
        );
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
        SELECT id, title, abstract, journal 
        FROM publications 
        WHERE sdg_tags IS NULL OR sdg_tags = '' OR sdg_tags = '[]'
        LIMIT 60
      `).all();

      let processed = 0;
      for (const pub of unclassified) {
        try {
          const sdgResult = await classifyPublicationSDG(pub.title, pub.abstract, pub.journal);
          const auditResult = auditJournalReputation(pub.journal);
          const tagsJson = JSON.stringify([sdgResult.primarySDG, sdgResult.secondarySDG]);

          db.prepare(`
            UPDATE publications
            SET sdg_tags = ?, sdg_rationale = ?, ched_priority = ?,
                journal_indexing = ?, nbc461_points = ?, is_predatory_flag = ?
            WHERE id = ?
          `).run(
            tagsJson,
            sdgResult.rationale,
            sdgResult.chedPriority,
            auditResult.indexing,
            auditResult.nbc461Points,
            auditResult.isPredatory,
            pub.id
          );
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
      const { question } = await readJsonBody();
      if (!question || !question.trim()) {
        return sendJson(400, { error: 'Question is required' });
      }

      const approvedPubs = db.prepare(`
        SELECT id, title, authors, year, journal, citations, abstract, sdg_tags, sdg_rationale, ched_priority, nbc461_points, owner_name
        FROM publications
        WHERE approval_status = 'approved'
        ORDER BY citations DESC, year DESC
        LIMIT 50
      `).all();

      const researchers = db.prepare(`
        SELECT id, instructor_id, name, department, total_publications, total_citations
        FROM researchers
      `).all();

      const totalCitations = approvedPubs.reduce((sum, p) => sum + (p.citations || 0), 0);

      const systemMetadata = {
        totalPublications: approvedPubs.length,
        totalResearchers: researchers.length,
        researchersList: researchers.map(r => `${r.name} (${r.department || 'Faculty'}, ${r.total_publications} papers, ${r.total_citations} citations)`),
        totalCitations,
        features: [
          'Google Scholar Search & Auto-Caching: Query live literature, cache in SQLite, and prevent duplicate saves via title normalization.',
          'Publications Management: Dynamic instructor dropdown filtering by registered faculty, sorting by citations/year/impact, and APA citation export.',
          'UN SDG Impact Matrix: Gemini Flash powered mapping into all 17 UN Sustainable Development Goals and CHED priority agendas with interactive research evidence.',
          'Research Inspector Drawer: In-depth metrics drawer analyzing citations, NBC 461 point calculations, and academic journal predatory auditing.',
          'Admin & Faculty Management: Dedicated portal for user credentials, faculty rosters, departments, and Google Scholar profile synchronization.',
          'Accreditation Reporting Hub: Ready-to-export reports for CHED, SUC Leveling, and AACCUP accreditation.'
        ]
      };

      const ragResult = await askCampusIntelligence(question, approvedPubs, systemMetadata);
      return sendJson(200, ragResult);
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
               journal_indexing, nbc461_points
        FROM publications
        WHERE approval_status = 'approved'
        ORDER BY citations DESC, year DESC
      `).all();

      const sdgCounts = {};
      ALL_SDGS.forEach(sdg => { sdgCounts[sdg] = { count: 0, papers: [] }; });

      pubs.forEach(p => {
        let tags = [];
        try {
          tags = JSON.parse(p.sdg_tags || '[]');
        } catch {
          tags = [];
        }

        // If unclassified, apply fast on-the-fly heuristic for real-time reporting
        if (tags.length === 0) {
          const text = `${p.title} ${p.abstract || ''}`.toLowerCase();
          if (text.includes('fracture') || text.includes('acetabular') || text.includes('health') || text.includes('medical') || text.includes('covid')) tags.push('SDG 3: Good Health and Well-being');
          else if (text.includes('education') || text.includes('learn') || text.includes('student') || text.includes('math') || text.includes('statistic')) tags.push('SDG 4: Quality Education');
          else if (text.includes('agri') || text.includes('crop') || text.includes('soil')) tags.push('SDG 2: Zero Hunger');
          else if (text.includes('austerity') || text.includes('resources management')) tags.push('SDG 12: Responsible Consumption and Production');
          else if (text.includes('graduate') || text.includes('career') || text.includes('employment')) tags.push('SDG 8: Decent Work and Economic Growth');
          else tags.push('SDG 9: Industry, Innovation and Infrastructure');
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

        const getTailoredRationale = (targetKey) => {
          const targetNum = extractSDGNum(targetKey);
          for (const [k, v] of Object.entries(rationalesMap)) {
            if (k === targetKey || k.toLowerCase() === targetKey.toLowerCase()) return v;
            const kNum = extractSDGNum(k);
            if (targetNum !== null && kNum !== null && targetNum === kNum) return v;
          }
          if (rawRationale && !rawRationale.startsWith('{')) return rawRationale;
          const cleanT = (p.title || '').replace(/^\[.*?\]\s*/, '');
          if (targetNum === 4) return `Directly enhances Quality Education by providing practical learning tools and teaching techniques in "${cleanT}".`;
          if (targetNum === 3) return `Promotes Good Health and Well-being by contributing clinical findings and health safety protocols in "${cleanT}".`;
          if (targetNum === 8) return `Supports Decent Work and Economic Growth by strengthening workforce competencies and professional training in "${cleanT}".`;
          if (targetNum === 9) return `Fosters Industry, Innovation, and Infrastructure by introducing digital tools and technical methodologies in "${cleanT}".`;
          if (targetNum === 10) return `Helps reduce inequalities by providing targeted learning interventions to support struggling and disadvantaged students in "${cleanT}".`;
          if (targetNum === 12) return `Encourages Responsible Consumption by promoting cost-effective resource management and waste reduction in "${cleanT}".`;
          return `Advances ${targetKey} through verified academic research and institutional development.`;
        };

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
          nbc461Points: p.nbc461_points || 5.0,
        };

        tags.forEach(t => {
          const tagNum = extractSDGNum(t);
          const matchKey = ALL_SDGS.find(s => {
            const sNum = extractSDGNum(s);
            if (tagNum !== null && sNum !== null) {
              return tagNum === sNum;
            }
            return s.toLowerCase() === String(t).toLowerCase();
          });

          if (matchKey) {
            sdgCounts[matchKey].count += 1;
            const tailoredRationale = getTailoredRationale(matchKey);
            sdgCounts[matchKey].papers.push({
              ...paperItem,
              sdgRationale: tailoredRationale,
            });
          }
        });
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
        totalClassified: pubs.length,
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
