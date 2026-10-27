import { db } from './db.mjs';
import { classifyPublicationSDG, auditJournalReputation } from './aiService.mjs';

async function batchTagAllPublications() {
  console.log('[Batch Tagging] Starting UN SDG & Journal Indexing classification for all database publications...');
  const publications = db.prepare('SELECT id, title, abstract, journal FROM publications').all();
  console.log(`[Batch Tagging] Found ${publications.length} publications in repository.`);

  const updateStmt = db.prepare(`
    UPDATE publications
    SET sdg_tags = ?,
        sdg_rationale = ?,
        ched_priority = ?,
        journal_indexing = ?,
        nbc461_points = ?,
        is_predatory_flag = ?
    WHERE id = ?
  `);

  let count = 0;
  for (const pub of publications) {
    count++;
    console.log(`[Batch Tagging] (${count}/${publications.length}) Processing: "${pub.title.slice(0, 60)}..."`);
    try {
      const sdg = await classifyPublicationSDG(pub.title, pub.abstract || '', pub.journal || '');
      const audit = auditJournalReputation(pub.journal || '');
      const sdgTagsJson = JSON.stringify([sdg.primarySDG, sdg.secondarySDG].filter(Boolean));

      updateStmt.run(
        sdgTagsJson,
        sdg.rationale,
        sdg.chedPriority,
        audit.indexing,
        audit.nbc461Points,
        audit.isPredatory,
        pub.id
      );
      console.log(`  -> Primary: ${sdg.primarySDG} | Source: ${sdg.source}`);
    } catch (err) {
      console.error(`  -> Failed for ${pub.id}:`, err.message);
    }
  }

  console.log('[Batch Tagging] Complete! All publications have been classified and saved into SQLite.');
}

batchTagAllPublications().catch(console.error);
