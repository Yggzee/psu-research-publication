import crypto from 'node:crypto';

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

// Server-side secret for signing session tokens (Never exposed to client)
const SESSION_SECRET = process.env.SESSION_SECRET || 'psu-asingan-sec-token-2026-auth-seal-49a';

/**
 * Sign a session token using HMAC-SHA256
 * Payload structure: { id, role, name, username, instructorId, department, exp }
 */
export function signSessionToken(payload) {
  const data = {
    id: payload.id,
    role: payload.role || 'instructor',
    name: payload.name,
    username: payload.username,
    instructorId: payload.instructorId || payload.username,
    department: payload.department,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
  };

  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/**
 * Verify an HMAC-SHA256 session token
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

  if (signature.length !== expectedSig.length) return null;

  try {
    const isMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!isMatch) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Token expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Authenticate incoming HTTP request via Authorization: Bearer <token>
 * Returns caller payload or null
 */
export function authenticateCaller(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifySessionToken(token);
  }
  return null;
}

/**
 * Check if caller has administrator privileges
 */
export function isCallerAdmin(caller) {
  return Boolean(caller && caller.role === 'admin');
}

/**
 * Check if caller owns a specific publication
 */
export function isCallerPublicationOwner(pub, caller) {
  if (!caller || !pub) return false;
  if (caller.role === 'admin') return true;

  const pubOwnerId = (pub.owner_id || '').trim().toLowerCase();
  const callerInstId = (caller.instructorId || '').trim().toLowerCase();
  const callerId = (caller.id || '').trim().toLowerCase();
  const callerUsername = (caller.username || '').trim().toLowerCase();

  if (pubOwnerId && (pubOwnerId === callerInstId || pubOwnerId === callerId || pubOwnerId === callerUsername)) {
    return true;
  }

  // Also check if caller matches publication's author list or owner_name
  return matchesResearcher(pub, {
    id: caller.id,
    instructor_id: caller.instructorId,
    name: caller.name,
  });
}

/**
 * Check if caller can read a publication (Tenant Isolation / SQLite RLS equivalent)
 * - Public & Approved publications: visible to all
 * - Private / Pending / Rejected drafts: visible ONLY to admin or owner
 */
export function canCallerAccessPublication(pub, caller) {
  const isApproved = pub.approval_status === 'approved';
  const isPublic = Boolean(pub.is_public);

  if (isApproved && isPublic) {
    return true;
  }

  if (!caller) return false;
  if (caller.role === 'admin') return true;

  return isCallerPublicationOwner(pub, caller);
}

/**
 * Filter list of publications for tenant isolation
 */
export function filterPublicationsForCaller(publications, caller) {
  if (caller && caller.role === 'admin') {
    return publications; // Admins see all publications
  }

  return publications.filter((p) => canCallerAccessPublication(p, caller));
}

/**
 * Check if caller can modify a publication
 */
export function canCallerModifyPublication(pub, caller) {
  if (!caller) return false;
  if (caller.role === 'admin') return true;
  return isCallerPublicationOwner(pub, caller);
}

/**
 * Check if caller can modify a researcher profile
 */
export function canCallerModifyResearcher(researcher, caller) {
  if (!caller || !researcher) return false;
  if (caller.role === 'admin') return true;

  const rId = (researcher.id || '').trim().toLowerCase();
  const rInstId = (researcher.instructor_id || '').trim().toLowerCase();
  const rUserId = (researcher.user_id || '').trim().toLowerCase();

  const cId = (caller.id || '').trim().toLowerCase();
  const cInstId = (caller.instructorId || '').trim().toLowerCase();
  const cUsername = (caller.username || '').trim().toLowerCase();

  return (
    rId === cId ||
    rInstId === cInstId ||
    rInstId === cUsername ||
    rUserId === cId
  );
}

/**
 * Input Whitelisting: Sanitize publication creation/update body to prevent
 * unauthorized privilege/status/points elevation.
 */
export function sanitizePublicationInput(data, caller, isCreate = false) {
  const isAdmin = isCallerAdmin(caller);

  if (isAdmin) {
    // Admin has full control
    return {
      title: data.title?.trim(),
      authors: data.authors,
      journal: data.journal || 'Research Journal',
      year: Number(data.year) || new Date().getFullYear(),
      citations: Number(data.citations) || 0,
      abstract: data.abstract || '',
      url: data.url || null,
      impactScore: Number(data.impactScore) || 0.0,
      ownerId: data.ownerId || caller?.instructorId || 'admin',
      ownerName: data.ownerName || caller?.name || 'Admin',
      source: data.source || 'admin',
      approvalStatus: data.approvalStatus || 'approved',
      researchStatus: data.researchStatus || 'Published',
      isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
      fileName: data.fileName || null,
      citedByLink: data.citedByLink || null,
      sdgTags: data.sdgTags || data.sdg_tags,
      sdgRationale: data.sdgRationale || data.sdg_rationale,
      chedPriority: data.chedPriority || data.ched_priority,
      journalIndexing: data.journalIndexing || data.journal_indexing,
      nbc461Points: data.nbc461Points !== undefined ? Number(data.nbc461Points) : null,
      isPredatoryFlag: data.isPredatoryFlag !== undefined ? Boolean(data.isPredatoryFlag) : null,
      citingPapers: data.citingPapers,
    };
  }

  // For non-admin (Faculty/Instructor):
  // 1. Force approvalStatus to 'pending' (cannot self-approve!)
  // 2. Lock owner to authenticated caller
  // 3. nbc461Points cannot be arbitrarily dictated (set to null so auditJournalReputation calculates it)
  return {
    title: data.title?.trim(),
    authors: data.authors,
    journal: data.journal || 'Research Journal',
    year: Number(data.year) || new Date().getFullYear(),
    citations: Number(data.citations) || 0,
    abstract: data.abstract || '',
    url: data.url || null,
    impactScore: 0.0,
    ownerId: caller?.instructorId || caller?.id || 'instructor',
    ownerName: caller?.name || 'Faculty Researcher',
    source: isCreate ? 'manual' : (data.source || 'manual'),
    approvalStatus: 'pending', // Strictly enforced! Non-admins cannot approve
    researchStatus: ['In Progress', 'Unpublished', 'Published'].includes(data.researchStatus)
      ? data.researchStatus
      : 'In Progress',
    isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
    fileName: data.fileName || null,
    citedByLink: data.citedByLink || null,
    sdgTags: null, // Generated server-side via AI
    sdgRationale: null,
    chedPriority: null,
    journalIndexing: null, // Computed server-side
    nbc461Points: null,    // Computed server-side from audited journal
    isPredatoryFlag: null, // Computed server-side
    citingPapers: data.citingPapers,
  };
}

/**
 * Input Whitelisting: Sanitize researcher profile updates.
 * Disallow self-escalation to admin role or changing system approval status.
 */
export function sanitizeResearcherInput(data, caller) {
  const isAdmin = isCallerAdmin(caller);

  if (isAdmin) {
    return {
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
      department: data.department,
      isFaculty: data.isFaculty !== undefined ? Boolean(data.isFaculty) : undefined,
      photoUrl: data.photoUrl,
      scholarUrl: data.scholarUrl,
      googleScholarId: data.googleScholarId,
      status: data.status,
      password: data.password,
    };
  }

  // Instructor cannot modify: role, status, isFaculty, or other system flags
  return {
    firstName: data.firstName?.trim(),
    lastName: data.lastName?.trim(),
    department: data.department,
    isFaculty: undefined, // Cannot change faculty flag
    photoUrl: data.photoUrl,
    scholarUrl: data.scholarUrl,
    googleScholarId: data.googleScholarId,
    status: undefined,    // Cannot un-suspend or self-admit
    password: data.password,
  };
}
