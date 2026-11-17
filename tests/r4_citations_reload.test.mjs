import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  createIsolatedBackend,
  installFetchMock,
  FIXTURES,
  readRepoFile,
  walkFiles,
  REPO_ROOT,
} from './helpers/testEnv.mjs';

let env;
let adminToken;
let fetchMock;
let seq = 1;

function nextSuffix() {
  return `${Date.now()}${seq++}`;
}

describe('R4: Citation Count Accuracy (58 vs 59) & Strictly 2 Reload Buttons', () => {
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

  it('T1.1 POST /api/publications/:id/reload-citation updates stale 58 count to live Google Scholar 59 and replaces polluted citing_papers', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Cite',
      lastName: `Tester${s}`,
      digits: `801${seq++}`,
    });

    const title = `Stale 58 Citation Paper ${s}`;
    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'Philippine Journal of Science',
        year: 2024,
        ownerId: researcher.instructorId,
      },
    });
    assert.equal(pubRes.status, 201);
    const pubId = pubRes.json.id;

    // Seed stale 58 citations & polluted CrossRef keyword citing_papers
    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);
    env.db.prepare(
      `INSERT INTO citing_papers (publication_id, title, authors, journal, year) VALUES (?, ?, ?, ?, ?)`
    ).run(pubId, 'Unrelated Keyword Pollution Paper', 'Random Author', 'Unrelated Journal', 2020);

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([
          { title: `Genuine Citing Paper A ${s}`, authors: 'M. Santos', journal: 'IEEE Access', year: 2025 },
          { title: `Genuine Citing Paper B ${s}`, authors: 'J. Reyes', journal: 'Springer', year: 2026 },
        ]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title,
          authors: `${researcher.user.name}`,
          citesId: '99112233',
          citationsText: '59',
          aboutTotalText: 'About 59 results (0.04 sec)',
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const reloadRes = await env.request('POST', `/api/publications/${pubId}/reload-citation`, {
      token: adminToken,
    });
    assert.equal(reloadRes.status, 200, `Expected 200, got ${reloadRes.status}: ${reloadRes.rawBody}`);
    assert.equal(Number(reloadRes.json?.publication?.citations), 59, 'Live GS 59 must replace stale 58');

    const dbRow = env.db.prepare('SELECT citations, cited_by_link FROM publications WHERE id = ?').get(pubId);
    assert.equal(Number(dbRow.citations), 59);
    assert.ok(dbRow.cited_by_link && dbRow.cited_by_link.includes('99112233'));

    const citingRows = env.db.prepare('SELECT title FROM citing_papers WHERE publication_id = ?').all(pubId);
    assert.ok(!citingRows.some((r) => r.title === 'Unrelated Keyword Pollution Paper'), 'Polluted citing_papers must be replaced');
    assert.ok(citingRows.some((r) => r.title === `Genuine Citing Paper A ${s}`), 'Genuine citing papers must be persisted');
  });

  it('T1.2 Authenticated GET /api/publications/:id?refresh=true refreshes stale 58 count to live GS 59', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Refresh',
      lastName: `Detail${s}`,
      digits: `802${seq++}`,
    });

    const title = `Refresh Query Parameter Study ${s}`;
    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'Journal of Informatics',
        year: 2024,
        ownerId: researcher.instructorId,
      },
    });
    const pubId = pubRes.json.id;
    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([
          { title: `Verified Citing Paper ${s}`, authors: 'A. Tan', journal: 'ACM', year: 2025 },
        ]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title,
          authors: researcher.user.name,
          citesId: '44556677',
          citationsText: '59',
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const detailRes = await env.request('GET', `/api/publications/${pubId}?refresh=true`, {
      token: researcher.token,
    });
    assert.equal(detailRes.status, 200);
    assert.equal(Number(detailRes.json?.citations), 59);
  });

  it('T1.3 POST /api/publications/reload-citations updates approved repository publications and researchers.total_citations', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Batch',
      lastName: `Reloader${s}`,
      digits: `803${seq++}`,
    });

    const title = `Batch Citation Sync Paper ${s}`;
    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'Batch Journal',
        year: 2024,
        ownerId: researcher.instructorId,
      },
    });
    const pubId = pubRes.json.id;
    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([
          { title: `Batch Citing ${s}`, authors: 'K. Lim', journal: 'Elsevier', year: 2025 },
        ]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title,
          authors: researcher.user.name,
          citesId: '33221100',
          citationsText: '59',
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const batchRes = await env.request('POST', '/api/publications/reload-citations', {
      token: researcher.token,
    });
    assert.equal(batchRes.status, 200, `Batch reload failed: ${batchRes.rawBody}`);
    assert.equal(batchRes.json?.success, true);

    const updatedPub = env.db.prepare('SELECT citations FROM publications WHERE id = ?').get(pubId);
    assert.equal(Number(updatedPub.citations), 59);

    const updatedRes = env.db.prepare('SELECT total_citations FROM researchers WHERE id = ?').get(researcher.researcher.id);
    assert.ok(Number(updatedRes.total_citations) >= 59, 'researchers.total_citations must reflect reloaded count');
  });

  it('T1.4 fetchCitingPapersFromOpenAlex never queries CrossRef query.bibliographic keyword search', async () => {
    fetchMock = installFetchMock([
      { match: 'api.openalex.org/works', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      { match: 'scholar.google.com', text: '<html><body></body></html>' },
      {
        match: 'api.crossref.org',
        handler: (url) => {
          assert.fail(`Forbidden CrossRef bibliographic keyword call detected: ${url}`);
        },
      },
    ]);

    const rows = await env.scholarScraper.fetchCitingPapersFromOpenAlex({
      title: 'Edge AI Systems for Flood Forecasting',
      doi: '',
      cited_by_link: '',
    });
    assert.ok(Array.isArray(rows));
    assert.ok(
      !fetchMock.calls.some((c) => c.url.includes('query.bibliographic')),
      'CrossRef query.bibliographic must not be called for citing papers'
    );
  });

  it('T1.5 Strictly 2 citation-reload buttons in UI: "Reload Citations" on Publications pages and "Reload Citation" in PublicationDetail citations table', () => {
    const stripComments = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
    const findButtonsWithText = (src, pattern) => {
      const clean = stripComments(src);
      const btnRegex = /<(?:Button|button)\b(?:(?!<\/?(?:Button|button)\b)[\s\S])*?<\/(?:Button|button)>/g;
      const matches = [];
      let m;
      while ((m = btnRegex.exec(clean)) !== null) {
        if (pattern.test(m[0])) {
          matches.push({ text: m[0], index: m.index });
        }
      }
      return matches;
    };

    const coordPubs = readRepoFile('src/app/components/PublicationsPage.tsx');
    const coordReloadBtns = findButtonsWithText(coordPubs, /\bReload Citations\b/);
    assert.equal(coordReloadBtns.length, 1, `PublicationsPage.tsx must have strictly 1 "Reload Citations" button, found ${coordReloadBtns.length}`);
    assert.equal(findButtonsWithText(coordPubs, /\bReload Citation\b(?!s)/).length, 0, 'PublicationsPage.tsx must not have singular "Reload Citation" button');
    assert.match(coordPubs, /reload(?:All)?Citations|reload-citations/, 'PublicationsPage.tsx must call batch citation reload API');

    const instPubs = readRepoFile('src/app/components/InstructorPublicationsPage.tsx');
    const instReloadBtns = findButtonsWithText(instPubs, /\bReload Citations\b/);
    assert.equal(instReloadBtns.length, 1, `InstructorPublicationsPage.tsx must have strictly 1 "Reload Citations" button, found ${instReloadBtns.length}`);
    assert.equal(findButtonsWithText(instPubs, /\bReload Citation\b(?!s)/).length, 0, 'InstructorPublicationsPage.tsx must not have singular "Reload Citation" button');
    assert.match(instPubs, /reload(?:All)?Citations|reload-citations/, 'InstructorPublicationsPage.tsx must call batch citation reload API');

    const detail = readRepoFile('src/app/components/PublicationDetail.tsx');
    const detailClean = stripComments(detail);
    assert.ok(!detailClean.includes('Refresh & Enrich Data'), 'Legacy "Refresh & Enrich Data" button must be removed');
    assert.ok(!detailClean.includes('Sync Remaining Citations'), 'Legacy "Sync Remaining Citations" button must be removed');
    const detailReloadBtns = findButtonsWithText(detailClean, /\bReload Citation\b(?!s)/);
    assert.equal(detailReloadBtns.length, 1, `PublicationDetail.tsx must have strictly 1 "Reload Citation" button, found ${detailReloadBtns.length}`);
    assert.ok(!/\bReload Citations\b/.test(detailClean), 'PublicationDetail.tsx must use singular "Reload Citation", not "Reload Citations"');

    // Confirm the JSX <Button>Reload Citation</Button> element sits inside the Citations Table section (after Official Citation Sheet header)
    const sheetIdx = detailClean.indexOf('Official Citation Sheet');
    const reloadBtnIdx = detailReloadBtns[0].index;
    const tableIdx = detailClean.indexOf('<table', Math.max(0, sheetIdx));
    assert.ok(
      sheetIdx !== -1 && reloadBtnIdx > sheetIdx && (tableIdx === -1 || reloadBtnIdx < tableIdx),
      '"Reload Citation" <Button> must be positioned at the top of the citations table on PublicationDetail.tsx'
    );
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================

  it('T2.1 Unauthenticated POST /api/publications/:id/reload-citation and /api/publications/reload-citations return 401', async () => {
    const r1 = await env.request('POST', '/api/publications/some-id/reload-citation');
    assert.equal(r1.status, 401);

    const r2 = await env.request('POST', '/api/publications/reload-citations');
    assert.equal(r2.status, 401);
  });

  it('T2.2 scrapeGoogleScholarDirect parses comma-formatted "Cited by 1,234" and About results count', async () => {
    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title: 'High Impact Deep Learning Survey',
          citesId: '1234567',
          citationsText: '1,234',
          aboutTotalText: 'About 1,234 results (0.05 sec)',
          nestedDiv: true,
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
    ]);

    const res = await env.scholarScraper.scrapeGoogleScholarDirect('High Impact Deep Learning Survey', 0, 10);
    assert.equal(res.length, 1);
    assert.equal(res[0].citations, 1234, 'Must parse comma-formatted citation count 1,234 -> 1234');
  });

  it('T2.3 scrapeGoogleScholarCitations handles nested <div> elements inside gs_ri without truncation', async () => {
    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        handler: (url) => {
          if (url.includes('start=0')) {
            return {
              text: FIXTURES.gsCitationsPageHtml([
                { title: 'Citing Nested One', authors: 'A. One', journal: 'J1', year: 2025 },
                { title: 'Citing Nested Two', authors: 'B. Two', journal: 'J2', year: 2026 },
              ]),
            };
          }
          return { text: '<html><body><div id="gs_res_ccl_bot"></div></body></html>' };
        },
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
    ]);

    const citing = await env.scholarScraper.scrapeGoogleScholarCitations('999888', 2);
    assert.equal(citing.length, 2);
    assert.equal(citing[0].title, 'Citing Nested One');
    assert.equal(citing[1].title, 'Citing Nested Two');
  });

  it('T2.4 Google Scholar verification/CAPTCHA (<title>Verifying...</title>, sgsync-verification, HTTP 429) never zeroes existing citations', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, { digits: `804${seq++}` });
    const title = `Protected Citation Floor ${s}`;
    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'IEEE Transactions',
        year: 2024,
        ownerId: researcher.instructorId,
      },
    });
    const pubId = pubRes.json.id;
    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);

    // 1. Direct unit check on <title>Verifying...</title> + sgsync-verification
    fetchMock = installFetchMock([
      { match: 'scholar.google.com/scholar', text: FIXTURES.gsVerificationHtml() },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
    ]);
    const directRes = await env.scholarScraper.scrapeGoogleScholarDirect(title, 0, 10);
    assert.equal(directRes.captchaBlocked, true);
    assert.equal(directRes.length, 0);

    // 2. Reload endpoint under HTTP 429 must preserve existing 58 citations
    fetchMock.restore();
    fetchMock = installFetchMock([
      { match: 'scholar.google.com', status: 429, text: 'Too Many Requests' },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const reloadRes = await env.request('POST', `/api/publications/${pubId}/reload-citation`, {
      token: adminToken,
    });
    assert.equal(reloadRes.status, 200);
    assert.equal(Number(reloadRes.json?.publication?.citations), 58, 'Transient GS 429/CAPTCHA must NOT downgrade existing 58 citations');
  });

  it('T2.5 scrapeGoogleScholarProfile parses comma-formatted citation numbers (1,234)', async () => {
    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/citations',
        text: FIXTURES.gsProfileHtml({
          totalCitations: '1,234',
          rows: [{ title: 'Comma Cited Paper', citations: '1,234', year: 2024 }],
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
    ]);

    const profileData = await env.scholarScraper.scrapeGoogleScholarProfile('x6PdtN8AAAAJ');
    assert.equal(profileData.profile.totalCitations, 1234);
    assert.equal(profileData.publications[0].citations, 1234);
  });

  it('T2.6 No other component files outside the 2 designated UI views (+ SystemGuidePage) contain "Reload Citation(s)"', () => {
    const allowed = new Set([
      'PublicationsPage.tsx',
      'InstructorPublicationsPage.tsx',
      'PublicationDetail.tsx',
      'SystemGuidePage.tsx',
    ]);
    const files = walkFiles('src/app/components', ['.tsx']);
    for (const full of files) {
      const base = path.basename(full);
      if (allowed.has(base)) continue;
      const txt = readRepoFile(path.relative(REPO_ROOT, full));
      assert.ok(
        !/Reload Citations?/.test(txt),
        `Unexpected extra reload citation button/text found in ${base}`
      );
    }
  });

  // =========================================================================
  // Tier 3: Pairwise (R2 + R4)
  // =========================================================================

  it('T2.7 POST /api/publications/:id/reload-citation returns 404 for nonexistent publication ID', async () => {
    const res = await env.request('POST', '/api/publications/nonexistent-pub-999/reload-citation', {
      token: adminToken,
    });
    assert.equal(res.status, 404);
  });

  it('T2.8 fetchCitingPapersFromOpenAlex paginates via next_cursor and filters out self-citations', async () => {
    const page1Filler = Array.from({ length: 198 }, (_, i) => ({
      id: `https://openalex.org/W91${i}`,
      title: `Cursor Page 1 Filler ${i + 1}`,
      publication_year: 2025,
      publication_date: '2025-05-10',
      doi: `https://doi.org/10.1000/filler-${i + 1}`,
      authorships: [{ author: { display_name: `Author ${i + 1}` } }],
      primary_location: { source: { display_name: 'J1' } },
    }));

    fetchMock = installFetchMock([
      {
        match: 'api.openalex.org/works/doi:',
        json: { id: 'https://openalex.org/W9000' },
      },
      {
        match: 'cursor=*',
        json: {
          meta: { next_cursor: 'page2cursor' },
          results: [
            {
              id: 'https://openalex.org/W9001',
              title: 'Parent Paper Self Match!',
              publication_year: 2025,
              authorships: [{ author: { display_name: 'Self' } }],
            },
            {
              id: 'https://openalex.org/W9002',
              title: 'Cursor Page 1 Citing Work',
              publication_year: 2025,
              publication_date: '2025-05-10',
              doi: 'https://doi.org/10.1000/cp1',
              authorships: [{ author: { display_name: 'Alice One' } }],
              primary_location: { source: { display_name: 'J1' } },
            },
            ...page1Filler,
          ],
        },
      },
      {
        match: 'cursor=page2cursor',
        json: {
          meta: { next_cursor: null },
          results: [
            {
              id: 'https://openalex.org/W9003',
              title: 'Cursor Page 2 Citing Work',
              publication_year: 2026,
              publication_date: '2026-08-01',
              doi: 'https://doi.org/10.1000/cp2',
              authorships: [{ author: { display_name: 'Bob Two' } }],
              primary_location: { source: { display_name: 'J2' } },
            },
          ],
        },
      },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const citing = await env.scholarScraper.fetchCitingPapersFromOpenAlex(
      {
        title: 'Parent Paper Self Match',
        doi: '10.1000/parent',
      },
      300
    );
    assert.ok(!citing.some((c) => c.title.includes('Parent Paper Self Match')), 'Self-citations must be excluded');
    assert.ok(citing.some((c) => c.title === 'Cursor Page 1 Citing Work'));
    assert.equal(citing.find((c) => c.title === 'Cursor Page 1 Citing Work')?.quarter, 'Second');
    assert.ok(
      fetchMock.calls.some((c) => c.url.includes('cursor=page2cursor')),
      'OpenAlex cursor pagination must request cursor=page2cursor'
    );
    assert.ok(
      citing.some((c) => c.title === 'Cursor Page 2 Citing Work'),
      'OpenAlex cursor pagination must return Cursor Page 2 Citing Work'
    );
  });

  it('T3.1 Pairwise R2+R4: DOI-resolved paper -> approved -> citation reloaded -> researcher stats updated -> unassigned & cleaned', async () => {
    const s = nextSuffix();
    const r = await env.createActiveResearcher(adminToken, {
      firstName: 'DoiCite',
      lastName: `Pair${s}`,
      digits: `810${seq++}`,
    });
    const doi = `10.1000/pair-r2r4-${s}`;
    const title = `Pairwise DOI Citation Audit ${s}`;

    fetchMock = installFetchMock([
      { match: `api.crossref.org/works/${encodeURIComponent(doi)}`, json: FIXTURES.crossrefDoiWork(doi, { title: [title] }) },
      { match: 'api.crossref.org/works', json: { status: 'ok', message: { items: [] } } },
      { match: /api\.openalex\.org\/works\/doi:/, json: FIXTURES.openAlexWork(doi, 'W776655', { title }) },
      { match: 'api.openalex.org/works', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([{ title: `Pair Citing ${s}`, authors: 'Z. Lee', journal: 'Nature', year: 2026 }]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({ title, authors: 'JO Moreno, RM Garin', citesId: '77665544', citationsText: '59' }),
      },
    ]);

    const doiRes = await env.request('POST', '/api/publications/resolve-doi', {
      token: r.token,
      body: { doi, ownerId: r.instructorId },
    });
    assert.equal(doiRes.status, 200);

    const createRes = await env.request('POST', '/api/publications', {
      token: r.token,
      body: { ...doiRes.json.metadata, doi, citations: 58, source: 'doi' },
    });
    assert.equal(createRes.status, 201);
    const pubId = createRes.json.id;

    await env.request('POST', `/api/claims/${pubId}/review`, {
      token: adminToken,
      body: { status: 'approved' },
    });

    const reloadRes = await env.request('POST', `/api/publications/${pubId}/reload-citation`, { token: r.token });
    assert.equal(reloadRes.status, 200);
    assert.equal(Number(reloadRes.json.publication.citations), 59);

    const unassignRes = await env.request('POST', `/api/publications/${pubId}/unassign`, {
      token: r.token,
      body: { instructorId: r.instructorId },
    });
    assert.equal(unassignRes.status, 200);
    assert.equal(unassignRes.json.deletedPublication, true);
  });

  // =========================================================================
  // Tier 4: Real-World Scenario 3 — Coordinator Live Citation Audit
  // =========================================================================

  it('T4.1 Scenario 3: Research Coordinator Live Citation Audit fixes 58 vs 59 mismatch and polluted citing_papers', async () => {
    const s = nextSuffix();
    const researcher = await env.createActiveResearcher(adminToken, {
      firstName: 'Audit',
      lastName: `Coordinator${s}`,
      digits: `820${seq++}`,
    });
    const title = `Audit Discrepancy Study ${s}`;

    const pubRes = await env.request('POST', '/api/publications', {
      token: adminToken,
      body: {
        title,
        authors: [researcher.user.name],
        journal: 'PSU Journal of Technology',
        year: 2024,
        ownerId: researcher.instructorId,
      },
    });
    const pubId = pubRes.json.id;

    env.db.prepare('UPDATE publications SET citations = 58 WHERE id = ?').run(pubId);
    env.db.prepare(
      `INSERT INTO citing_papers (publication_id, title, authors, journal, year) VALUES (?, ?, ?, ?, ?)`
    ).run(pubId, 'Stale Polluted Entry 1', 'X. Foo', 'Old Journal', 2021);

    fetchMock = installFetchMock([
      {
        match: 'scholar.google.com/scholar?cites=',
        text: FIXTURES.gsCitationsPageHtml([
          { title: `Audit Verified Citing 1 ${s}`, authors: 'L. Gomez', journal: 'IEEE', year: 2025 },
          { title: `Audit Verified Citing 2 ${s}`, authors: 'R. Diaz', journal: 'ACM', year: 2026 },
        ]),
      },
      {
        match: 'scholar.google.com/scholar',
        text: FIXTURES.gsSearchHtml({
          title,
          authors: researcher.user.name,
          citesId: '59595959',
          citationsText: '59',
          aboutTotalText: 'About 59 results (0.03 sec)',
        }),
      },
      { match: 'api.crossref.org', json: { status: 'ok', message: { items: [] } } },
      { match: 'api.openalex.org', json: { results: [] } },
      { match: 'api.semanticscholar.org', json: { data: [] } },
    ]);

    const batchRes = await env.request('POST', '/api/publications/reload-citations', { token: adminToken });
    assert.equal(batchRes.status, 200);

    const detailRes = await env.request('POST', `/api/publications/${pubId}/reload-citation`, { token: adminToken });
    assert.equal(detailRes.status, 200);
    assert.equal(Number(detailRes.json.publication.citations), 59);

    const citing = detailRes.json.citingPapers || [];
    assert.ok(!citing.some((c) => c.title === 'Stale Polluted Entry 1'));
    assert.ok(citing.some((c) => c.title === `Audit Verified Citing 1 ${s}`));

    const rRes = await env.request('GET', `/api/researchers/${researcher.researcher.id}`);
    assert.equal(rRes.status, 200);
    assert.ok(Number(rRes.json.totalCitations) >= 59);
  });
});
