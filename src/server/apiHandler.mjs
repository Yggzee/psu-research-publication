import { db } from './db.mjs';
import { isTursoConfigured, rehydrateFromTurso, pushTableToTurso } from './turso.mjs';
import { scrapeGoogleScholarDirect, scrapeGoogleScholarCitations, scrapeGoogleScholarProfile } from './scholarScraper.mjs';

/**
 * Check if a publication belongs to a researcher (by instructorId, user id, full name, or surname/initial in authors)
 */
export function matchesResearcher(p, r) {
  if (!r) return false;
  const pOwnerId = (p.owner_id || '').trim().toLowerCase();
  const rInstId = (r.instructor_id || '').trim().toLowerCase();
  const rId = (r.id || '').trim().toLowerCase();
  if (pOwnerId && (pOwnerId === rInstId || pOwnerId === rId)) return true;

  const rName = (r.name || '').trim().toLowerCase();
  const rFirst = (r.first_name || '').trim().toLowerCase();
  const rLast = (r.last_name || '').trim().toLowerCase();
  const pOwnerName = (p.owner_name || '').trim().toLowerCase();

  if (pOwnerName) {
    if (pOwnerName === rName) return true;
    if (rLast && rLast.length >= 3 && pOwnerName.includes(rLast)) return true;
  }

  let authors = [];
  try {
    authors = Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]');
  } catch {
    authors = [p.authors || ''];
  }

  for (const a of authors) {
    const aLower = (typeof a === 'string' ? a : (a?.name || '')).trim().toLowerCase();
    if (!aLower) continue;
    if (aLower === rName || aLower.includes(rName) || rName.includes(aLower)) return true;
    if (rLast && rLast.length >= 3 && aLower.includes(rLast)) {
      const firstInitial = rFirst[0];
      if (!firstInitial || aLower.includes(firstInitial) || aLower.replace(/[^a-z]/g, '') === rLast) {
        return true;
      }
    }
  }

  return false;
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
      
      const user = db.prepare(`
        SELECT u.* FROM users u
        WHERE u.id = ? OR LOWER(u.username) = LOWER(?)
        LIMIT 1
      `).get(userId || '', username || '');

      if (!user) {
        return sendJson(404, { error: 'User not found.' });
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
      const researchersCount = db.prepare('SELECT COUNT(*) as count FROM researchers').get().count;
      const pubStats = db.prepare(`
        SELECT 
          COUNT(*) as totalPublications,
          COALESCE(SUM(citations), 0) as totalCitations,
          COALESCE(AVG(impact_score), 0.0) as averageImpactScore
        FROM publications
        WHERE approval_status = 'approved'
      `).get();

      // Ensure all researchers have up-to-date counts
      const allResearchers = db.prepare('SELECT * FROM researchers').all();
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
      const rows = db.prepare('SELECT * FROM researchers ORDER BY name ASC').all();
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
        totalPublications: pubCount,
        totalCitations: citCount,
        publications: pubs.map((p) => ({
          ...p,
          authors: Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]'),
        })),
      });
    }

    // POST /api/researchers (Admin adding researcher + creating user credentials)
    if (pathname === '/api/researchers' && method === 'POST') {
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
      } = data;

      if (!firstName || !lastName || !instructorId || !password) {
        return sendJson(400, { error: 'First name, last name, instructor ID, and password are required' });
      }

      const trimmedInstId = instructorId.trim();
      // Check if instructor ID or username exists
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedInstId);
      if (existing) {
        return sendJson(400, { error: 'That Instructor ID is already registered.' });
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

      // 1. Insert into users table so researcher can immediately log in
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, department, is_faculty, photo_url, scholar_url, google_scholar_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        trimmedInstId,
        email || `${trimmedInstId.toLowerCase()}@psu.edu.ph`,
        password,
        fullName,
        department,
        isFaculty ? 1 : 0,
        photoUrl || null,
        scholarUrl || null,
        parsedScholarId || null,
        now
      );

      // 2. Insert into researchers table
      db.prepare(`
        INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, photo_url, scholar_url, google_scholar_id, total_publications, total_citations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      `).run(
        researcherId,
        userId,
        trimmedInstId,
        firstName.trim(),
        lastName.trim(),
        fullName,
        email || null,
        department,
        isFaculty ? 1 : 0,
        photoUrl || null,
        scholarUrl || null,
        parsedScholarId || null,
        now
      );

      // Synchronize any pre-existing matching publications
      updateResearcherStats(db, researcherId);
      const savedResearcher = db.prepare('SELECT * FROM researchers WHERE id = ?').get(researcherId);

      return sendJson(201, {
        success: true,
        message: 'Researcher created and login credentials generated successfully.',
        researcher: {
          id: researcherId,
          instructorId: trimmedInstId,
          name: fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          department,
          isFaculty: Boolean(isFaculty),
          photoUrl: photoUrl || null,
          scholarUrl: scholarUrl || null,
          googleScholarId: parsedScholarId || null,
          totalPublications: savedResearcher.total_publications || 0,
          totalCitations: savedResearcher.total_citations || 0,
        }
      });
    }

    // PUT /api/researchers/:id
    if (pathname.startsWith('/api/researchers/') && method === 'PUT') {
      const id = pathname.replace('/api/researchers/', '');
      const data = await readJsonBody();
      const current = db.prepare('SELECT * FROM researchers WHERE id = ? OR instructor_id = ?').get(id, id);
      if (!current) {
        return sendJson(404, { error: 'Researcher not found' });
      }

      const firstName = data.firstName?.trim() || current.first_name;
      const lastName = data.lastName?.trim() || current.last_name;
      const fullName = `${firstName} ${lastName}`;
      const department = data.department || current.department;
      const isFaculty = data.isFaculty !== undefined ? (data.isFaculty ? 1 : 0) : current.is_faculty;
      const photoUrl = data.photoUrl !== undefined ? data.photoUrl : current.photo_url;
      let scholarUrl = data.scholarUrl !== undefined ? data.scholarUrl : current.scholar_url;
      let googleScholarId = data.googleScholarId !== undefined ? data.googleScholarId : current.google_scholar_id;

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
        if (data.password) {
          db.prepare('UPDATE users SET name = ?, department = ?, is_faculty = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ?, password = ? WHERE id = ?')
            .run(fullName, department, isFaculty, photoUrl, scholarUrl || null, googleScholarId || null, data.password, current.user_id);
        } else {
          db.prepare('UPDATE users SET name = ?, department = ?, is_faculty = ?, photo_url = ?, scholar_url = ?, google_scholar_id = ? WHERE id = ?')
            .run(fullName, department, isFaculty, photoUrl, scholarUrl || null, googleScholarId || null, current.user_id);
        }
      }

      return sendJson(200, { success: true, message: 'Researcher updated successfully' });
    }

    // DELETE /api/researchers/:id
    if (pathname.startsWith('/api/researchers/') && method === 'DELETE') {
      const id = pathname.replace('/api/researchers/', '');
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
      const rows = db.prepare('SELECT * FROM publications ORDER BY year DESC, citations DESC').all();

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
          };
        }
      }

      if (!p) {
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

      // Auto-fetch citing papers if none cached yet and paper has citations / cited_by_link
      if (citing.length === 0 && citedByLink) {
        try {
          const fetchedCiting = await scrapeGoogleScholarCitations(citedByLink, 50);
          if (fetchedCiting.length > 0) {
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
      const id = data.id || `pub-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO publications (
          id, title, authors, journal, year, citations, abstract, url,
          impact_score, owner_id, owner_name, source, approval_status,
          research_status, is_public, file_name, cited_by_link, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.title,
        JSON.stringify(Array.isArray(data.authors) ? data.authors : [data.authors]),
        data.journal || 'Research Journal',
        Number(data.year) || new Date().getFullYear(),
        Number(data.citations) || 0,
        data.abstract || '',
        data.url || null,
        Number(data.impactScore) || 0.0,
        data.ownerId || 'admin',
        data.ownerName || 'Admin',
        data.source || 'manual',
        data.approvalStatus || 'approved',
        data.researchStatus || 'Published',
        data.isPublic !== undefined ? (data.isPublic ? 1 : 0) : 1,
        data.fileName || null,
        data.citedByLink || null,
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

      return sendJson(201, { success: true, id, message: 'Publication saved to database' });
    }

    // PUT /api/publications/:id (Update visibility, approval, etc.)
    if (pathname.startsWith('/api/publications/') && method === 'PUT') {
      const id = pathname.replace('/api/publications/', '');
      const data = await readJsonBody();
      const current = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
      if (!current) {
        return sendJson(404, { error: 'Publication not found' });
      }

      const updates = [];
      const values = [];

      if (data.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(data.isPublic ? 1 : 0);
      }
      if (data.approvalStatus !== undefined) {
        updates.push('approval_status = ?');
        values.push(data.approvalStatus);
      }
      if (data.researchStatus !== undefined) {
        updates.push('research_status = ?');
        values.push(data.researchStatus);
      }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE publications SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      return sendJson(200, { success: true, message: 'Publication updated' });
    }

    // Helper to get active Apify token row
    const getActiveApifyTokenRow = () => {
      let row = db.prepare('SELECT * FROM apify_tokens WHERE is_active = 1 LIMIT 1').get();
      if (!row) {
        row = db.prepare('SELECT * FROM apify_tokens ORDER BY created_at DESC LIMIT 1').get();
      }
      if (!row && (process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN)) {
        return {
          id: 'env',
          name: 'Environment Token',
          token: process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN,
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

      const checkExisting = db.prepare(`
        SELECT id, citations FROM publications 
        WHERE LOWER(title) = LOWER(?) AND (owner_id = ? OR owner_name = ?)
      `);

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
        if (!title) continue;

        const existing = checkExisting.get(title, targetInstId, targetName);
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
          count: combinedCached.length,
          message: `Loaded ${combinedCached.length} publications instantly from local database cache`,
        }));
      }

      // STEP 2: Live Fetch from Google Scholar (Direct + Apify if needed)
      // First try direct Google Scholar fetch to get the full 10-20 results without free-tier limitations
      let liveResults = [];
      try {
        liveResults = await scrapeGoogleScholarDirect(cleanQuery, 2);
      } catch (err) {
        console.warn('[ScholarSearch] Direct search fallback:', err.message);
      }

      // If direct scraping gave good results, save and return
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
          count: liveResults.length,
          message: `Retrieved ${liveResults.length} publications directly from Google Scholar`,
        }));
      }

      // STEP 3: Fallback to Apify Google Scholar Scraper Integration with Multi-Token Failover
      const tokenRows = db.prepare(`
        SELECT * FROM apify_tokens ORDER BY is_active DESC, created_at DESC
      `).all();

      const candidateTokens = tokenRows.map((r) => ({
        id: r.id,
        name: r.name,
        token: r.token,
        actorId: (r.actor_id || 'johnvc~google-scholar-lite-api').replace('/', '~')
      }));

      if (candidateTokens.length === 0 && (process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN)) {
        candidateTokens.push({
          id: 'env',
          name: 'Environment Token',
          token: process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN,
          actorId: (process.env.APIFY_ACTOR_ID || 'johnvc~google-scholar-lite-api').replace('/', '~')
        });
      }

      if (candidateTokens.length === 0) {
        // If no Apify tokens, return whatever cache we had
        if (combinedCached.length > 0) {
          return sendJson(200, await attachTokenUsage({
            results: combinedCached,
            fromCache: true,
            count: combinedCached.length,
            message: `Loaded ${combinedCached.length} publications from local database cache`,
          }));
        }
        return sendJson(200, await attachTokenUsage({
          results: [],
          fromCache: false,
          count: 0,
          requiresApify: true,
          message: 'Google Scholar search returned 0 results. Connect an Apify token for additional redundancy.',
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
        count: formattedResults.length,
        message: `Scraped ${formattedResults.length} publications via Google Scholar (${usedTokenName}) and cached to database.`,
      }, true));
    }

    // ----------------------------------------------------
    // 6. RESEARCH CLAIMS
    // ----------------------------------------------------
    if (pathname === '/api/claims' && method === 'GET') {
      const claims = db.prepare(`
        SELECT * FROM publications WHERE source = 'claim' ORDER BY created_at DESC
      `).all();

      return sendJson(200, claims.map((c) => ({
        ...c,
        authors: JSON.parse(c.authors || '[]'),
      })));
    }

    if (pathname.startsWith('/api/claims/') && pathname.endsWith('/review') && method === 'POST') {
      const claimId = pathname.replace('/api/claims/', '').replace('/review', '');
      const { status } = await readJsonBody(); // 'approved' or 'rejected'

      db.prepare('UPDATE publications SET approval_status = ? WHERE id = ?').run(status, claimId);
      return sendJson(200, { success: true, message: `Claim marked as ${status}` });
    }

    // ----------------------------------------------------
    // 7. APIFY TOKENS MANAGEMENT (Multi-Token support)
    // ----------------------------------------------------
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

    // Unknown API endpoint
    return sendJson(404, { error: 'API Endpoint not found', endpoint: pathname });

  } catch (error) {
    console.error('[API Error]:', error);
    return sendJson(500, { error: error.message || 'Internal Server Error' });
  }
}
