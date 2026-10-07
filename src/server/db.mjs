import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists in project root
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'research.db');
export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

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
      search_query TEXT,
      scraped_at TEXT NOT NULL
    );
  `);

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
