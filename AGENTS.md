# Research Publication Tracking System

React + Vite + Tailwind CSS project with a Node.js + SQLite/Turso backend, deployed on Render and Turso Cloud.

## Development Server

A Vite development server is always running on `$PORT` (default 8443). Source changes
are reflected through hot reload.

## Key Files

- `src/main.tsx` - Browser entry point
- `src/server/apiHandler.mjs` - Unified backend API handler (used in both Vite dev and Render prod)
- `src/server/db.mjs` - Local SQLite initialization, schema migrations, and automatic Turso write/transaction replication
- `src/server/turso.mjs` - Turso Cloud SQLite schema initialization (`initTursoSchema`), cold-start rehydration (`rehydrateFromTurso`), and batch replication
- `src/server/prod.mjs` - Render production HTTP server serving `dist/` and `/api/*`
- `render.yaml` - Render cloud deployment configuration
- `vite.figma.config.ts` - Figma Make wrapper configuration
- `.mise.toml` - Toolchain versions

## Mandatory Turso Cloud & Render Deployment Rules

Whenever you add a new feature, modify backend logic, or change the database schema, you **MUST** keep **Turso (`src/server/turso.mjs`)** and **Render (`src/server/prod.mjs` / `render.yaml`)** updated in lockstep to prevent data loss or production bugs:

1. **Database Schema & Column Sync (`db.mjs` + `turso.mjs`):**
   - Every time you add a new table or column in `src/server/db.mjs`, you **MUST** also add:
     - The updated `CREATE TABLE IF NOT EXISTS` definition in `initTursoSchema()` inside `src/server/turso.mjs`.
     - An idempotent `ALTER TABLE <table_name> ADD COLUMN <col_def>` entry in `columnMigrations` inside `src/server/turso.mjs` so existing Turso Cloud tables migrate automatically on startup.
2. **Cold-Start Rehydration Sync (`turso.mjs` + `apiHandler.mjs`):**
   - Every time you create a new table, you **MUST** add its name to the `tables` array in both:
     - `rehydrateFromTurso()` in `src/server/turso.mjs` (so Render restores the table when waking from free-tier sleep).
     - `POST /api/turso/sync` in `src/server/apiHandler.mjs`.
3. **Write & Transaction Replication:**
   - Always execute database writes (`INSERT`, `UPDATE`, `DELETE`, `REPLACE`) using `db.prepare(...).run(...)` or inside `runInTransaction(...)` from `src/server/db.mjs` (never raw `db.exec()` for data writes) so changes replicate automatically to Turso Cloud.
   - Any startup database job or incoming API request must wait for `await dbReadyPromise` from `src/server/db.mjs` so Render cold-starts never race with Turso rehydration.
4. **Render Production Compatibility & Auto-Deploy (`prod.mjs` + `render.yaml`):**
   - Ensure any new packages, environment variables, or routes work cleanly with `npm run build` and `node src/server/prod.mjs` (update `render.yaml` if new environment variable keys are introduced).
   - After verifying changes locally (`node --check` / `npm run build`), always commit and `git push origin main` so the deployed Render server stays updated automatically.
5. **No Emojis in UI:**
   - Do not use emojis anywhere in the application UI; always use `lucide-react` icons.

## Project Guidelines

Read and always follow the instructions in the [project guidelines](guidelines/Guidelines.md) unless the user requests otherwise.
