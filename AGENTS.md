# Research Publication Tracking System

React + Vite + Tailwind CSS project with a Node.js + SQLite/Turso backend, deployed on Render and Turso Cloud.

## Development & Production Servers

- **Local Development (`npm run dev`):** Runs Vite with the embedded `/api/*` backend middleware on `$PORT` (default `8443`).
- **Production (`npm run build` && `npm start`):** Builds the frontend to `dist/` and runs `node src/server/prod.mjs` on Render with Turso Cloud SQLite persistence.

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

## Mandatory System Terminology & ID Rules

Always enforce the following standardized terminology and formatting across all pages, components, modals, and notifications:

1. **Collection of Researchers:**
   - Always refer to the list or group of people as **"Researchers"** (never use "Roster", "Faculty Roster", "Institutional Faculty Roster", or "Faculty Researchers").
2. **Individual Person ("Researcher"):**
   - Always refer to each person as **"Researcher"** (singular) or **"Researchers"** (plural) across the entire system.
3. **Faculty vs. Non-Faculty Mark (Researchers Page & Profile Only):**
   - Outside of the Researchers page (`src/app/components/ResearchersPage.tsx`), Researcher Profile (`src/app/components/ResearcherProfile.tsx`), and the classification selector when inviting a researcher, never label or separate users as "Faculty", "Teaching Instructors", or "Non-Teaching Staff" — always call them **Researcher / Researchers**.
   - On the Researchers page and Researcher Profile only, display their classification badge as:
     - **`Faculty (<Department>)`** (e.g., `Faculty (BSIT)`, `Faculty (BSBA)`) for faculty researchers.
     - **`Non-Faculty`** for non-faculty researchers.
4. **Instructor ID (`ASIN-00000` Format):**
   - Always call their identifier **"Instructor ID"** (never "Employee ID" or "Instructor / Employee ID").
   - Both Faculty and Non-Faculty use the exact same format: **`ASIN-00000`** (`ASIN-` prefix followed by 5 digits).
   - In all invitation channels (**"Ask for Invitation"** modal on `LoginScreen.tsx` and **"Invite Researcher"** form in `AdminPage.tsx`), the **`ASIN-`** prefix must be locked/non-editable and only the **5 numeric digits (`00000`)** are editable.
5. **Research Coordinator (Sir Rodelio M. Garin):**
   - Always refer to Sir Rodelio M. Garin's role as **"Research Coordinator"** (never "Campus Research Administrator", "Research Administrator", "Campus Research Coordinator", or "System Administrator").
   - Avoid displaying multiple or redundant title badges next to his name; show at most a single **"Research Coordinator"** badge.
6. **Publications (Published Works Only):**
   - Refer to all retrieved and indexed scholarly works as **"Publications"** (never "Papers" or "Scholarly Works").
   - On the researcher's publications page (`InstructorPublicationsPage.tsx`), use **"My Publications"** (page header), **"My Published Research"** (Tab 1), **"Institutional Repository"** (Tab 2), and **"Add Publication"** (action button/modal). Do not include an option to add ongoing/in-progress unpublished research.

## Mandatory UI & Workflow Rules

1. **No Redundant / Duplicate Action Buttons:**
   - Never place multiple buttons or links on the same page that perform the exact same action or navigate to the exact same destination (for example, having multiple "Back to Public Search", "Return to Dashboard", or duplicate pagination/help buttons on a single screen). Each distinct action or navigation target must have only **one** button on the page.
2. **Keep the System Visual Guide (`SystemGuidePage.tsx`) Synchronized:**
   - Whenever you add, rename, or modify a page, button, badge, or workflow in the workspace, you **MUST** also update `src/app/components/SystemGuidePage.tsx` (`/guide`) so its visual button replicas, simulated charts, and plain-language narrative explanations always match the live workspace.
3. **Proactive `AGENTS.md` Rule Confirmation:**
   - Every time we come up with a new rule, or the user states a requirement or preference that looks like a system-wide rule, **always ask the user if that rule should be added to `AGENTS.md`**.
4. **Facebook-Style Dark Mode Readability (`src/styles/theme.css`):**
   - Always maintain the Facebook Dark Mode surface and text hierarchy (`#18191a` page background, `#242526` elevated cards/sidebar, `#3a3b3c` inputs/muted surfaces, `#3e4042` borders, `#e4e6eb` primary text, `#b0b3b8` secondary text, and `#2d88ff` accent blue) so dark mode is never pitch-black or hard to read.
5. **Pre-Change Breakdown & Plan Explanation Before Working:**
   - Before working on any bug fix, error, or feature request, **always provide a clear breakdown of the error/issue and explain what files and logic will be changed** before making edits.
6. **Mandatory Security, SEO & Accessibility Audit on Major Changes / New Features:**
   - Whenever making major changes or adding a new feature to the system, **always verify all web security, SEO, and accessibility protections**:
     - **HTTP Security Headers (`src/server/securityHeaders.mjs`):** Verify `Strict-Transport-Security` (HSTS), `Content-Security-Policy` (CSP with `upgrade-insecure-requests` and `frame-ancestors 'self'`), `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` (COOP), `Cross-Origin-Resource-Policy` (CORP), and `Cross-Origin-Embedder-Policy` (COEP) are applied on all responses and compatible with any new assets or endpoints.
     - **Crawler & Security Policies (`public/robots.txt`, `public/.well-known/security.txt`, `src/server/prod.mjs`):** Verify `/robots.txt` and `/.well-known/security.txt` resolve as `text/plain; charset=UTF-8` and missing non-HTML extensions return `404` instead of `index.html`.
     - **SEO & Social Metadata (`index.html`):** Ensure meta description, OpenGraph (`og:*`), Twitter Card, and canonical tags remain intact.
     - **WCAG AA Color Contrast:** Ensure all text elements maintain at least a `4.5:1` contrast ratio in both Light Mode and Dark Mode.
7. **Mandatory 100% Free-Tier & Zero-Cost Infrastructure:**
   - The entire system (development, runtime, deployment, search, and indexing) must always run exclusively on **100% free services and open-access public protocols**:
     - **Hosting & Compute:** Render Free Tier (`src/server/prod.mjs`, Node.js runtime).
     - **Persistence:** Turso Cloud Free Tier SQLite (`@libsql/client`) paired with local SQLite WAL-mode cache.
     - **Scholarly Data Retrieval:** Free open-access academic APIs (**OpenAlex** and **CrossRef**) with polite headers, alongside direct/cached Google Scholar scraping and Apify free credits with the $1.00 quota circuit breaker.
     - **Search & Intelligence:** Local in-memory algorithms, regex concept dictionaries, and SQLite composite indexes.
     - **Strict Prohibition:** Never introduce paid external APIs, paid vector database services, paid LLM tokens, or cloud services that incur billing charges. Every feature must remain 100% free-to-run.

## Project Guidelines

Read and always follow the instructions in the [project guidelines](guidelines/Guidelines.md) unless the user requests otherwise.
