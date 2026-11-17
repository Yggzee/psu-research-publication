import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createIsolatedBackend,
  installFetchMock,
  FIXTURES,
  readRepoFile,
  walkFiles,
  extractBalancedBraces,
  extractNamedFunction,
  REPO_ROOT,
} from './helpers/testEnv.mjs';

let env;
let adminToken;
let fetchMock;
let seq = 1;

function nextSuffix() {
  return `${Date.now()}${seq++}`;
}

describe('R5 (Login Hint Removal), R6 (12:00 AM Asia/Manila & Manual Backups), R7 (Public Scraper Toggle)', () => {
  before(async () => {
    env = await createIsolatedBackend();
    ({ token: adminToken } = await env.loginAdmin());
  });

  beforeEach(() => {
    fetchMock = installFetchMock([
      { match: 'api.crossref.org', status: 404, json: {} },
      { match: 'api.openalex.org', status: 404, json: {} },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      { match: 'generativelanguage.googleapis.com', status: 404, json: {} },
      { match: 'api.groq.com', status: 404, json: {} },
      { match: 'api.apify.com', json: { data: {} } },
      { match: 'scholar.google.com', text: '<html><body></body></html>' },
    ]);
  });

  afterEach(async () => {
    if (fetchMock) {
      fetchMock.restore();
      fetchMock = null;
    }
    // Restore default public_scraper_enabled = 'true' after tests that flip it
    await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'true' },
    });
  });

  after(async () => {
    await env.close();
  });

  // =========================================================================
  // R5: Login Page Credential Hint Removal
  // =========================================================================

  it('R5.1 LoginScreen.tsx does not contain psuac-rc or admin123 credential hint', () => {
    const loginSrc = readRepoFile('src/app/components/LoginScreen.tsx');
    assert.ok(!loginSrc.includes('psuac-rc'), 'LoginScreen.tsx must not expose psuac-rc hint');
    assert.ok(!loginSrc.includes('admin123'), 'LoginScreen.tsx must not expose admin123 password hint');
  });

  it('R5.2 Built dist/ bundle omits admin123 and psuac-rc / admin123 hint', () => {
    const distDir = path.join(REPO_ROOT, 'dist');
    assert.ok(fs.existsSync(distDir), 'dist/ directory must exist after build');
    const files = walkFiles('dist', ['.js', '.html']);
    assert.ok(files.length > 0, 'dist/ must contain built JS/HTML files');
    for (const full of files) {
      const txt = fs.readFileSync(full, 'utf8');
      assert.ok(!txt.includes('admin123'), `Built asset ${path.relative(REPO_ROOT, full)} must not contain admin123`);
      assert.doesNotMatch(
        txt,
        /psuac-rc\s*\/\s*admin123/i,
        `Built asset ${path.relative(REPO_ROOT, full)} must not contain psuac-rc / admin123`
      );
    }
  });

  it('R5.3 Coordinator login continues to work with valid credentials and rejects invalid credentials with 401', async () => {
    const ok = await env.request('POST', '/api/auth/login', {
      body: {
        username: process.env.ADMIN_USERNAME || 'psuac-rc',
        password: process.env.ADMIN_PASSWORD || 'admin123',
      },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.json?.user?.role, 'admin');

    const bad = await env.request('POST', '/api/auth/login', {
      body: { username: 'psuac-rc', password: 'wrong-password-xyz' },
    });
    assert.equal(bad.status, 401);
  });

  // =========================================================================
  // R6: Automated 12:00 AM Asia/Manila & Manual Database Backup
  // =========================================================================

  it('R6.1 src/server/backupService.mjs exists, targets 12:00 AM Asia/Manila, and computes UTC 15:59 vs 16:00 Manila date boundary', async () => {
    const servicePath = path.join(REPO_ROOT, 'src', 'server', 'backupService.mjs');
    assert.ok(fs.existsSync(servicePath), 'src/server/backupService.mjs must exist');

    const backupMod = await import('../src/server/backupService.mjs');
    const src = readRepoFile('src/server/backupService.mjs');
    assert.match(src, /Asia\/Manila/, 'backupService.mjs must use Asia/Manila timezone');

    // Verify 12:00 AM Asia/Manila schedule metadata & date boundary (UTC 15:59 vs 16:00)
    assert.equal(backupMod.BACKUP_SCHEDULE_INFO?.timezone, 'Asia/Manila');
    assert.equal(backupMod.BACKUP_SCHEDULE_INFO?.hour, 0);
    assert.equal(backupMod.BACKUP_SCHEDULE_INFO?.minute, 0);

    assert.equal(
      backupMod.getManilaDateString(new Date('2026-11-17T15:59:59Z')),
      '2026-11-17',
      '15:59:59Z is still 23:59:59 on 2026-11-17 in Asia/Manila'
    );
    assert.equal(
      backupMod.getManilaDateString(new Date('2026-11-17T16:00:00Z')),
      '2026-11-18',
      '16:00:00Z crosses 12:00 AM (00:00:00) into 2026-11-18 in Asia/Manila'
    );
    assert.equal(
      backupMod.getMsUntilNextManilaMidnight(new Date('2026-11-17T15:59:00Z')),
      60 * 1000,
      '15:59:00Z must be exactly 60s before 12:00 AM Asia/Manila'
    );
    assert.equal(
      backupMod.getMsUntilNextManilaMidnight(new Date('2026-11-17T16:00:00Z')),
      24 * 60 * 60 * 1000,
      '16:00:00Z (00:00 Manila) must schedule 24h to next midnight'
    );

    // Scheduled backup creation & manila_date idempotency across UTC 15:59 -> 16:00
    const b1 = await backupMod.createDatabaseBackup({
      backupType: 'scheduled',
      createdBy: 'scheduler',
      date: new Date('2026-11-17T15:59:00Z'),
    });
    assert.equal(b1.alreadyExists, false);
    assert.equal(b1.backup.manilaDate, '2026-11-17');

    // Second scheduled run on same Manila date must be idempotent
    const b1Dup = await backupMod.createDatabaseBackup({
      backupType: 'scheduled',
      createdBy: 'scheduler',
      date: new Date('2026-11-17T15:59:30Z'),
    });
    assert.equal(b1Dup.alreadyExists, true);
    const countSame = env.db
      .prepare("SELECT COUNT(*) as c FROM db_backups WHERE backup_type = 'scheduled' AND manila_date = '2026-11-17'")
      .get().c;
    assert.equal(countSame, 1, 'Scheduled backup must be idempotent per manila_date');

    // Crossing UTC 16:00 -> 12:00 AM Asia/Manila next day (2026-11-18) creates new snapshot
    const b2 = await backupMod.createDatabaseBackup({
      backupType: 'scheduled',
      createdBy: 'scheduler',
      date: new Date('2026-11-17T16:00:00Z'),
    });
    assert.equal(b2.alreadyExists, false);
    assert.equal(b2.backup.manilaDate, '2026-11-18');
  });

  it('R6.2 POST /api/admin/backups/manual creates db_backups row and local .json file inside DATA_DIR/backups', async () => {
    const res = await env.request('POST', '/api/admin/backups/manual', {
      token: adminToken,
    });
    assert.ok([200, 201].includes(res.status), `Manual backup expected 200/201, got ${res.status}: ${res.rawBody}`);
    assert.equal(res.json?.success, true);
    const b = res.json?.backup;
    assert.ok(b && b.id, 'Response must include created backup metadata');
    assert.equal(b.backupType || b.backup_type, 'manual');
    assert.ok(b.filename && b.filename.endsWith('.json'));

    const dbRow = env.db.prepare('SELECT * FROM db_backups WHERE id = ?').get(b.id);
    assert.ok(dbRow, 'db_backups table must contain manual backup row');
    assert.ok(dbRow.snapshot_json && dbRow.snapshot_json.length > 20);

    // Local backup file must exist inside isolated DATA_DIR/backups/ and contain valid snapshot JSON
    const expectedLocalPath = dbRow.local_path || path.join(env.tempDir, 'backups', b.filename);
    assert.ok(
      path.resolve(expectedLocalPath).startsWith(path.resolve(env.tempDir)),
      `Local backup file must write inside isolated DATA_DIR (${env.tempDir}), got ${expectedLocalPath}`
    );
    assert.ok(fs.existsSync(expectedLocalPath), `Local backup file must exist on disk at ${expectedLocalPath}`);
    const localJson = JSON.parse(fs.readFileSync(expectedLocalPath, 'utf8'));
    assert.equal(localJson.backupType, 'manual', 'Local backup JSON must record backupType=manual');
    assert.ok(localJson.tables && typeof localJson.tables === 'object', 'Local backup JSON must include tables map');
    assert.ok(Array.isArray(localJson.tables.system_settings), 'Local backup JSON must include system_settings array');
    assert.ok(Array.isArray(localJson.tables.users), 'Local backup JSON must include users array');
    assert.ok(Array.isArray(localJson.tables.publications), 'Local backup JSON must include publications array');
  });

  it('R6.3 GET /api/admin/backups returns 12:00 AM Asia/Manila schedule and snapshot list; download returns attachment JSON', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, { digits: `900${seq++}` });
    await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Backup Snapshot Validation Paper ${s}`,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: r.instructorId,
      },
    });

    const manual = await env.request('POST', '/api/admin/backups/manual', { token: adminToken });
    const backupId = manual.json.backup.id;

    const listRes = await env.request('GET', '/api/admin/backups', { token: adminToken });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json?.schedule?.timezone, 'Asia/Manila');
    assert.equal(listRes.json?.schedule?.hour, 0);
    assert.equal(listRes.json?.schedule?.minute, 0);
    assert.ok(Array.isArray(listRes.json?.backups));
    assert.ok(listRes.json.backups.some((x) => x.id === backupId));

    const dlRes = await env.request('GET', `/api/admin/backups/${backupId}/download`, { token: adminToken });
    assert.equal(dlRes.status, 200);
    assert.match(String(dlRes.headers['content-disposition'] || ''), /attachment/i);
    assert.match(String(dlRes.headers['cache-control'] || ''), /no-store/i);
    const parsed = JSON.parse(dlRes.rawBody);
    const tables = parsed?.tables || parsed?.data;
    assert.ok(tables && typeof tables === 'object', 'Downloaded backup JSON must contain table snapshot');
    assert.ok(Array.isArray(tables.users) && tables.users.length > 0, 'Backup snapshot must have non-empty users');
    assert.ok(
      Array.isArray(tables.system_settings) && tables.system_settings.length > 0,
      'Backup snapshot must have non-empty system_settings'
    );
    assert.ok(
      Array.isArray(tables.publications) && tables.publications.length > 0,
      'Backup snapshot must have non-empty publications'
    );
  });

  it('R6.4 Backup endpoints enforce 401 unauthenticated, 403 non-admin researcher, and 404 missing ID', async () => {
    const researcher = await env.createActiveResearcher(adminToken, { digits: `901${seq++}` });

    for (const [method, url] of [
      ['GET', '/api/admin/backups'],
      ['POST', '/api/admin/backups/manual'],
      ['GET', '/api/admin/backups/nonexistent-id/download'],
    ]) {
      const unauth = await env.request(method, url);
      assert.equal(unauth.status, 401, `${method} ${url} unauthenticated must return 401, got ${unauth.status}`);

      const forbidden = await env.request(method, url, { token: researcher.token });
      assert.equal(forbidden.status, 403, `${method} ${url} non-admin must return 403, got ${forbidden.status}`);
    }

    const notFound = await env.request('GET', '/api/admin/backups/does-not-exist-999/download', { token: adminToken });
    assert.equal(notFound.status, 404);
  });

  it('R6.5 Full Turso & SQLite schema parity: db.mjs, turso.mjs, and apiHandler.mjs /api/turso/sync include publication_researchers and db_backups', () => {
    const dbSrc = readRepoFile('src/server/db.mjs');
    const tursoSrc = readRepoFile('src/server/turso.mjs');
    const apiSrc = readRepoFile('src/server/apiHandler.mjs');

    const syncRouteMatch = apiSrc.match(/pathname\s*===\s*['"]\/api\/turso\/sync['"]/);
    assert.ok(syncRouteMatch, 'pathname === "/api/turso/sync" route handler must exist');
    const syncSlice = apiSrc.slice(syncRouteMatch.index, syncRouteMatch.index + 1500);

    for (const table of ['publication_researchers', 'db_backups']) {
      assert.match(dbSrc, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}`, 'i'), `db.mjs missing ${table}`);
      assert.match(tursoSrc, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}`, 'i'), `turso.mjs tableSchemas missing ${table}`);

      const rehydrateFn = extractNamedFunction(tursoSrc, 'rehydrateFromTurso');
      assert.ok(rehydrateFn.includes(`'${table}'`) || rehydrateFn.includes(`"${table}"`), `turso.mjs rehydrateFromTurso missing ${table}`);

      assert.ok(syncSlice.includes(`'${table}'`) || syncSlice.includes(`"${table}"`), `apiHandler.mjs /api/turso/sync route missing ${table}`);
    }
  });

  it('R6.6 SettingsPage.tsx shows 12:00 AM Asia/Manila backup schedule, snapshot list/download, and admin-only "Manual Backup" button', () => {
    const settingsSrc = readRepoFile('src/app/components/SettingsPage.tsx');
    const apiServiceSrc = readRepoFile('src/app/services/api.service.ts');
    assert.match(settingsSrc, /12:00\s*AM/i, 'SettingsPage.tsx must display 12:00 AM schedule');
    assert.match(settingsSrc, /Asia\/Manila/i, 'SettingsPage.tsx must display Asia/Manila timezone');
    assert.ok(settingsSrc.includes('Manual Backup'), 'SettingsPage.tsx must include "Manual Backup" button');
    assert.match(apiServiceSrc, /\/admin\/backups/, 'api.service.ts must expose /api/admin/backups endpoints');

    // Verify Manual Backup is gated to admin role (supports inline gating, early return, or extracted backup card component)
    const idx = settingsSrc.indexOf('Manual Backup');
    const roleGuardRegex = /role\s*[!=]==\s*["']admin["']|isAdmin|isCoordinator/;

    // Find enclosing function/component around "Manual Backup"
    let enclosingFnSrc = '';
    for (const fnMatch of settingsSrc.matchAll(/\bfunction\s+([A-Za-z0-9_]+)\s*\(/g)) {
      const fnName = fnMatch[1];
      const extracted = extractNamedFunction(settingsSrc, fnName);
      if (extracted && extracted.includes('Manual Backup')) {
        enclosingFnSrc = extracted;
        // Check if this helper component is itself rendered behind an admin gate in SettingsPage
        const tagPattern = new RegExp(`(?:role\\s*===\\s*["']admin["']|isAdmin|isCoordinator)[\\s\\S]{0,250}<${fnName}\\b`);
        if (roleGuardRegex.test(extracted) || tagPattern.test(settingsSrc)) {
          enclosingFnSrc = 'GATED_OK';
        }
        break;
      }
    }

    const wideWindow = settingsSrc.slice(Math.max(0, idx - 3000), idx + 500);
    assert.ok(
      enclosingFnSrc === 'GATED_OK' || roleGuardRegex.test(enclosingFnSrc || wideWindow),
      '"Manual Backup" must be gated to Research Coordinator (admin) role'
    );
  });

  // =========================================================================
  // R7: Fix "Disable Public Scraper" Setting
  // =========================================================================

  it('R7.1 PUT /api/admin/settings persists public_scraper_enabled=false and GET /api/settings/public-scraper-status returns no-store', async () => {
    const putRes = await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(putRes.status, 200);
    assert.match(String(putRes.headers['cache-control'] || ''), /no-store/i);

    const statusRes = await env.request('GET', '/api/settings/public-scraper-status');
    assert.equal(statusRes.status, 200);
    assert.match(String(statusRes.headers['cache-control'] || ''), /no-store/i);
    assert.equal(statusRes.json?.publicScraperEnabled, false);
    assert.equal(statusRes.json?.isAvailableForPublic, false);
    assert.equal(statusRes.json?.reason, 'admin_disabled');
  });

  it('R7.2 rehydrateFromTurso puts system_settings at index 0 of tables array', () => {
    const tursoSrc = readRepoFile('src/server/turso.mjs');
    const rehydrateFn = extractNamedFunction(tursoSrc, 'rehydrateFromTurso');
    const tablesMatch = rehydrateFn.match(/const\s+tables\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(tablesMatch, 'rehydrateFromTurso must declare const tables = [...]');
    const items = [...tablesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.equal(items[0], 'system_settings', `Expected system_settings at index 0, got ${items[0]}`);
  });

  it('R7.3 When public_scraper_enabled=false, public GS search, unauth fetch-profile, and unauth pub detail scraping are blocked', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, { digits: `902${seq++}` });
    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Public Scrape Block Study ${s}`,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: r.instructorId,
      },
    });
    const pubId = pubRes.json.id;
    env.db.prepare('UPDATE publications SET citations = 5, cited_by_link = NULL WHERE id = ?').run(pubId);

    const offRes = await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(offRes.status, 200);

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com',
        handler: (url) => {
          assert.fail(`External GS fetch must be blocked when public scraper disabled: ${url}`);
        },
      },
      {
        match: 'api.crossref.org',
        handler: (url) => {
          assert.fail(`External CrossRef fetch must be blocked for unauth caller when disabled: ${url}`);
        },
      },
    ]);

    // 1. Public GS search returns publicScraperDisabled: true, reason: 'admin_disabled'
    const gsSearch = await env.request('GET', '/api/search/google-scholar?q=artificial+intelligence');
    assert.equal(gsSearch.status, 200);
    assert.equal(gsSearch.json?.publicScraperDisabled, true);
    assert.equal(gsSearch.json?.reason, 'admin_disabled');

    // 2. Unauthenticated POST /api/scholar/fetch-profile returns 401
    const fetchProf = await env.request('POST', '/api/scholar/fetch-profile', {
      body: { scholarUrl: 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ' },
    });
    assert.equal(fetchProf.status, 401, `Unauth /api/scholar/fetch-profile must return 401, got ${fetchProf.status}`);

    // 3. Unauthenticated GET /api/publications/:id does NOT trigger external scraping
    const pubDetail = await env.request('GET', `/api/publications/${pubId}`);
    assert.equal(pubDetail.status, 200);
    assert.equal(fetchMock.calls.length, 0, 'Unauthenticated pub detail must not trigger external scraping when disabled');
  });

  it('R7.4 Non-admin gets 403 and unauth gets 401 on PUT /api/admin/settings; re-enabling restores public search', async () => {
    const unauth = await env.request('PUT', '/api/admin/settings', {
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(unauth.status, 401);

    const researcher = await env.createActiveResearcher(adminToken, { digits: `903${seq++}` });
    const forbidden = await env.request('PUT', '/api/admin/settings', {
      token: researcher.token,
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(forbidden.status, 403);

    await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'true' },
    });
    const status = await env.request('GET', '/api/settings/public-scraper-status');
    assert.equal(status.json?.publicScraperEnabled, true);
    assert.equal(status.json?.isAvailableForPublic, true);
    assert.equal(status.json?.reason, 'ok');
  });

  it('R7.6 Authenticated researcher can still use GET /api/search/google-scholar when public_scraper_enabled=false', async () => {
    const r = await env.createActiveResearcher(adminToken, { digits: `906${seq++}` });
    await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title: 'Smart Agriculture Monitoring Research',
          citationsText: '12',
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
    ]);

    const authSearch = await env.request(
      'GET',
      '/api/search/google-scholar?q=Smart+Agriculture+Monitoring+Research',
      { token: r.token }
    );
    assert.equal(authSearch.status, 200);
    assert.ok(!authSearch.json?.publicScraperDisabled, 'Authenticated researcher must not be blocked by public scraper toggle');
    assert.ok(Array.isArray(authSearch.json?.results) && authSearch.json.results.length >= 1);
  });

  it('R7.5 PublicRepositoryPortal.tsx and AdminPage.tsx handle admin-disabled state and pagination lock properly', () => {
    const portalSrc = readRepoFile('src/app/components/PublicRepositoryPortal.tsx');
    const goToPageFn = extractNamedFunction(portalSrc, 'handleGlobalGoToPage');
    assert.ok(goToPageFn, 'handleGlobalGoToPage must exist');
    assert.match(goToPageFn, /isScraperLockedForPublic|isAvailableForPublic/, 'handleGlobalGoToPage must guard against locked public scraper');

    // Must explicitly branch inside the isScraperLockedForPublic UI banner/badge between admin_disabled and quota Power-Save Mode
    // (Must NOT false-pass on pre-existing toast text in handleGlobalSearch)
    assert.match(
      portalSrc,
      /admin_disabled|!scraperStatus\??\.publicScraperEnabled|publicScraperEnabled\s*===\s*false/,
      'PublicRepositoryPortal must explicitly check admin_disabled or !publicScraperEnabled'
    );
    const lockBannerIdx = portalSrc.indexOf('isScraperLockedForPublic &&');
    assert.ok(lockBannerIdx !== -1, 'PublicRepositoryPortal must render isScraperLockedForPublic alert banner');
    const lockBannerSlice = portalSrc.slice(lockBannerIdx, lockBannerIdx + 1200);
    assert.match(
      lockBannerSlice,
      /admin_disabled|!scraperStatus\??\.publicScraperEnabled|publicScraperEnabled\s*===\s*false|quotaCircuitBreakerTripped|isAdminDisabled/,
      'isScraperLockedForPublic alert banner must explicitly branch on admin_disabled / !publicScraperEnabled vs quotaCircuitBreakerTripped'
    );
    assert.match(portalSrc, /disabled=\{[^}]*isScraperLockedForPublic/, 'Pagination controls must disable when scraper locked');

    const adminSrc = readRepoFile('src/app/components/AdminPage.tsx');
    const loadScraperFn = extractNamedFunction(adminSrc, 'loadScraperSettings');
    assert.ok(loadScraperFn, 'loadScraperSettings must exist');
    assert.match(loadScraperFn, /publicScraperEnabled/, 'loadScraperSettings must fall back to status.publicScraperEnabled');
  });

  it('R7.7 public_scraper_enabled=false survives initDatabase() cold-start/reload initialization and fresh DB read', async () => {
    const putRes = await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(putRes.status, 200);

    // Simulate reload / cold-start initialization on existing DATA_DIR
    env.dbMod.initDatabase();

    const freshReadDb = new DatabaseSync(env.dbPath, { readOnly: true });
    try {
      const row = freshReadDb
        .prepare("SELECT value FROM system_settings WHERE key = 'public_scraper_enabled'")
        .get();
      assert.equal(row?.value, 'false', 'Fresh SQLite read after initDatabase() must preserve public_scraper_enabled=false');
    } finally {
      freshReadDb.close();
    }

    const statusRes = await env.request('GET', '/api/settings/public-scraper-status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.json?.publicScraperEnabled, false);
    assert.equal(statusRes.json?.isAvailableForPublic, false);
    assert.equal(statusRes.json?.reason, 'admin_disabled');
  });

  // =========================================================================
  // Tier 3 & Tier 4 Scenarios
  // =========================================================================

  it('T3.1 Pairwise R6+R7+R2: Backup snapshot JSON captures disabled scraper setting and publication_researchers', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, { digits: `904${seq++}` });
    await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Backup Snapshot Inclusion Paper ${s}`,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: r.instructorId,
      },
    });
    await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });

    const manual = await env.request('POST', '/api/admin/backups/manual', { token: adminToken });
    const dl = await env.request('GET', `/api/admin/backups/${manual.json.backup.id}/download`, { token: adminToken });
    const snap = JSON.parse(dl.rawBody);
    const tablesObj = snap.tables || snap.data || snap;

    const settingsRows = tablesObj.system_settings || [];
    const pubSetting = settingsRows.find((row) => row.key === 'public_scraper_enabled');
    assert.equal(pubSetting?.value, 'false');

    const links = tablesObj.publication_researchers || [];
    assert.ok(links.some((l) => l.instructor_id === r.instructorId), 'Backup snapshot must include publication_researchers');
  });

  it('T3.2 Pairwise R4+R7: Disabled public scraper blocks public detail scrape while authenticated Coordinator still reloads live citations', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, { digits: `905${seq++}` });
    const title = `Admin Reload While Public Locked ${s}`;
    const pub = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2024,
        ownerId: r.instructorId,
      },
    });
    const pubId = pub.json.id;
    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);

    await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([{ title: `Admin Reload Citing ${s}`, authors: 'Q. Tan', journal: 'IEEE', year: 2026 }]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({ title, authors: r.user.name, citesId: '777111', citationsText: '59' }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const guestDetail = await env.request('GET', `/api/publications/${pubId}`);
    assert.equal(guestDetail.status, 200);
    assert.equal(fetchMock.calls.length, 0);

    const adminReload = await env.request('POST', `/api/publications/${pubId}/reload-citation`, { token: adminToken });
    assert.equal(adminReload.status, 200);
    assert.equal(Number(adminReload.json.publication.citations), 59);
  });

  it('T4.1 Scenario 5: Administrator Incident Lockdown & Recovery Verification', async () => {
    // 1. Admin disables public scraper
    const dis = await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'false' },
    });
    assert.equal(dis.status, 200);

    // 2. Public status reflects disabled
    const st1 = await env.request('GET', '/api/settings/public-scraper-status');
    assert.equal(st1.json.publicScraperEnabled, false);
    assert.equal(st1.json.reason, 'admin_disabled');

    // 3. Public search blocked offline without hitting GS
    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({ title: 'Recovered Search Result', citationsText: '10' }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
    ]);

    const blockedSearch = await env.request('GET', '/api/search/google-scholar?q=Recovered');
    assert.equal(blockedSearch.json.publicScraperDisabled, true);
    assert.equal(fetchMock.calls.length, 0);

    // 4. Admin re-enables public scraper -> public search resumes
    const en = await env.request('PUT', '/api/admin/settings', {
      token: adminToken,
      body: { public_scraper_enabled: 'true' },
    });
    assert.equal(en.status, 200);

    const resumedSearch = await env.request('GET', '/api/search/google-scholar?q=Recovered');
    assert.equal(resumedSearch.status, 200);
    assert.ok(!resumedSearch.json.publicScraperDisabled);
    assert.ok(Array.isArray(resumedSearch.json.results) && resumedSearch.json.results.length >= 1);
  });

  it('T4.2 Scenario 4: Midnight Asia/Manila Automated Backup & Admin Recovery Snapshot (R6+R2)', async () => {
    const s = nextSuffix();
    const backupMod = await import('../src/server/backupService.mjs');
    const researcher = await env.createActiveResearcher(adminToken, { digits: `907${seq++}` });
    const pubTitle = `Midnight Backup Recovery Paper ${s}`;

    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: pubTitle,
        authors: [researcher.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: researcher.instructorId,
      },
    });
    assert.equal(pubRes.status, 201);
    const pubId = pubRes.json.id;

    // 1. Cross UTC 16:00 -> 12:00 AM Asia/Manila (2026-11-19) -> creates idempotent scheduled backup
    const scheduled = await backupMod.createDatabaseBackup({
      backupType: 'scheduled',
      createdBy: 'scheduler',
      date: new Date('2026-11-18T16:00:00Z'),
    });
    assert.equal(scheduled.alreadyExists, false);
    assert.equal(scheduled.backup.manilaDate, '2026-11-19');

    const scheduledDup = await backupMod.createDatabaseBackup({
      backupType: 'scheduled',
      createdBy: 'scheduler',
      date: new Date('2026-11-18T16:15:00Z'),
    });
    assert.equal(scheduledDup.alreadyExists, true);

    // 2. Admin triggers Manual Backup and lists snapshots
    const manualRes = await env.request('POST', '/api/admin/backups/manual', { token: adminToken });
    assert.ok([200, 201].includes(manualRes.status));
    const manualId = manualRes.json?.backup?.id;
    assert.ok(manualId);

    const listRes = await env.request('GET', '/api/admin/backups', { token: adminToken });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.json.backups.some((b) => b.id === scheduled.backup.id));
    assert.ok(listRes.json.backups.some((b) => b.id === manualId));

    // 3. Download JSON recovery snapshot & verify database tables + local file integrity
    const dlRes = await env.request('GET', `/api/admin/backups/${manualId}/download`, { token: adminToken });
    assert.equal(dlRes.status, 200);
    const snap = JSON.parse(dlRes.rawBody);
    assert.ok(snap.tables.researchers.some((r) => r.instructor_id === researcher.instructorId));
    assert.ok(snap.tables.publications.some((p) => p.id === pubId && p.title === pubTitle));
    assert.ok(snap.tables.publication_researchers.some((l) => l.publication_id === pubId));
    assert.ok(snap.tables.system_settings.length > 0);

    const localDiskJson = JSON.parse(fs.readFileSync(manualRes.json.backup.localPath, 'utf8'));
    assert.equal(localDiskJson.tableCounts.publications, snap.tableCounts.publications);
  });
});
