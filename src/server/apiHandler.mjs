import { db } from './db.mjs';

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
        }
      });
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

      // Top researchers by citations
      const topResearchers = db.prepare(`
        SELECT 
          r.id, r.name, r.department, r.instructor_id,
          COALESCE(SUM(p.citations), 0) as citations,
          COUNT(p.id) as publications
        FROM researchers r
        LEFT JOIN publications p ON (p.owner_id = r.instructor_id OR p.authors LIKE '%' || r.name || '%') AND p.approval_status = 'approved'
        GROUP BY r.id
        ORDER BY citations DESC
        LIMIT 10
      `).all();

      // Citations and publications grouped by department & year
      const deptYearStats = db.prepare(`
        SELECT 
          r.department,
          p.year,
          COUNT(p.id) as publications,
          COALESCE(SUM(p.citations), 0) as citations
        FROM publications p
        JOIN researchers r ON p.owner_id = r.instructor_id
        WHERE p.approval_status = 'approved'
        GROUP BY r.department, p.year
        ORDER BY p.year ASC
      `).all();

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
      const rows = db.prepare(`
        SELECT 
          r.*,
          COALESCE(COUNT(p.id), 0) as totalPublications,
          COALESCE(SUM(p.citations), 0) as totalCitations
        FROM researchers r
        LEFT JOIN publications p ON (p.owner_id = r.instructor_id OR p.authors LIKE '%' || r.name || '%') AND p.approval_status = 'approved'
        GROUP BY r.id
        ORDER BY r.name ASC
      `).all();

      const researchers = rows.map((r) => {
        // Fetch publications for each researcher
        const pubs = db.prepare(`
          SELECT * FROM publications
          WHERE (owner_id = ? OR authors LIKE '%' || ? || '%') AND approval_status = 'approved'
          ORDER BY year DESC
        `).all(r.instructor_id, r.name);

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
          totalPublications: pubs.length,
          totalCitations: pubs.reduce((sum, p) => sum + p.citations, 0),
          publications: pubs.map((p) => ({
            ...p,
            authors: JSON.parse(p.authors || '[]'),
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

      const pubs = db.prepare(`
        SELECT * FROM publications
        WHERE (owner_id = ? OR authors LIKE '%' || ? || '%') AND approval_status = 'approved'
        ORDER BY year DESC
      `).all(r.instructor_id, r.name);

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
        totalPublications: pubs.length,
        totalCitations: pubs.reduce((sum, p) => sum + p.citations, 0),
        publications: pubs.map((p) => ({
          ...p,
          authors: JSON.parse(p.authors || '[]'),
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

      const userId = `user-${Date.now()}`;
      const researcherId = `res-${Date.now()}`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const now = new Date().toISOString();

      // 1. Insert into users table so researcher can immediately log in
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, department, is_faculty, photo_url, created_at)
        VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?, ?, ?)
      `).run(
        userId,
        trimmedInstId,
        email || `${trimmedInstId.toLowerCase()}@psu.edu.ph`,
        password,
        fullName,
        department,
        isFaculty ? 1 : 0,
        photoUrl || null,
        now
      );

      // 2. Insert into researchers table
      db.prepare(`
        INSERT INTO researchers (id, user_id, instructor_id, first_name, last_name, name, email, department, is_faculty, photo_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        now
      );

      return sendJson(201, {
        success: true,
        message: 'Researcher created and login credentials generated successfully.',
        researcher: {
          id: researcherId,
          instructorId: trimmedInstId,
          name: fullName,
          department,
          isFaculty,
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

      db.prepare(`
        UPDATE researchers 
        SET first_name = ?, last_name = ?, name = ?, department = ?, is_faculty = ?, photo_url = ?
        WHERE id = ?
      `).run(firstName, lastName, fullName, department, isFaculty, photoUrl, current.id);

      // Update associated user record if password or details changed
      if (current.user_id) {
        if (data.password) {
          db.prepare('UPDATE users SET name = ?, department = ?, is_faculty = ?, photo_url = ?, password = ? WHERE id = ?')
            .run(fullName, department, isFaculty, photoUrl, data.password, current.user_id);
        } else {
          db.prepare('UPDATE users SET name = ?, department = ?, is_faculty = ?, photo_url = ? WHERE id = ?')
            .run(fullName, department, isFaculty, photoUrl, current.user_id);
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
      const pubs = rows.map((p) => ({
        ...p,
        authors: JSON.parse(p.authors || '[]'),
        isPublic: Boolean(p.is_public),
      }));
      return sendJson(200, pubs);
    }

    if (pathname.startsWith('/api/publications/') && method === 'GET') {
      const id = pathname.replace('/api/publications/', '');
      const p = db.prepare('SELECT * FROM publications WHERE id = ?').get(id);
      if (!p) {
        return sendJson(404, { error: 'Publication not found' });
      }

      const trends = db.prepare('SELECT year, citations, id FROM citation_trends WHERE publication_id = ? ORDER BY year ASC').all(id);
      const citing = db.prepare('SELECT title, authors, year, link FROM citing_papers WHERE publication_id = ?').all(id);

      return sendJson(200, {
        ...p,
        authors: JSON.parse(p.authors || '[]'),
        isPublic: Boolean(p.is_public),
        citationTrend: trends,
        citingPapers: citing,
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
          research_status, is_public, file_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        now
      );

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

    // ----------------------------------------------------
    // 5. GOOGLE SCHOLAR SEARCH & PERSISTENT SCRAPING CACHE
    // ----------------------------------------------------
    if (pathname === '/api/search/google-scholar' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim();

      if (!query) {
        return sendJson(200, { results: [], fromCache: true });
      }

      // STEP 1: Check database cache FIRST (exact or like match on title, authors, or query)
      const cached = db.prepare(`
        SELECT * FROM scraped_publications 
        WHERE LOWER(title) LIKE LOWER(?) 
           OR LOWER(authors) LIKE LOWER(?) 
           OR LOWER(search_query) LIKE LOWER(?)
        LIMIT 20
      `).all(`%${query}%`, `%${query}%`, `%${query}%`);

      if (cached.length > 0) {
        // Cache HIT! Zero API calls or Apify scraping needed!
        return sendJson(200, {
          results: cached.map((p) => ({
            ...p,
            authors: JSON.parse(p.authors || '[]'),
            fromCache: true,
          })),
          fromCache: true,
          count: cached.length,
          message: 'Loaded instantly from local database cache (0 scraper calls)',
        });
      }

      // STEP 2: Apify Google Scholar Scraper Integration
      const apifyToken = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN;
      const apifyActorId = process.env.APIFY_ACTOR_ID || 'dan.k/google-scholar-scraper';

      if (!apifyToken) {
        // Apify is not connected yet - Do NOT fabricate fake data
        return sendJson(200, {
          results: [],
          fromCache: false,
          count: 0,
          requiresApify: true,
          message: 'Apify Google Scholar Scraper is not connected yet. Configure your APIFY_TOKEN in .env to enable live scraping.',
        });
      }

      try {
        // Trigger Apify Google Scholar Actor run synchronously
        const apifyRes = await fetch(
          `https://api.apify.com/v2/acts/${encodeURIComponent(apifyActorId)}/run-sync-get-dataset-items?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queries: [query],
              maxItems: 20,
            }),
          }
        );

        if (!apifyRes.ok) {
          const errText = await apifyRes.text();
          return sendJson(502, {
            error: `Apify scraping failed (${apifyRes.status}): ${errText}`,
            results: [],
            fromCache: false,
          });
        }

        const rawItems = await apifyRes.json();
        const items = Array.isArray(rawItems) ? rawItems : [];

        // Save every scraped publication to SQLite cache so we never scrape it again!
        const insertScraped = db.prepare(`
          INSERT OR IGNORE INTO scraped_publications (id, title, authors, journal, year, citations, abstract, url, search_query, scraped_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const formattedResults = [];
        const now = new Date().toISOString();

        for (const raw of items) {
          const authors = Array.isArray(raw.authors)
            ? raw.authors
            : typeof raw.authors === 'string'
            ? raw.authors.split(',').map((a) => a.trim())
            : [];
          const id = raw.id || `gs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const title = raw.title || 'Untitled Publication';
          const journal = raw.source || raw.journal || 'Academic Publication';
          const year = parseInt(raw.year || raw.publicationYear, 10) || new Date().getFullYear();
          const citations = parseInt(raw.citations || raw.citationCount || 0, 10) || 0;
          const abstract = raw.abstract || raw.snippet || '';
          const paperUrl = raw.url || raw.link || '';

          insertScraped.run(
            id,
            title,
            JSON.stringify(authors),
            journal,
            year,
            citations,
            abstract,
            paperUrl,
            query,
            now
          );

          formattedResults.push({
            id,
            title,
            authors,
            journal,
            year,
            citations,
            abstract,
            url: paperUrl,
            fromCache: false,
          });
        }

        return sendJson(200, {
          results: formattedResults,
          fromCache: false,
          count: formattedResults.length,
          message: `Scraped ${formattedResults.length} publications via Apify and permanently saved to database.`,
        });
      } catch (err) {
        console.error('[Apify Request Error]:', err);
        return sendJson(500, {
          error: `Apify connection error: ${err.message}`,
          results: [],
          fromCache: false,
        });
      }
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

    // Unknown API endpoint
    return sendJson(404, { error: 'API Endpoint not found', endpoint: pathname });

  } catch (error) {
    console.error('[API Error]:', error);
    return sendJson(500, { error: error.message || 'Internal Server Error' });
  }
}
