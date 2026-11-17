# Specialized Sub-Agent Architecture

This workspace is equipped with five specialized, on-demand sub-agents organized into two wings:

## 1. Academic Research & Manuscript Wing

### `citation-verifier`
- **Role:** Citation Verification & Open-Access PDF Harvester.
- **Tools:** OpenAlex, CrossRef, Google Scholar scraping, local PDF validator (`%PDF` binary header).
- **Policy:** Dual-Tier Verification (prioritizes binary full-text PDFs saved to `manuscript/zotero_library/Related_Literature_PDFs/` or `Related_Studies_PDFs/`; falls back to verified CrossRef DOI metadata if paywalled). Strictly no UP citations for local works.

### `academic-writer`
- **Role:** Academic Manuscript Drafting & Literature Synthesis.
- **Policy:** Evidence-Grounded Drafting with Anti-Pattern Filter. Eliminates AI clichés ('delve', 'testament', 'pivotal role', 'tapestry', 'crucial milestone', 'fostering a seamless'). Maximizes burstiness and natural perplexity. Adheres to Philippine SUC thesis standards, APA 7th format, and system invariants (Researchers, ASIN-00000, Sir Rodelio M. Garin, Iterative Waterfall Model).

---

## 2. Software Engineering & Production QA Wing

### `frontend-specialist`
- **Role:** React 18, Vite, Tailwind CSS, and UI/UX Developer.
- **Policy:** Enforces Facebook-style dark mode (`#18191a`, `#242526`), zero emojis (`lucide-react` only), no duplicate buttons, non-editable text selection suppression, and mandatory `SystemGuidePage.tsx` (`/guide`) parity. Propose-and-verify workflow with `npm.cmd run build`.

### `backend-auditor`
- **Role:** Node.js, SQLite, and Turso Cloud Database Engineer.
- **Policy:** Enforces schema and column migration parity between `db.mjs` and `turso.mjs`, cold-start rehydration sync (`rehydrateFromTurso`), transactional writes (`runInTransaction`), security headers, and 100% free-tier zero-cost constraints.

### `browser-qa`
- **Role:** Automated Chrome Browser QA & Production Auditor.
- **Policy:** On-demand side-by-side verification between live Render production (`https://psuresearch.onrender.com/`) and localhost (`http://localhost:8443`). Monitors cold-start wake-up latency, browser console exceptions, route guards, dark mode rendering, and network API status.
