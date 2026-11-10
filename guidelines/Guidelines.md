# Project Guidelines — PSU Research Publication Tracking System

This guide outlines core architectural requirements, terminology standards, and development workflows for the **PSU Asingan Research Publication Tracking System**. 

For AI agents and automated coding tools, detailed enforceable rules are codified in [AGENTS.md](../AGENTS.md) and modularly under [.agents/rules/](../.agents/rules/).

---

## 1. Cloud Architecture & Zero-Cost Infrastructure
- **100% Free-Tier Mandate:** The entire system runs exclusively on free-tier services:
  - **Hosting:** Render Free Tier (`src/server/prod.mjs`, Node.js runtime).
  - **Persistence:** Turso Cloud Free Tier SQLite (`@libsql/client`) paired with local SQLite WAL-mode cache.
  - **Scholarly APIs:** OpenAlex & CrossRef with polite email headers; direct Google Scholar scraping with an Apify free quota circuit breaker.
- **Turso Cloud Synchronization:**
  - Database schema changes in `src/server/db.mjs` must be synchronized with `initTursoSchema()` and `columnMigrations` in `src/server/turso.mjs`.
  - Every table must be registered in `rehydrateFromTurso()` and `/api/turso/sync`.
  - Database writes must execute through `runInTransaction()` or `db.prepare().run()`, waiting for `dbReadyPromise`.

---

## 2. Standardized System Terminology & ID Invariants
- **Researchers:** Always refer to individuals as **"Researcher"** and the group as **"Researchers"** (never "Faculty Roster").
- **Faculty vs. Non-Faculty:** On the Researchers page and profiles, display classification badges as **`Faculty (<Department>)`** or **`Non-Faculty`**. Everywhere else, use **Researcher / Researchers**.
- **Instructor ID (`ASIN-00000`):** Always formatted with a locked/non-editable `ASIN-` prefix followed by 5 editable digits (`00000`).
- **Research Coordinator:** Sir Rodelio M. Garin's official title is **"Research Coordinator"** (displayed without "Sir" in his personalized profile view).
- **Publications:** Always refer to scholarly items as **"Publications"** (published works only).
- **SDG Alignment & Goals:** Always refer to SDG analytics as **"SDG Alignment"** and individual targets as **"SDG Goals"** (never "Radar" or "Matrix").
- **Proponent Attribution:** Maintain `"Developed by Julius Oscar Moreno • PSU Asingan Campus"` in the public repository footer.

---

## 3. UI, UX & Accessibility Standards
- **No Emojis:** Use `lucide-react` icons exclusively.
- **Single Distinct Actions:** No redundant buttons that navigate to the exact same destination.
- **Facebook Dark Mode:** Elevated card background (`#242526`), canvas background (`#18191a`), borders (`#3e4042`), and high-contrast text (`#e4e6eb`).
- **Visual Guide Sync:** Keep `/guide` (`SystemGuidePage.tsx`) updated whenever UI elements, badges, or buttons change.
- **Security & Accessibility:** Enforce HSTS, CSP, COOP, CORP, robots.txt, security.txt, and WCAG AA `4.5:1` contrast.

---

## 4. Developer Tooling
- **Windows PowerShell:** Always use `npm.cmd` (e.g., `npm.cmd run build`) to bypass PowerShell script execution restrictions (`PSSecurityException`).
- **Knowledge Graphing:** Knowledge graphs are updated locally via `graphify update .` and `graphify cluster-only . --no-label` with zero LLM API cost.
