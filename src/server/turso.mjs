import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before reading TURSO_DATABASE_URL
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {
    // ignore if already loaded
  }
}

const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || '';

export const isTursoConfigured = Boolean(TURSO_URL && TURSO_TOKEN);

let tursoClient = null;

if (isTursoConfigured) {
  try {
    tursoClient = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
    console.log('[Turso] Initialized Turso Cloud SQLite client for:', TURSO_URL.replace(/:\/\/[^@]+@/, '://***@'));
  } catch (err) {
    console.warn('[Turso] Failed to initialize Turso client:', err.message);
  }
} else {
  console.log('[Turso] TURSO_DATABASE_URL not set. Running with local SQLite storage.');
}

export function getTursoClient() {
  return tursoClient;
}

/**
 * Execute a query or write on Turso Cloud asynchronously
 */
export async function executeOnTurso(sql, args = []) {
  if (!tursoClient) return null;
  try {
    const res = await tursoClient.execute({ sql, args });
    return res;
  } catch (err) {
    console.warn('[Turso Cloud Write Warning]:', err.message, '| SQL:', sql.slice(0, 60));
    return null;
  }
}

/**
 * Execute a batch of write statements on Turso Cloud in a single round-trip
 */
export async function executeBatchOnTurso(statements = []) {
  if (!tursoClient || !statements.length) return null;
  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      await tursoClient.batch(chunk, 'write');
    }
    return true;
  } catch (err) {
    console.warn('[Turso Cloud Batch Write Warning]:', err.message);
    return null;
  }
}

/**
 * Initialize remote Turso database tables and column migrations if they do not exist
 */
export async function initTursoSchema() {
  if (!tursoClient) return;

  console.log('[Turso] Verifying cloud database schema...');
  const tableSchemas = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      middle_initial TEXT,
      role TEXT NOT NULL DEFAULT 'instructor',
      department TEXT,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      photo_url TEXT,
      scholar_url TEXT,
      google_scholar_id TEXT,
      status TEXT DEFAULT 'active',
      verification_token TEXT,
      verification_token_expires_at TEXT,
      email_verified_at TEXT,
      registration_type TEXT DEFAULT 'manual',
      has_scholar INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS researchers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      instructor_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_initial TEXT,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT NOT NULL,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      affiliation TEXT DEFAULT 'Pangasinan State University - Asingan Campus',
      photo_url TEXT,
      scholar_url TEXT,
      google_scholar_id TEXT,
      status TEXT DEFAULT 'active',
      has_scholar INTEGER DEFAULT 1,
      total_publications INTEGER DEFAULT 0,
      total_citations INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      journal TEXT,
      year INTEGER NOT NULL,
      citations INTEGER DEFAULT 0,
      abstract TEXT,
      url TEXT,
      impact_score REAL DEFAULT 0.0,
      owner_id TEXT,
      owner_name TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      approval_status TEXT NOT NULL DEFAULT 'approved',
      research_status TEXT NOT NULL DEFAULT 'Published',
      is_public INTEGER NOT NULL DEFAULT 1,
      file_name TEXT,
      cited_by_link TEXT,
      sdg_tags TEXT,
      sdg_rationale TEXT,
      journal_indexing TEXT,
      is_predatory_flag INTEGER DEFAULT 0,
      nbc461_points REAL DEFAULT 0.0,
      jc3_points REAL DEFAULT 0.0,
      ched_priority TEXT,
      doi TEXT,
      keywords TEXT,
      issn_isbn TEXT,
      volume_issue TEXT,
      publication_date TEXT,
      publication_level TEXT DEFAULT 'International',
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS scraped_publications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      journal TEXT,
      year INTEGER,
      citations INTEGER DEFAULT 0,
      abstract TEXT,
      url TEXT,
      cited_by_link TEXT,
      search_query TEXT,
      scraped_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS citation_trends (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      citations INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS citing_papers (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT,
      year INTEGER,
      link TEXT,
      journal TEXT,
      volume_issue TEXT,
      quarter TEXT,
      doi_issn TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS apify_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token TEXT NOT NULL,
      actor_id TEXT NOT NULL DEFAULT 'johnvc~google-scholar-api',
      is_active INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'untested',
      username TEXT,
      plan TEXT,
      search_count INTEGER DEFAULT 0,
      monthly_usage_usd REAL DEFAULT 0,
      max_monthly_usage_usd REAL DEFAULT 5,
      cycle_end_at TEXT,
      total_runs INTEGER,
      created_at TEXT NOT NULL,
      last_tested_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS invitation_requests (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_initial TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      instructor_id TEXT NOT NULL,
      department TEXT DEFAULT 'BSIT',
      scholar_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS email_logs (
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
    );`,
    `CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`
  ];

  for (const sql of tableSchemas) {
    try {
      await tursoClient.execute(sql);
    } catch (err) {
      console.warn('[Turso Schema Warning]:', err.message);
    }
  }

  // Run idempotent column migrations on Turso for pre-existing tables
  const columnMigrations = [
    `ALTER TABLE users ADD COLUMN middle_initial TEXT`,
    `ALTER TABLE users ADD COLUMN scholar_url TEXT`,
    `ALTER TABLE users ADD COLUMN google_scholar_id TEXT`,
    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`,
    `ALTER TABLE users ADD COLUMN verification_token TEXT`,
    `ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT`,
    `ALTER TABLE users ADD COLUMN email_verified_at TEXT`,
    `ALTER TABLE users ADD COLUMN registration_type TEXT DEFAULT 'manual'`,
    `ALTER TABLE users ADD COLUMN has_scholar INTEGER DEFAULT 1`,
    `ALTER TABLE researchers ADD COLUMN middle_initial TEXT`,
    `ALTER TABLE researchers ADD COLUMN scholar_url TEXT`,
    `ALTER TABLE researchers ADD COLUMN google_scholar_id TEXT`,
    `ALTER TABLE researchers ADD COLUMN status TEXT DEFAULT 'active'`,
    `ALTER TABLE researchers ADD COLUMN has_scholar INTEGER DEFAULT 1`,
    `ALTER TABLE publications ADD COLUMN cited_by_link TEXT`,
    `ALTER TABLE publications ADD COLUMN sdg_tags TEXT`,
    `ALTER TABLE publications ADD COLUMN sdg_rationale TEXT`,
    `ALTER TABLE publications ADD COLUMN journal_indexing TEXT`,
    `ALTER TABLE publications ADD COLUMN is_predatory_flag INTEGER DEFAULT 0`,
    `ALTER TABLE publications ADD COLUMN nbc461_points REAL DEFAULT 0.0`,
    `ALTER TABLE publications ADD COLUMN jc3_points REAL DEFAULT 0.0`,
    `ALTER TABLE publications ADD COLUMN ched_priority TEXT`,
    `ALTER TABLE publications ADD COLUMN doi TEXT`,
    `ALTER TABLE publications ADD COLUMN keywords TEXT`,
    `ALTER TABLE publications ADD COLUMN issn_isbn TEXT`,
    `ALTER TABLE publications ADD COLUMN volume_issue TEXT`,
    `ALTER TABLE publications ADD COLUMN publication_date TEXT`,
    `ALTER TABLE publications ADD COLUMN publication_level TEXT DEFAULT 'International'`,
    `ALTER TABLE citing_papers ADD COLUMN journal TEXT`,
    `ALTER TABLE citing_papers ADD COLUMN volume_issue TEXT`,
    `ALTER TABLE citing_papers ADD COLUMN quarter TEXT`,
    `ALTER TABLE citing_papers ADD COLUMN doi_issn TEXT`,
  ];

  for (const migrationSql of columnMigrations) {
    try {
      await tursoClient.execute(migrationSql);
    } catch {
      // Column already exists on Turso — ignore
    }
  }

  console.log('[Turso] Cloud schema initialized.');
}

/**
 * Rehydrate local SQLite database from Turso Cloud on container boot.
 * This guarantees Render containers waking from sleep never lose a single record!
 */
export async function rehydrateFromTurso(localDb, rawPrepare = null) {
  if (!tursoClient) return;

  const prepareFn = rawPrepare || localDb.prepare.bind(localDb);

  try {
    console.log('[Turso Sync] Syncing latest records from Turso Cloud into local database...');

    const tables = [
      'users',
      'researchers',
      'publications',
      'scraped_publications',
      'citation_trends',
      'citing_papers',
      'apify_tokens',
      'invitation_requests',
      'email_logs',
      'ai_chat_sessions',
      'system_settings'
    ];

    // Check if Turso Cloud is brand-new (0 users in cloud, while local DB has seed data)
    let tursoUserCount = 0;
    try {
      const userCheck = await tursoClient.execute('SELECT COUNT(*) as c FROM users');
      tursoUserCount = Number(userCheck.rows?.[0]?.c || 0);
    } catch {}

    if (tursoUserCount === 0) {
      console.log('[Turso Sync] Turso Cloud is empty — pushing initial seed tables to Turso Cloud...');
      for (const table of tables) {
        await pushTableToTurso(localDb, table);
      }
      console.log('[Turso Sync] Initial seed push to Turso Cloud complete!');
      return;
    }

    let totalRestored = 0;

    // Temporarily disable foreign key enforcement during bulk table replacement
    try { localDb.exec('PRAGMA foreign_keys = OFF;'); } catch {}

    for (const table of tables) {
      try {
        const result = await tursoClient.execute(`SELECT * FROM ${table}`);
        if (result.rows) {
          localDb.exec('BEGIN IMMEDIATE;');
          try {
            // If Turso has rows for core tables (or even 0 rows for dynamic tables like invitation_requests),
            // clear stale git-baked local rows so deletions on Render also persist across restarts.
            if (result.rows.length > 0 || ['invitation_requests', 'email_logs', 'ai_chat_sessions'].includes(table)) {
              prepareFn(`DELETE FROM ${table}`).run();
            }

            if (result.rows.length > 0) {
              const localColsInfo = prepareFn(`PRAGMA table_info(${table})`).all();
              const validLocalCols = new Set(localColsInfo.map(col => col.name));
              const columns = result.columns.filter(c => validLocalCols.has(c));

              if (columns.length > 0) {
                const placeholders = columns.map(() => '?').join(', ');
                const colNames = columns.join(', ');
                const insertStmt = prepareFn(`INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`);

                for (const row of result.rows) {
                  const values = columns.map(c => row[c]);
                  insertStmt.run(...values);
                  totalRestored++;
                }
              }
            }
            localDb.exec('COMMIT;');
          } catch (txErr) {
            try { localDb.exec('ROLLBACK;'); } catch {}
            throw txErr;
          }
        }
      } catch (err) {
        console.warn(`[Turso Sync] Error syncing table ${table}:`, err.message);
      }
    }

    try { localDb.exec('PRAGMA foreign_keys = ON;'); } catch {}

    console.log(`[Turso Sync] Successfully rehydrated ${totalRestored} records from Turso Cloud!`);
  } catch (err) {
    console.warn('[Turso Sync] Rehydration encountered error:', err.message);
  }
}

/**
 * Replicate an entire local table to Turso Cloud (used for initial seed or backup)
 */
export async function pushTableToTurso(localDb, tableName) {
  if (!tursoClient) return;
  try {
    const rows = localDb.prepare(`SELECT * FROM ${tableName}`).all();
    if (rows.length === 0) return;

    const statements = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => row[k]);

      statements.push({
        sql: `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${placeholders})`,
        args: values,
      });
    }
    await executeBatchOnTurso(statements);
  } catch (err) {
    console.warn(`[Turso Push] Error pushing ${tableName}:`, err.message);
  }
}
