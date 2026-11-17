import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, rawPrepare, dbReadyPromise } from './db.mjs';
import { isTursoConfigured, executeOnTurso } from './turso.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const SCHEDULED_RETENTION_DAYS = 30;

export const BACKUP_TABLES = [
  'users',
  'researchers',
  'publications',
  'publication_researchers',
  'scraped_publications',
  'citation_trends',
  'citing_papers',
  'apify_tokens',
  'invitation_requests',
  'email_logs',
  'ai_chat_sessions',
  'system_settings',
  'archived_researchers',
  'declined_registrations',
];

export const BACKUP_SCHEDULE_INFO = {
  timezone: 'Asia/Manila',
  hour: 0,
  minute: 0,
  label: '12:00 AM Asia/Manila (UTC+8)',
};

export function getManilaDateString(date = new Date()) {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  const y = manila.getUTCFullYear();
  const m = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const d = String(manila.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMsUntilNextManilaMidnight(date = new Date()) {
  const manilaNowMs = date.getTime() + MANILA_OFFSET_MS;
  const manila = new Date(manilaNowMs);
  const nextMidnightManilaUtc = Date.UTC(
    manila.getUTCFullYear(),
    manila.getUTCMonth(),
    manila.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(1000, nextMidnightManilaUtc - manilaNowMs);
}

export function getBackupsDir() {
  const baseDataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
  return path.join(baseDataDir, 'backups');
}

function formatBackupMetadata(row) {
  if (!row) return null;
  let tableCounts = {};
  try {
    tableCounts = JSON.parse(row.table_counts_json || '{}');
  } catch {
    tableCounts = {};
  }
  return {
    id: row.id,
    backupType: row.backup_type,
    manilaDate: row.manila_date,
    filename: row.filename,
    sizeBytes: Number(row.size_bytes) || 0,
    tableCounts,
    createdBy: row.created_by || 'system',
    localPath: row.local_path || null,
    createdAt: row.created_at,
  };
}

async function pruneOldScheduledBackups(nowDate = new Date()) {
  try {
    const cutoffDate = new Date(nowDate.getTime() - SCHEDULED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffManilaDate = getManilaDateString(cutoffDate);
    const oldRows = rawPrepare(`
      SELECT id, local_path FROM db_backups
      WHERE backup_type = 'scheduled' AND manila_date < ?
    `).all(cutoffManilaDate);

    if (oldRows.length === 0) return 0;

    for (const row of oldRows) {
      if (row.local_path) {
        try {
          if (fs.existsSync(row.local_path)) {
            fs.unlinkSync(row.local_path);
          }
        } catch {}
      }
    }

    rawPrepare(`
      DELETE FROM db_backups
      WHERE backup_type = 'scheduled' AND manila_date < ?
    `).run(cutoffManilaDate);

    if (isTursoConfigured) {
      await executeOnTurso(
        `DELETE FROM db_backups WHERE backup_type = 'scheduled' AND manila_date < ?`,
        [cutoffManilaDate]
      );
    }

    return oldRows.length;
  } catch (err) {
    console.warn('[BackupService] Retention pruning warning:', err.message);
    return 0;
  }
}

export async function createDatabaseBackup({ backupType = 'manual', createdBy = 'system', date = new Date() } = {}) {
  await dbReadyPromise;

  const normalizedType = backupType === 'scheduled' ? 'scheduled' : 'manual';
  const manilaDate = getManilaDateString(date);

  if (normalizedType === 'scheduled') {
    const existing = rawPrepare(`
      SELECT id, backup_type, manila_date, filename, size_bytes, table_counts_json, created_by, local_path, created_at
      FROM db_backups
      WHERE backup_type = 'scheduled' AND manila_date = ?
      LIMIT 1
    `).get(manilaDate);
    if (existing) {
      return {
        alreadyExists: true,
        backup: formatBackupMetadata(existing),
      };
    }
  }

  const tables = {};
  const tableCounts = {};
  for (const table of BACKUP_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      tables[table] = rows;
      tableCounts[table] = rows.length;
    } catch {
      tables[table] = [];
      tableCounts[table] = 0;
    }
  }

  const createdAt = date.toISOString();
  const safeStamp = createdAt.replace(/[:.]/g, '-');
  const id = `bak-${normalizedType}-${manilaDate}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const filename = `respub-backup-${normalizedType}-${manilaDate}-${safeStamp}.json`;

  const snapshot = {
    version: 1,
    backupType: normalizedType,
    manilaDate,
    createdBy,
    createdAt,
    tableCounts,
    tables,
  };

  const snapshotJson = JSON.stringify(snapshot, null, 2);
  const sizeBytes = Buffer.byteLength(snapshotJson, 'utf8');
  const tableCountsJson = JSON.stringify(tableCounts);

  let localPath = null;
  try {
    const backupsDir = getBackupsDir();
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const targetPath = path.join(backupsDir, filename);
    fs.writeFileSync(targetPath, snapshotJson, 'utf8');
    localPath = targetPath;
  } catch (fsErr) {
    console.warn('[BackupService] Local backup file write skipped:', fsErr.message);
  }

  const insertSql = `
    INSERT INTO db_backups (
      id, backup_type, manila_date, filename, size_bytes, table_counts_json, snapshot_json, created_by, local_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const insertArgs = [
    id,
    normalizedType,
    manilaDate,
    filename,
    sizeBytes,
    tableCountsJson,
    snapshotJson,
    createdBy,
    localPath,
    createdAt,
  ];

  rawPrepare(insertSql).run(...insertArgs);

  if (isTursoConfigured) {
    await executeOnTurso(insertSql, insertArgs);
  }

  if (normalizedType === 'scheduled') {
    await pruneOldScheduledBackups(date);
  }

  return {
    alreadyExists: false,
    backup: {
      id,
      backupType: normalizedType,
      manilaDate,
      filename,
      sizeBytes,
      tableCounts,
      createdBy,
      localPath,
      createdAt,
    },
  };
}

export function listDatabaseBackups(limit = 50) {
  const rows = rawPrepare(`
    SELECT id, backup_type, manila_date, filename, size_bytes, table_counts_json, created_by, local_path, created_at
    FROM db_backups
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  return rows.map(formatBackupMetadata);
}

export function getDatabaseBackupById(id) {
  if (!id) return null;
  const row = rawPrepare(`
    SELECT id, backup_type, manila_date, filename, size_bytes, table_counts_json, snapshot_json, created_by, local_path, created_at
    FROM db_backups
    WHERE id = ?
    LIMIT 1
  `).get(id);
  if (!row) return null;
  return {
    ...formatBackupMetadata(row),
    snapshotJson: row.snapshot_json,
  };
}

export function startDailyBackupScheduler() {
  if (globalThis.__respubBackupSchedulerStarted) return;
  globalThis.__respubBackupSchedulerStarted = true;

  const scheduleNextRun = () => {
    const delayMs = getMsUntilNextManilaMidnight() + 50;
    const timer = setTimeout(async () => {
      try {
        const res = await createDatabaseBackup({ backupType: 'scheduled', createdBy: 'scheduler' });
        if (!res.alreadyExists) {
          console.log(`[BackupScheduler] Daily 12:00 AM Asia/Manila backup created: ${res.backup.filename}`);
        }
      } catch (err) {
        console.warn('[BackupScheduler] Scheduled backup failed:', err.message);
      } finally {
        scheduleNextRun();
      }
    }, delayMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  };

  // Startup catch-up for missed midnight backups (e.g., Render free-tier sleep)
  Promise.resolve()
    .then(() => dbReadyPromise)
    .then(() => createDatabaseBackup({ backupType: 'scheduled', createdBy: 'scheduler' }))
    .then((res) => {
      if (!res.alreadyExists) {
        console.log(`[BackupScheduler] Startup Asia/Manila catch-up backup created: ${res.backup.filename}`);
      }
    })
    .catch((err) => {
      console.warn('[BackupScheduler] Startup catch-up warning:', err.message);
    })
    .finally(() => {
      scheduleNextRun();
    });
}
