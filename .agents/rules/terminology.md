---
trigger: always_on
description: Mandatory system terminology, roles, and ID formatting invariants.
---

# Mandatory System Terminology & ID Rules

Always enforce the following standardized terminology and formatting across all pages, components, modals, and notifications:

## 1. Collection of Researchers
- Always refer to the list or group of people as **"Researchers"** (never use "Roster", "Faculty Roster", "Institutional Faculty Roster", or "Faculty Researchers").

## 2. Individual Person ("Researcher")
- Always refer to each person as **"Researcher"** (singular) or **"Researchers"** (plural) across the entire system.

## 3. Faculty vs. Non-Faculty Mark (Researchers Page & Profile Only)
- Outside of the Researchers page (`src/app/components/ResearchersPage.tsx`), Researcher Profile (`src/app/components/ResearcherProfile.tsx`), and the classification selector when inviting a researcher, never label or separate users as "Faculty", "Teaching Instructors", or "Non-Teaching Staff" — always call them **Researcher / Researchers**.
- On the Researchers page and Researcher Profile only, display their classification badge as:
  - **`Faculty (<Department>)`** (e.g., `Faculty (BSIT)`, `Faculty (BSBA)`) for faculty researchers.
  - **`Non-Faculty`** for non-faculty researchers.

## 4. Instructor ID (`ASIN-00000` Format)
- Always call their identifier **"Instructor ID"** (never "Employee ID" or "Instructor / Employee ID").
- Both Faculty and Non-Faculty use the exact same format: **`ASIN-00000`** (`ASIN-` prefix followed by 5 digits).
- In all invitation channels (**"Ask for Invitation"** modal on `LoginScreen.tsx` and **"Invite Researcher"** form in `AdminPage.tsx`), the **`ASIN-`** prefix must be locked/non-editable and only the **5 numeric digits (`00000`)** are editable.

## 5. Research Coordinator (Sir Rodelio M. Garin)
- Always refer to Sir Rodelio M. Garin's role as **"Research Coordinator"** (never "Campus Research Administrator", "Research Administrator", "Campus Research Coordinator", or "System Administrator").
- Avoid displaying multiple or redundant title badges next to his name; show at most a single **"Research Coordinator"** badge.
- In his personal profile view, display his name as **"Rodelio M. Garin"** without the honorific "Sir" prefix.

## 6. Publications (Published Works Only)
- Refer to all retrieved and indexed scholarly works as **"Publications"** (never "Papers" or "Scholarly Works").
- On the researcher's publications page (`InstructorPublicationsPage.tsx`), use **"My Publications"** (page header), **"My Published Research"** (Tab 1), **"Institutional Repository"** (Tab 2), and **"Add Publication"** (action button/modal). Do not include an option to add ongoing/in-progress unpublished research.

## 7. SDG Alignment & Goals
- Always refer to SDG analytics as **"SDG Alignment"** (tab/feature name) and individual targets as **"SDG Goals"** (never use "SDG Radar" or "SDG Matrix").

## 8. Proponent Attribution
- Always maintain the proponent developer credit in the public repository footer: `"Developed by Julius Oscar Moreno • PSU Asingan Campus"`.

## 9. Focus SDG Mapping (1:1 Ratio) & Bespoke Rationales
- In SDG Alignment (UN Development Goals view), each publication maps strictly to **exactly 1 primary Focus SDG** in all institutional aggregations (radar charts, top goals bar charts, goal counts, and total mapped figures). The sum of all goal counts must equal the number of verified publications (1:1 paper-to-SDG ratio).
- Any secondary/co-aligned SDGs are preserved in the publication's metadata (`sdg_tags`) and surfaced as subtle secondary badges and within the Publication Inspector Drawer (`PublicationInspectorDrawer.tsx`) and Publication Detail page.
- "Why this is aligned" rationales must be **unique, evidence-grounded, and specific to the individual research paper's methodology and findings**, never following repeated grammatical boilerplate formulas or identical sentence patterns across papers.

## 10. Generalized Scholarly Author Name Resolution & Author-Exclusive Search
- Always generalize name resolution, initials matching, and author indexing across all researchers rather than hardcoding or tailoring logic to specific individuals.
- In academic searches, author claiming, and attribution, never rely strictly on Institutional IDs (`ASIN-00000`), as external and regional indexing does not always carry IDs; prioritize Name, Full Name, and Full Name + Affiliation ('Pangasinan State University' / 'PSU').
- When searching for a researcher's name, enforce Author-Exclusive Search: return only publications where the queried author physically appears (including compound names, given-name tokens, initials sequences, and inverted formats); never pollute author results with unrelated campus papers.

## 11. Strict Prohibition on Adding or Seeding Researchers
- Never add, seed, register, or invite a researcher automatically or on your own.
- Creating or inviting a researcher account requires explicit human administrative action and direct user authorization.
- Unauthorized creation of researcher records risks sending unapproved automated invitation/verification emails to real faculty members and corrupts institutional directory records.



