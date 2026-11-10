---
trigger: always_on
description: UI, UX, dark mode styling, and front-end design invariants.
---

# UI & UX Design Rules

Always maintain the following user interface standards across the application:

## 1. No Emojis in UI
- Do not use emojis anywhere in the application UI (buttons, cards, badges, alerts, toasts, or modals). Always use `lucide-react` icons.

## 2. No Redundant / Duplicate Action Buttons
- Never place multiple buttons or links on the same page that perform the exact same action or navigate to the exact same destination (for example, having multiple "Back to Public Search", "Return to Dashboard", or duplicate pagination/help buttons on a single screen). Each distinct action or navigation target must have only **one** button on the page.

## 3. Keep the System Visual Guide (`SystemGuidePage.tsx`) Synchronized
- Whenever you add, rename, or modify a page, button, badge, or workflow in the workspace, you **MUST** also update `src/app/components/SystemGuidePage.tsx` (`/guide`) so its visual button replicas, simulated charts, and plain-language narrative explanations always match the live workspace.

## 4. Facebook-Style Dark Mode Readability (`src/styles/theme.css`)
- Always maintain the Facebook Dark Mode surface and text hierarchy:
  - `#18191a` - Page background
  - `#242526` - Elevated cards and sidebar
  - `#3a3b3c` - Inputs and muted surfaces
  - `#3e4042` - Borders
  - `#e4e6eb` - Primary text
  - `#b0b3b8` - Secondary text
  - `#2d88ff` - Accent blue
- Dark mode must never be pitch-black (`#000000`) or hard to read.

## 5. Pre-Change Breakdown & Plan Explanation Before Working
- Before working on any bug fix, error, or feature request, **always provide a clear breakdown of the error/issue and explain what files and logic will be changed** before making edits.

## 6. Proactive `AGENTS.md` Rule Confirmation
- Every time we come up with a new rule, or the user states a requirement or preference that looks like a system-wide rule, **always ask the user if that rule should be added to `AGENTS.md`**.

## 7. Mandatory Security, SEO & Accessibility Audit on Major Changes / New Features
- Whenever making major changes or adding a new feature to the system, **always verify all web security, SEO, and accessibility protections**:
  - **HTTP Security Headers (`src/server/securityHeaders.mjs`):** Verify `Strict-Transport-Security` (HSTS), `Content-Security-Policy` (CSP with `upgrade-insecure-requests` and `frame-ancestors 'self'`), `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` (COOP), `Cross-Origin-Resource-Policy` (CORP), and `Cross-Origin-Embedder-Policy` (COEP) are applied on all responses and compatible with any new assets or endpoints.
  - **Crawler & Security Policies (`public/robots.txt`, `public/.well-known/security.txt`, `src/server/prod.mjs`):** Verify `/robots.txt` and `/.well-known/security.txt` resolve as `text/plain; charset=UTF-8` and missing non-HTML extensions return `404` instead of `index.html`.
  - **SEO & Social Metadata (`index.html`):** Ensure meta description, OpenGraph (`og:*`), Twitter Card, and canonical tags remain intact.
  - **WCAG AA Color Contrast:** Ensure all text elements maintain at least a `4.5:1` contrast ratio in both Light Mode and Dark Mode.

