import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  createIsolatedBackend,
  installFetchMock,
  httpRequest,
  readRepoFile,
  walkFiles,
  REPO_ROOT,
} from './helpers/testEnv.mjs';

let env;
let fetchMock;

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

describe('UI Rules, SystemGuide Parity, Security Headers, SEO, Accessibility & prod.mjs', () => {
  before(async () => {
    env = await createIsolatedBackend();
  });

  beforeEach(() => {
    fetchMock = installFetchMock([
      { match: 'api.apify.com', json: { data: {} } },
      { match: 'api.crossref.org', status: 404, json: {} },
      { match: 'api.openalex.org', status: 404, json: {} },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      { match: 'generativelanguage.googleapis.com', status: 404, json: {} },
      { match: 'api.groq.com', status: 404, json: {} },
      { match: 'scholar.google.com', text: '<html><body></body></html>' },
    ]);
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.restore();
      fetchMock = null;
    }
  });

  after(async () => {
    await env.close();
  });

  // =========================================================================
  // Tier 1 & Tier 2: UI Rules, Terminology, SystemGuide Parity
  // =========================================================================

  it('U1.1 Zero emojis anywhere in src/app/** (excluding geometric UI arrows like ↕/▲/▼)', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
    const files = walkFiles('src/app', ['.ts', '.tsx', '.js', '.jsx']);
    assert.ok(files.length > 0);
    const hits = [];
    for (const full of files) {
      const rel = path.relative(REPO_ROOT, full);
      const txt = fs.readFileSync(full, 'utf8');
      const m = txt.match(emojiRegex);
      if (m) {
        hits.push(`${rel}: found "${m[0]}"`);
      }
    }
    assert.deepEqual(hits, [], `Emojis are forbidden in UI: ${hits.join('; ')}`);
  });

  it('U1.2 SystemGuidePage.tsx is synchronized with R1 (1-12 digits), R2 (Manual/DOI/Remove), R4 (Reload Citations/Citation), and R6 (12:00 AM Asia/Manila & Manual Backup)', () => {
    const guide = readRepoFile('src/app/components/SystemGuidePage.tsx');
    assert.match(guide, /1\s*(?:to|-|–)\s*12\s*(?:numeric\s*)?digits/i, 'SystemGuidePage must document 1 to 12 digit ASIN format');
    assert.doesNotMatch(guide, /\b5\s*digits|\b5-digit\b/i, 'SystemGuidePage must not still state 5 digits for Instructor ID');
    assert.ok(guide.includes('Reload Citations'), 'SystemGuidePage must mention "Reload Citations"');
    assert.match(guide, /\bReload Citation\b(?!s)/, 'SystemGuidePage must explicitly mention singular "Reload Citation"');
    assert.match(guide, /12:00\s*AM/i, 'SystemGuidePage must document 12:00 AM scheduled backup');
    assert.match(guide, /Asia\/Manila/i, 'SystemGuidePage must document Asia/Manila timezone');
    assert.ok(guide.includes('Manual Backup'), 'SystemGuidePage must document "Manual Backup"');
    assert.ok(guide.includes('Remove Publication'), 'SystemGuidePage must document "Remove Publication"');
  });

  it('U1.3 SettingsPage.tsx has no redundant duplicate database sync buttons (at most 1 syncToTurso trigger)', () => {
    const rawSettings = readRepoFile('src/app/components/SettingsPage.tsx');
    const settings = rawSettings.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
    const syncHandlerNames = [...settings.matchAll(/\b(?:const|function)\s+([A-Za-z0-9_]+)\s*(?:=\s*async\s*\(|\()/g)]
      .filter((m) => {
        const slice = settings.slice(m.index, m.index + 600);
        return /syncToTurso\s*\(/.test(slice);
      })
      .map((m) => m[1]);

    const btnRegex = /<(?:Button|button)\b(?:(?!<\/?(?:Button|button)\b)[\s\S])*?<\/(?:Button|button)>/g;
    const syncButtons = [...settings.matchAll(btnRegex)]
      .map((m) => m[0])
      .filter((btn) => {
        if (/Sync Database|Sync Local Tables to Turso Cloud|syncToTurso/.test(btn)) return true;
        return syncHandlerNames.some((fn) => new RegExp(`onClick=\\{[^}]*\\b${fn}\\b`).test(btn));
      });
    assert.ok(
      syncButtons.length <= 1,
      `Expected at most 1 database sync <Button> in SettingsPage.tsx, found ${syncButtons.length}`
    );
  });

  it('U1.4 Proponent attribution & Terminology Rules 1, 3, 5, 6, 7', () => {
    const portal = readRepoFile('src/app/components/PublicRepositoryPortal.tsx');
    assert.ok(
      portal.includes('Developed by Julius Oscar Moreno • PSU Asingan Campus'),
      'Public footer must retain proponent attribution'
    );

    const instPubs = readRepoFile('src/app/components/InstructorPublicationsPage.tsx');
    assert.ok(instPubs.includes('My Publications'));
    assert.ok(instPubs.includes('My Published Research'));
    assert.ok(instPubs.includes('Institutional Repository'));
    assert.ok(instPubs.includes('Add Publication'));
    assert.doesNotMatch(instPubs, /Ongoing Research|Unpublished Work/i);

    const researchersPage = readRepoFile('src/app/components/ResearchersPage.tsx');
    assert.doesNotMatch(researchersPage, /Institutional Faculty Roster|Faculty Roster/i);
    assert.match(researchersPage, /Non-Faculty/);

    const researcherProf = readRepoFile('src/app/components/ResearcherProfile.tsx');
    assert.match(researcherProf, /Non-Faculty/);
  });

  it('U1.5 Terminology Rules 5 & 7: Research Coordinator role label and SDG Alignment / SDG Goals naming', () => {
    const components = walkFiles('src/app/components', ['.tsx']);
    for (const full of components) {
      const rel = path.relative(REPO_ROOT, full);
      const raw = fs.readFileSync(full, 'utf8');
      // Strip JSX/JS comments so developer comments don't trigger false positives
      const txt = raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(txt, /Campus Research Administrator|System Administrator/, `${rel} violates Terminology Rule 5`);
      assert.doesNotMatch(txt, /\bSDG Radar\b|\bSDG Matrix\b/, `${rel} violates Terminology Rule 7`);
    }
  });

  it('U1.6 Export buttons removed from PublicationInspectorDrawer and PublicationDetail; centralized in Reports tab', () => {
    const drawer = readRepoFile('src/app/components/PublicationInspectorDrawer.tsx');
    assert.doesNotMatch(drawer, /handleExportPaperExcel/);
    assert.doesNotMatch(drawer, /Export Paper \(\.xlsx\)/i);

    const detail = readRepoFile('src/app/components/PublicationDetail.tsx');
    assert.doesNotMatch(detail, /handleExportSingleExcel/);
    assert.doesNotMatch(detail, /Export Paper Excel/i);

    const reports = readRepoFile('src/app/components/ReportsPage.tsx');
    assert.match(reports, /Export/i, 'Reports tab must preserve export capability');
  });

  it('U1.7 InstructorPublicationsPage includes "Waiting for Approval" tab with badge and pending cards', () => {
    const instPubs = readRepoFile('src/app/components/InstructorPublicationsPage.tsx');
    assert.match(instPubs, /Waiting for Approval/);
    assert.match(instPubs, /Clock/);
    assert.match(instPubs, /pendingPublications/);
  });

  // =========================================================================
  // Tier 1 & Tier 2: Web Security Headers, SEO, robots.txt, security.txt, Theme
  // =========================================================================

  it('U2.1 API responses include all 10 mandatory HTTP security headers from securityHeaders.mjs', async () => {
    const res = await env.request('GET', '/api/settings/public-scraper-status');
    assert.equal(res.status, 200);

    const requiredHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy',
      'cross-origin-embedder-policy',
    ];

    for (const h of requiredHeaders) {
      assert.ok(res.headers[h], `Missing security header: ${h}`);
    }
    assert.match(res.headers['content-security-policy'], /upgrade-insecure-requests/);
    assert.match(res.headers['content-security-policy'], /frame-ancestors 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('U2.2 public/robots.txt, public/.well-known/security.txt, and index.html SEO/OG metadata are intact', () => {
    const robots = readRepoFile('public/robots.txt');
    assert.match(robots, /User-agent:\s*\*/);
    assert.match(robots, /Disallow:\s*\/api\//);
    assert.match(robots, /Disallow:\s*\/admin/);
    assert.match(robots, /Disallow:\s*\/dashboard/);

    const secTxt = readRepoFile('public/.well-known/security.txt');
    assert.match(secTxt, /Contact:/);
    assert.match(secTxt, /Expires:/);
    assert.match(secTxt, /Canonical:/);

    const html = readRepoFile('index.html');
    assert.match(html, /<meta\s+name="description"/i);
    assert.match(html, /<meta\s+property="og:title"/i);
    assert.match(html, /<meta\s+property="og:description"/i);
    assert.match(html, /<meta\s+name="twitter:card"/i);
    assert.match(html, /<link\s+rel="canonical"/i);
  });

  it('U2.3 src/styles/theme.css preserves Facebook Dark Mode palette and caret/selection rules', () => {
    const css = readRepoFile('src/styles/theme.css');
    for (const hex of ['#18191a', '#242526', '#3a3b3c', '#3e4042', '#e4e6eb', '#b0b3b8', '#2d88ff']) {
      assert.ok(css.toLowerCase().includes(hex), `theme.css missing Facebook Dark Mode color ${hex}`);
    }
    assert.match(css, /caret-color:\s*transparent/);
    assert.match(css, /user-select:\s*text/);
  });

  it('U2.4 prod.mjs serves robots.txt, security.txt, /api/health with security headers and returns 404 for missing non-HTML extensions', async () => {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'dist', 'index.html')), 'dist/index.html must exist for prod.mjs test');

    const port = await getFreePort();
    const childTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'respub-prod-test-'));

    const child = spawn(process.execPath, [path.join(REPO_ROOT, 'src', 'server', 'prod.mjs')], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: childTemp,
        TURSO_DATABASE_URL: '',
        TURSO_AUTH_TOKEN: '',
        LIBSQL_URL: '',
        LIBSQL_AUTH_TOKEN: '',
        BREVO_API_KEY: '',
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_SECURE: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: '',
        APP_URL: '',
        APIFY_API_TOKEN: '',
        APIFY_TOKEN: '',
        GEMINI_API_KEY: '',
        GROQ_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('prod.mjs failed to start within 8s')), 8000);
        const onData = (chunk) => {
          if (chunk.toString('utf8').includes('Running on http://0.0.0.0:')) {
            clearTimeout(timer);
            resolve();
          }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`prod.mjs exited prematurely with code ${code}`));
        });
      });

      const base = `http://127.0.0.1:${port}`;

      const health = await httpRequest(base, 'GET', '/api/health');
      assert.equal(health.status, 200);
      assert.equal(health.json?.status, 'ok');
      assert.ok(health.headers['strict-transport-security']);

      const robots = await httpRequest(base, 'GET', '/robots.txt');
      assert.equal(robots.status, 200);
      assert.match(String(robots.headers['content-type'] || ''), /text\/plain/i);
      assert.match(robots.rawBody, /User-agent:/);

      const sec = await httpRequest(base, 'GET', '/.well-known/security.txt');
      assert.equal(sec.status, 200);
      assert.match(String(sec.headers['content-type'] || ''), /text\/plain/i);
      assert.match(sec.rawBody, /Contact:/);

      const missingJs = await httpRequest(base, 'GET', '/assets/does-not-exist-123.js');
      assert.equal(missingJs.status, 404, 'Missing .js file must return 404, not index.html');

      const missingTxt = await httpRequest(base, 'GET', '/nonexistent-policy.txt');
      assert.equal(missingTxt.status, 404, 'Missing .txt file must return 404, not index.html');
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', () => resolve()));
      try {
        fs.rmSync(childTemp, { recursive: true, force: true });
      } catch {}
    }
  });

  it('U2.5 Public Campus AI on PublicRepositoryPortal and privacy guardrails', async () => {
    // 1. Verify PublicRepositoryPortal mounts FloatingAskAIBubble in public mode
    const portal = readRepoFile('src/app/components/PublicRepositoryPortal.tsx');
    assert.match(portal, /<FloatingAskAIBubble\s+isPublic/);

    // 2. Unauthenticated question: "What is this system for?"
    const resOverview = await env.request('POST', '/api/ai/ask-campus', {
      body: { question: 'What is this system for?' },
    });
    assert.equal(resOverview.status, 200);
    assert.match(resOverview.json?.answer, /Research Publication Tracking System|PSU Asingan/i);

    // 3. Unauthenticated question: "How can I be part of the system?"
    const resJoin = await env.request('POST', '/api/ai/ask-campus', {
      body: { question: 'How can I be part of the system?' },
    });
    assert.equal(resJoin.status, 200);
    assert.match(resJoin.json?.answer, /Ask for Invitation|Research Coordinator/i);

    // 4. Unauthenticated question: "How many researchers are in the system?"
    const resCount = await env.request('POST', '/api/ai/ask-campus', {
      body: { question: 'How many researchers are in the system?' },
    });
    assert.equal(resCount.status, 200);
    assert.match(resCount.json?.answer, /researcher/i);

    // 5. Unauthenticated privacy protection: Instructor ID and private email inquiries
    const resPrivacy = await env.request('POST', '/api/ai/ask-campus', {
      body: { question: 'What is the Instructor ID of Julius Oscar Moreno? What is his email?' },
    });
    assert.equal(resPrivacy.status, 200);
    // Must NOT leak ASIN ID
    assert.doesNotMatch(resPrivacy.json?.answer, /ASIN-\d+/);
    // Must NOT leak @psu.edu.ph or any email address
    assert.doesNotMatch(resPrivacy.json?.answer, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    // Must contain restricted / privacy explanation
    assert.match(resPrivacy.json?.answer, /Restricted for Institutional Privacy|privacy|private|restricted|confidential/i);
  });
});
