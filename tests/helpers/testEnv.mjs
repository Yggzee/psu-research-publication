import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import * as nodeModule from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const PROD_DB_PATH = path.resolve(REPO_ROOT, 'data', 'research.db');

let singletonPromise = null;
let activeRefs = 0;
let ipCounter = 1;
const originalFetch = globalThis.fetch;

function nextSyntheticIp() {
  const idx = ipCounter++;
  const b3 = Math.floor(idx / 250) % 250;
  const b4 = (idx % 250) + 1;
  return `10.88.${b3}.${b4}`;
}

/**
 * Performs an HTTP request using node:http so it is never intercepted by
 * globalThis.fetch mocks used for external scholarly APIs.
 */
export function httpRequest(baseUrl, method, pathname, { token, body, headers = {}, ip } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, baseUrl);
    const reqHeaders = {
      'x-forwarded-for': ip || nextSyntheticIp(),
      ...headers,
    };
    if (token) {
      reqHeaders.authorization = `Bearer ${token}`;
    }

    let payload = null;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        payload = body;
      } else {
        payload = JSON.stringify(body);
        if (!reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
          reqHeaders['content-type'] = 'application/json';
        }
      }
      reqHeaders['content-length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: method.toUpperCase(),
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const contentType = String(res.headers['content-type'] || '');
          let json = null;
          if (contentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
            try {
              json = JSON.parse(rawBody);
            } catch {
              json = null;
            }
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            rawBody,
            json,
          });
        });
      }
    );
    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Creates (or shares within the same test worker process) an isolated backend instance:
 * - Fresh os.tmpdir() DATA_DIR
 * - Blanked Turso/Brevo/SMTP/Apify env vars BEFORE dynamic import()
 * - Verified SQLite path strictly inside tempDir
 * - Ephemeral 127.0.0.1 HTTP server bound to port 0
 */
export async function createIsolatedBackend() {
  activeRefs++;
  if (!singletonPromise) {
    singletonPromise = (async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'respub-e2e-'));

      // MUST set these BEFORE dynamic import of db.mjs / turso.mjs / apiHandler.mjs
      process.env.DATA_DIR = tempDir;
      process.env.TURSO_DATABASE_URL = '';
      process.env.TURSO_AUTH_TOKEN = '';
      process.env.LIBSQL_URL = '';
      process.env.LIBSQL_AUTH_TOKEN = '';
      process.env.BREVO_API_KEY = '';
      process.env.SMTP_HOST = '';
      process.env.SMTP_PORT = '';
      process.env.SMTP_SECURE = '';
      process.env.SMTP_USER = '';
      process.env.SMTP_PASS = '';
      process.env.SMTP_FROM = '';
      process.env.APP_URL = '';
      process.env.APIFY_API_TOKEN = '';
      process.env.APIFY_TOKEN = '';
      process.env.GEMINI_API_KEY = '';
      process.env.GROQ_API_KEY = '';

      const dbMod = await import('../../src/server/db.mjs');
      const apiMod = await import('../../src/server/apiHandler.mjs');
      const rlMod = await import('../../src/server/rateLimiter.mjs');
      const authMod = await import('../../src/server/authHelper.mjs');
      const scraperMod = await import('../../src/server/scholarScraper.mjs');
      const tursoMod = await import('../../src/server/turso.mjs');
      const secMod = await import('../../src/server/securityHeaders.mjs');

      await dbMod.dbReadyPromise;

      const dbList = dbMod.db.prepare('PRAGMA database_list').all();
      const mainEntry = dbList.find((row) => row.name === 'main');
      assert.ok(mainEntry && mainEntry.file, 'Expected SQLite main database file path');
      const resolvedMain = path.resolve(mainEntry.file);
      const resolvedTemp = path.resolve(tempDir);
      assert.ok(
        resolvedMain.startsWith(resolvedTemp),
        `DB isolation breach! Expected DB inside ${resolvedTemp}, got ${resolvedMain}`
      );
      assert.notEqual(
        resolvedMain.toLowerCase(),
        PROD_DB_PATH.toLowerCase(),
        'DB isolation breach! Production data/research.db must never be opened'
      );

      const server = http.createServer((req, res) => {
        apiMod.handleApiRequest(req, res).catch((err) => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Unhandled test server error' }));
          }
        });
      });

      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });

      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      return {
        tempDir,
        dbPath: resolvedMain,
        baseUrl,
        server,
        db: dbMod.db,
        dbMod,
        dbReadyPromise: dbMod.dbReadyPromise,
        handleApiRequest: apiMod.handleApiRequest,
        rateLimiter: rlMod.rateLimiter,
        loginAttemptTracker: rlMod.loginAttemptTracker,
        authHelper: authMod,
        scholarScraper: scraperMod,
        turso: tursoMod,
        securityHeaders: secMod,
      };
    })();
  }

  const ctx = await singletonPromise;

  return {
    ...ctx,
    request(method, pathname, options) {
      return httpRequest(ctx.baseUrl, method, pathname, options);
    },
    resetRateLimits() {
      ctx.rateLimiter.reset();
      ctx.loginAttemptTracker.attempts.clear();
    },
    async loginAdmin(
      username = process.env.ADMIN_USERNAME || 'psuac-rc',
      password = process.env.ADMIN_PASSWORD || 'admin123'
    ) {
      const res = await httpRequest(ctx.baseUrl, 'POST', '/api/auth/login', {
        body: { username, password },
      });
      assert.equal(res.status, 200, `Admin login failed: ${res.rawBody}`);
      assert.ok(res.json?.token, 'Admin login must return JWT/HMAC token');
      return { token: res.json.token, user: res.json.user };
    },
    async createActiveResearcher(adminToken, overrides = {}) {
      const uid = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const digits = String(overrides.digits || (10000 + (ipCounter % 89999)));
      const password = overrides.password || 'ResearcherPass123!';
      const payload = {
        firstName: 'Juan',
        middleInitial: '',
        lastName: `Tester${uid}`,
        instructorId: `ASIN-${digits}`,
        email: `tester.${uid}@psu.edu.ph`,
        password,
        department: 'BSIT',
        isFaculty: true,
        sendInvite: false,
        ...overrides,
      };
      const createRes = await httpRequest(ctx.baseUrl, 'POST', '/api/researchers', {
        token: adminToken,
        body: payload,
      });
      assert.equal(
        createRes.status,
        201,
        `createActiveResearcher failed (${createRes.status}): ${createRes.rawBody}`
      );
      const loginRes = await httpRequest(ctx.baseUrl, 'POST', '/api/auth/login', {
        body: { username: payload.email, password },
      });
      assert.equal(
        loginRes.status,
        200,
        `Researcher login failed (${loginRes.status}): ${loginRes.rawBody}`
      );
      return {
        researcher: createRes.json.researcher,
        user: loginRes.json.user,
        token: loginRes.json.token,
        password,
        instructorId: createRes.json.researcher?.instructorId || payload.instructorId,
      };
    },
    async close() {
      activeRefs = Math.max(0, activeRefs - 1);
      if (activeRefs === 0 && singletonPromise) {
        const current = await singletonPromise;
        singletonPromise = null;
        await new Promise((resolve) => current.server.close(() => resolve()));
        try {
          current.db.close();
        } catch {}
        try {
          fs.rmSync(current.tempDir, { recursive: true, force: true });
        } catch {}
      }
    },
  };
}

function buildMockResponse({ status = 200, headers = {}, json, text }) {
  const hdrs = new Headers(headers);
  let bodyText = '';
  if (json !== undefined) {
    bodyText = JSON.stringify(json);
    if (!hdrs.has('content-type')) {
      hdrs.set('content-type', 'application/json');
    }
  } else if (text !== undefined) {
    bodyText = String(text);
    if (!hdrs.has('content-type')) {
      hdrs.set('content-type', 'text/html; charset=utf-8');
    }
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Status ${status}`,
    headers: hdrs,
    async text() {
      return bodyText;
    },
    async json() {
      return json !== undefined ? json : JSON.parse(bodyText || '{}');
    },
  };
}

/**
 * Installs an offline deterministic mock for globalThis.fetch.
 * Local loopback requests (127.0.0.1 / localhost) pass through to original fetch.
 * Any unmatched external request throws immediately so tests never hit live networks.
 */
export function installFetchMock(routes = []) {
  const calls = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);

    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) {
      return originalFetch(input, init);
    }

    calls.push({ url, init });

    for (const route of routes) {
      const matched =
        typeof route.match === 'function'
          ? route.match(url, init)
          : route.match instanceof RegExp
            ? route.match.test(url)
            : url.includes(String(route.match));

      if (!matched) continue;

      if (route.throwError) {
        throw route.throwError;
      }
      if (typeof route.handler === 'function') {
        const resSpec = await route.handler(url, init);
        if (resSpec instanceof Error) throw resSpec;
        return buildMockResponse(resSpec || {});
      }
      return buildMockResponse(route);
    }

    throw new Error(`Unmocked external fetch blocked in offline test: ${url}`);
  };

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

export const FIXTURES = {
  crossrefDoiWork(doi = '10.1000/respub-2025', overrides = {}) {
    return {
      status: 'ok',
      message: {
        DOI: doi,
        title: ['Smart Agriculture Monitoring for Pangasinan Farms'],
        author: [
          { given: 'Julius Oscar', family: 'Moreno' },
          { given: 'Rodelio M.', family: 'Garin' },
        ],
        'container-title': ['Philippine Journal of Computing and Agriculture'],
        published: { 'date-parts': [[2025, 3, 15]] },
        volume: '14',
        issue: '2',
        page: '45-58',
        ISSN: ['2546-1234'],
        URL: `https://doi.org/${doi}`,
        abstract: '<jats:p>An IoT-driven soil moisture and crop health analytics platform deployed across Pangasinan.</jats:p>',
        'is-referenced-by-count': 12,
        ...overrides,
      },
    };
  },

  openAlexWork(doi = '10.1000/respub-2025', workId = 'W99887766', overrides = {}) {
    return {
      id: `https://openalex.org/${workId}`,
      doi: `https://doi.org/${doi}`,
      title: 'Smart Agriculture Monitoring for Pangasinan Farms',
      publication_year: 2025,
      publication_date: '2025-03-15',
      cited_by_count: 14,
      authorships: [
        { author: { display_name: 'Julius Oscar Moreno' } },
        { author: { display_name: 'Rodelio M. Garin' } },
      ],
      primary_location: {
        source: { display_name: 'Philippine Journal of Computing and Agriculture', issn_l: '2546-1234' },
        landing_page_url: `https://journal.example.org/articles/${workId}`,
        pdf_url: `https://journal.example.org/articles/${workId}.pdf`,
      },
      abstract_inverted_index: {
        An: [0],
        IoT: [1],
        soil: [2],
        monitoring: [3],
        platform: [4],
        for: [5],
        Pangasinan: [6],
        'farms.': [7],
      },
      sustainable_development_goals: [
        { id: 'https://metadata.un.org/sdg/2', display_name: 'Zero hunger', score: 0.91 },
      ],
      ...overrides,
    };
  },

  gsSearchHtml({
    title = 'Smart Agriculture Monitoring for Pangasinan Farms',
    authors = 'JO Moreno, RM Garin',
    journal = 'Philippine Journal of Computing',
    year = 2025,
    citesId = '777888999',
    citationsText = '59',
    aboutTotalText = 'About 59 results (0.04 sec)',
    pdfUrl = 'https://journal.example.org/paper.pdf',
    paperUrl = 'https://journal.example.org/paper',
    nestedDiv = true,
  } = {}) {
    const innerExtra = nestedDiv ? '<div class="gs_extra_meta"><span>Peer Reviewed</span></div>' : '';
    return `<!doctype html><html><head><title>Google Scholar</title></head><body>
      <div id="gs_ab_md"><div class="gs_ab_mdw">${aboutTotalText}</div></div>
      <div id="gs_res_ccl_mid">
        <div class="gs_r gs_or gs_scl" data-cid="abc123">
          <div class="gs_ggs gs_fl"><div class="gs_ggsd"><div class="gs_or_ggsm"><a href="${pdfUrl}">[PDF] journal.example.org</a></div></div></div>
          <div class="gs_ri">
            <h3 class="gs_rt"><a href="${paperUrl}">${title}</a></h3>
            <div class="gs_a">${authors} - ${journal}, ${year} - journal.example.org</div>
            <div class="gs_rs">IoT-driven soil moisture and crop analytics for sustainable agriculture.</div>
            ${innerExtra}
            <div class="gs_fl gs_flb">
              <a href="/scholar?cites=${citesId}&amp;as_sdt=2005&amp;sciodt=0,5&amp;hl=en">Cited by ${citationsText}</a>
              <a href="/scholar?q=related:abc:scholar.google.com/">Related articles</a>
            </div>
          </div>
        </div>
      </div>
      <div id="gs_res_ccl_bot"></div>
    </body></html>`;
  },

  gsCitationsPageHtml(items = []) {
    const blocks = items
      .map(
        (it, idx) => `
      <div class="gs_r gs_or gs_scl">
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="${it.link || `https://example.org/citing-${idx}`}">${it.title}</a></h3>
          <div class="gs_a">${it.authors || 'A. Author, B. Researcher'} - ${it.journal || 'Journal of Testing'}, ${it.year || 2025} - example.org</div>
          <div class="gs_rs">Citing research snippet ${idx + 1}.</div>
          <div class="gs_fl"><div class="gs_fl_inner"><a href="/scholar?cites=${1000 + idx}">Cited by 3</a></div></div>
        </div>
      </div>`
      )
      .join('\n');
    return `<!doctype html><html><head><title>Google Scholar</title></head><body>
      <div id="gs_ab_md"><div class="gs_ab_mdw">About ${items.length} results (0.03 sec)</div></div>
      ${blocks}
      <div id="gs_res_ccl_bot"></div>
    </body></html>`;
  },

  gsProfileHtml({
    name = 'Rodelio M. Garin',
    affiliation = 'Pangasinan State University - Asingan Campus',
    verifiedEmail = 'Verified email at psu.edu.ph',
    totalCitations = '1,234',
    hIndex = '12',
    i10Index = '15',
    rows = [],
  } = {}) {
    const rowHtml = rows
      .map(
        (r) => `
      <tr class="gsc_a_tr">
        <td class="gsc_a_t">
          <a href="${r.href || '/citations?view_op=view_citation&citation_for_view=abc'}" class="gsc_a_at">${r.title}</a>
          <div class="gs_gray">${r.authors || 'RM Garin, JO Moreno'}</div>
          <div class="gs_gray">${r.journal || 'Philippine Journal of Science'}</div>
        </td>
        <td class="gsc_a_c"><a href="${r.citedByLink || 'https://scholar.google.com/scholar?oi=bibs&hl=en&cites=777888999'}" class="gsc_a_ac gs_ibl">${r.citations}</a></td>
        <td class="gsc_a_y"><span class="gsc_a_h gsc_a_hc gs_ibl">${r.year || 2025}</span></td>
      </tr>`
      )
      .join('\n');

    return `<!doctype html><html><head><title>${name} - Google Scholar</title></head><body>
      <div id="gsc_prf_in">${name}</div>
      <div class="gsc_prf_il">${affiliation}</div>
      <div id="gsc_prf_ivh">${verifiedEmail}</div>
      <table id="gsc_rsb_st">
        <tr><td class="gsc_rsb_std">${totalCitations}</td><td class="gsc_rsb_std">900</td></tr>
        <tr><td class="gsc_rsb_std">${hIndex}</td><td class="gsc_rsb_std">10</td></tr>
        <tr><td class="gsc_rsb_std">${i10Index}</td><td class="gsc_rsb_std">11</td></tr>
      </table>
      <table id="gsc_a_t"><tbody id="gsc_a_b">${rowHtml}</tbody></table>
    </body></html>`;
  },

  gsVerificationHtml() {
    return `<!doctype html><html><head><title>Verifying...</title></head><body>
      <div id="sgsync-verification">Please wait while we verify your browser.</div>
    </body></html>`;
  },
};

export function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

export function walkFiles(relDir, exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
  const root = path.join(REPO_ROOT, relDir);
  if (!fs.existsSync(root)) return [];
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Finds the index of the matching closing brace for the `{` at `openIdx`,
 * or returns -1 if unbalanced.
 */
function findMatchingBraceIndex(source, openIdx) {
  if (openIdx === -1 || source[openIdx] !== '{') return -1;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Extracts a balanced-brace block starting from the first `{` at or after `openSearchIdx`
 * (or `startIdx` when `openSearchIdx` is omitted), returning `source.slice(startIdx, closeIdx + 1)`.
 */
export function extractBalancedBraces(source, startIdx, openSearchIdx = startIdx) {
  const openIdx = source.indexOf('{', openSearchIdx);
  const closeIdx = findMatchingBraceIndex(source, openIdx);
  if (closeIdx === -1) return '';
  return source.slice(startIdx, closeIdx + 1);
}

function skipWsAndComments(source, idx) {
  let i = idx;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function findFunctionBodyBrace(source, startIdx, isAssigned) {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let sawParamParens = false;
  let sawReturnColon = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '(') {
      if (parenDepth === 0 && braceDepth === 0 && bracketDepth === 0 && !sawParamParens) {
        sawParamParens = true;
      }
      parenDepth++;
      continue;
    }
    if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
      continue;
    }
    if (ch === '[') { bracketDepth++; continue; }
    if (ch === ']') { if (bracketDepth > 0) bracketDepth--; continue; }

    if (parenDepth === 0 && bracketDepth === 0) {
      if (isAssigned) {
        if (ch === '{') braceDepth++;
        else if (ch === '}' && braceDepth > 0) braceDepth--;
        else if (ch === '=' && next === '>' && braceDepth === 0) {
          const afterArrow = skipWsAndComments(source, i + 2);
          if (source[afterArrow] === '{') {
            return afterArrow;
          }
          i++;
        }
      } else if (sawParamParens && parenDepth === 0) {
        if (ch === ':' && braceDepth === 0) {
          sawReturnColon = true;
          continue;
        }
        if (ch === '{') {
          if (sawReturnColon) {
            const closeIdx = findMatchingBraceIndex(source, i);
            if (closeIdx !== -1) {
              const afterClose = skipWsAndComments(source, closeIdx + 1);
              const nextChar = source[afterClose];
              if (nextChar === '{' || nextChar === '|' || nextChar === '&' || nextChar === '[') {
                i = closeIdx;
                continue;
              }
            }
          }
          return i;
        }
      }
    }
  }
  return -1;
}

export function extractNamedFunction(source, fnName) {
  const regex = new RegExp(`(?:(?:export\\s+)?(?:async\\s+)?function\\s+${fnName}\\b|(?:const|let|var)\\s+${fnName}\\s*=)`);
  const match = regex.exec(source);
  if (!match) return '';
  const isAssigned = /^(?:const|let|var)\b/.test(match[0]);
  const bodyIdx = findFunctionBodyBrace(source, match.index, isAssigned);
  if (bodyIdx === -1) {
    // Fallback for plain JS without TS return types
    const fallbackIdx = source.indexOf('{', match.index);
    if (fallbackIdx === -1) return '';
    return extractBalancedBraces(source, match.index, fallbackIdx);
  }
  return extractBalancedBraces(source, match.index, bodyIdx);
}

/**
 * Strips TypeScript type annotations from extracted non-JSX JS/TS function source.
 * Uses Node v24 built-in stripTypeScriptTypes when available, with regex fallback.
 */
export function stripTsTypes(tsSource) {
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    try {
      return nodeModule.stripTypeScriptTypes(tsSource, { mode: 'strip' });
    } catch {
      // fall through to regex fallback
    }
  }
  return tsSource
    .replace(/\)\s*:\s*\{[^}]*\}\s*=>/g, ') =>')
    .replace(/\)\s*:\s*[\w.<>\[\]\s|&?]+\s*(=>|\{)/g, ') $1')
    .replace(/(\w)\s*\??\s*:\s*(?:string|number|boolean|any|unknown|void|never)(?:\[\])?/g, '$1')
    .replace(/\bas\s+(?:string|number|boolean|any|unknown)\b/g, '');
}
