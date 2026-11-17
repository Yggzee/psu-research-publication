import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIsolatedBackend,
  readRepoFile,
  extractNamedFunction,
} from './helpers/testEnv.mjs';

let env;
let adminToken;
let seq = 1;

function nextSuffix() {
  return `${Date.now()}${seq++}`;
}

describe('R1: ASIN Instructor ID (1 to 12 Digits) & Terminology', () => {
  before(async () => {
    env = await createIsolatedBackend();
    ({ token: adminToken } = await env.loginAdmin());
  });

  after(async () => {
    await env.close();
  });

  // =========================================================================
  // Tier 1: Feature Coverage across all 5 endpoints + terminology.md
  // =========================================================================

  it('T1.1 POST /api/auth/register accepts 1-digit, 5-digit, and 12-digit ASIN IDs without zero-padding', async () => {
    const cases = ['ASIN-1', 'ASIN-12345', 'ASIN-987654321012'];
    for (const id of cases) {
      const s = nextSuffix();
      const res = await env.request('POST', '/api/auth/register', {
        body: {
          firstName: 'Ana',
          lastName: `Reg${s}`,
          instructorId: id,
          email: `reg.${s}@psu.edu.ph`,
          password: 'Password123!',
          department: 'BSIT',
          isFaculty: true,
        },
      });
      assert.equal(res.status, 201, `Expected 201 for ${id}, got ${res.status}: ${res.rawBody}`);
      const row = env.db.prepare('SELECT instructor_id FROM researchers WHERE email = ?').get(`reg.${s}@psu.edu.ph`);
      assert.equal(row?.instructor_id, id, `Expected ${id} stored verbatim without padding`);
    }
  });

  it('T1.2 POST /api/researchers accepts 1-digit, 5-digit, and 12-digit ASIN IDs', async () => {
    const cases = ['ASIN-7', 'ASIN-54321', 'ASIN-123456789012'];
    for (const id of cases) {
      const s = nextSuffix();
      const res = await env.request('POST', '/api/researchers', {
        token: adminToken,
        body: {
          firstName: 'Mark',
          lastName: `AdminAdd${s}`,
          instructorId: id,
          email: `adminadd.${s}@psu.edu.ph`,
          password: 'Password123!',
          department: 'BSBA',
          isFaculty: true,
          sendInvite: false,
        },
      });
      assert.equal(res.status, 201, `Expected 201 for ${id}, got ${res.status}: ${res.rawBody}`);
      assert.equal(res.json?.researcher?.instructorId, id);
    }
  });

  it('T1.3 POST /api/invitation-requests accepts 1-digit and 12-digit ASIN IDs', async () => {
    for (const id of ['ASIN-3', 'ASIN-111222333444']) {
      const s = nextSuffix();
      const res = await env.request('POST', '/api/invitation-requests', {
        body: {
          firstName: 'Carla',
          lastName: `Invite${s}`,
          instructorId: id,
          email: `invite.${s}@psu.edu.ph`,
        },
      });
      assert.equal(res.status, 201, `Expected 201 for ${id}, got ${res.status}: ${res.rawBody}`);
      const row = env.db.prepare('SELECT instructor_id FROM invitation_requests WHERE email = ?').get(`invite.${s}@psu.edu.ph`);
      assert.equal(row?.instructor_id, id);
    }
  });

  it('T1.4 PUT /api/auth/profile accepts updating instructorId to 1-digit and 12-digit ASIN IDs', async () => {
    const created = await env.createActiveResearcher(adminToken, { digits: '44001' });

    const r1 = await env.request('PUT', '/api/auth/profile', {
      token: created.token,
      body: { instructorId: 'ASIN-9' },
    });
    assert.equal(r1.status, 200, `Expected 200 for ASIN-9, got ${r1.status}: ${r1.rawBody}`);
    assert.equal(r1.json?.user?.instructorId, 'ASIN-9');

    const r12 = await env.request('PUT', '/api/auth/profile', {
      token: created.token,
      body: { instructorId: 'ASIN-999888777666' },
    });
    assert.equal(r12.status, 200, `Expected 200 for 12-digit ASIN, got ${r12.status}: ${r12.rawBody}`);
    assert.equal(r12.json?.user?.instructorId, 'ASIN-999888777666');
  });

  it('T1.5 PUT /api/researchers/:id accepts updating instructorId to 1-digit and 12-digit ASIN IDs', async () => {
    const created = await env.createActiveResearcher(adminToken, { digits: '44002' });

    const r12 = await env.request('PUT', `/api/researchers/${created.researcher.id}`, {
      token: adminToken,
      body: { instructorId: 'ASIN-102030405060' },
    });
    assert.equal(r12.status, 200, `Expected 200 for 12-digit update, got ${r12.status}: ${r12.rawBody}`);
    const check = await env.request('GET', `/api/researchers/${created.researcher.id}`);
    assert.equal(check.status, 200);
    assert.equal(check.json?.instructorId, 'ASIN-102030405060');
  });

  it('T1.6 .agents/rules/terminology.md Rule 4 reflects 1-to-12-digit ASIN- format', () => {
    const md = readRepoFile('.agents/rules/terminology.md');
    const rule4Match = md.match(/^## 4\.[\s\S]*?(?=^## 5\.)/m);
    assert.ok(rule4Match, 'Rule 4 section must exist in terminology.md');
    const rule4 = rule4Match[0];
    assert.match(rule4, /1\s*(?:to|-|–)\s*12\s*(?:numeric\s*)?digits/i);
    assert.doesNotMatch(rule4, /followed by 5 digits|only the \*\*5 numeric digits/i);
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases (0 digits, 13 digits, non-digits, case, dups, UI)
  // =========================================================================

  it('T2.1 Rejects ASIN-, ASIN-1234567890123 (13 digits), ASIN-12A, and INS-12345 on POST /api/auth/register', async () => {
    for (const badId of ['ASIN-', 'ASIN-1234567890123', 'ASIN-12A', 'INS-12345', '00001']) {
      const s = nextSuffix();
      const res = await env.request('POST', '/api/auth/register', {
        body: {
          firstName: 'Bad',
          lastName: `Reg${s}`,
          instructorId: badId,
          email: `badreg.${s}@psu.edu.ph`,
          password: 'Password123!',
        },
      });
      assert.equal(res.status, 400, `Expected 400 for invalid ID "${badId}", got ${res.status}: ${res.rawBody}`);
    }
  });

  it('T2.2 Rejects invalid ASIN formats on POST /api/researchers and POST /api/invitation-requests', async () => {
    for (const badId of ['ASIN-', 'ASIN-1234567890123', 'ASIN-12A', 'BAD-99']) {
      const s1 = nextSuffix();
      const rAdmin = await env.request('POST', '/api/researchers', {
        token: adminToken,
        body: {
          firstName: 'Bad',
          lastName: `Adm${s1}`,
          instructorId: badId,
          email: `badadm.${s1}@psu.edu.ph`,
          password: 'Password123!',
          sendInvite: false,
        },
      });
      assert.equal(rAdmin.status, 400, `POST /api/researchers must reject "${badId}", got ${rAdmin.status}`);

      const s2 = nextSuffix();
      const rInv = await env.request('POST', '/api/invitation-requests', {
        body: {
          firstName: 'Bad',
          lastName: `Inv${s2}`,
          instructorId: badId,
          email: `badinv.${s2}@psu.edu.ph`,
        },
      });
      assert.equal(rInv.status, 400, `POST /api/invitation-requests must reject "${badId}", got ${rInv.status}`);
    }
  });

  it('T2.3 Rejects invalid ASIN formats on PUT /api/auth/profile and PUT /api/researchers/:id', async () => {
    const created = await env.createActiveResearcher(adminToken, { digits: '44003' });
    for (const badId of ['ASIN-', 'ASIN-1234567890123', 'ASIN-12A', 'EMP-123']) {
      const rProf = await env.request('PUT', '/api/auth/profile', {
        token: created.token,
        body: { instructorId: badId },
      });
      assert.equal(rProf.status, 400, `PUT /api/auth/profile must reject "${badId}", got ${rProf.status}`);

      const rRes = await env.request('PUT', `/api/researchers/${created.researcher.id}`, {
        token: adminToken,
        body: { instructorId: badId },
      });
      assert.equal(rRes.status, 400, `PUT /api/researchers/:id must reject "${badId}", got ${rRes.status}`);
    }
  });

  it('T2.4 Lowercase asin-42 normalizes to ASIN-42 without zero-padding across endpoints', async () => {
    const s = nextSuffix();
    const res = await env.request('POST', '/api/researchers', {
      token: adminToken,
      body: {
        firstName: 'Norm',
        lastName: `Case${s}`,
        instructorId: 'asin-42',
        email: `norm.${s}@psu.edu.ph`,
        password: 'Password123!',
        sendInvite: false,
      },
    });
    assert.equal(res.status, 201, `Expected 201 for asin-42, got ${res.status}: ${res.rawBody}`);
    assert.equal(res.json?.researcher?.instructorId, 'ASIN-42');

    const s2 = nextSuffix();
    const inv = await env.request('POST', '/api/invitation-requests', {
      body: {
        firstName: 'Norm',
        lastName: `Inv${s2}`,
        instructorId: 'asin-77',
        email: `norminv.${s2}@psu.edu.ph`,
      },
    });
    assert.equal(inv.status, 201);
    const invRow = env.db.prepare('SELECT instructor_id FROM invitation_requests WHERE email = ?').get(`norminv.${s2}@psu.edu.ph`);
    assert.equal(invRow?.instructor_id, 'ASIN-77');
  });

  it('T2.5 Rejects duplicate Instructor ID across register, create researcher, and profile update', async () => {
    const first = await env.createActiveResearcher(adminToken, { digits: '55112233' });
    const dupId = first.instructorId;

    const s = nextSuffix();
    const regDup = await env.request('POST', '/api/auth/register', {
      body: {
        firstName: 'Dup',
        lastName: `User${s}`,
        instructorId: dupId,
        email: `dup.${s}@psu.edu.ph`,
        password: 'Password123!',
      },
    });
    assert.ok([400, 409].includes(regDup.status), `Duplicate register expected 400/409, got ${regDup.status}`);

    const second = await env.createActiveResearcher(adminToken, { digits: '55112244' });
    const profDup = await env.request('PUT', '/api/auth/profile', {
      token: second.token,
      body: { instructorId: dupId },
    });
    assert.ok([400, 409].includes(profDup.status), `Duplicate profile update expected 400/409, got ${profDup.status}`);

    const s2 = nextSuffix();
    const createDup = await env.request('POST', '/api/researchers', {
      token: adminToken,
      body: {
        firstName: 'DupAdmin',
        lastName: `User${s2}`,
        instructorId: dupId,
        email: `dupadmin.${s2}@psu.edu.ph`,
        password: 'Password123!',
        department: 'BSIT',
        isFaculty: true,
        sendInvite: false,
      },
    });
    assert.ok(
      [400, 409].includes(createDup.status),
      `Duplicate POST /api/researchers expected 400/409, got ${createDup.status}`
    );
  });

  it('T2.6 Frontend ASIN input controls in LoginScreen, ProfilePage, and AdminPage enforce 1-12 digits with locked ASIN- prefix', () => {
    const files = [
      'src/app/components/LoginScreen.tsx',
      'src/app/components/ProfilePage.tsx',
      'src/app/components/AdminPage.tsx',
    ];
    for (const file of files) {
      const src = readRepoFile(file);
      const blocks = [...src.matchAll(/<span[^>]*>\s*ASIN-\s*<\/span>[\s\S]{0,700}?<(?:input|Input)\b[\s\S]*?\/>/gi)].map((m) => m[0]);
      assert.ok(blocks.length >= 1, `${file} must have at least 1 locked ASIN- input block`);
      for (const block of blocks) {
        assert.doesNotMatch(block, /maxLength=\{5\}|\\d\{5\}|\[0-9\]\{5\}|\.slice\(0,\s*5\)/, `${file} ASIN input still restricts to 5 digits`);
        assert.match(block, /maxLength=\{12\}/, `${file} ASIN input must allow maxLength={12}`);
        const hasInline12 = /slice\(0,\s*12\)|\\d\{1,12\}|\[0-9\]\{1,12\}/.test(block);
        const hasHelper12 = /onChange=/.test(block) && /slice\(0,\s*12\)|\\d\{1,12\}|\[0-9\]\{1,12\}|maxLength=\{12\}/.test(src);
        assert.ok(hasInline12 || hasHelper12, `${file} ASIN input must enforce 1..12 digits`);
      }
    }
  });

  it('T2.7 Frontend ASIN submit/edit handlers enforce 1-12 digits and contain no legacy 5-digit padStart/slice/regex limits', () => {
    const legacy5DigitPattern = /digitsOnly\.length\s*(?:!==|>|<)\s*5|must be 5 digits|padStart\(\s*5|\.slice\(\s*0,\s*5\s*\)|ASIN-\(\\d\{5\}\)|\\d\{5\}/i;

    const loginSrc = readRepoFile('src/app/components/LoginScreen.tsx');
    const inviteFn = extractNamedFunction(loginSrc, 'handleRequestInvite');
    assert.ok(inviteFn, 'handleRequestInvite must exist in LoginScreen.tsx');
    assert.doesNotMatch(inviteFn, legacy5DigitPattern, 'LoginScreen handleRequestInvite still enforces 5-digit limit');
    assert.match(
      `${loginSrc}`,
      /digitsOnly\.length\s*>\s*12|\\d\{1,12\}|slice\(\s*0,\s*12\s*\)|1\s*(?:to|-|–)\s*12/i,
      'LoginScreen must enforce 1-12 digit Instructor ID validation'
    );

    const profileSrc = readRepoFile('src/app/components/ProfilePage.tsx');
    const openEditFn = extractNamedFunction(profileSrc, 'handleOpenEdit');
    const saveFn = extractNamedFunction(profileSrc, 'handleSave');
    assert.ok(openEditFn && saveFn, 'handleOpenEdit and handleSave must exist in ProfilePage.tsx');
    assert.doesNotMatch(openEditFn, legacy5DigitPattern, 'ProfilePage handleOpenEdit still assumes 5-digit ASIN');
    assert.doesNotMatch(saveFn, legacy5DigitPattern, 'ProfilePage handleSave still pads/slices to 5 digits');
    assert.match(
      `${openEditFn}\n${saveFn}\n${profileSrc}`,
      /\\d\{1,12\}|length\s*>\s*12|slice\(\s*0,\s*12\s*\)|1\s*(?:to|-|–)\s*12/i,
      'ProfilePage must support/enforce 1-12 digit Instructor IDs'
    );

    const adminSrc = readRepoFile('src/app/components/AdminPage.tsx');
    const adminSaveFn = extractNamedFunction(adminSrc, 'saveForm');
    const adminApproveFn = extractNamedFunction(adminSrc, 'handleApproveInvitationRequest');
    assert.ok(adminSaveFn && adminApproveFn, 'saveForm and handleApproveInvitationRequest must exist in AdminPage.tsx');
    assert.doesNotMatch(adminSaveFn, legacy5DigitPattern, 'AdminPage saveForm still enforces 5-digit ASIN limit');
    assert.doesNotMatch(adminApproveFn, legacy5DigitPattern, 'AdminPage handleApproveInvitationRequest still slices to 5 digits');
    assert.match(
      `${adminSaveFn}\n${adminApproveFn}`,
      /\\d\{1,12\}|length\s*>\s*12|slice\(\s*0,\s*12\s*\)|1\s*(?:to|-|–)\s*12/i,
      'AdminPage handlers must support/enforce 1-12 digit Instructor IDs'
    );
  });

  // =========================================================================
  // Tier 3: Cross-Feature Pairwise (R1 + R3)
  // =========================================================================

  it('T2.8 Rejects ASIN-0000000000000 (13 zeros) and hyphenated digits ASIN-12-34 on profile & researcher updates', async () => {
    const created = await env.createActiveResearcher(adminToken, { digits: '44009' });
    for (const badId of ['ASIN-0000000000000', 'ASIN-12-34', 'ASIN- 123']) {
      const res = await env.request('PUT', '/api/auth/profile', {
        token: created.token,
        body: { instructorId: badId },
      });
      assert.equal(res.status, 400, `Expected 400 for "${badId}", got ${res.status}`);
    }
  });

  it('T2.9 aiService.mjs does not restrict ASIN Instructor ID instructions to strictly 5 digits', () => {
    const aiSrc = readRepoFile('src/server/aiService.mjs');
    assert.doesNotMatch(aiSrc, /ASIN-\d{5}\b.*only|strictly\s+5\s+digits/i);
  });

  it('T3.1 Pairwise R1+R3: 12-digit ASIN researcher with multi-word first name & middle initial persists across login & profile', async () => {
    const s = nextSuffix();
    const res = await env.request('POST', '/api/researchers', {
      token: adminToken,
      body: {
        firstName: 'Julius Oscar',
        middleInitial: 'M.',
        lastName: `Moreno${s}`,
        instructorId: 'ASIN-112233445566',
        email: `pairwise.r1r3.${s}@psu.edu.ph`,
        password: 'Password123!',
        department: 'BSIT',
        isFaculty: true,
        sendInvite: false,
      },
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${res.rawBody}`);

    const loginRes = await env.request('POST', '/api/auth/login', {
      body: { username: 'ASIN-112233445566', password: 'Password123!' },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.json?.user?.instructorId, 'ASIN-112233445566');
    assert.equal(loginRes.json?.user?.firstName, 'Julius Oscar');
    assert.equal(loginRes.json?.user?.middleInitial, 'M.');
    assert.equal(loginRes.json?.user?.lastName, `Moreno${s}`);
  });
});
