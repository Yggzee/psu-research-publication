import { db } from './db.mjs';

export function normalizeTitle(t) {
  if (!t) return '';
  return t
    .replace(/^\[(pdf|html|c|b|citation|doc|book)\]\s*/i, '')
    .replace(/[’‘]/g, "'")
    .replace(/["“”]/g, '')
    .replace(/[…\.]+/g, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function deduplicateDatabase() {
  const all = db.prepare('SELECT id, title, citations, abstract FROM publications').all();
  const map = new Map();
  const toDelete = [];

  for (const p of all) {
    const norm = normalizeTitle(p.title);
    if (!norm) continue;
    if (map.has(norm)) {
      const existing = map.get(norm);
      if ((p.citations > existing.citations) || (p.abstract && p.abstract.length > (existing.abstract || '').length)) {
        toDelete.push(existing.id);
        map.set(norm, p);
      } else {
        toDelete.push(p.id);
      }
    } else {
      map.set(norm, p);
    }
  }

  if (toDelete.length > 0) {
    console.log(`[Deduplication] Removing ${toDelete.length} duplicate publication records...`);
    const delPub = db.prepare('DELETE FROM publications WHERE id = ?');
    const delCiting = db.prepare('DELETE FROM citing_papers WHERE publication_id = ?');
    const delTrends = db.prepare('DELETE FROM citation_trends WHERE publication_id = ?');

    toDelete.forEach((id) => {
      delPub.run(id);
      delCiting.run(id);
      delTrends.run(id);
    });
  }

  const uniqueCount = db.prepare('SELECT COUNT(*) as c FROM publications').get().c;
  console.log(`[Deduplication] Retained ${uniqueCount} unique publications.`);
  return { removed: toDelete.length, uniqueCount };
}

// Run if called directly
deduplicateDatabase();
