import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isTursoConfigured, initTursoSchema, rehydrateFromTurso, executeOnTurso } from './turso.mjs';

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

// Wrap db.prepare to replicate write queries to Turso Cloud SQLite automatically
const originalPrepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const statement = originalPrepare(sql);
  const originalRun = statement.run.bind(statement);
  statement.run = (...args) => {
    const result = originalRun(...args);
    if (isTursoConfigured && /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) {
      executeOnTurso(sql, args).catch((err) => {
        console.warn('[Turso Background Replicate Error]:', err.message);
      });
    }
    return result;
  };
  return statement;
};

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
  } catch {}
  try {
    db.exec(`ALTER TABLE researchers ADD COLUMN google_scholar_id TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN scholar_url TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN google_scholar_id TEXT`);
  } catch {}

  // Intelligence & Capstone Innovations Migrations
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_tags TEXT`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN sdg_rationale TEXT`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN journal_indexing TEXT`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN is_predatory_flag INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN nbc461_points REAL DEFAULT 0.0`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN ched_priority TEXT`); } catch {}
  try { db.exec(`ALTER TABLE publications ADD COLUMN doi TEXT`); } catch {}

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
      FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );
  `);

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

  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN search_count INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN monthly_usage_usd REAL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN max_monthly_usage_usd REAL DEFAULT 5`); } catch {}
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN cycle_end_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE apify_tokens ADD COLUMN total_runs INTEGER`); } catch {}

  // Verification & Onboarding Migrations
  try { db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN registration_type TEXT DEFAULT 'manual'`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN has_scholar INTEGER DEFAULT 1`); } catch {}

  try { db.exec(`ALTER TABLE researchers ADD COLUMN status TEXT DEFAULT 'active'`); } catch {}
  try { db.exec(`ALTER TABLE researchers ADD COLUMN has_scholar INTEGER DEFAULT 1`); } catch {}

  // Ensure any existing rows have active status
  try {
    db.exec(`UPDATE users SET status = 'active' WHERE status IS NULL`);
    db.exec(`UPDATE researchers SET status = 'active' WHERE status IS NULL`);
  } catch {}

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

  // Seed default admin account ONLY if no admin exists
  const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, name, role, department, is_faculty, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'admin-1',
      'admin',
      'admin@psu.edu.ph',
      'admin',
      'Admin User',
      'admin',
      'Administration',
      0,
      new Date().toISOString()
    );
    console.log('[Database] Default admin user initialized (admin / admin).');
  }
}

// Call on import to guarantee schema existence
initDatabase();

if (isTursoConfigured) {
  initTursoSchema().then(() => {
    rehydrateFromTurso(db);
  }).catch((err) => {
    console.warn('[Turso Startup Error]:', err.message);
  });
}
