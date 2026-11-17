import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIsolatedBackend,
  installFetchMock,
  FIXTURES,
  readRepoFile,
  extractNamedFunction,
} from './helpers/testEnv.mjs';

let env;
let adminToken;
let fetchMock;
let seq = 1;

function nextSuffix() {
  return `${Date.now()}${seq++}`;
}

function buildDoiMockRoutes(doi, title, citations = 59) {
  return [
    {
      match: `api.crossref.org/works/${encodeURIComponent(doi)}`,
      json: FIXTURES.crossrefDoiWork(doi, {
        title: [title],
        'is-referenced-by-count': 12,
      }),
    },
    {
      match: 'api.crossref.org/works',
      json: { status: 'ok', message: { items: [] } },
    },
    {
      match: /api\.openalex\.org\/works\/doi:/,
      json: FIXTURES.openAlexWork(doi, 'W55443322', { title }),
    },
    {
      match: 'api.openalex.org/works?filter=cites:',
      json: {
        meta: { next_cursor: null },
        results: [
          {
            id: 'https://openalex.org/W111',
            title: `Follow-up Study Citing ${title}`,
            publication_year: 2026,
            publication_date: '2026-02-01',
            doi: 'https://doi.org/10.1000/citing-follow-up',
            authorships: [{ author: { display_name: 'Elena Cruz' } }],
            primary_location: { source: { display_name: 'IEEE Access' } },
          },
        ],
      },
    },
    {
      match: 'api.openalex.org/works',
      json: { results: [] },
    },
    {
      match: 'api.semanticscholar.org',
      json: { data: [] },
    },
    {
      match: 'scholar.google.com/scholar?cites=',
      text: FIXTURES.gsCitationsPageHtml([
        { title: `GS Citing Work of ${title}`, authors: 'C. Reyes', journal: 'Science Direct', year: 2026 },
      ]),
    },
    {
      match: 'scholar.google.com/scholar',
      text: FIXTURES.gsSearchHtml({
        title,
        citesId: '888999000',
        citationsText: String(citations),
        aboutTotalText: `About ${citations} results (0.04 sec)`,
      }),
    },
  ];
}

describe('R2: My Publications Approval Workflow, Add Options, and Removal Controls', () => {
  before(async () => {
    env = await createIsolatedBackend();
    ({ token: adminToken } = await env.loginAdmin());
  });

  beforeEach(() => {
    // Offline-safe fast default stub (tests needing rich metadata override fetchMock explicitly)
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
  // Tier 1: Feature Coverage
  // =========================================================================

  it('T1.1 Non-admin manual POST /api/publications creates pending, non-public record hidden from default lists', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Manual',
      lastName: `Submitter${s}`,
      digits: `701${seq++}`,
    });

    const title = `Pending Manual Publication ${s}`;
    const createRes = await env.request('POST', '/api/publications', {
      token: researcher.token,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'Philippine Journal of Computing',
        year: 2025,
        abstract: 'A genuinely submitted pending research paper.',
      },
    });
    assert.equal(createRes.status, 201, `Expected 201, got ${createRes.status}: ${createRes.rawBody}`);
    const pubId = createRes.json.id;

    // DB must store pending & non-public
    const row = env.db.prepare('SELECT approval_status, is_public FROM publications WHERE id = ?').get(pubId);
    assert.equal(row?.approval_status, 'pending');
    assert.equal(Number(row?.is_public), 0);

    // Must NOT appear in default GET /api/publications (guest or researcher)
    const guestList = await env.request('GET', '/api/publications');
    assert.equal(guestList.status, 200);
    assert.ok(!guestList.json.some((p) => p.id === pubId), 'Guest list must exclude pending publication');

    const ownList = await env.request('GET', '/api/publications', { token: researcher.token });
    assert.equal(ownList.status, 200);
    assert.ok(!ownList.json.some((p) => p.id === pubId), 'Default researcher GET /api/publications must exclude pending publication until approved');

    // Must NOT appear in GET /api/repository/search
    const repoSearch = await env.request('GET', `/api/repository/search?q=${encodeURIComponent(title)}`);
    assert.equal(repoSearch.status, 200);
    const repoResults = Array.isArray(repoSearch.json) ? repoSearch.json : repoSearch.json?.results || [];
    assert.ok(!repoResults.some((p) => p.id === pubId), 'Repository search must exclude pending publication');
  });

  it('T1.2 Pending publication appears in GET /api/claims and becomes visible after Coordinator approval', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Approve',
      lastName: `Flow${s}`,
      digits: `702${seq++}`,
    });

    const title = `Approval Gate Research ${s}`;
    const createRes = await env.request('POST', '/api/publications', {
      token: researcher.token,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'PSU Asingan Research Journal',
        year: 2025,
      },
    });
    assert.equal(createRes.status, 201);
    const pubId = createRes.json.id;

    // Admin sees it in GET /api/claims
    const claimsRes = await env.request('GET', '/api/claims', { token: adminToken });
    assert.equal(claimsRes.status, 200);
    const claim = claimsRes.json.find((c) => c.id === pubId || c.publication_id === pubId);
    assert.ok(claim, 'Coordinator GET /api/claims must surface pending publication');
    assert.ok(claim.claimSource, 'Claim item must include claimSource metadata');

    // Coordinator approves via POST /api/claims/:id/review
    const reviewRes = await env.request('POST', `/api/claims/${pubId}/review`, {
      token: adminToken,
      body: { status: 'approved' },
    });
    assert.equal(reviewRes.status, 200, `Review failed: ${reviewRes.rawBody}`);

    // Now visible in GET /api/publications & GET /api/repository/search with assignedResearcherIds
    const pubsRes = await env.request('GET', '/api/publications', { token: researcher.token });
    const approved = pubsRes.json.find((p) => p.id === pubId);
    assert.ok(approved, 'Approved publication must appear in GET /api/publications');
    assert.ok(
      Array.isArray(approved.assignedResearcherIds) && approved.assignedResearcherIds.includes(researcher.instructorId),
      'Approved publication must include assignedResearcherIds'
    );

    const searchRes = await env.request('GET', `/api/repository/search?q=${encodeURIComponent(title)}`);
    const searchRows = Array.isArray(searchRes.json) ? searchRes.json : searchRes.json?.results || [];
    assert.ok(searchRows.some((p) => p.id === pubId), 'Approved publication must appear in repository search');
  });

  it('T1.3 Authenticated non-admin POST /api/scholar/import creates pending publications scoped to caller', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Scholar',
      lastName: `Importer${s}`,
      digits: `703${seq++}`,
    });

    const title = `Scholar Imported Pending Paper ${s}`;
    const impRes = await env.request('POST', '/api/scholar/import', {
      token: researcher.token,
      body: {
        instructorId: researcher.instructorId,
        publications: [
          {
            title,
            authors: [researcher.user.name],
            journal: 'International Journal of Tech',
            year: 2024,
            citations: 7,
          },
        ],
      },
    });
    assert.equal(impRes.status, 200, `Import failed: ${impRes.rawBody}`);

    const row = env.db.prepare('SELECT id, approval_status, is_public FROM publications WHERE title = ?').get(title);
    assert.ok(row, 'Imported publication must exist in DB');
    assert.equal(row.approval_status, 'pending', 'Non-admin scholar import must stay pending');
    assert.equal(Number(row.is_public), 0);

    // Excluded from default GET /api/publications until approved
    const listRes = await env.request('GET', '/api/publications', { token: researcher.token });
    assert.ok(!listRes.json.some((p) => p.id === row.id));

    // Non-admin caller cannot import into another researcher's instructorId (403)
    const otherResearcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Other',
      lastName: `Target${s}`,
      digits: `7031${seq++}`,
    });
    const forbiddenTitle = `Unauthorized Target Import ${s}`;
    const forbiddenImp = await env.request('POST', '/api/scholar/import', {
      token: researcher.token,
      body: {
        instructorId: otherResearcher.instructorId,
        publications: [
          {
            title: forbiddenTitle,
            authors: [otherResearcher.user.name],
            journal: 'International Journal of Tech',
            year: 2024,
            citations: 3,
          },
        ],
      },
    });
    assert.equal(
      forbiddenImp.status,
      403,
      `Non-admin POST /api/scholar/import for another researcher must return 403, got ${forbiddenImp.status}`
    );
    const forbiddenRow = env.db.prepare('SELECT id FROM publications WHERE title = ?').get(forbiddenTitle);
    assert.equal(forbiddenRow, undefined, 'Forbidden cross-researcher scholar import must not persist');
  });

  it('T1.4 POST /api/publications/resolve-doi hydrates metadata from CrossRef/OpenAlex + GS citations & link', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, { digits: `704${seq++}` });
    const doi = `10.1000/respub-${s}`;
    const title = `Smart Agriculture Monitoring ${s}`;

    fetchMock = installFetchMock(buildDoiMockRoutes(doi, title, 59));

    const res = await env.request('POST', '/api/publications/resolve-doi', {
      token: researcher.token,
      body: { doi: `https://doi.org/${doi}`, ownerId: researcher.instructorId },
    });
    assert.equal(res.status, 200, `resolve-doi failed (${res.status}): ${res.rawBody}`);
    const meta = res.json?.metadata;
    assert.ok(meta, 'Response must include metadata object');
    assert.equal(meta.title, title);
    assert.ok(Array.isArray(meta.authors) && meta.authors.length >= 2);
    assert.equal(meta.journal, 'Philippine Journal of Computing and Agriculture');
    assert.equal(Number(meta.year), 2025);
    assert.equal(meta.doi, doi);
    assert.ok(meta.abstract && meta.abstract.length > 10);
    assert.equal(Number(meta.citations), 59, 'GS citation enrichment must set live count 59');
    assert.ok(meta.citedByLink && meta.citedByLink.includes('cites=888999000'));
    assert.ok(meta.pdfUrl || meta.url);
    assert.ok(Array.isArray(meta.sources) && meta.sources.length >= 1);
  });

  it('T1.4b POST /api/publications/resolve-doi falls back to OpenAlex when CrossRef returns 404', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, { digits: `7041${seq++}` });
    const doi = `10.1000/openalex-fallback-${s}`;
    const title = `OpenAlex Fallback Study ${s}`;

    fetchMock = installFetchMock([
      { match: 'api.crossref.org', status: 404, json: { status: 'failed' } },
      {
        match: `api.openalex.org/works/doi:${encodeURIComponent(doi)}`,
        json: FIXTURES.openAlexWork(doi, 'W88776655', { title }),
      },
      { match: 'api.openalex.org/works', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title,
          citesId: '66778899',
          citationsText: '59',
          aboutTotalText: 'About 59 results (0.04 sec)',
        }),
      },
    ]);

    const res = await env.request('POST', '/api/publications/resolve-doi', {
      token: researcher.token,
      body: { doi, ownerId: researcher.instructorId },
    });
    assert.equal(res.status, 200, `OpenAlex fallback resolve-doi failed (${res.status}): ${res.rawBody}`);
    const meta = res.json?.metadata;
    assert.ok(meta, 'Response must include metadata object');
    assert.equal(meta.title, title);
    assert.ok(Array.isArray(meta.authors) && meta.authors.includes('Julius Oscar Moreno'));
    assert.equal(meta.journal, 'Philippine Journal of Computing and Agriculture');
    assert.equal(Number(meta.year), 2025);
    assert.equal(meta.doi, doi);
    assert.ok(meta.abstract && meta.abstract.includes('Pangasinan'));
    assert.equal(Number(meta.citations), 59);
    assert.ok(Array.isArray(meta.sources) && meta.sources.includes('OpenAlex'), 'sources must include OpenAlex');
    assert.ok(!meta.sources.includes('CrossRef'), 'sources must not include CrossRef when CrossRef returned 404');
  });

  it('T1.5 POST /api/publications/:id/unassign unlinks researcher from publication_researchers', async () => {
    const s = nextSuffix();
    const rA = await env.createActiveResearcher(adminToken, { firstName: 'Alpha', lastName: `Co${s}`, digits: `705${seq++}` });
    const rB = await env.createActiveResearcher(adminToken, { firstName: 'Beta', lastName: `Co${s}`, digits: `706${seq++}` });

    const createRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Coauthored Paper ${s}`,
        authors: [rA.user.name, rB.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: rA.instructorId,
      },
    });
    assert.equal(createRes.status, 201);
    const pubId = createRes.json.id;

    // Ensure rB is also linked in publication_researchers
    env.db.prepare(
      `INSERT OR IGNORE INTO publication_researchers (publication_id, instructor_id, approval_status, assigned_by, created_at)
       VALUES (?, ?, 'approved', 'admin', datetime('now'))`
    ).run(pubId, rB.instructorId);

    const unassignRes = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: rA.token,
      body: { instructorId: rA.instructorId },
    });
    assert.equal(unassignRes.status, 200, `Unassign failed: ${unassignRes.rawBody}`);
    assert.equal(unassignRes.json?.success, true);
    assert.equal(unassignRes.json?.unassignedInstructorId, rA.instructorId);
    assert.equal(unassignRes.json?.remainingCount, 1);
    assert.equal(unassignRes.json?.deletedPublication, false);

    // Verify publication_researchers DB rows directly: rA removed, rB retained
    const remainingLinks = env.db
      .prepare('SELECT instructor_id FROM publication_researchers WHERE publication_id = ?')
      .all(pubId)
      .map((row) => row.instructor_id);
    assert.ok(!remainingLinks.includes(rA.instructorId), 'rA must be removed from publication_researchers');
    assert.ok(remainingLinks.includes(rB.instructorId), 'rB must remain linked in publication_researchers');
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================

  it('T2.1 POST /api/publications returns 400 when title, authors, journal, or year is missing or invalid', async () => {
    const researcher = await env.createActiveResearcher(adminToken, { digits: `710${seq++}` });

    const invalidPayloads = [
      { authors: ['A. Author'], journal: 'J', year: 2025 }, // missing title
      { title: 'Valid Title', authors: [], journal: 'J', year: 2025 }, // empty authors
      { title: 'Valid Title', authors: ['A. Author'], journal: '', year: 2025 }, // missing journal
      { title: 'Valid Title', authors: ['A. Author'], journal: 'J' }, // missing year
      { title: 'Valid Title', authors: ['A. Author'], journal: 'J', year: 1800 }, // out-of-range year
      { title: 'Valid Title', authors: ['A. Author'], journal: 'J', year: 'not-a-year' }, // non-numeric year
    ];

    for (const body of invalidPayloads) {
      const res = await env.request('POST', '/api/publications', {
        token: researcher.token,
        body,
      });
      assert.equal(res.status, 400, `Expected 400 for payload ${JSON.stringify(body)}, got ${res.status}: ${res.rawBody}`);
    }
  });

  it('T2.2 Unauthenticated calls to POST /api/scholar/import, POST /api/publications/resolve-doi, and POST /api/publications/:id/unassign return 401', async () => {
    const imp = await env.request('POST', '/api/scholar/import', {
      body: { instructorId: 'ASIN-00001', publications: [{ title: 'X', authors: ['Y'], journal: 'Z', year: 2025 }] },
    });
    assert.equal(imp.status, 401, `Unauth /api/scholar/import must return 401, got ${imp.status}`);

    const doi = await env.request('POST', '/api/publications/resolve-doi', {
      body: { doi: '10.1000/test' },
    });
    assert.equal(doi.status, 401, `Unauth /api/publications/resolve-doi must return 401, got ${doi.status}`);

    const unassign = await env.request('POST', '/api/publications/pub-1/unassign', {
      body: { instructorId: 'ASIN-00001' },
    });
    assert.equal(unassign.status, 401, `Unauth /api/publications/:id/unassign must return 401, got ${unassign.status}`);
  });

  it('T2.3 POST /api/publications/resolve-doi rejects malformed DOI with 400', async () => {
    const researcher = await env.createActiveResearcher(adminToken, { digits: `711${seq++}` });
    const res = await env.request('POST', '/api/publications/resolve-doi', {
      token: researcher.token,
      body: { doi: 'not-a-valid-doi-at-all' },
    });
    assert.equal(res.status, 400, `Malformed DOI must return 400, got ${res.status}: ${res.rawBody}`);
  });

  it('T2.4 Non-admin cannot unassign another researcher from a publication (403)', async () => {
    const s = nextSuffix();
    const rA = await env.createActiveResearcher(adminToken, { digits: `712${seq++}` });
    const rB = await env.createActiveResearcher(adminToken, { digits: `713${seq++}` });

    const pub = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Protected Unassign Paper ${s}`,
        authors: [rA.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: rA.instructorId,
      },
    });
    assert.equal(pub.status, 201);

    const res = await env.request('POST', `/api/publications/${pub.json.id}/unassign`, {
      token: rB.token,
      body: { instructorId: rA.instructorId },
    });
    assert.equal(res.status, 403, `Non-admin unassigning another researcher must return 403, got ${res.status}`);
  });

  it('T2.5 Unassigning the last remaining researcher deletes publication, citing_papers, and citation_trends without re-attribution', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, {
      firstName: 'Solo',
      lastName: `Author${s}`,
      digits: `714${seq++}`,
    });

    const pub = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Solo Orphan Delete Paper ${s}`,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: r.instructorId,
      },
    });
    assert.equal(pub.status, 201);
    const pubId = pub.json.id;

    // Seed citing_papers & citation_trends for this publication
    env.db.prepare(
      `INSERT INTO citing_papers (publication_id, title, authors, journal, year) VALUES (?, ?, ?, ?, ?)`
    ).run(pubId, `Citing Orphan ${s}`, 'Someone', 'Journal', 2025);
    env.db.prepare(
      `INSERT INTO citation_trends (publication_id, year, citations) VALUES (?, ?, ?)`
    ).run(pubId, 2025, 4);

    const unassignRes = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: r.token,
      body: { instructorId: r.instructorId },
    });
    assert.equal(unassignRes.status, 200);
    assert.equal(unassignRes.json?.remainingCount, 0);
    assert.equal(unassignRes.json?.deletedPublication, true);

    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM publications WHERE id = ?').get(pubId).c, 0);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM citing_papers WHERE publication_id = ?').get(pubId).c, 0);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM citation_trends WHERE publication_id = ?').get(pubId).c, 0);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM publication_researchers WHERE publication_id = ?').get(pubId).c, 0);
  });

  it('T2.6 Duplicate normalized title submitted by non-admin creates a pending link without auto-approving', async () => {
    const s = nextSuffix();
    const r1 = await env.createActiveResearcher(adminToken, { firstName: 'Lead', lastName: `One${s}`, digits: `715${seq++}` });
    const r2 = await env.createActiveResearcher(adminToken, { firstName: 'Co', lastName: `Two${s}`, digits: `716${seq++}` });

    const title = `Shared Research Discovery ${s}`;
    const first = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [r1.user.name, r2.user.name],
        journal: 'PSU Journal',
        year: 2025,
        ownerId: r1.instructorId,
      },
    });
    assert.equal(first.status, 201);
    const pubId = first.json.id;

    // r2 submits same title with punctuation variance
    const dup = await env.request('POST', '/api/publications', {
      token: r2.token,
      body: {
        title: `${title}!`,
        authors: [r1.user.name, r2.user.name],
        journal: 'PSU Journal',
        year: 2025,
      },
    });
    assert.ok([200, 201].includes(dup.status));

    const link = env.db.prepare(
      'SELECT approval_status FROM publication_researchers WHERE publication_id = ? AND instructor_id = ?'
    ).get(pubId, r2.instructorId);
    assert.equal(link?.approval_status, 'pending', 'Non-admin duplicate link must remain pending until approved');
  });

  it('T2.7 Frontend InstructorPublicationsPage, ScholarImportModal & Coordinator UI implement Manual/DOI add, pending approval, and unassign/remove controls', () => {
    const instSrc = readRepoFile('src/app/components/InstructorPublicationsPage.tsx');
    assert.match(instSrc, /resolveDoi|resolve-doi/, 'InstructorPublicationsPage must support DOI Link Retrieval');
    assert.match(instSrc, /Remove Publication/, 'InstructorPublicationsPage must provide "Remove Publication" action');

    // (a) handleSubmit must submit approvalStatus: "pending" (not "approved")
    const submitFn = extractNamedFunction(instSrc, 'handleSubmit');
    assert.ok(submitFn, 'handleSubmit must exist in InstructorPublicationsPage.tsx');
    assert.doesNotMatch(
      submitFn,
      /approvalStatus\s*:\s*["']approved["']/,
      'InstructorPublicationsPage handleSubmit must not submit approvalStatus: "approved"'
    );
    assert.match(
      submitFn,
      /approvalStatus\s*:\s*["']pending["']/,
      'InstructorPublicationsPage handleSubmit must submit approvalStatus: "pending"'
    );

    // (b) ownPublications must filter to "approved"
    const ownPubsMatch = instSrc.match(/const\s+ownPublications\s*=[\s\S]{0,700}?;/);
    assert.ok(ownPubsMatch, 'ownPublications filter must exist in InstructorPublicationsPage.tsx');
    assert.match(
      ownPubsMatch[0],
      /(?:\(\s*p\.approval_status\s*\|\|\s*p\.approvalStatus\s*\)\s*===\s*["']approved["']|p\.approvalStatus\s*===\s*["']approved["']|p\.approval_status\s*===\s*["']approved["'])/,
      'ownPublications in InstructorPublicationsPage must filter to approved publications'
    );

    assert.doesNotMatch(instSrc, /Ongoing|In Progress/i, 'Terminology Rule 6: no ongoing/unpublished option');

    const modalSrc = readRepoFile('src/app/components/ScholarImportModal.tsx');
    assert.match(modalSrc, /pending|approval/i, 'ScholarImportModal must reflect Coordinator approval workflow for non-admins');

    // Coordinator unassign controls & API client support
    const apiSrc = readRepoFile('src/app/services/api.service.ts');
    assert.match(apiSrc, /\/unassign\b|unassignPublication/i, 'api.service.ts must expose publication unassign endpoint');
    const coordFiles = [
      'src/app/components/AdminPage.tsx',
      'src/app/components/PublicationsPage.tsx',
      'src/app/components/ResearcherProfile.tsx',
      'src/app/components/PublicationInspectorDrawer.tsx',
    ];
    const hasCoordUnassignUi = coordFiles.some((f) => /unassign/i.test(readRepoFile(f)));
    assert.ok(
      hasCoordUnassignUi,
      'Research Coordinator UI (AdminPage/PublicationsPage/ResearcherProfile/PublicationInspectorDrawer) must expose publication unassign controls'
    );
  });

  it('T2.7b My Publications has "Waiting for Approval" tab and export buttons are removed from drawer & detail views', () => {
    const instSrc = readRepoFile('src/app/components/InstructorPublicationsPage.tsx');
    assert.match(instSrc, /Waiting for Approval/, 'InstructorPublicationsPage must define "Waiting for Approval" tab');
    assert.match(instSrc, /const\s+pendingPublications\s*=/, 'InstructorPublicationsPage must compute pendingPublications');

    const drawerSrc = readRepoFile('src/app/components/PublicationInspectorDrawer.tsx');
    assert.doesNotMatch(drawerSrc, /Export Paper \(\.xlsx\)/, 'PublicationInspectorDrawer must NOT contain Export Paper button');
    assert.doesNotMatch(drawerSrc, /exportSinglePublicationToExcel/, 'PublicationInspectorDrawer must not import exportSinglePublicationToExcel');

    const detailSrc = readRepoFile('src/app/components/PublicationDetail.tsx');
    assert.doesNotMatch(detailSrc, /Export Paper Excel \(\.xlsx\)/, 'PublicationDetail must NOT contain Export Paper Excel button');
    assert.doesNotMatch(detailSrc, /exportSinglePublicationToExcel/, 'PublicationDetail must not import exportSinglePublicationToExcel');
  });

  // =========================================================================
  // Tier 3: Pairwise (R1 + R2)
  // =========================================================================

  it('T2.8 POST /api/claims/:id/review rejects non-admin caller (403) and deletes publication on rejection', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, { digits: `718${seq++}` });
    const pubRes = await env.request('POST', '/api/publications', {
      token: r.token,
      body: {
        title: `Rejectable Claim Paper ${s}`,
        authors: [r.user.name],
        journal: 'PSU Journal',
        year: 2025,
      },
    });
    assert.equal(pubRes.status, 201);
    const pubId = pubRes.json.id;

    const nonAdminReview = await env.request('POST', `/api/claims/${pubId}/review`, {
      token: r.token,
      body: { status: 'approved' },
    });
    assert.equal(nonAdminReview.status, 403);

    const rejectRes = await env.request('POST', `/api/claims/${pubId}/review`, {
      token: adminToken,
      body: { status: 'rejected' },
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM publications WHERE id = ?').get(pubId).c, 0);
  });

  it('T2.9 GET /api/publications?includePending=true returns pending works only for authenticated owner/admin', async () => {
    const s = nextSuffix();
    const r1 = await env.createActiveResearcher(adminToken, { digits: `719${seq++}` });
    const r2 = await env.createActiveResearcher(adminToken, { digits: `720${seq++}` });
    const pubRes = await env.request('POST', '/api/publications', {
      token: r1.token,
      body: {
        title: `IncludePending Scoped Study ${s}`,
        authors: [r1.user.name],
        journal: 'PSU Journal',
        year: 2025,
      },
    });
    const pubId = pubRes.json.id;

    const r1Pending = await env.request('GET', '/api/publications?includePending=true', { token: r1.token });
    assert.equal(r1Pending.status, 200);
    assert.ok(r1Pending.json.some((p) => p.id === pubId), 'Owner with includePending=true should see own pending work');

    const r2Pending = await env.request('GET', '/api/publications?includePending=true', { token: r2.token });
    assert.equal(r2Pending.status, 200);
    assert.ok(!r2Pending.json.some((p) => p.id === pubId), 'Other researcher must NOT see r1 pending work');
  });

  it('T2.10 POST /api/publications/resolve-doi returns 404 when DOI does not exist in CrossRef or OpenAlex', async () => {
    const r = await env.createActiveResearcher(adminToken, { digits: `723${seq++}` });
    fetchMock = installFetchMock([
      { match: 'api.crossref.org', status: 404, json: { status: 'failed' } },
      { match: 'api.openalex.org', status: 404, json: { error: 'Not found' } },
      { match: 'scholar.google.com', text: '<html><body></body></html>' },
    ]);

    const res = await env.request('POST', '/api/publications/resolve-doi', {
      token: r.token,
      body: { doi: '10.9999/nonexistent-doi-xyz' },
    });
    assert.equal(res.status, 404);
  });

  it('T3.1 Pairwise R1+R2: 1-digit ASIN-1 researcher resolves DOI, gets approved, then unassigns self', async () => {
    const s = nextSuffix();
    const r1 = await env.createActiveResearcher(adminToken, {
      firstName: 'OneDigit',
      lastName: `Author${s}`,
      instructorId: 'ASIN-1',
      digits: '1',
    });
    const doi = `10.1000/r1r2-${s}`;
    const title = `One Digit DOI Paper ${s}`;
    fetchMock = installFetchMock(buildDoiMockRoutes(doi, title, 15));

    const resolved = await env.request('POST', '/api/publications/resolve-doi', {
      token: r1.token,
      body: { doi, ownerId: 'ASIN-1' },
    });
    assert.equal(resolved.status, 200);

    const created = await env.request('POST', '/api/publications', {
      token: r1.token,
      body: {
        ...resolved.json.metadata,
        doi,
        source: 'doi',
      },
    });
    assert.equal(created.status, 201);
    const pubId = created.json.id;

    const approve = await env.request('POST', `/api/claims/${pubId}/review`, {
      token: adminToken,
      body: { status: 'approved' },
    });
    assert.equal(approve.status, 200);

    const unassign = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: r1.token,
      body: { instructorId: 'ASIN-1' },
    });
    assert.equal(unassign.status, 200);
    assert.equal(unassign.json?.deletedPublication, true);
  });

  // =========================================================================
  // Tier 4: Real-World End-to-End Scenarios
  // =========================================================================

  it('T4.1 Scenario 1: New Researcher Onboarding & Publication Lifecycle (R1+R2+R3+R4)', async () => {
    const s = nextSuffix();
    const email = `lifecycle.${s}@psu.edu.ph`;
    const instructorId = `ASIN-9876543210`;
    const title = `Full Lifecycle AI Study ${s}`;
    const doi = `10.1000/lifecycle-${s}`;

    // 1. Coordinator invites researcher with 10-digit ASIN
    const inviteRes = await env.request('POST', '/api/researchers', {
      token: adminToken,
      body: {
        firstName: 'Julius Oscar',
        middleInitial: 'M.',
        lastName: `Lifecycle${s}`,
        instructorId,
        email,
        department: 'BSIT',
        isFaculty: true,
        sendInvite: true,
      },
    });
    assert.equal(inviteRes.status, 201);
    const verifUrl = new URL(inviteRes.json.verificationLink);
    const inviteToken = verifUrl.searchParams.get('token');
    assert.ok(inviteToken, 'Invitation must yield verification token');

    // 2. Researcher completes invitation
    const completeRes = await env.request('POST', '/api/auth/complete-invitation', {
      body: { token: inviteToken, newPassword: 'MySecurePassword1!' },
    });
    assert.equal(completeRes.status, 200);

    // 3. Researcher logs in -> verifies structured name parts & 10-digit ASIN
    const loginRes = await env.request('POST', '/api/auth/login', {
      body: { username: instructorId, password: 'MySecurePassword1!' },
    });
    assert.equal(loginRes.status, 200);
    const token = loginRes.json.token;
    assert.equal(loginRes.json.user.instructorId, instructorId);
    assert.equal(loginRes.json.user.firstName, 'Julius Oscar');
    assert.equal(loginRes.json.user.middleInitial, 'M.');

    // 4. Researcher updates Edit Profile preserving middle initial
    const profUpd = await env.request('PUT', '/api/auth/profile', {
      token,
      body: { firstName: 'Julius Oscar', middleInitial: 'M.', lastName: `Lifecycle${s}` },
    });
    assert.equal(profUpd.status, 200);
    assert.equal(profUpd.json.user.middleInitial, 'M.');

    // 5. Researcher resolves DOI & submits pending publication
    fetchMock = installFetchMock(buildDoiMockRoutes(doi, title, 59));
    const doiRes = await env.request('POST', '/api/publications/resolve-doi', {
      token,
      body: { doi, ownerId: instructorId },
    });
    assert.equal(doiRes.status, 200);

    const subRes = await env.request('POST', '/api/publications', {
      token,
      body: { ...doiRes.json.metadata, doi, source: 'doi' },
    });
    assert.equal(subRes.status, 201);
    const pubId = subRes.json.id;

    // 6. Hidden from My Publications until Coordinator approves
    const preList = await env.request('GET', '/api/publications', { token });
    assert.ok(!preList.json.some((p) => p.id === pubId));

    const approveRes = await env.request('POST', `/api/claims/${pubId}/review`, {
      token: adminToken,
      body: { status: 'approved' },
    });
    assert.equal(approveRes.status, 200);

    // 7. Visible after approval + reload citation -> 59
    const reloadRes = await env.request('POST', `/api/publications/${pubId}/reload-citation`, { token });
    assert.equal(reloadRes.status, 200);
    assert.equal(Number(reloadRes.json?.publication?.citations), 59);

    // 8. Remove Publication deletes orphan
    const rmRes = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token,
      body: { instructorId },
    });
    assert.equal(rmRes.status, 200);
    assert.equal(rmRes.json?.deletedPublication, true);
  });

  it('T4.2 Scenario 2: Multi-Author Co-Publication & Selective Unassignment', async () => {
    const s = nextSuffix();
    const rA = await env.createActiveResearcher(adminToken, { firstName: 'CoA', lastName: `Multi${s}`, digits: `721${seq++}` });
    const rB = await env.createActiveResearcher(adminToken, { firstName: 'CoB', lastName: `Multi${s}`, digits: `722${seq++}` });

    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title: `Multi-Author Selective Removal ${s}`,
        authors: [rA.user.name, rB.user.name],
        journal: 'PSU Interdisciplinary Journal',
        year: 2025,
        ownerId: rA.instructorId,
      },
    });
    assert.equal(pubRes.status, 201);
    const pubId = pubRes.json.id;

    env.db.prepare(
      `INSERT OR IGNORE INTO publication_researchers (publication_id, instructor_id, approval_status, assigned_by, created_at)
       VALUES (?, ?, 'approved', 'admin', datetime('now'))`
    ).run(pubId, rB.instructorId);

    env.db.prepare(
      `INSERT INTO citing_papers (publication_id, title, authors, journal, year) VALUES (?, ?, ?, ?, ?)`
    ).run(pubId, `Citing Multi ${s}`, 'C. Author', 'J', 2026);

    // Coordinator removes Researcher A -> paper + citing_papers remain for Researcher B
    const unA = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: adminToken,
      body: { instructorId: rA.instructorId },
    });
    assert.equal(unA.status, 200);
    assert.equal(unA.json.remainingCount, 1);
    assert.equal(unA.json.deletedPublication, false);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM citing_papers WHERE publication_id = ?').get(pubId).c, 1);

    // Researcher B removes self -> 0 researchers remain -> publication + citing_papers deleted
    const unB = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: rB.token,
      body: { instructorId: rB.instructorId },
    });
    assert.equal(unB.status, 200);
    assert.equal(unB.json.remainingCount, 0);
    assert.equal(unB.json.deletedPublication, true);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM publications WHERE id = ?').get(pubId).c, 0);
    assert.equal(env.db.prepare('SELECT COUNT(*) as c FROM citing_papers WHERE publication_id = ?').get(pubId).c, 0);
  });
});
