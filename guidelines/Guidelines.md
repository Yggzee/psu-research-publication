# Project Guidelines — PSU Research Publication Tracking System

## 1. Mandatory Turso Cloud & Render Deployment Synchronization
Every feature addition, bug fix, or database change must work seamlessly not only on local SQLite (`data/research.db`) but also on the deployed **Render + Turso Cloud** production environment:

- **Schema Parity (`src/server/db.mjs` & `src/server/turso.mjs`):**
  - Never add a table or column to `src/server/db.mjs` without adding the exact same table/column definition and `ALTER TABLE ... ADD COLUMN` migration to `initTursoSchema()` in `src/server/turso.mjs`.
- **Rehydration Parity:**
  - Every new table must be added to the `tables` list in `rehydrateFromTurso()` (`src/server/turso.mjs`) and `/api/turso/sync` (`src/server/apiHandler.mjs`) so Render free-tier sleep cycles never lose data.
- **Cold-Start Safety:**
  - Startup scripts (such as orphan cleanup or deduplication) and API handlers must wait for `dbReadyPromise` (`src/server/db.mjs`) to resolve before reading/modifying the database.
- **Render Production Build & Push:**
  - Verify changes with `node --check` and `npm run build`, update `render.yaml` / `src/server/prod.mjs` if needed, and push commits to `origin/main` so Render auto-deploys.

## 2. UI & Design Guidelines
- **No Emojis:** Never use emojis in any component, alert, badge, or button. Always use icons from `lucide-react`.
- **Responsive & Structured Layouts:** Use Tailwind CSS flexbox and grid layouts aligned with the existing PSU institutional theme.
