import crypto from 'node:crypto';

/**
 * Check if a publication belongs to a researcher with high-precision verification:
 * 1. Strict explicit ownership by ID (instructor_id, researcher id, or user_id).
 * 2. If unassigned or admin-managed, requires tokenized full-name or verified initials
 *    matching (never matching solely on surname or loose single-letter substrings).
 */
export function matchesResearcher(p, r) {
  if (!r || !p) return false;
  const pOwnerId = (p.owner_id || p.ownerId || '').trim().toLowerCase();
  const rInstId = (r.instructor_id || r.instructorId || '').trim().toLowerCase();
  const rId = (r.id || '').trim().toLowerCase();
  const rUserId = (r.user_id || r.userId || '').trim().toLowerCase();

  // 1. Strict Explicit Ownership Match
  // If the publication has an explicit researcher owner_id assigned (not generic 'admin'/'instructor'),
  // strictly tie the publication to that assigned researcher.
  if (pOwnerId && pOwnerId !== 'admin' && pOwnerId !== 'instructor') {
    return (
      pOwnerId === rInstId ||
      pOwnerId === rId ||
      (Boolean(rUserId) && pOwnerId === rUserId)
    );
  }

  // Normalize researcher names for token-level matching
  const rName = (r.name || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const rFirst = (r.first_name || r.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const rLast = (r.last_name || r.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const rMiddle = (r.middle_initial || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!rLast || rLast.length < 2) return false;

  const pOwnerName = (p.owner_name || p.ownerName || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

  // Exact full name match on owner_name
  if (pOwnerName && pOwnerName === rName) {
    return true;
  }

  // If pOwnerName is present and doesn't match full name, ensure it doesn't belong to a different person
  if (pOwnerName && pOwnerName !== 'admin' && pOwnerName !== 'instructor') {
    const ownerTokens = pOwnerName.split(' ').filter(Boolean);
    if (ownerTokens.includes(rLast)) {
      if (rFirst && ownerTokens.includes(rFirst)) return true;
      if (rFirst && ownerTokens.some((t) => t.length > 2 && t !== rFirst && !rName.includes(t))) {
        // Explicitly belongs to someone else (e.g., "Maria Moreno" vs "Julius Moreno")
        return false;
      }
    } else {
      return false;
    }
  }

  let authors = [];
  try {
    authors = Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || '[]');
  } catch {
    authors = [p.authors || ''];
  }

  for (const a of authors) {
    const raw = (typeof a === 'string' ? a : (a?.name || '')).trim().toLowerCase();
    if (!raw) continue;
    const clean = raw.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    // 1. Exact full-name match
    if (clean === rName) return true;

    const tokens = clean.split(' ').filter(Boolean);
    // Must contain the exact last name token as a distinct word boundary
    if (!tokens.includes(rLast)) continue;

    // Check if full first name matches as a token (e.g. "Julius" in "Julius Moreno" or "Moreno, Julius")
    if (rFirst && tokens.includes(rFirst)) {
      return true;
    }

    // Check academic initial formats: "J. O. Moreno" or "Moreno, J. O."
    if (rFirst) {
      const fInit = rFirst[0];
      const otherTokens = tokens.filter((t) => t !== rLast);

      // Reject conflicting full first names (e.g. "Juan Moreno", "Jorge Moreno" must NEVER match "Julius")
      const hasConflictingFirstName = otherTokens.some((t) => t.length > 2 && t !== rFirst && !rName.includes(t));
      if (hasConflictingFirstName) {
        continue;
      }

      // Check initials match
      const matchedFirstInit = otherTokens.some((t) => t === fInit || t.startsWith(fInit));
      if (matchedFirstInit) {
        if (rMiddle) {
          // If researcher has a middle initial, verify it matches
          const matchedMiddle = otherTokens.some((t) => t === rMiddle || t === `${fInit}${rMiddle}` || t.endsWith(rMiddle));
          if (matchedMiddle) return true;
        } else if (otherTokens.length === 1 && otherTokens[0] === fInit) {
          // Single initial e.g. "Moreno, J." when researcher has no middle initial recorded
          return true;
        }
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
      jc3Points: data.jc3Points !== undefined ? Number(data.jc3Points) : (data.jc3_points !== undefined ? Number(data.jc3_points) : null),
      nbc461Points: data.nbc461Points !== undefined ? Number(data.nbc461Points) : null,
      isPredatoryFlag: data.isPredatoryFlag !== undefined ? Boolean(data.isPredatoryFlag) : null,
      citingPapers: data.citingPapers,
    };
  }

  // For non-admin (Faculty/Instructor):
  // 1. Force approvalStatus to 'pending' (cannot self-approve!)
  // 2. Lock owner to authenticated caller
  // 3. jc3Points/nbc461Points cannot be arbitrarily dictated (set to null so auditJournalReputation calculates it)
  return {
    title: data.title?.trim(),
    authors: data.authors,
    journal: data.journal || 'Research Journal',
    year: Number(data.year) || new Date().getFullYear(),
    citations: Number(data.citations) || 0,
    abstract: data.abstract || '',
    url: data.url || null,
    impactScore: 0.0,
    ownerId: caller?.instructorId || data.ownerId || caller?.id || '',
    ownerName: caller?.name || data.ownerName || 'Faculty Researcher',
    source: data.source === 'claim' ? 'claim' : (isCreate ? 'manual' : (data.source || 'manual')),
    approvalStatus: 'pending', // Strictly enforced! Non-admins cannot self-approve
    researchStatus: ['In Progress', 'Unpublished', 'Published'].includes(data.researchStatus)
      ? data.researchStatus
      : 'Published',
    isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
    fileName: data.fileName || null,
    citedByLink: data.citedByLink || null,
    sdgTags: null, // Generated server-side via AI
    sdgRationale: null,
    chedPriority: null,
    journalIndexing: null, // Computed server-side
    jc3Points: null,       // Computed server-side from audited journal
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
      instructorId: data.instructorId?.trim(),
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
    instructorId: data.instructorId?.trim(),
    department: data.department,
    isFaculty: undefined, // Cannot change faculty flag
    photoUrl: data.photoUrl,
    scholarUrl: data.scholarUrl,
    googleScholarId: data.googleScholarId,
    status: undefined,    // Cannot un-suspend or self-admit
    password: data.password,
  };
}

/**
 * One-way cryptographic password hashing using Node.js crypto.scryptSync
 * Format: scrypt$<salt_hex>$<derivedKey_hex>
 */
export function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Constant-time password verification against stored scrypt hash
 */
export function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  // If stored in old plaintext, check equality (migration will catch it)
  if (!stored.startsWith('scrypt$')) {
    return password === stored;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const originalKeyHex = parts[2];
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(derivedKey, 'hex');
    const b = Buffer.from(originalKeyHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Normalizes any freeform or legacy department label into one of the 6 canonical PSU Asingan codes
 */
export function normalizeDepartment(rawDept) {
  if (!rawDept) return 'BSIT';
  const u = String(rawDept).toUpperCase().trim();
  if (u.includes('BSIT') || u.includes('INFORMATION TECHNOLOGY') || u === 'IT') return 'BSIT';
  if (u.includes('BSBA') || u.includes('BUSINESS') || u.includes('ADMINISTRATION')) return 'BSBA';
  if (u.includes('BTLED') || u.includes('LIVELIHOOD') || u.includes('TECHNOLOGY AND LIVELIHOOD')) return 'BTLED';
  if (u.includes('BSE') || u.includes('SECONDARY')) return 'BSE';
  if (u.includes('BEE') || u.includes('ELEMENTARY')) return 'BEE';
  if (u.includes('BIT') || u.includes('INDUSTRIAL')) return 'BIT';
  return 'BSIT';
}
