# Research Publication Tracking System

React + Vite + Tailwind CSS project with a Node.js + SQLite/Turso backend, deployed on Render and Turso Cloud.

## Development & Production Servers

- **Local Development (`npm.cmd run dev`):** Runs Vite with the embedded `/api/*` backend middleware on `$PORT` (default `8443`).
- **Production (`npm.cmd run build` && `npm.cmd start`):** Builds the frontend to `dist/` and runs `node src/server/prod.mjs` on Render with Turso Cloud SQLite persistence.

## Key Files

- `src/main.tsx` - Browser entry point
- `src/app/routes.tsx` - Frontend route definitions and role-based route guards
- `src/app/components/SystemGuidePage.tsx` - Role-aware step-by-step visual system guide (`/guide`)
- `src/server/apiHandler.mjs` - Unified backend API handler (used in both Vite dev and Render prod)
- `src/server/db.mjs` - Local SQLite initialization, schema migrations, and automatic Turso write/transaction replication
- `src/server/turso.mjs` - Turso Cloud SQLite schema initialization (`initTursoSchema`), cold-start rehydration (`rehydrateFromTurso`), and batch replication
- `src/server/prod.mjs` - Render production HTTP server serving `dist/` and `/api/*`
- `src/server/securityHeaders.mjs` - Shared HTTP security headers (`HSTS`, `CSP`, `X-Frame-Options`, `COOP`, `CORP`, `COEP`, etc.)
- `public/robots.txt` & `public/.well-known/security.txt` - Crawler indexing rules and RFC 9116 security contact metadata
- `Dockerfile` & `render.yaml` - Render cloud deployment configuration (Docker & Node runtime)
- `vite.config.ts` - Vite dev & build configuration

---

## Active Modular Agent Rules (`.agents/rules/`)

All system rules are organized into modular, `always_on` rule files in `.agents/rules/`. Always adhere strictly to them:

1. **[Turso Cloud & Render Deployment](.agents/rules/turso-render.md)**
   - Schema & migration parity between `db.mjs` and `turso.mjs` (`initTursoSchema` and `columnMigrations`).
   - Cold-start rehydration sync in `turso.mjs` and `apiHandler.mjs` (`POST /api/turso/sync`).
   - Database writes via `runInTransaction` / `db.prepare().run()`, waiting on `dbReadyPromise`.
   - Render production compatibility (`npm.cmd run build`) and auto-deploy (`git push origin main`).

2. **[System Terminology & ID Invariants](.agents/rules/terminology.md)**
   - **Researchers** (group) & **Researcher** (individual) across the entire system.
   - Classification badge: **`Faculty (<Department>)`** or **`Non-Faculty`** (on Researchers page & profile only).
   - Instructor ID: **`ASIN-00000`** format with locked non-editable `ASIN-` prefix and 5 editable digits.
   - Research Coordinator: **Sir Rodelio M. Garin** (single badge; "Rodelio M. Garin" without "Sir" in personal profile).
   - Publications: **"Publications"** (published works only, no ongoing/unpublished research).
   - SDG Analytics: **"SDG Alignment"** (tab/feature) and **"SDG Goals"** (individual targets).
   - Proponent Attribution: `"Developed by Julius Oscar Moreno • PSU Asingan Campus"` in public footer.

3. **[UI & UX Design Rules](.agents/rules/ui-design.md)**
   - **No Emojis** anywhere in UI; always use `lucide-react` icons.
   - **No Redundant / Duplicate Action Buttons** on the same page.
   - **System Visual Guide Parity:** Synchronize `SystemGuidePage.tsx` (`/guide`) on every UI change.
   - **Facebook Dark Mode:** `#18191a` background, `#242526` surface, `#3a3b3c` input, `#e4e6eb` text, `#2d88ff` blue.
   - **Pre-Change Breakdown:** Provide clear issue breakdown and file plan before writing code.
   - **Web Security, SEO & Accessibility Audit:** HSTS, CSP, COOP, robots.txt, and WCAG AA contrast.

4. **[Infrastructure & Tooling Rules](.agents/rules/tooling-infrastructure.md)**
   - **100% Free-Tier & Zero-Cost:** Never introduce paid external APIs, vector databases, or LLM tokens.
   - **Windows PowerShell:** Always execute scripts via `npm.cmd` to bypass `npm.ps1` execution policies.
   - **Pre-Task Workspace Skill Evaluation:** Inspect `.agents/skills` on every user prompt.
   - **Zero-Cost Knowledge Graphing:** Maintain `.graphifyignore` and run Graphify in AST-only mode.

5. **[Knowledge Graphing (`graphify`)](.agents/rules/graphify.md)**
   - Consult `graphify-out/graph.json` via `graphify query`, `path`, or `explain`.
   - Run `graphify update .` and `graphify cluster-only . --no-label` after file modifications.

---

## Project Documentation

- [Project Guidelines](guidelines/Guidelines.md) - High-level project specifications and architectural guidelines.
- [Roadmap & Enhancements](docs/roadmap.md) - Future feature ideas, background automations, and zero-cost hosting notes.
