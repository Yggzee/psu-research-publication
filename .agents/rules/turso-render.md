---
trigger: always_on
description: Mandatory Turso Cloud and Render deployment synchronization rules.
---

# Turso Cloud & Render Deployment Rules

Whenever you add a new feature, modify backend logic, or change the database schema, you **MUST** keep **Turso (`src/server/turso.mjs`)** and **Render (`src/server/prod.mjs` / `render.yaml`)** updated in lockstep to prevent data loss or production bugs:

## 1. Database Schema & Column Sync (`db.mjs` + `turso.mjs`)
- Every time you add a new table or column in `src/server/db.mjs`, you **MUST** also add:
  - The updated `CREATE TABLE IF NOT EXISTS` definition in `initTursoSchema()` inside `src/server/turso.mjs`.
  - An idempotent `ALTER TABLE <table_name> ADD COLUMN <col_def>` entry in `columnMigrations` inside `src/server/turso.mjs` so existing Turso Cloud tables migrate automatically on startup.

## 2. Cold-Start Rehydration Sync (`turso.mjs` + `apiHandler.mjs`)
- Every time you create a new table, you **MUST** add its name to the `tables` array in both:
  - `rehydrateFromTurso()` in `src/server/turso.mjs` (so Render restores the table when waking from free-tier sleep).
  - `POST /api/turso/sync` in `src/server/apiHandler.mjs`.

## 3. Write & Transaction Replication
- Always execute database writes (`INSERT`, `UPDATE`, `DELETE`, `REPLACE`) using `db.prepare(...).run(...)` or inside `runInTransaction(...)` from `src/server/db.mjs` (never raw `db.exec()` for data writes) so changes replicate automatically to Turso Cloud.
- Any startup database job or incoming API request must wait for `await dbReadyPromise` from `src/server/db.mjs` so Render cold-starts never race with Turso rehydration.

## 4. Render Production Compatibility & Manual Git Deployment (`prod.mjs` + `render.yaml`)
- Ensure any new packages, environment variables, or routes work cleanly with `npm.cmd run build` and `node src/server/prod.mjs` (update `render.yaml` if new environment variable keys are introduced).
- **Manual Git Operations Only:** Never execute `git add`, `git commit`, or `git push` automatically. Git commits and pushes must strictly be executed manually by the user or when the user explicitly instructs you to do so.

