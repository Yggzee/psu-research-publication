---
trigger: always_on
description: Mandatory 100% free-tier zero-cost architecture and developer tooling invariants.
---

# Infrastructure & Tooling Rules

Always enforce the following infrastructure and developer environment guardrails:

## 1. Mandatory 100% Free-Tier & Zero-Cost Infrastructure
The entire system (development, runtime, deployment, search, and indexing) must always run exclusively on **100% free services and open-access public protocols**:
- **Hosting & Compute:** Render Free Tier (`src/server/prod.mjs`, Node.js runtime).
- **Persistence:** Turso Cloud Free Tier SQLite (`@libsql/client`) paired with local SQLite WAL-mode cache.
- **Scholarly Data Retrieval:** Free open-access academic APIs (**OpenAlex** and **CrossRef**) with polite headers, alongside direct/cached Google Scholar scraping and Apify free credits with the $1.00 quota circuit breaker.
- **Search & Intelligence:** Local in-memory algorithms, regex concept dictionaries, and SQLite composite indexes.
- **Strict Prohibition:** Never introduce paid external APIs, paid vector database services, paid LLM tokens, or cloud services that incur billing charges. Every feature must remain 100% free-to-run.

## 2. Windows PowerShell Command Tooling (`npm.cmd`)
- When executing npm scripts via terminal commands in Windows PowerShell environments, always use `npm.cmd` (e.g., `npm.cmd run build`) rather than `npm` to avoid `npm.ps1` execution policy restrictions (`PSSecurityException`).

## 3. Pre-Task Workspace Skill Evaluation (`.agents/skills`)
- At the start of every user prompt, proactively inspect the available workspace skills in `.agents/skills` (e.g., `grill-me`, `frontend-design`, `web-search`, `archify`, `prompt-master`, etc.) to determine if any skill applies directly to the user's request.
- If a relevant skill exists (such as `/grill-me` for requirements alignment and design interviews, `frontend-design` for distinctive UI/UX design, or `web-search` for external discovery), activate and execute that skill first before proceeding with code changes or actual implementation work.

## 4. Zero-Cost Knowledge Graphing (`graphify`)
- The knowledge graph must remain 100% free and run on local AST parsing without external LLM API keys. Maintain `.graphifyignore` to exclude non-code documents, images, and vaults from requiring semantic extraction. Always use `graphify update .`, `graphify .`, or `graphify cluster-only . --no-label`.

