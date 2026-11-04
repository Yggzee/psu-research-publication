import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/research.db');

// Update PSU-002 (Sir Rodelio Garin) to admin role
db.prepare(`
  UPDATE users 
  SET role = 'admin', 
      name = 'Sir Rodelio M. Garin',
      photo_url = 'https://scholar.google.com/citations/images/avatar_scholar_128.png',
      scholar_url = 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
      google_scholar_id = 'x6PdtN8AAAAJ'
  WHERE username = 'PSU-002' OR email = 'rodeliogarin@gmail.com'
`).run();

// Also update admin-1 to Sir Rodelio M. Garin
db.prepare(`
  UPDATE users 
  SET name = 'Sir Rodelio M. Garin', 
      department = 'Campus Research Unit / BSIT',
      photo_url = 'https://scholar.google.com/citations/images/avatar_scholar_128.png',
      scholar_url = 'https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en',
      google_scholar_id = 'x6PdtN8AAAAJ'
  WHERE username = 'admin'
`).run();

// Verify
const users = db.prepare('SELECT id, username, email, name, role, department FROM users').all();
console.log('Updated users:', users);
