import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isTursoConfigured, initTursoSchema, rehydrateFromTurso, executeOnTurso, executeBatchOnTurso } from './turso.mjs';
import { matchesResearcher, hashPassword } from './authHelper.mjs';
import { localHeuristicSDG } from './aiService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load root .env if present
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch (err) {
    console.warn('[Env] Failed to load .env file:', err.message);
  }
}

// Ensure data directory exists (support custom mount via DATA_DIR)
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'research.db');
export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

let inBulkTransaction = false;
let pendingTursoBatch = [];

// Wrap db.prepare to replicate write queries to Turso Cloud SQLite automatically
const originalPrepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const statement = originalPrepare(sql);
  const originalRun = statement.run.bind(statement);
  statement.run = (...args) => {
    const result = originalRun(...args);
    if (isTursoConfigured && /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) {
      if (inBulkTransaction) {
        pendingTursoBatch.push({ sql, args });
      } else {
        executeOnTurso(sql, args).catch((err) => {
          console.warn('[Turso Background Replicate Error]:', err.message);
        });
      }
    }
    return result;
  };
  return statement;
};

/**
 * Execute a synchronous callback inside a single atomic SQLite transaction.
 * Makes inserting 1,000 to 10,000+ rows execute in milliseconds instead of seconds.
 */
export function runInTransaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  inBulkTransaction = true;
  pendingTursoBatch = [];
  try {
    const res = fn();
    db.exec('COMMIT;');
    if (isTursoConfigured && pendingTursoBatch.length > 0) {
      const batchToSync = [...pendingTursoBatch];
      executeBatchOnTurso(batchToSync).catch((err) => {
        console.warn('[Turso Batch Replicate Error]:', err.message);
      });
    }
    return res;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch { }
    throw err;
  } finally {
    inBulkTransaction = false;
    pendingTursoBatch = [];
  }
}

/**
 * Initialize Database Tables
 * Notice: Started completely fresh with NO mock data!
 */
export function initDatabase() {
  // 1. Users Table (for Admin & all Researchers created by Admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'instructor', -- 'admin' | 'instructor'
      department TEXT,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      photo_url TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 2. Researchers Table (Added and managed by Admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS researchers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      instructor_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT NOT NULL,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      affiliation TEXT DEFAULT 'Pangasinan State University - Asingan Campus',
      photo_url TEXT,
      total_publications INTEGER DEFAULT 0,
      total_citations INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Publications Table (Permanent system records)
  db.exec(`
    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL, -- JSON array string
      journal TEXT,
      year INTEGER NOT NULL,
      citations INTEGER DEFAULT 0,
      abstract TEXT,
      url TEXT,
      impact_score REAL DEFAULT 0.0,
      owner_id TEXT, -- instructorId or 'admin'
      owner_name TEXT,
      source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'claim' | 'scraped' | 'admin'
      approval_status TEXT NOT NULL DEFAULT 'approved', -- 'approved' | 'pending' | 'rejected'
      research_status TEXT NOT NULL DEFAULT 'Published', -- 'In Progress' | 'Unpublished' | 'Published'
      is_public INTEGER NOT NULL DEFAULT 1,
      file_name TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 4. Scraped Publications Cache (From Google Scholar / Apify)
  // Ensures scraped research is permanently saved and never re-scraped
  db.exec(`
    CREATE TABLE IF NOT EXISTS scraped_publications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL, -- JSON array string
      journal TEXT,
      year INTEGER,
      citations INTEGER DEFAULT 0,
      abstract TEXT,
      url TEXT,
      cited_by_link TEXT,
      search_query TEXT,
      scraped_at TEXT NOT NULL
    );
  `);

  // Migration: add cited_by_link column to scraped_publications & publications if missing
  try {
    db.exec(`ALTER TABLE scraped_publications ADD COLUMN cited_by_link TEXT`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE publications ADD COLUMN cited_by_link TEXT`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE researchers ADD COLUMN scholar_url TEXT`);
  } catch { }
  try {
    db.exec(`ALTER TABLE researchers ADD COLUMN google_scholar_id TEXT`);
  } catch { }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN scholar_url TEXT`);
  } catch { }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN google_scholar_id TEXT`);
  } catch { }
  try {
    db.exec(`ALTER TABLE researchers ADD COLUMN middle_initial TEXT`);
  } catch { }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN middle_initial TEXT`);
  } catch { }

  // 4b. Invitation Requests Table (Submitted from Login page by researchers asking for invitation)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitation_requests (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_initial TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      instructor_id TEXT NOT NULL,
      department TEXT DEFAULT 'BSIT',
      scholar_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'invited' | 'rejected'
      admin_notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Intelligence & Capstone Innovations Migrations
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_tags TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_rationale TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_source TEXT DEFAULT 'auto'`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_evidence TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN journal_indexing TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN is_predatory_flag INTEGER DEFAULT 0`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN nbc461_points REAL DEFAULT 0.0`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN jc3_points REAL DEFAULT 0.0`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN ched_priority TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN doi TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN keywords TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN issn_isbn TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN volume_issue TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN publication_date TEXT`); } catch { }
  try { db.exec(`ALTER TABLE publications ADD COLUMN publication_level TEXT DEFAULT 'International'`); } catch { }

  // 5. Citation Trends Table (yearly citations per publication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS citation_trends (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      citations INTEGER NOT NULL,
      FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );
  `);

  // 6. Citing Papers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS citing_papers (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT,
      year INTEGER,
      link TEXT,
      journal TEXT,
      volume_issue TEXT,
      quarter TEXT,
      doi_issn TEXT,
      FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );
  `);

  try { db.exec(`ALTER TABLE citing_papers ADD COLUMN journal TEXT`); } catch { }
  try { db.exec(`ALTER TABLE citing_papers ADD COLUMN volume_issue TEXT`); } catch { }
  try { db.exec(`ALTER TABLE citing_papers ADD COLUMN quarter TEXT`); } catch { }
  try { db.exec(`ALTER TABLE citing_papers ADD COLUMN doi_issn TEXT`); } catch { }

  // High-performance indexes for 1,000–10,000+ citation scale
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_citing_papers_pub_id ON citing_papers(publication_id);
      CREATE INDEX IF NOT EXISTS idx_citing_papers_pub_year ON citing_papers(publication_id, year);
      CREATE INDEX IF NOT EXISTS idx_citation_trends_pub_id ON citation_trends(publication_id);
      CREATE INDEX IF NOT EXISTS idx_publications_owner_id ON publications(owner_id);
      CREATE INDEX IF NOT EXISTS idx_publications_approval ON publications(approval_status, year DESC);
    `);
  } catch { }

  // 7. Apify Scraper Tokens Table (Support for multiple tokens, switching, and auto-failover)
  db.exec(`
    CREATE TABLE IF NOT EXISTS apify_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token TEXT NOT NULL,
      actor_id TEXT NOT NULL DEFAULT 'johnvc~google-scholar-api',
      is_active INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'untested',
      username TEXT,
      plan TEXT,
      created_at TEXT NOT NULL,
      last_tested_at TEXT
    );
    UPDATE apify_tokens SET actor_id = 'johnvc~google-scholar-api' WHERE actor_id LIKE '%dan.k%';
  `);

  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN search_count INTEGER DEFAULT 0`); } catch { }
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN monthly_usage_usd REAL DEFAULT 0`); } catch { }
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN max_monthly_usage_usd REAL DEFAULT 5`); } catch { }
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN cycle_end_at TEXT`); } catch { }
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN total_runs INTEGER`); } catch { }

  // Verification & Onboarding Migrations
  try { db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`); } catch { }
  try { db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`); } catch { }
  try { db.exec(`ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT`); } catch { }
  try { db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`); } catch { }
  try { db.exec(`ALTER TABLE users ADD COLUMN registration_type TEXT DEFAULT 'manual'`); } catch { }
  try { db.exec(`ALTER TABLE users ADD COLUMN has_scholar INTEGER DEFAULT 1`); } catch { }

  try { db.exec(`ALTER TABLE researchers ADD COLUMN status TEXT DEFAULT 'active'`); } catch { }
  try { db.exec(`ALTER TABLE researchers ADD COLUMN has_scholar INTEGER DEFAULT 1`); } catch { }

  // Ensure any existing rows have active status
  try {
    db.exec(`UPDATE users SET status = 'active' WHERE status IS NULL`);
    db.exec(`UPDATE researchers SET status = 'active' WHERE status IS NULL`);
  } catch { }

  // 8. Email Logs & Outbox Table (Auditing, local preview, and resend support)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      email_type TEXT NOT NULL,
      verification_token TEXT,
      verification_link TEXT,
      html_content TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      created_at TEXT NOT NULL
    );
  `);

  // 9. Campus AI Chat Sessions & History Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 10. System Settings Table (Public Scraper toggles, Quota Circuit Breakers, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 11. Archived Researchers Table (Audit storage for deleted researchers & publication snapshots)
  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_researchers (
      id TEXT PRIMARY KEY,
      original_researcher_id TEXT NOT NULL,
      original_user_id TEXT,
      instructor_id TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      affiliation TEXT,
      photo_url TEXT,
      scholar_url TEXT,
      google_scholar_id TEXT,
      total_publications INTEGER DEFAULT 0,
      total_citations INTEGER DEFAULT 0,
      publications_snapshot TEXT,
      archive_reason TEXT DEFAULT 'Deleted by administrator',
      archived_at TEXT NOT NULL
    );
  `);

  // 12. Declined Registrations Table (Audit storage for declined registrations & invitation requests)
  db.exec(`
    CREATE TABLE IF NOT EXISTS declined_registrations (
      id TEXT PRIMARY KEY,
      original_request_id TEXT,
      original_user_id TEXT,
      instructor_id TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      is_faculty INTEGER DEFAULT 1,
      scholar_url TEXT,
      google_scholar_id TEXT,
      registration_type TEXT DEFAULT 'self_registration',
      decline_reason TEXT DEFAULT 'Declined by administrator',
      declined_at TEXT NOT NULL
    );
  `);

  // Seed default system settings if missing
  const initSetting = (key, defaultValue) => {
    const existing = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    if (!existing) {
      db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
        key,
        defaultValue,
        new Date().toISOString()
      );
    }
  };

  initSetting('public_scraper_enabled', 'true');
  initSetting('scraper_quota_threshold_usd', '1.00');
  initSetting('scraper_daily_limit', '100');

  const adminUsername = process.env.ADMIN_USERNAME || 'psuac-rc';

  // Seed default admin account with password = 'ENV_MANAGED' (never stored in DB!)
  const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, name, role, department, is_faculty, scholar_url, google_scholar_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'admin-1',
      adminUsername,
      'rodeliogarin@gmail.com',
      'ENV_MANAGED',
      'Sir Rodelio M. Garin',
      'admin',
      'Campus Research Unit / BSIT',
      1,
      'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
      'x6PdtN8AAAAJ',
      new Date().toISOString()
    );
    console.log('[Database] Default admin user initialized with ENV_MANAGED credentials.');
  } else {
    // Idempotent migration to ensure admin credentials match .env and are removed from database
    try {
      db.prepare(`
        UPDATE users 
        SET username = ?, 
            password = 'ENV_MANAGED',
            name = 'Sir Rodelio M. Garin',
            email = 'rodeliogarin@gmail.com',
            department = 'Campus Research Unit / BSIT',
            scholar_url = 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
            google_scholar_id = 'x6PdtN8AAAAJ'
        WHERE role = 'admin'
      `).run(adminUsername);
      console.log('[Database] Admin user credentials protected via .env (password marked ENV_MANAGED).');
    } catch (e) {
      console.warn('[Admin Upgrade Error]:', e.message);
    }
  }

  // Delete duplicate orphaned test account from earlier experiments
  try {
    db.prepare("DELETE FROM users WHERE id = 'user-1794223646835-yndd'").run();
  } catch { }

  // Ensure Sir Rodelio M. Garin's researcher profile is linked to admin-1
  try {
    const garinRes = db.prepare(`SELECT id FROM researchers WHERE (instructor_id = 'PSU-002' OR name LIKE '%Garin%') LIMIT 1`).get();
    if (garinRes) {
      db.prepare(`
        UPDATE researchers 
        SET user_id = 'admin-1',
            scholar_url = 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
            google_scholar_id = 'x6PdtN8AAAAJ'
        WHERE id = ?
      `).run(garinRes.id);
    }
  } catch (e) {
    console.warn('[Garin Researcher Link Error]:', e.message);
  }

  // Upgrade any plaintext researcher passwords to salted scrypt hashes
  migrateResearcherPasswordsToScrypt(db);
  // Call on startup audit to recalibrate any inflated citation counts
  auditAndSyncResearcherCitations();
  autoBackfillMissingSDGs();
}

/**
 * Scan users table and transparently upgrade any plaintext passwords to salted scrypt hashes
 */
export function migrateResearcherPasswordsToScrypt(dbInstance = db) {
  try {
    const unhashedUsers = dbInstance.prepare(`
      SELECT id, username, password FROM users 
      WHERE password IS NOT NULL 
        AND password != 'ENV_MANAGED' 
        AND password NOT LIKE 'scrypt$%'
    `).all();

    if (unhashedUsers.length > 0) {
      console.log(`[Security] Migrating ${unhashedUsers.length} plaintext researcher password(s) to salted scrypt hashes...`);
      for (const u of unhashedUsers) {
        const hashed = hashPassword(u.password);
        dbInstance.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, u.id);
      }
      console.log('[Security] Researcher passwords successfully upgraded to scrypt hashes.');
    }
  } catch (err) {
    console.warn('[Password Migration Error]:', err.message);
  }
}

/**
 * Automatically backfill missing SDG tags and CHED priorities using the academic classifier
 */
export function autoBackfillMissingSDGs() {
  try {
    const unclassified = db.prepare(`
      SELECT id, title, abstract, journal, doi FROM publications
      WHERE (sdg_tags IS NULL OR sdg_tags = '' OR sdg_tags = '[]' OR sdg_tags = '["General Research"]')
      AND approval_status = 'approved'
      AND (sdg_source IS NULL OR sdg_source != 'manual_override')
    `).all();

    if (unclassified.length > 0) {
      console.log(`[SDG Backfill] Auto-classifying ${unclassified.length} publications...`);
      for (const pub of unclassified) {
        const classified = localHeuristicSDG(pub.title || '', pub.abstract || '');
        const tags = JSON.stringify([classified.primarySDG, ...(classified.secondarySDG ? [classified.secondarySDG] : [])].filter(Boolean));
        const rationale = classified.rationale || '';
        const ched = classified.chedPriority || '';
        const evidenceJson = JSON.stringify(classified.evidence || null);
        const source = classified.source || 'auto';
        db.prepare(`
          UPDATE publications
          SET sdg_tags = ?, sdg_rationale = ?, ched_priority = ?, sdg_source = ?, sdg_evidence = ?
          WHERE id = ?
        `).run(tags, rationale, ched, source, evidenceJson, pub.id);
      }
      console.log(`[SDG Backfill] Finished auto-classifying ${unclassified.length} publications.`);
    }
  } catch (err) {
    console.warn('[SDG Backfill Error]:', err.message);
  }
}

/**
 * Recalculate publication counts and citation sums for all researchers using strict attribution
 */
export function auditAndSyncResearcherCitations() {
  try {
    const researchers = db.prepare("SELECT * FROM researchers WHERE (status = 'active' OR status IS NULL)").all();
    const allApproved = db.prepare("SELECT * FROM publications WHERE approval_status = 'approved'").all();

    for (const r of researchers) {
      const matching = allApproved.filter((p) => matchesResearcher(p, r));
      const pubCount = matching.length;
      const citCount = matching.reduce((sum, p) => sum + (p.citations || 0), 0);
      if (r.total_publications !== pubCount || r.total_citations !== citCount) {
        db.prepare(`
          UPDATE researchers
          SET total_publications = ?, total_citations = ?
          WHERE id = ?
        `).run(pubCount, citCount, r.id);
        console.log(`[Citation Audit] Recalibrated ${r.name} (${r.instructor_id}): ${r.total_publications} -> ${pubCount} pubs, ${r.total_citations} -> ${citCount} citations.`);
      }
    }
  } catch (err) {
    console.warn('[Citation Audit Error]:', err.message);
  }
}

// Call on import to guarantee schema existence
initDatabase();

// Guard startup rehydration with a strict timeout so slow cloud networks never freeze HTTP requests
const TURSO_SYNC_TIMEOUT_MS = 6000;

const tursoSyncWithTimeout = async () => {
  const syncTask = (async () => {
    await initTursoSchema();
    await rehydrateFromTurso(db, originalPrepare);
    auditAndSyncResearcherCitations();
    autoBackfillMissingSDGs();
  })();

  const timeoutTask = new Promise((resolve) => {
    setTimeout(() => {
      console.warn(`[Turso Sync] Startup sync exceeded ${TURSO_SYNC_TIMEOUT_MS}ms timeout. Continuing with local SQLite cache to keep web service responsive.`);
      resolve();
    }, TURSO_SYNC_TIMEOUT_MS);
  });

  await Promise.race([syncTask, timeoutTask]);
};

export const dbReadyPromise = isTursoConfigured
  ? tursoSyncWithTimeout().catch((err) => {
    console.warn('[Turso Startup Error]:', err.message);
  })
  : Promise.resolve();
