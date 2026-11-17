import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIsolatedBackend,
  installFetchMock,
  readRepoFile,
  extractNamedFunction,
  stripTsTypes,
} from './helpers/testEnv.mjs';

let env;
let adminToken;
let defaultMock;
let seq = 1;

function nextSuffix() {
  return `${Date.now()}${seq++}`;
}

function loadParseNamePartsFromProfilePage() {
  const src = readRepoFile('src/app/components/ProfilePage.tsx');
  const fnSource = extractNamedFunction(src, 'parseNameParts');
  assert.ok(fnSource, 'parseNameParts must exist in src/app/components/ProfilePage.tsx');

  // Strip TypeScript parameter & return-type annotations safely via Node stripTypeScriptTypes
  const jsSource = stripTsTypes(fnSource);

  const factory = new Function(`${jsSource}; return parseNameParts;`);
  const parseNameParts = factory();
  assert.equal(typeof parseNameParts, 'function', 'Extracted parseNameParts must be callable');
  return parseNameParts;
}

describe('R3: Edit Profile Middle Initial Parsing & Persistence', () => {
  before(async () => {
    env = await createIsolatedBackend();
    ({ token: adminToken } = await env.loginAdmin());
  });

  beforeEach(() => {
    defaultMock = installFetchMock([
      { match: 'api.crossref.org', status: 404, json: {} },
      { match: 'api.openalex.org', status: 404, json: {} },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      { match: 'generativelanguage.googleapis.com', status: 404, json: {} },
      { match: 'api.groq.com', status: 404, json: {} },
      { match: 'api.apify.com', json: { data: {} } },
      { match: 'scholar.google.com', text: '<html><body></body></html>' },
    ]);
  });

  afterEach(() => {
    if (defaultMock) {
      defaultMock.restore();
      defaultMock = null;
    }
  });

  after(async () => {
    await env.close();
  });

  // =========================================================================
  // Tier 1: Feature Coverage
  // =========================================================================

  it('T1.1 POST /api/auth/login returns firstName, middleInitial, lastName for multi-word first name + middle initial', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Julius Oscar',
      middleInitial: 'M.',
      lastName: `Moreno${s}`,
      digits: `610${seq++}`,
    });
    assert.equal(created.user?.firstName, 'Julius Oscar');
    assert.equal(created.user?.middleInitial, 'M.');
    assert.equal(created.user?.lastName, `Moreno${s}`);
  });

  it('T1.2 POST /api/auth/login returns Rodelio / M. / Garin cleanly for Coordinator', async () => {
    const res = await env.request('POST', '/api/auth/login', {
      body: {
        username: process.env.ADMIN_USERNAME || 'psuac-rc',
        password: process.env.ADMIN_PASSWORD || 'admin123',
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.user?.firstName, 'Rodelio');
    assert.equal(res.json?.user?.middleInitial, 'M.');
    assert.equal(res.json?.user?.lastName, 'Garin');
  });

  it('T1.3 GET /api/auth/profile returns authoritative structured name parts', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Maria Clara',
      middleInitial: 'A.',
      lastName: `Santos${s}`,
      digits: `620${seq++}`,
    });

    const profRes = await env.request('GET', '/api/auth/profile', {
      token: created.token,
    });
    assert.equal(profRes.status, 200, `Expected 200 from GET /api/auth/profile, got ${profRes.status}: ${profRes.rawBody}`);
    const payload = profRes.json?.user || profRes.json;
    assert.equal(payload?.firstName, 'Maria Clara');
    assert.equal(payload?.middleInitial, 'A.');
    assert.equal(payload?.lastName, `Santos${s}`);
  });

  it('T1.4 PUT /api/auth/profile persists updated firstName, middleInitial, lastName without folding middleInitial into firstName', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Juan',
      middleInitial: 'B.',
      lastName: `Cruz${s}`,
      digits: `630${seq++}`,
    });

    const updateRes = await env.request('PUT', '/api/auth/profile', {
      token: created.token,
      body: {
        firstName: 'Julius Oscar',
        middleInitial: 'M.',
        lastName: `Moreno${s}`,
      },
    });
    assert.equal(updateRes.status, 200, `Expected 200, got ${updateRes.status}: ${updateRes.rawBody}`);
    assert.equal(updateRes.json?.user?.firstName, 'Julius Oscar');
    assert.equal(updateRes.json?.user?.middleInitial, 'M.');
    assert.equal(updateRes.json?.user?.lastName, `Moreno${s}`);

    // Re-login and verify persistence
    const relogin = await env.request('POST', '/api/auth/login', {
      body: { username: created.instructorId, password: created.password },
    });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.json?.user?.firstName, 'Julius Oscar');
    assert.equal(relogin.json?.user?.middleInitial, 'M.');
    assert.equal(relogin.json?.user?.lastName, `Moreno${s}`);
  });

  it('T1.5 ProfilePage.tsx parseNameParts() keeps middle initial in middleInitial for multi-word first names', () => {
    const parseNameParts = loadParseNamePartsFromProfilePage();

    assert.deepEqual(parseNameParts('Julius Oscar M. Moreno'), {
      firstName: 'Julius Oscar',
      middleInitial: 'M.',
      lastName: 'Moreno',
    });
    assert.deepEqual(parseNameParts('Juan Carlos M. Dela Cruz'), {
      firstName: 'Juan Carlos',
      middleInitial: 'M.',
      lastName: 'Dela Cruz',
    });
    assert.deepEqual(parseNameParts('Rodelio M. Garin'), {
      firstName: 'Rodelio',
      middleInitial: 'M.',
      lastName: 'Garin',
    });
    assert.deepEqual(parseNameParts('Sir Rodelio M. Garin'), {
      firstName: 'Rodelio',
      middleInitial: 'M.',
      lastName: 'Garin',
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================

  it('T2.1 GET /api/auth/profile and PUT /api/auth/profile return 401 when unauthenticated', async () => {
    const getUnauth = await env.request('GET', '/api/auth/profile');
    assert.equal(getUnauth.status, 401, `Unauthenticated GET /api/auth/profile must return 401, got ${getUnauth.status}`);

    const putUnauth = await env.request('PUT', '/api/auth/profile', {
      body: { userId: 'admin-1', firstName: 'Hacked' },
    });
    assert.equal(putUnauth.status, 401, `Unauthenticated PUT /api/auth/profile must return 401, got ${putUnauth.status}`);
  });

  it('T2.2 parseNameParts() handles empty middle initial, two-word names, and 2-letter middle initial', () => {
    const parseNameParts = loadParseNamePartsFromProfilePage();

    assert.deepEqual(parseNameParts('Julius Oscar Moreno'), {
      firstName: 'Julius Oscar',
      middleInitial: '',
      lastName: 'Moreno',
    });
    assert.deepEqual(parseNameParts('Jane Doe'), {
      firstName: 'Jane',
      middleInitial: '',
      lastName: 'Doe',
    });
    assert.deepEqual(parseNameParts('Maria Clara De Los Santos'), {
      firstName: 'Maria Clara De Los',
      middleInitial: '',
      lastName: 'Santos',
    });
    assert.deepEqual(parseNameParts('Jose Ma. Santos'), {
      firstName: 'Jose',
      middleInitial: 'Ma.',
      lastName: 'Santos',
    });
  });

  it('T2.3 GET /api/researchers and PUT /api/researchers/:id preserve firstName, middleInitial, lastName', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Jose',
      middleInitial: 'P.',
      lastName: `Rizal${s}`,
      digits: `640${seq++}`,
    });

    const listRes = await env.request('GET', '/api/researchers');
    assert.equal(listRes.status, 200);
    const found = listRes.json.find((r) => r.id === created.researcher.id);
    assert.ok(found, 'Created researcher must appear in GET /api/researchers');
    assert.equal(found.firstName, 'Jose');
    assert.equal(found.middleInitial, 'P.');
    assert.equal(found.lastName, `Rizal${s}`);

    const upd = await env.request('PUT', `/api/researchers/${created.researcher.id}`, {
      token: adminToken,
      body: {
        firstName: 'Jose Protacio',
        middleInitial: 'M.',
        lastName: `Rizal${s}`,
      },
    });
    assert.equal(upd.status, 200);

    const getOne = await env.request('GET', `/api/researchers/${created.researcher.id}`);
    assert.equal(getOne.status, 200);
    assert.equal(getOne.json?.firstName, 'Jose Protacio');
    assert.equal(getOne.json?.middleInitial, 'M.');
    assert.equal(getOne.json?.lastName, `Rizal${s}`);
  });

  it('T2.4 Non-admin cannot PUT /api/researchers/:id for another researcher (403)', async () => {
    const r1 = await env.createActiveResearcher(adminToken, { digits: `650${seq++}` });
    const r2 = await env.createActiveResearcher(adminToken, { digits: `651${seq++}` });

    const res = await env.request('PUT', `/api/researchers/${r2.researcher.id}`, {
      token: r1.token,
      body: { firstName: 'Unauthorized' },
    });
    assert.equal(res.status, 403);
  });

  it('T2.5 LoginScreen.tsx and AdminPage.tsx preserve firstName, middleInitial, lastName in session & edit state', () => {
    const loginSrc = readRepoFile('src/app/components/LoginScreen.tsx');
    const loginSubmit = extractNamedFunction(loginSrc, 'handleLogin');
    assert.ok(loginSubmit, 'handleLogin must exist in LoginScreen.tsx');
    assert.match(loginSubmit, /firstName/, 'LoginScreen setCurrentUser must include firstName');
    assert.match(loginSubmit, /middleInitial/, 'LoginScreen setCurrentUser must include middleInitial');
    assert.match(loginSubmit, /lastName/, 'LoginScreen setCurrentUser must include lastName');

    const adminSrc = readRepoFile('src/app/components/AdminPage.tsx');
    const editFn = extractNamedFunction(adminSrc, 'editResearcher');
    assert.ok(editFn, 'editResearcher must exist in AdminPage.tsx');
    assert.match(editFn, /middleInitial/, 'AdminPage editResearcher must preserve middleInitial');
  });

  // =========================================================================
  // Tier 3: Pairwise R3 + R2
  // =========================================================================

  it('T2.6 Coordinator personal ProfilePage view removes "Sir" honorific and displays "Rodelio M. Garin" (Terminology Rule 5)', () => {
    const profileSrc = readRepoFile('src/app/components/ProfilePage.tsx');
    assert.match(profileSrc, /Rodelio M\. Garin/, 'ProfilePage must reference Rodelio M. Garin without Sir prefix');
    const openEditFn = extractNamedFunction(profileSrc, 'handleOpenEdit');
    assert.ok(openEditFn, 'handleOpenEdit must exist in ProfilePage.tsx');
    assert.match(openEditFn, /firstName/, 'handleOpenEdit must read firstName');
    assert.match(openEditFn, /middleInitial/, 'handleOpenEdit must read middleInitial');
    assert.match(openEditFn, /lastName/, 'handleOpenEdit must read lastName');
  });

  it('T2.7 PUT /api/auth/profile reconstructs full name cleanly without duplicating middle initial', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Julius Oscar',
      middleInitial: 'M.',
      lastName: `Moreno${s}`,
      digits: `655${seq++}`,
    });

    const upd = await env.request('PUT', '/api/auth/profile', {
      token: created.token,
      body: {
        firstName: 'Julius Oscar',
        middleInitial: 'M.',
        lastName: `Moreno${s}`,
      },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.json?.user?.name, `Julius Oscar M. Moreno${s}`);
  });

  it('T3.1 Pairwise R3+R2: Updating profile middle initial preserves researcher publication links', async () => {
    const s = nextSuffix();
    const created = await env.createActiveResearcher(adminToken, {
      firstName: 'Julius Oscar',
      middleInitial: 'A.',
      lastName: `Tester${s}`,
      digits: `660${seq++}`,
    });

    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Profile Link Preservation Study ${s}`,
        authors: [`Julius Oscar A. Tester${s}`],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: created.instructorId,
      },
    });
    assert.equal(pubRes.status, 201);

    const upd = await env.request('PUT', '/api/auth/profile', {
      token: created.token,
      body: {
        firstName: 'Julius Oscar',
        middleInitial: 'M.',
        lastName: `Tester${s}`,
      },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.json?.user?.middleInitial, 'M.');

    const pubs = await env.request('GET', '/api/publications', { token: created.token });
    assert.equal(pubs.status, 200);
    const mine = pubs.json.find((p) => p.id === pubRes.json.id);
    assert.ok(mine, 'Approved publication must remain accessible after profile name update');
  });
});
