import { createClient } from '@libsql/client';

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
 * Initialize remote Turso database tables if they do not exist
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
      role TEXT NOT NULL DEFAULT 'instructor',
      department TEXT,
      is_faculty INTEGER NOT NULL DEFAULT 1,
      photo_url TEXT,
      scholar_url TEXT,
      google_scholar_id TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS researchers (
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
      scholar_url TEXT,
      google_scholar_id TEXT,
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
      link TEXT
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
    );`
  ];

  for (const sql of tableSchemas) {
    try {
      await tursoClient.execute(sql);
    } catch (err) {
      console.warn('[Turso Schema Warning]:', err.message);
    }
  }
  console.log('[Turso] Cloud schema initialized.');
}

/**
 * Rehydrate local SQLite database from Turso Cloud on container boot.
 * This guarantees Render containers waking from sleep never lose a single record!
 */
export async function rehydrateFromTurso(localDb) {
  if (!tursoClient) return;

  try {
    console.log('[Turso Sync] Syncing latest records from Turso Cloud into local database...');

    const tables = [
      'users',
      'researchers',
      'publications',
      'scraped_publications',
      'citation_trends',
      'citing_papers',
      'apify_tokens'
    ];

    let totalRestored = 0;

    for (const table of tables) {
      try {
        const result = await tursoClient.execute(`SELECT * FROM ${table}`);
        if (result.rows && result.rows.length > 0) {
          const columns = result.columns;
          const placeholders = columns.map(() => '?').join(', ');
          const colNames = columns.join(', ');
          const insertStmt = localDb.prepare(`INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`);

          for (const row of result.rows) {
            const values = columns.map(c => row[c]);
            insertStmt.run(...values);
            totalRestored++;
          }
        }
      } catch (err) {
        console.warn(`[Turso Sync] Error syncing table ${table}:`, err.message);
      }
    }

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

    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => row[k]);

      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${placeholders})`,
        args: values,
      });
    }
  } catch (err) {
    console.warn(`[Turso Push] Error pushing ${tableName}:`, err.message);
  }
}
