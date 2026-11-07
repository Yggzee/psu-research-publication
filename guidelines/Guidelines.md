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

## 2. Mandatory System Terminology & ID Rules
- **Researchers & Researcher:** Always call the collection **"Researchers"** (never "Roster" or "Faculty Roster") and each individual **"Researcher"**.
- **Faculty vs. Non-Faculty Scope:** Only show the Faculty/Non-Faculty mark on `ResearchersPage.tsx` and `ResearcherProfile.tsx` formatted as **`Faculty (<Department>)`** (e.g., `Faculty (BSIT)`) or **`Non-Faculty`**. Everywhere else in the system, call them **Researcher / Researchers**.
- **Instructor ID (`ASIN-00000`):** Always call the ID **"Instructor ID"**. Both Faculty and Non-Faculty use the `ASIN-00000` format, with **`ASIN-`** locked/non-editable and only the **5 numeric digits (`00000`)** editable in invitation channels.
- **Research Coordinator:** Always call Sir Rodelio M. Garin **"Research Coordinator"** with a single clean role badge (no duplicate/conflicting administrator titles).
- **Publications:** Always call indexed/retrieved works **"Publications"**, with **"My Publications"**, **"My Published Research"**, and **"Add Publication"** on the researcher's page (no ongoing/unpublished research option).

## 3. UI & Design Guidelines
- **No Emojis:** Never use emojis in any component, alert, badge, or button. Always use icons from `lucide-react`.
- **No Redundant Action Buttons:** Never place two or more buttons on the same page that perform the exact same action or navigate to the exact same page (e.g., duplicate "Back to Public Search" buttons). Keep strictly one button per distinct action.
- **Proactive Rule Capture:** Whenever the user introduces a new rule or a preference that looks like a project-wide rule, always ask if it should be added to `AGENTS.md`.
- **Responsive & Structured Layouts:** Use Tailwind CSS flexbox and grid layouts aligned with the existing PSU institutional theme.
