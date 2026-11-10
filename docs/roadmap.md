# Project Roadmap & Future Enhancements

A central repository of brainstormed concepts, workflow automation designs, and feature ideas for the **PSU Asingan Research Publication Tracking System**.

---

## 1. Workflow Automations (n8n & GitHub Actions)

Concepts for automating background pipelines, researcher engagement, and coordinator notifications without placing load on the main Render container:

### A. Autonomous Literature Discovery & Ingestion
- **Trigger:** Scheduled Cron (e.g., Every Monday at 3:00 AM PHT).
- **Process:**
  1. Queries open-access scholarly APIs (**OpenAlex** and **CrossRef**) for `"Pangasinan State University"` and registered researcher names.
  2. Normalizes retrieved publication titles to eliminate duplicates against the local SQLite database.
  3. Stages newly discovered records into the unapproved staging table (`/api/admin/scraped-publications`) ready for claiming.
- **Benefits:** Publications authored by PSU faculty are discovered automatically without requiring manual search queries.

### B. Citation Milestone & Growth Tracker
- **Trigger:** Scheduled Cron (Bi-weekly).
- **Process:**
  1. Fetches all approved publications and their DOIs from `/api/publications`.
  2. Pings CrossRef / OpenAlex to check if citation counts have increased.
  3. Updates citation trends and recalculates DBM-CHED JC3 KRA II citation points (+5.0 points per Scopus/WoS citation).
  4. Automatically emails or notifies the researcher:
     > *"Congratulations! Your publication '[Title]' just received a new citation (Total: 15). Your estimated JC3 points have increased."*

### C. Pending Claim Alerts for Research Coordinator Sir Rodelio M. Garin
- **Trigger:** Webhook event on publication claim (`POST /api/publications/claim`).
- **Process:**
  1. Captures the claim payload: Researcher Name, locked Instructor ID (`ASIN-00000`), publication title, and declared authorship share.
  2. Dispatches an instant alert via Gmail, Telegram, or Discord webhook to Sir Rodelio M. Garin.
  3. Provides a direct link to the Admin Portal (`/admin`) for one-click verification.

### D. Monthly Accreditation & UN SDG Executive Digest
- **Trigger:** Scheduled Cron (1st day of every month).
- **Process:**
  1. Requests aggregate metrics from `/api/reports/summary`.
  2. Summarizes new publications approved, citation growth, top JC3 point earners, and distribution across UN SDGs (SDG 4, SDG 9, SDG 12, etc.).
  3. Generates an export-ready Excel audit spreadsheet (`/api/reports/export/excel`) and archives it into a Google Drive folder organized by Academic Year.
  4. Delivers an executive briefing email to the Research Coordinator and Campus Administration.

### E. Zero-Cost Render Keep-Alive Probe
- **Trigger:** Scheduled Cron (Every 12 minutes during campus working hours: 7:00 AM – 7:00 PM PHT).
- **Process:**
  1. Sends a lightweight HTTP `GET` to `https://psuresearch.onrender.com/healthz`.
  2. Prevents the Render free container from spinning down during high-traffic campus hours, eliminating the 30–50 second cold-start delay for faculty and students.

### F. Disaster Recovery Snapshot & Redundant Backup
- **Trigger:** Scheduled Cron (Every Sunday at midnight).
- **Process:**
  1. Queries `/api/turso/sync` to retrieve a full dump of the SQLite tables.
  2. Commits the timestamped snapshot into an encrypted private backup repository or Google Drive folder, providing an extra layer of disaster recovery alongside Turso Cloud WAL replication.

---

## 2. Zero-Cost Automation Hosting Strategies

Evaluation of how to run these automations without violating the **100% Free-Tier & Zero-Cost Infrastructure** rule:

| Strategy | Cost | Compute Overhead | Best Used For |
| :--- | :---: | :--- | :--- |
| **GitHub Actions** *(Recommended)* | **$0.00** | Runs on GitHub's free runners (2,000 minutes/month). Zero local or Render compute. | Scheduled scrapers, weekly backups, monthly report generation, and keep-alive pings. |
| **Independent Cloud n8n** | **$0.00** | Hosted on a separate free provider (Koyeb, Zeabur, or a secondary Render account). | Visual drag-and-drop workflow building, complex branching, and multi-app webhooks. |
| **Self-Hosted Campus Runner** | **$0.00** | Runs locally on a campus office PC or laptop via Docker or `npx n8n`. | Total on-premise control, intranet-only integrations, and direct local database access. |

> [!WARNING]
> Do **not** deploy n8n as a second web service on the primary Render free account. One account only has 750 free hours per month; two continuously running web services will exhaust free hours mid-month.

---

## 3. Future Feature Backlog & Exploration

Additional product ideas to consider for future sprints:

### A. Visual Co-Authorship & Department Collaboration Network
- An interactive node-link graph on the Dashboard visualizing research collaboration between departments (e.g., cross-disciplinary work between `BSIT` and `Education`).
- Calculates interdisciplinary synergy scores using the built-in `calculateSynergy` function.

### B. Dynamic QR Code Generator for Researcher Profiles
- Every researcher's profile (`/researchers/:id`) generates a downloadable, high-resolution QR code badge.
- Perfect for research poster presentations, faculty business cards, and university accreditation displays so visitors can scan and instantly view verified campus publications.

### C. One-Click Citation Card Export (APA 7, MLA 9, IEEE, Chicago)
- A quick "Copy Formatted Citation" button on every publication card in Global Academic Search and the Institutional Repository.
- Automatically formats authors, titles, journals, volumes, and DOIs into standard academic reference styles.

### D. Campus Research Newsletter & Press Release Generator
- Uses Campus AI to turn newly approved publications into 2-paragraph layperson-friendly news blurbs suitable for the official PSU Asingan campus Facebook page or university newsletter.

### E. Predatory Journal Early-Warning Flagging
- Cross-references incoming journal titles against known DOAJ (Directory of Open Access Journals) and UGC-CARE whitelists, warning researchers before submitting claims to questionable open-access venues.

---

## 4. Architectural Rules & Constraints

Whenever picking up an idea from this document, remember:
1. **100% Free-Tier & Zero-Cost:** Never introduce paid external APIs, paid vector database services, paid LLM tokens, or cloud services that incur billing.
2. **Mandatory Terminology:** Always use **"Researchers"** (never "Faculty Roster"), **"Instructor ID (`ASIN-00000`)"**, **"Research Coordinator (Sir Rodelio M. Garin)"**, and **"Publications"**.

