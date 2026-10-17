---
name: homenest-store-s
description: >
  Production-grade engineering reference for HomeNest Kitchen — a Next.js 16
  App Router e-commerce storefront + admin console (React 19, TypeScript
  strict, Tailwind CSS v4 CSS-first, Prisma 6 + SQLite, Vitest + Playwright),
  built as a visual-and-functional superset of nest-culinary-hub.base44.app.
  Covers the full architecture, the Tailwind v4 / CSP-nonce / env-shadowing
  trap logs, the integer-cent money contract, the tracking access-control
  model, TDD workflow, debugging playbooks, and the complete pre-ship gate
  chain. Use when extending, debugging, auditing, onboarding, or replicating
  this codebase — every pattern below was verified against a live build.
version: 1.40.0
last_updated: 2026-10-17
project_state: "432 unit tests · 66 e2e tests · lint/typecheck/typecheck:tests/build green · security-hardened (post-remediation sessions 2-43; the placeOrderTx money authority is extracted verbatim into src/lib/order-placement.ts with the db client injected — route behavior byte-equivalent, the C1/C3 boundary pins green unchanged — the money-path real-engine harness pins the server-derived money (the args' cosmetic mirrors carry garbage; the live product rows win), the receipt snapshots, stock reservation incl. the WRITE-side atomic decrement guard (the duplicate-product handoff), the coupon burn plus the engine-level atomic rollback, the S12-1 cart-clear scoping, and the S7-8 best-effort address save against a live SQLite engine — session-27 completed the route-level 429 wiring-pin grid: ALL 14 metered HTTP surfaces carry route-level boundary pins in api-boundaries.test.ts — session-28 was the hygiene/precision pass (the two audit NITs + the reproducible count anchors) — and sessions 29/30 are the first two fully-empty remediation cycles (deep audits 30-a/31-a: 0 CRITICAL/HIGH/MEDIUM/LOW/NIT, all count anchors and 8 carried deferrals verified standing, nothing to change in src/tests/prisma) — session-31 is the third consecutive fully-empty cycle (deep audit 32-a: sweeps 12/12 clean, counts 13/13 MATCH, docs aligned, 0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 4 Informational all verified accepted-shape/docs-only/sandbox-side and disposed no-change) — session-32 is the fourth consecutive fully-empty cycle (deep audit 33-a at 6e62d01: docs claims 8/8 WIRED, sweeps 12/12 clean, counts 12/13 exact MATCH + 1 count-convention gloss (the '16 route handlers' anchor = 15 HTTP handlers + 1 exported response type across 11 files — clarified going forward), 8/8 deferrals standing, 0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 2 Informational disposed no-change) — session-33 is a REFERENCE-PARITY cycle (deep audit 34-a at e444df8: repo-side 9/9 docs claims WIRED, 13/13 sweeps clean, 7/7 counts MATCH, 8/8 deferrals standing, 0 repo-side defects; the live reference re-ordered its catalog AND shrank its visible catalog 16→8 — S33-1 re-aligned the seed's authored order to the reference's current live order (Dutch-Oven-first core of 8, the 16-product superset kept), TDD: the seed-catalog order pin extended first, then the PRODUCTS block reorder, fresh-DB re-seed, all gates green twice) — session-34 is the SECOND consecutive reference-parity cycle (deep audit 35-a at 99eca4a: repo-side 9/9 docs claims WIRED, 12/12 sweeps clean, 9/9 counts MATCH incl. the audit's own dynamic 432/432 re-run, 8/8 deferrals standing, 0 repo-side defects + 3 Informational disposed no-change; the live reference re-ordered its catalog AGAIN — S34-1 re-aligned the seed's authored order to the current live order (Damascus-first core of 8, the 16-product superset kept), TDD: pin extended first (red), the pure 97/97 block reorder (green, with the S33-1 move's mixed brace indentation normalized), the twice-re-aligned history re-anchored in the seed-policy/spec/seed comments, fresh-DB re-seed, card-for-card parity re-verified on all three surfaces, all gates green twice) — session-35 is the FIFTH fully-empty remediation cycle and the first with BOTH surfaces clean (deep audit 36-a at 98359d0: repo-side 9/9 docs claims WIRED, 11/11 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run, 8/8 deferrals standing, 0 repo-side defects + 3 Informational (2 environmental + 1 docs-precision on the '16 admin-dialog catches / 6 files' anchor's file-set convention: the five admin *-dialog.tsx files + settings-form.tsx, with the account address-dialog's three catches outside the admin set — restated precisely going forward) disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order — no re-alignment item this cycle; card-for-card parity re-verified on /products + Featured + New Arrivals, all gates green twice; plus S35-2, a LOW docs-tooling fix: the 11-checkout screenshot capture's fire-and-forget add-to-cart race (the run-35 shot had silently shipped the empty-cart shell at /checkout — the session-23/run-24 class) now gated on expectBadgeCount like the 04-cart shot, verified deterministic by a byte-identical md5 across consecutive capture runs) — session-36 is the SIXTH fully-empty remediation cycle and the second consecutive with BOTH surfaces clean (deep audit 37-a at ef1b7b4: repo-side 9/9 docs claims WIRED, 11/11 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run, 8/8 deferrals standing, 0 repo-side defects + 2 Informational (one environmental — the parent-worklog stub; one informational — the Appendix B session-35 entry citing session_62 but not session_63, an inherent commit-chronology artifact) disposed no-change, with 36-a's untracked verify-seed scratch RESOLVED by the surviving workspace; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the THIRD consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices and the mobile-menu contract at 390×844 on both sides, all gates green twice) — session-37 is the SEVENTH fully-empty remediation cycle and the third consecutive with BOTH surfaces clean (deep audit 38-a at a7a9743: repo-side 9/9 docs claims WIRED, 11/11 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run, 8/8 deferrals standing, 0 repo-side defects + 2 Informational (the parent-worklog stub observation RESOLVED by the second consecutive surviving workspace; a README/PAD doc-layout consistency note) disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the FOURTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices re-verified to the cent and the mobile-menu contract at 390×844 on both sides, all gates green twice — plus S37-2, a LOW docs-tooling fix: the 04b capture's coupon-toast animation frame made the shot run-to-run byte-non-deterministic (pixel-diff isolated the only differing region to the toast itself, not a content race); the capture now waits for the toast's auto-dismiss, verified deterministic by a byte-identical md5)— session-38 is the EIGHTH fully-empty remediation cycle and the fourth consecutive with BOTH surfaces clean (deep audit 39-a at 28053f4 on the fresh-clone recovery tree: repo-side 9/9 docs claims WIRED, 12/12 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run (19.77s) plus an empirical temp-DB serialization check of concurrent interactive transactions, 8/8 deferrals standing, 0 repo-side defects + 3 Informational (a phrasing gloss on the deliberate empty-catch census — precisely 7 src + 1 test; the documented admin layout-level gating design; the SQLite per-single-process serialization scope) all disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the FIFTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices re-verified to the cent and the mobile-menu contract at 390×844 on both sides — the panel-scoped search-box re-check rendered 209×40 (an unscoped document-wide query had matched the header's desktop input and false-alarmmed hidden; the e2e panel-scoped pin was green all along), all gates green twice) — session-39 is the NINTH fully-empty remediation cycle and the fifth consecutive with BOTH surfaces clean (deep audit 40-a at 0d6f1fe on the third-consecutive surviving workspace: repo-side 9/9 docs claims WIRED, 12/12 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run (21.63s) plus fresh hunts (no open redirects, all fetch same-origin, no client component importing db/prisma), 8/8 deferrals standing, 0 repo-side defects + 3 Informational (all audit-brief citation glosses: the verification-only-cycle 2-box convention; the login-limiter's actual home in src/lib/actions/auth.ts:85-91; the button-based ARIA radiogroup shape) all disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the SIXTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices + compare-at + badges to the cent and the mobile-menu contract at 390×844 on both sides — the reference's navigate-closes verified with a REAL Playwright click (a synthetic dom.click() had hit the hidden desktop link, a testing artifact), the clone verified with 16/16 automated parity checks (Close-menu 44×44 @330,78, panel search box 209×40 @16,80, unmount-on-navigate; methodology: the clone's cards render article > h3 > Link so parity scripts need article-scoped extraction, and the panel's close button + search box live in div[data-testid="mobile-menu"] OUTSIDE nav[aria-label="Mobile"]), all gates green twice) — session-40 is the TENTH fully-empty remediation cycle and the sixth consecutive with BOTH surfaces clean (deep audit 41-a at 5f14a88 on the fourth-consecutive surviving workspace: repo-side 9/9 docs claims WIRED, 12/12 sweeps clean, 10/10 counts MATCH incl. the audit's own dynamic 432/432 re-run (19.86s) plus fresh hunts (redirects static/role-derived, all 15 fetch() same-origin, no client component importing db/prisma, zero Math.random/@ts-ignore/innerHTML writes, target="_blank" hardened), 8/8 deferrals standing, 0 repo-side defects + 2 Informational (both brief-side citation glosses: the git-ls-files pathspec convention — the documented 127 tracked src TS files is the true count, a bare 'src/**/*.ts' pathspec drops zero-depth src/proxy.ts on this git build; the redirect anchor = 6 textual occurrences, 5 executable + 1 comment) both disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the SEVENTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices + compare-at + badges to the cent and the mobile-menu contract at 390×844 on both sides — the reference's navigate-closes verified with a REAL Playwright click on the panel's Products link (URL → /products, panel unmounted), the clone verified with 16/16 automated parity checks (Close-menu 44×44 @330,78, panel search box 209×40 @16,80, unmount-on-navigate), all gates green twice) — session-41 is the ELEVENTH fully-empty remediation cycle and the seventh consecutive with BOTH surfaces clean (deep audit 42-a on the fresh-clone recovery tree at dba8c7d after the sandbox reset: repo-side 9/9 docs claims WIRED, 12/12 sweeps clean, 10/10 counts MATCH incl. the audit’s own dynamic 432/432 re-run (19.97s) plus fresh hunts all clean, 8/8 deferrals standing, 0 repo-side CRITICAL/HIGH/MEDIUM/LOW + 1 NIT + 4 Informational; the NIT is a genuine latent docs-quality defect INSIDE the documented state — PAD §1.2’s Technology Stack Summary still carried blueprint-time counts (131/32) contradicting the same document’s §8.1 (432) and §12 (432 unit · 66 e2e), the S25-2 stale-stats class, fixed as S41-2; the 4 Informational are brief-side citation glosses disposed no-change; the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the EIGHTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices + compare-at + badges to the cent and the mobile-menu contract at 390×844 on both sides — the reference’s navigate-closes verified with a REAL Playwright click on the panel’s Products link, the clone verified with 15/15 automated parity checks reproducing the run-39/40/41 geometry EXACTLY (Close-menu 44×44 @330,78, panel search box 209×40 @16,80, unmount-on-navigate; methodology refinement recorded: measure panel geometry only AFTER the mount animation settles — waitForTimeout(700) past visibility, transform none — mid-animation reads false-alarm the y pins as drifted; and target the search INPUT by placeholder, a role=search locator matches the 314-wide wrapping FORM), all gates green twice) — session-42 is the TWELFTH fully-empty remediation cycle and the eighth consecutive with BOTH surfaces clean (deep audit 43-a on the fresh-clone recovery tree at ad12c4b after the sandbox reset: repo-side 10/10 docs claims WIRED, 12/12 sweeps clean, 12/12 counts MATCH incl. the audit’s own dynamic 432/432 re-run (22.37s) plus lint ✓ · typecheck ✓ · typecheck:tests ✓ as extra permitted gates plus fresh hunts all clean (redirects static/role-derived — 6 textual, 5 executable + 1 comment; 4 router.push sites same-origin incl. the server-minted order+token pair; all 15 fetch() same-origin; no client component importing db/prisma; timing-safe HMAC with length guard; health degraded-503; demo credentials server-side props only; zero Math.random/@ts-ignore/innerHTML writes; target=_blank hardened), 8/8 deferrals standing, 0 repo-side CRITICAL/HIGH/MEDIUM/LOW/NIT + 5 Informational (the four standing brief-side citation glosses re-confirmed + one new observational note on the dynamic unit duration 22.37s vs the 19.97-21.63s prior range — sandbox load variance, no action); the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the NINTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices + compare-at + badges to the cent and the mobile-menu contract at 390×844 on both sides — the reference’s navigate-closes verified with a REAL Playwright click on the panel’s Products link (URL → /products, panel unmounted, re-checked defensively) AND toggle-closes verified by clicking the hamburger again, hero rotation observed (Elevate Your Kitchen → New Arrivals mid-rotation), the clone verified with 15/15 automated parity checks reproducing the run-39/40/41/42 geometry EXACTLY (Close-menu 44×44 @330,78, panel search box 209×40 @16,80, unmount-on-navigate — the settle-wait + input[placeholder] methodology), all gates green twice; plus S42-2, a LOW docs-tooling fix found during the screenshot refresh: the 21-mobile-menu-open capture’s panel-mount raster race (two back-to-back re-captures of the SAME shot differ by the SAME photographic-hero band structure, 12.6% of pixels, content VLM-identical, geometry pins exact — the panel mount re-rasterizes the photographic content behind it and screenshotting before the settle catches it mid-flight, the S37-2 class) — the capture now waits 700ms past the panel mount, verified deterministic by byte-identical md5s across consecutive settled captures) — session-43 is the THIRTEENTH fully-empty remediation cycle and the ninth consecutive with BOTH surfaces clean (deep audit 44-a on the fresh-clone recovery tree at dc7d143 after the sandbox reset: repo-side 8/9 docs claims WIRED + 1 partial, 12/12 sweeps clean, 12/12 counts MATCH incl. the audit's own dynamic 432/432 re-run (20.16s) plus lint ✓ · typecheck ✓ · typecheck:tests ✓ as extra permitted gates plus fresh hunts all clean, 8/8 deferrals standing, 0 repo-side CRITICAL/HIGH/MEDIUM/LOW + 1 NIT + 4 Informational — the NIT is S43-1: the project_state range phrase itself missed its session-42 bump (the S42-1 sweep's claimed "sessions 2-42" never landed in the file — the git history shows the phrase bumping in lockstep 2-38/2-39/2-40/2-41 then stalling), fixed this cycle by the catch-up 2-41 → 2-43; the 4 Informational: the tool-display pipeline's two-char sequence-stripping artifact (byte-level includes() checks prove a[href] and [hidden] are intact in the source — future audits must verify bracket-bearing strings at byte level), the dynamic unit duration 20.16s (within the prior range), the standing git-ls-files pathspec convention (127 = 53 .ts + 74 .tsx), and the parent-worklog location note (the repo's git-tracked worklog.md carries Task 43); the live reference KEPT its catalog in the session-34-pinned Damascus-first order for the TENTH consecutive cycle — no re-alignment item; card-for-card parity re-verified on /products + Featured + New Arrivals incl. all 8 prices + compare-at + badges to the cent and the mobile-menu contract at 390×844 on both sides — navigate-closes AND toggle-closes verified with REAL clicks on both surfaces, hero rotation observed, the clone verified with a 13/13 automated parity-check grid (the run-42 15-check grid consolidated, the run-39/40/41/42 geometry reproducing EXACTLY — Close-menu 44×44 @330,78, panel search INPUT 209×40 @16,80, unmount-on-navigate); no changes in src/tests/prisma, 432/432 · 66/66 green twice)""
tags:
  - nextjs16
  - react19
  - tailwind-v4
  - prisma
  - sqlite
  - ecommerce
  - rsc
  - tdd
---

# HomeNest Kitchen — Project SKILL

> **How to use this document.** This is the single source of truth for working
> in this repository. `AGENTS.md` is the compact operational brief (commands +
> traps); `CLAUDE.md` the per-conversation guidance; the PAD
> (`Project_Architecture_Document.md`) the deep architecture + ADRs; this file
> is the full engineering reference that binds all three to the code, with the
> debugging playbooks and the hard-won "why" behind every invariant. When a
> section conflicts with the code, **the code and its tests win** — then fix
> the docs in the same change.

---

## Table of Contents

1. [Project Identity & Design Philosophy](#1-project-identity--design-philosophy)
2. [Tech Stack & Environment](#2-tech-stack--environment)
3. [Bootstrapping & Configuration](#3-bootstrapping--configuration)
4. [The Design System (Code-First)](#4-the-design-system-code-first)
5. [Component Architecture & Patterns](#5-component-architecture--patterns)
6. [State & Data-Flow Deep Dive](#6-state--data-flow-deep-dive)
7. [Data Layer: Prisma, Money & the DB-Path Contract](#7-data-layer-prisma-money--the-db-path-contract)
8. [Security Model (Auth, CSP, Rate Limiting, Tracking Access)](#8-security-model)
9. [Anti-Patterns & Common Bugs](#9-anti-patterns--common-bugs)
10. [Debugging Guide](#10-debugging-guide)
11. [Pre-Ship Checklist](#11-pre-ship-checklist)
12. [Lessons Learnt & How to Avoid Them](#12-lessons-learnt--how-to-avoid-them)
13. [Pitfalls to Avoid](#13-pitfalls-to-avoid)
14. [Best Practices](#14-best-practices)
15. [Coding Patterns (with code)](#15-coding-patterns-with-code)
16. [Coding Anti-Patterns](#16-coding-anti-patterns)
17. [Responsive Breakpoint Reference](#17-responsive-breakpoint-reference)
18. [Z-Index Layer Map](#18-z-index-layer-map)
19. [Color Reference (Complete)](#19-color-reference-complete)
20. [The Complete TypeScript Interface Reference](#20-the-complete-typescript-interface-reference)
- [Appendix A — Architecture Decision Records](#appendix-a--architecture-decision-records)
- [Appendix B — Session History & Audit Trail](#appendix-b--session-history--audit-track)
- [Appendix C — Quick Reference Card](#appendix-c--quick-reference-card)

---

## 1. Project Identity & Design Philosophy

**What this is.** HomeNest Kitchen is a production-grade e-commerce storefront
plus admin back office — a **visual-and-functional superset** of the Base44
reference app at `https://nest-culinary-hub.base44.app/`. "Superset" is a hard
requirement: every reference feature exists here (hero carousel, 8 category
tiles, featured/new-arrival grids, product detail with gallery + specs +
reviews, guest checkout with 3-step flow, order tracking timeline, About /
Contact / legal pages), plus features the reference lacks (wishlist, coupons,
order-status workflow with events, addresses book, full admin console,
sitemap/robots/SEO with schema.org JSON-LD rich results, web manifest +
branded error boundaries, analytics).

**Design thesis.** Warm, editorial kitchenware aesthetic: cream paper
background, terracotta-orange primary, serif display headings (Playfair via
`.font-display`), soft warm borders, generous whitespace. The reference's
sampled pixels are the spec — tokens in `src/app/globals.css` were sampled
from reference screenshots (primary pinned to `hsl(24 70% 50%)`).

**Non-negotiable design rules:**

1. **Never "improve" the pinned tokens.** `--shadow-sm` is pinned to v3
   geometry; the radius scale is pinned to the reference's measured px
   (`rounded-xl`=12px, `2xl`=16px, `3xl`=24px). v4 shifted both — the pins are
   intentional.
2. **The mobile menu is a push-down panel**, conditionally mounted, with the
   green circular close button and the `bg-primary` active pill. It is never a
   slide-over, and never toggled via a `hidden` class (see §9.1).
3. **No generic Bootstrap-style UI.** All primitives are shadcn-style
   (`src/components/ui/`) themed through the CSS-first token layer.
4. **Demo honesty.** The payment step is a clearly labeled demo (no real
   charges, only `cardLast4` stored) — don't "wire up" a fake success that
   looks real; the designed seam for real payments is `/api/checkout` +
   `computeOrderMoney` (see §7.3).
5. **`skills/` is excluded** from linting, typechecking, tests, and builds
   (tsconfig + eslint ignore it). Never let tooling reach into it.

## 2. Tech Stack & Environment

Locked versions (from `package.json` — keep this table in sync when bumping):

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `next` | ^16.1.1 | App Router, standalone output, `src/proxy.ts` CSP |
| UI runtime | `react` / `react-dom` | ^19.0.0 | RSC + client islands |
| Language | `typescript` | ^5 | strict, `noUncheckedIndexedAccess`, no `any` |
| Styling | `tailwindcss` + `@tailwindcss/postcss` | ^4 | CSS-first `@theme inline` in `globals.css`; **no tailwind.config.js** |
| Animations | `tw-animate-css` | ^1.3.5 | shadcn dialog/sheet/toast keyframes |
| Data | `prisma` / `@prisma/client` | ^6.11.1 | SQLite, 18 models, relative `file:` URL contract |
| UI primitives | `@radix-ui/*` (dialog, label, radio-group, select, slot, tabs, toast) | latest | accessible shells |
| Styling utils | `class-variance-authority`, `clsx`, `tailwind-merge` | latest | the `cn()` triad |
| Icons | `lucide-react` | ^0.525.0 | only icon set |
| Charts | `recharts` | ^3.1.0 | admin revenue/analytics only |
| Validation | `zod` | ^3.25.76 | single boundary: `src/lib/validation.ts` |
| Unit tests | `vitest` + `@testing-library/*` + `jsdom` | ^3.2.4 | `tests/unit/*` |
| E2E | `@playwright/test` | ^1.64.0 | `tests/e2e/*`, standalone server on :3100 |
| Lint | `eslint` (flat) + `eslint-config-next` | ^9 | `eslint.config.mjs` |

**Runtime environment facts:**

- Node ≥ 20, npm ≥ 10. Use `npm` — the committed lockfile is `package-lock.json` (a stray `bun.lock` from the old SPA may exist but is not authoritative).
- The sandbox exports a **global `DATABASE_URL`** that shadows `.env` (§10.4).
- WebKit is **not installable** in the target sandbox — Playwright's mobile project emulates iPhone 13 on Chromium.
- Fonts are self-hosted (`Inter` variable via `next/font`, Playfair Display via `.font-display` CSS var) — no external font CDN (CSP).

## 3. Bootstrapping & Configuration

```bash
npm install                # approve @prisma/engines, esbuild, unrs-resolver postinstalls if asked
cp .env.example .env       # then set AUTH_SECRET (required for production builds)
npm run db:setup           # prisma db push + seed (idempotent)
npm run dev                # http://localhost:3000 (logs tee'd to dev.log)
```

**Verify bootstrap:** `curl localhost:3000/api/health` →
`{"status":"ok","db":"up",...}` (the health route round-trips `SELECT 1`).

| Script | What it really does |
|---|---|
| `build` | `next build` **then** copies `.next/static` and `public/` into `.next/standalone/` — the standalone server needs both; forget the copy and assets 404 |
| `start` | `NODE_ENV=production node .next/standalone/server.js` — reads `PORT` (default 3000); **`.env` is copied into `standalone/` at build time**, so env changes require a rebuild |
| `db:setup` | `db push --accept-data-loss` + `tsx prisma/seed.ts` (idempotent: upserts by slug/email) |
| `test` | Vitest, node env, `tests/unit/*` |
| `test:e2e` | Playwright — `webServer` boots the **standalone** build on :3100 and waits for `/api/health`; run `build` first or you test stale code |
| `lint` / `typecheck` | ESLint 9 flat / `tsc --noEmit` — both must exit 0 |

**Env vars** (`.env.example` is the contract):

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `file:../db/custom.db` relative to `prisma/schema.prisma` (§7.2) |
| `AUTH_SECRET` | **production: yes** | HMAC key for the session cookie; `assertAuthSecret` **throws at module load** in production if missing/equal to the dev constant (`src/lib/auth-secret.ts`, unit-tested) |
| `NEXT_PUBLIC_SITE_URL` | recommended | metadataBase, sitemap, robots canonical origin |
| `NEXT_PUBLIC_DEMO_MODE` | no | set `"false"` to hide the login demo-credentials box (`src/app/(auth)/login/login-form.tsx`) |

**Demo accounts** (seeded): admin `admin@homenestkitchen.com` / `Admin123!`;
customer `demo@homenestkitchen.com` / `Demo1234!`.

## 4. The Design System (Code-First)

Config lives **only** in `src/app/globals.css` (`@theme inline`). There is no
`tailwind.config.js` and adding one is a bug. The header comment in that file
documents the four v4 pins; the full token table is §19.

Key mechanics:

- **Colors are FULL `hsl()` values** inside `@theme inline`. Bare `H S% L%`
  triplets silently resolve to transparent (§9.2).
- `@custom-variant hover (&:hover)` restores v3 hover semantics so touch
  devices still render hover styles.
- Typography: `--font-sans` binds the `next/font` Inter variable; headings use
  `.font-display` (Playfair Display) — the serif look is part of visual parity.
- Radius/shadow pins: see §1 rule 1.

## 5. Component Architecture & Patterns

127 tracked TS files (reproducible count:
`git ls-files src/ | grep -E '\.(ts|tsx)$'` — a `src/**/*.ts` GLOB
pathspec misses `src/proxy.ts` at the src root; use the ls-files form).
Component split in `src/components/`:
**13 client** (`"use client"`) and **9 server** components; 38 client files
across all of `src/` (pages' interactive islands included).

| Folder | Role | Examples |
|---|---|---|
| `src/components/ui/` | shadcn-style primitives (theme-aware) | button, input, dialog, select, sheet, tabs, toast primitives |
| `src/components/store/` | storefront chrome + islands | header, footer, mobile-nav, hero-carousel, product-card, store-chrome (drawer), store-provider, quantity-stepper, star-rating |
| `src/app/(storefront)/` | public pages (RSC, `force-dynamic` via layout) | home, products, product/[id], cart, checkout, track-order, account, admin/*, about, contact, legal/[slug] |
| `src/app/(auth)/` | login/register (layout awaits `connection()` — §8.2) | |
| `src/app/api/` | route handlers | cart, cart-summary, wishlist, checkout, coupon/apply, addresses, contact, newsletter, search, health |
| `src/lib/` | pure logic + singletons | db, auth, auth-secret, cart, wishlist, money, order-money, coupons, cart-quantity, order-tracking, rate-limit, settings, products, validation, csp, db-path, format, password |
| `src/lib/actions/` | Server Actions | auth, admin, reviews |
| `prisma/` | schema + seed | 18 models; seed is idempotent |
| `tests/unit/`, `tests/e2e/` | Vitest / Playwright | helpers: `tests/e2e/helpers.ts` (`gotoHydrated`) |

**The golden rule:** RSC by default; `"use client"` only for interactive
islands. Data fetching happens in Server Components via Prisma directly;
client islands fetch only through `/api/*` route handlers or Server Actions.

## 6. State & Data-Flow Deep Dive

- **Global client store** (`src/components/store/store-provider.tsx`): a
  single React context carrying `mobileNavOpen`, `searchOpen`,
  `cartDrawerOpen`, `cartCount`. It also sets `document.documentElement.dataset.hydrated`
  — the **hydration sentinel** every e2e test waits for (`gotoHydrated()` in
  `tests/e2e/helpers.ts`). Clicks before the sentinel fall back to native form
  GETs — that race produced three real bug reports during the build.
- **Cart/wishlist flow:** client island → `POST/PATCH/DELETE /api/cart` (guest
  token cookie `homenest_cart`, merged into the user's cart on login) →
  response carries `itemCount` → `setCartCount`. The header badge and the
  drawer are pure mirrors of that number.
- **Optimistic updates** follow one pattern everywhere (cart page
  `cart-lines.tsx`, drawer `store-chrome.tsx`): snapshot `prev`, optimistic
  `setState`, `setPendingId(lineId)` (per-line lock), fetch, on error roll
  back to `prev`, `finally` clear pending. Buttons `disabled={pendingId === line.id}`.
- **Toasts** (`@radix-ui/react-toast` via `useToast`): the `Toaster` is an
  **ancestor** of `{children}` in the root layout, not a sibling — a sibling
  placement breaks context reach and 500s every toast-using page (§9.5).
- **Money on the client is cosmetic.** Client totals mirror
  `computeOrderMoney`'s formula for display only; the server re-derives
  everything at `/api/checkout` (§7.3).

## 7. Data Layer: Prisma, Money & the DB-Path Contract

### 7.1 Schema shape

18 models (`prisma/schema.prisma`): `User`, `Session`, `Category`, `Product`,
`Review`, `Cart`, `CartItem`, `Wishlist`, `WishlistItem`, `Address`, `Order`,
`OrderItem`, `OrderEvent`, `Coupon`, `CarouselSlide`, `StoreSetting`,
`NewsletterSubscriber`, `ContactMessage`.

Conventions:
- All money columns are **`Int` cents** (`price`, `subtotal`, `shipping`,
  `tax`, `discount`, `total`, `unitPrice`, thresholds in `StoreSetting`).
- SQLite has no enums — vocabularies (`ORDER_STATUSES`, `SHIPPING_METHODS`,
  `PAYMENT_METHODS`, `ROLES`) are `as const` arrays in `src/lib/validation.ts`
  and validated by Zod at the boundary.
- Snapshots: `OrderItem` copies `nameSnapshot` / `imageSnapshot` /
  `unitPrice` at purchase time (catalog edits never rewrite history);
  `Order.shippingAddress` is a JSON snapshot string.
- `Order.number` is `ORD-YYYY-NNN` (sequential, unique); allocation retries on
  `P2002` (`placeOrderWithRetry`).

### 7.2 The DB-path contract (pinned by `tests/unit/db-path.test.ts`)

`.env` carries `DATABASE_URL="file:../db/custom.db"`. A relative `file:` URL
resolves against `prisma/schema.prisma` — for the CLI **and** at runtime via
`src/lib/db-path.ts` — so `db:push`, `db:seed`, `next dev`, `next build`, and
the standalone server all open ONE file: `<repo>/db/custom.db`, regardless of
CWD or standalone relocation. Absolute `file:` URLs and non-SQLite URLs pass
through untouched. `db/` is git-ignored (recreate with `db:setup`).

### 7.3 The money seam

- `src/lib/money.ts`: `formatMoney` (display) + `parseDollarsToCents`
  (admin input). The **only** place dollars→cents conversion happens.
- `src/lib/order-money.ts`: `computeOrderMoney({ subtotal, discount,
  shippingMethod, freeShippingThresholdCents, standardShippingCents,
  expressShippingCents, taxRatePercent })` — pure, integer, unit-tested
  (`tests/unit/order-money.test.ts` pins threshold/waive-tax/tax rounding).
- `/api/checkout` is the only caller that matters: it re-reads the cart from
  the DB, then **inside the transaction** re-reads prices from live `Product`
  rows, re-validates the coupon (`isCouponRedeemable` — active, unexpired,
  under its `maxRedemptions` cap; `timesUsed` increments with the order),
  derives subtotal from those snapshots and computes shipping/tax/total via
  `computeOrderMoney`. The client never sends an amount except `cardLast4`.
  Pre-transaction reads are a fast-fail UX path only — never the authority.
- Placement is **idempotent**: the client sends one `idempotencyKey`
  (`crypto.randomUUID()` per checkout visit, `Order.idempotencyKey` unique
  nullable column). A replay — same key — returns the already-placed order's
  `{ orderNumber, token }` instead of double-ordering; a `P2002` on the key
  resolves to the winning order (the retry loop only retries `number`
  collisions).
- Stock is reserved with a **conditional atomic decrement** (`updateMany`
  with `stock: { gte: qty }`, rollback when `count === 0`) — see §8.4.

## 8. Security Model

### 8.1 Auth & sessions

- Passwords: **scrypt** (N=16384, r=8, p=1, 64-byte key — OWASP 2023
  interactive baseline), format `scrypt$N$r$p$saltB64$hashB64`
  (`src/lib/password.ts`).
- Sessions are DB rows; the cookie is `homenest_session` = `<token>.<hmac>`
  where the token is 256-bit random stored **hashed** (SHA-256) and the HMAC
  is an integrity-in-depth layer keyed by `AUTH_SECRET`
  (`src/lib/auth.ts`). Comparisons are `timingSafeEqual`.
- `AUTH_SECRET` is enforced: `assertAuthSecret` throws at module load when
  `NODE_ENV=production` and the secret is missing or the dev constant
  (`src/lib/auth-secret.ts`, unit-tested in `tests/unit/auth-secret.test.ts`).
- Login is **anti-enumeration**: one uniform "Invalid email or password."
  message, and an unknown account burns a dummy scrypt verify so timing
  matches a real check (`src/lib/actions/auth.ts`). Rate-limited 10/min per
  email. Expired sessions are opportunistically purged on login.
- Registration catches Prisma `P2002` (the check-then-create race) and maps
  it to the friendly duplicate-email message. Rate-limited 5/min per email.

### 8.2 CSP nonce trap (Next 16 + `src/proxy.ts`)

The proxy stamps a **per-request nonce** CSP on every response; Next applies
the request-header nonce to the scripts it renders. A **prerendered/static
page bakes no (or build-time) nonces** → the browser silently refuses its
scripts → hydration never happens, with **zero console errors**. Symptom: a
page that loads, paints, but never hydrates.

Fix: make the route render per-request — `await connection()` in the layout
(`force-dynamic` alone did NOT de-prerender in Next 16.4). The `(auth)`
layout carries this fix with a comment; do not remove it. Pinned by the auth
e2e specs. (The 404 shell stays prerendered — accepted, it has no islands.)

### 8.3 Rate limiting (`src/lib/rate-limit.ts`)

In-memory fixed-window limiter: `rateLimit(key, limit, windowMs) → { ok,
retryAfterSec }`, opportunistic stale-bucket sweep. Single-process by design;
swap internals for a shared store if the deployment scales out (the sync
signature is the only coupling — a shared store forces async at all call
sites). The shared `clientIp()` helper derives the per-IP key from
`x-forwarded-for` (first hop, trimmed; missing → `"direct"`). Wired into:
`loginAction` (10/min/email **plus 30/min/IP** — the email key alone is
attacker-chosen, and every attempt burns real scrypt CPU), `registerAction`
(5/min/email plus 30/min/IP), `submitReviewAction` (5/min per
**IP+product+author**), `/api/contact` (5/min/IP), `/api/newsletter`
(5/min/IP), `/api/coupon/apply` (30/min/IP), `/api/checkout` (20/min/IP),
`/track-order` lookups (30/min/IP), `/api/cart` POST + PATCH + DELETE and
`/api/wishlist` POST (60/min/IP — guest-reachable writes), `/api/search`
GET (120/min/IP — per-keystroke typeahead). Limits are deliberately generous
so humans and the e2e suite are unaffected.

### 8.4 Order tracking access control (the HIGH-severity fix)

Order numbers are **sequential and printed on every receipt**, so the number
alone must never unlock PII. `/track-order` requires the order number **plus
the purchase email** (`trackOrderSchema` in `src/lib/validation.ts`); the
match is case-insensitive via `emailsMatch` (`src/lib/order-tracking.ts`,
unit-tested). Wrong-email, missing-email, and unknown-number all render the
same "couldn't find an order" alert (no enumeration oracle). The checkout
success page deep-links with both fields prefilled. E2E
(`tests/e2e/shopping-flow.spec.ts`) pins the full contract: number-only →
alert + zero PII; wrong email → alert; correct pair → order timeline.

**The same bug class on `/checkout/success` (fixed session 3):** the receipt
page rendered buyer email + address + spend from a bare `?order=` param.
Now `/api/checkout` mints an **order-access token**
(`src/lib/order-access.ts` — HMAC-SHA256 of the number keyed by
`AUTH_SECRET`, domain-separated, 128-bit hex) and the page renders the full
receipt ONLY for a valid `order`+`token` pair; anything else renders the
SAME "couldn't find that order" shell — an attacker cannot even observe that
an order number exists. The page is `noindex`. Pinned by the shopping-flow
e2e (guess → locked shell + zero PII; 32-char token in the redirect URL).

### 8.5 Boundary discipline

- **Zod at every boundary** — all Server Actions and all POST/PATCH bodies.
  (`/api/cart` DELETE `?line=` and `/api/search` `?q=` are raw strings;
  read-only and ownership-scoped — accepted.)
- **Admin is role-gated server-side**: every action in
  `src/lib/actions/admin.ts` starts with `requireAdmin()`; the layout checks
  too. Client checks are UX only.
- **Checkout hardening:** malformed JSON → 400 (not 500) on every route that
  reads a JSON body (cart, checkout, wishlist, contact, newsletter,
  addresses); a quantity-0 line can never be created
  (`clampPurchaseQuantity` in `src/lib/cart-quantity.ts` — the cart PATCH
  **deletes** the line) and a stale one is rejected with 409 before pricing;
  stock decrement is a conditional atomic `updateMany` inside the
  transaction (the check-then-decrement race is closed); the PATCH response
  carries the server-clamped `quantity` so optimistic islands can mirror it.
- **Order lifecycle:** `src/lib/order-status.ts` — `cancelled` and
  `delivered` are terminal (`canTransitionOrderStatus`); moving a live order
  to `cancelled` restocks every item inside the SAME admin transaction
  (`shouldRestockOnStatusChange`), exactly once.
- **Login merges the guest cart + wishlist** (`mergeGuestCarts` in
  `src/lib/actions/auth.ts`): `getOrCreateCart`/`getOrCreateWishlist` run
  right after `createSession`, best-effort — without them a guest with a
  full cart would see a stale cart after signing in. The cart merge itself
  is planned by the pure `computeMergedQuantities` (`src/lib/cart-merge.ts`,
  unit-pinned) and applied as **one transaction** with idempotent
  final-quantity upserts — a retried merge can never double-count.
- Cookies: `httpOnly`, `SameSite=Lax`, `secure` in production
  (`homenest_session`, `homenest_cart`, `homenest_wishlist` all aligned).
- Output safety: zero `dangerouslySetInnerHTML` except the two JSON-LD data
  blocks (builder-owned, no user-authored HTML reaches them); carousel
  `ctaLink` and product `images` accept only internal paths or `http(s)`
  URLs (`safeLinkSchema` / `imageUrlSchema`) — the production CSP is
  `img-src 'self' data:`, so anything else would silently never render.
- Platform headers: `poweredByHeader: false` (no framework fingerprint),
  HSTS with `includeSubDomains`, `Permissions-Policy` disabling
  camera/microphone/geolocation/payment.
- Error surfaces: `(storefront)/error.tsx` + `global-error.tsx` render the
  branded error card — keep them dependency-free.

## 9. Anti-Patterns & Common Bugs

### 9.1 The Tailwind v4 display-utility toggle (THE mobile-nav bug)

v4 changed display-utility generation order, so JS-toggling the `hidden`
class on an element that also carries `flex`/`block` is unreliable
(tailwindlabs/tailwindcss#15884, #18653); preflight's `[hidden]` is also
`!important`. Symptom: the mobile menu opens once, then never again, or
flashes. **Rule:** never JS-toggle a display utility. Overlays/menus mount
conditionally via React state (`mobile-nav.tsx`: `if (!mobileNavOpen) return
null;`) or animate with transform/opacity. Pinned by
`tests/e2e/mobile-navigation.spec.ts` (6 assertions incl. double-open/close
cycles).

### 9.2 Bare HSL triplets in `@theme inline`

`--color-primary: 24 70% 50%` silently resolves to transparent under `@theme
inline`. Always full values: `hsl(24 70% 50%)`.

### 9.3 Environment shadowing of `DATABASE_URL`

Any `DATABASE_URL` already in the process env (shell export, CI inject)
**wins over the repo `.env`** — Prisma never overrides existing process env.
Symptom: `db/custom.db` never appears at the repo root, or rows survive
"fresh" reseeds. Diagnose:
`node -e "console.log(process.env.DATABASE_URL)"` from the repo root. Fix:
converge the paths (symlink/hardlink) or unset before DB commands.

### 9.4 Prerendered page + per-request nonce = silent non-hydration

§8.2. The trap's signature is **no console errors** — don't debug the JS,
debug the rendering mode (`x-nextjs-prerender` response header).

### 9.5 Toaster as a sibling of `{children}`

The toast context must **wrap** the page tree in the root layout. Sibling
placement 500s every toast-using page during SSR.

### 9.6 Check-then-act across an await

Stock validation via `findUnique` followed by a separate `update` is a race.
Any "validate then write" pair inside a transaction must become a single
conditional write (`updateMany` with the guard in `where`) + count check.

### 9.7 Zero-quantity ghost lines

Clamping `Math.min(qty, stock)` to 0 and persisting it creates a line that
checkout "buys" for $0 (the `stock < quantity` guard passes for `0 < 0`).
Clamp to 0 ⇒ delete the line; checkout backstops with a 409 filter.

### 9.8 Sequential IDs as an authz decision

`/track-order?number=…` used to render full PII for guessable numbers. Any
object exposed publicly needs a second, unguessable or knowledge-based factor
(here: the purchase email), or an ownership check.

## 10. Debugging Guide

| Symptom | Likely cause | Play |
|---|---|---|
| Page paints but never hydrates, **no console errors** | Prerendered shell + per-request CSP nonce (§8.2) | Check `x-nextjs-prerender` header; add `await connection()` to the route's layout |
| Mobile menu won't open/close reliably | `hidden`-class JS toggle (§9.1) | Mount conditionally; run `npx playwright test tests/e2e/mobile-navigation.spec.ts` |
| Element invisible / transparent backgrounds | Bare HSL triplet in `@theme` (§9.2) | Use full `hsl()` values |
| DB file appears in the wrong place / reseed keeps rows | env shadowing (§9.3) | Diagnose with node one-liner; converge paths |
| E2E clicks do nothing, native GET in URL | Clicks raced hydration | Use `gotoHydrated()`; never raw `goto` + click |
| Standalone assets 404 | `build` didn't copy static/public into `standalone/` | Re-run `npm run build` (the script does the copies) |
| Prod server refuses to start with AUTH_SECRET error | `assertAuthSecret` gate | Set a real `AUTH_SECRET` in `.env` (build copies it into `standalone/`) |
| Checkout returns 409 "Only N left" | Live stock lower than cart line | Expected UX; test with seeded stock |
| Toast throws / no toast renders | Toaster not an ancestor of children (§9.5) | Fix root layout nesting |
| Tests hit rate limits | Reused server across runs + tight window | Restart the standalone server, or raise the limit for local runs |

## 11. Pre-Ship Checklist

Run the full chain — it is the only gate:

```bash
npm run lint && npm run typecheck && npm run typecheck:tests && npm run test && npm run build && npm run test:e2e
```

Then verify by hand:

- [ ] `curl localhost:3000/api/health` → `"db":"up"` (server + DB contract)
- [ ] Mobile menu opens/closes twice in a row (v4 trap regression)
- [ ] Login wrong-password **and** unknown-email show the SAME message
- [ ] `/track-order?number=<valid>` alone shows the alert (no PII)
- [ ] A guest can add to cart, checkout, and see `ORD-YYYY-NNN`
- [ ] Admin console loads every section with the admin account
- [ ] `git status` shows no `.env`, `db/*.db`, keys, or `node_modules`
- [ ] New external inputs pass through a Zod schema
- [ ] Any money change has a `computeOrderMoney` / unit test counterpart

## 12. Lessons Learnt & How to Avoid Them

1. **The e2e suite is the spec.** Three production bugs (Toaster nesting,
   CSP-nonce hydration, cart-badge races) were found only by driving the real
   standalone server — unit tests were all green. Reproduce test failures
   against the standalone server before touching code.
2. **Framework migration docs are not enough; pin behavior with tests.** The
   v4 display-order bug and the nonce trap are both invisible until a test or
   a user hits them. The regression specs exist so the next agent can't
   reintroduce them by "simplifying".
3. **`force-dynamic` is not a de-prerender switch in Next 16.4** —
   `connection()` is. Don't trust names; check the response header.
4. **Money math must have exactly one home.** Every "small" formatting change
   outside `money.ts`/`order-money.ts` drifts the totals. The unit tests pin
   the seam — extend them instead of duplicating math.
5. **Anti-enumeration is a UX contract, not a crypto one.** Uniform errors
   must be genuinely uniform (message AND timing — hence the dummy scrypt
   burn), and the e2e suite asserts both paths.
6. **Document traps where they will be read** — the header of `globals.css`,
   the comment above `await connection()`, the trap log in `AGENTS.md`. A
   README-only warning gets skipped; an in-file comment at the point of
   temptation does not.
7. **Snapshot at write time.** Orders copy name/image/price so catalog edits
   and price changes never corrupt history. Don't join back to the live
   product for receipts.
8. **Idempotent seeds are a superpower.** `db:setup` anytime; the seed
   upserts by natural keys (slug/email). New fixtures = extend `prisma/seed.ts`,
   never hand-edit the DB.

## 13. Pitfalls to Avoid

- Don't add `tailwind.config.js` — CSS-first only.
- Don't remove the `connection()` pin in the `(auth)` layout.
- Don't JS-toggle `hidden`, `flex`, `block` on the same element.
- Don't "upgrade" the pinned `--shadow-sm` / radius scale / hover variant.
- Don't trust `process.env.DATABASE_URL` in the sandbox — check for shadowing.
- Don't read `.env` at runtime in standalone mode and expect repo-relative
  paths — the build copies `.env`; runtime CWD is `.next/standalone`.
- Don't return rich error detail from auth (enumeration), and don't skip the
  dummy-hash burn because tests "feel" slower.
- Don't store full card data — the demo payment stores `cardLast4` only.
- Don't commit `.env`, `db/*.db`, `*.key`, `ssh-key.txt` (gitignore enforces).
- Don't create feature branches — `main` only, Conventional Commits, atomic.

## 14. Best Practices

- **TDD order:** failing test → minimal fix → full gate chain. The repo's
  tests encode contracts (db-path, order-money, rate-limit, auth-secret,
  tracking access, cart clamp); extend them first.
- **One validation module.** New inputs = new Zod schema in
  `validation.ts` + unit test; reuse `emailSchema`/`passwordSchema`.
- **Server-first rendering:** fetch in RSC via Prisma; islands only for
  stateful UI; route handlers only for island fetches.
- **Batch DB reads** (`Promise.all` + `include`); there are no N+1s in the
  codebase today — keep it that way; cap unbounded reads with `take` where
  the UI is bounded (home grids use `take: 8`).
- **Cookies through helpers:** `CART_COOKIE` / `findCartId` / `cookieOptions`
  in `lib/cart.ts` and the wishlist equivalents — never re-hardcode names or
  flags.
- **Evidence over assertion:** a change is done when lint+typecheck+tests+
  build are green and affected e2e specs pass — not when it looks right.

## 15. Coding Patterns (with code)

### 15.1 Conditional-mount overlay (v4-safe)

```tsx
// src/components/store/mobile-nav.tsx — never toggle `hidden`
export function MobileNav() {
  const { mobileNavOpen } = useStore();
  if (!mobileNavOpen) return null;          // ← the whole trick
  return <div data-testid="mobile-menu">…push-down panel…</div>;
}
```

### 15.2 Zod boundary + action state

```ts
// src/lib/actions/auth.ts (shape)
const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
if (!parsed.success) return { error: firstError(parsed.error) };
const limit = rateLimit(`login:${parsed.data.email}`, 10, 60_000);
if (!limit.ok) return { error: `Too many sign-in attempts. Please try again in ${limit.retryAfterSec}s.` };
// uniform failure path + dummy scrypt burn for unknown accounts
```

### 15.3 Atomic stock reservation inside the order transaction

```ts
// src/app/api/checkout/route.ts — guard lives in the WHERE, not in JS
const reserved = await tx.product.updateMany({
  where: { id: item.productId, stock: { gte: item.quantity } },
  data: { stock: { decrement: item.quantity } },
});
if (reserved.count === 0) throw new CheckoutError(409, "Stock just ran out …");
```

### 15.4 Optimistic update with per-line lock and rollback

```tsx
// cart-lines.tsx / store-chrome.tsx (drawer)
const prev = lines;
setLines(optimistic); setPendingId(line.id);
try { const res = await fetch("/api/cart", {…});
  if (!res.ok) throw new Error(data.error ?? "Could not update your cart.");
  if (typeof data.itemCount === "number") setCartCount(data.itemCount);
} catch { setLines(prev); } finally { setPendingId(null); }
```

### 15.5 Hydration-gated e2e

```ts
// tests/e2e/helpers.ts
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('html[data-hydrated="true"]');
}
```

## 16. Coding Anti-Patterns

- `any` / `as any` — banned (strict TS, lint).
- `parseFloat`/`Number()` on price fields outside `money.ts` — banned; money
  is integer cents.
- Manual `typeof x === "string"` validation for request bodies instead of Zod.
- `useState` mirrored from props via `useEffect` — use the
  adjust-during-render pattern (see `cart-lines.tsx` lines 30-34).
- Client-trusted totals/prices — the server re-derives; client mirrors only.
- Feature branches / long-lived WIP commits — `main` + atomic Conventional
  Commits only.

## 17. Responsive Breakpoint Reference

Tailwind default scale as used in the codebase:

| Breakpoint | Width | Primary usage |
|---|---|---|
| (base) | < 640px | mobile-first stack; hamburger + push-down menu; drawer is full-width |
| `sm` | ≥ 640px | 2-col forms/grids, container padding |
| `md` | ≥ 768px | product grid 2→3, checkout 2-col summary |
| `lg` | ≥ 1024px | desktop header nav appears (`hidden lg:flex`), hamburger hides (`lg:hidden`), admin sidebar rail |
| `xl` | ≥ 1280px | max content width caps; 4-col home grids |

E2E pins: desktop 1440×900 (Desktop Chrome), mobile iPhone 13 viewport on
Chromium (`playwright.config.ts`).

## 18. Z-Index Layer Map

| z | Used by |
|---|---|
| `z-10` | sticky header, badge overlays on cards |
| `z-40` | mobile nav panel (below drawer/backdrop) |
| `z-50` | cart drawer + its backdrop, Radix dialog/sheet/toast portals |
| `z-[100]` | toast viewport (must beat everything) |

Rule: overlays are portal-rendered at `z-50`; nothing custom above `z-[100]`.

## 19. Color Reference (Complete)

From `src/app/globals.css` `@theme inline` (all values exact):

| Token | Value |
|---|---|
| `--color-background` | `hsl(30 20% 98%)` (warm cream) |
| `--color-foreground` | `hsl(20 14% 12%)` |
| `--color-card` / popover | `hsl(0 0% 100%)` |
| `--color-primary` | **`hsl(24 70% 50%)`** (terracotta) |
| `--color-primary-foreground` | `hsl(0 0% 100%)` |
| `--color-secondary` / muted | `hsl(36 16% 94%)` |
| `--color-muted-foreground` | `hsl(25 9% 45%)` |
| `--color-accent` | `hsl(24 70% 96%)` (soft orange wash) |
| `--color-accent-foreground` | `hsl(24 70% 35%)` |
| `--color-destructive` | `hsl(0 72% 51%)` |
| `--color-border` | `hsl(33 15% 90%)` |
| `--color-input` | `hsl(33 15% 88%)` |
| `--color-ring` | `hsl(24 70% 50%)` |
| `--color-badge-sale` | `hsl(0 72% 61%)` |
| `--color-badge-featured` | `hsl(24 70% 60%)` |
| Radius pins | sm 6px · md 8px · lg 10px · **xl 12px · 2xl 16px · 3xl 24px** |
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` (v3 geometry pin) |

The mobile-menu close button's green (`bg-emerald-500`-family) is a
reference-matched utility class, not a token — do not tokenize it away.

## 20. The Complete TypeScript Interface Reference

The load-bearing types (see each module for the rest):

```ts
// src/lib/auth.ts
export type SessionUser = { id: string; email: string; name: string; phone: string | null; role: string };

// src/lib/cart.ts
export type CartLine = { id: string; productId: string; name: string; image: string;
  unitPrice: number; quantity: number; lineTotal: number; stock: number };
export type CartSummary = { lines: CartLine[]; itemCount: number; subtotal: number };

// src/lib/order-money.ts
export type OrderMoneyInput = { subtotal: number; discount: number;
  shippingMethod: "standard" | "express"; freeShippingThresholdCents: number;
  standardShippingCents: number; expressShippingCents: number; taxRatePercent: number };
export type OrderMoney = { shipping: number; tax: number; total: number };

// src/lib/rate-limit.ts
export type RateLimitResult = { ok: boolean; retryAfterSec?: number };

// src/lib/validation.ts (schemas are the contract)
trackOrderSchema = { number: string(uppercased); email: string(lowercased) }
checkoutBodySchema = checkoutSchema & { cardLast4?: string /* ^\d{4}$/ */ }

// src/lib/actions/auth.ts
export type AuthFormState = { error: string | null };

// src/lib/actions/reviews.ts
export type ReviewActionResult = { ok: true } | { ok: false; error: string };
```

---

## Appendix A — Architecture Decision Records

Full rationale lives in `Project_Architecture_Document.md` §1; the index:

| ADR | Decision |
|---|---|
| ADR-001 | Next.js 16 App Router (not a Vite SPA, not a separate API server) |
| ADR-002 | SQLite via relative `file:../db/custom.db` resolved against `prisma/schema.prisma` |
| ADR-003 | DB-backed sessions + HMAC-signed cookie + scrypt (Auth.js/NextAuth rejected) |
| ADR-004 | Guest carts/wishlists via token cookies, claimed & merged on login |
| ADR-005 | Integer-cent money; server-side re-derivation via `computeOrderMoney` |
| ADR-006 | Per-request CSP nonces via `src/proxy.ts` (+ the prerender trap it creates) |
| ADR-007 | Tailwind v4 CSS-first theme with reference-pinned tokens + trap log |

Session-2 additions (recorded in `docs/REMEDIATION_PLAN.md`): tracking
requires number+email; `AUTH_SECRET` enforced in production; in-memory rate
limiter; atomic stock reservation; uniform login errors; demo-mode gate.

## Appendix B — Session History & Audit Trail

- **Session 1 (migration):** Vite SPA (client-only, localStorage, client-side
  SHA-256 "auth") → Next.js 16 + Prisma full-stack superset. Reference recon
  via agent-browser (13 screenshots, 8-product catalog + images scraped).
  69 unit + 28 e2e green; pushed as `87cfa40`.
- **Session 2 (remediation):** full re-audit (0 critical / 1 high /
  6 medium / 14 low); remediation plan at `docs/REMEDIATION_PLAN.md`; all
  planned fixes executed TDD-first; gates re-run green (94 unit / 28 e2e);
  screenshots refreshed; `homenest-store-s_SKILL.md` + `worklog.md` created.
- **Session 3 (hardening):** fresh deep audit (1 HIGH / 4 MEDIUM / 4 LOW);
  token-gated `/checkout/success` receipts (HMAC `order-access.ts`),
  idempotent checkout (`Order.idempotencyKey @unique`), money derived inside
  the order transaction, order-status workflow + cancel-restock, login
  cart/wishlist merge, coupon lifecycle (`expiresAt`/`maxRedemptions`/
  `timesUsed`). 115 unit + 31 e2e green.
- **Session 4:** re-validation + fresh deep audit (0 HIGH /
  1 MEDIUM / 12 LOW + nits). Per-IP auth budgets (`clientIp()`), atomic
  coupon-cap increment (`couponRedemptionWhere`), transactional cart POST
  with the shared clamp, cart/wishlist POST limiters, six FK/hot-path
  `@@index` entries, `mergeReviewAggregate` (fixes the parity-count
  collapse), create-only coupon seeding, sitemap/robots privacy contract,
  dead-script removal, `tsconfig.tests.json` (`typecheck:tests`), and the
  a11y/nit bundle (drawer Escape + focus, carousel pause-on-hover/
  reduced-motion, header `aria-expanded`, cart-lines clamp mirror).
  131 unit + 32 e2e green.
- **Session 5:** re-validation (all session-4 gates green on the
  pulled tree; visual parity + mobile nav re-verified against the LIVE
  reference) + fresh deep audit (0 HIGH / 3 MEDIUM / 6 LOW / 4 NIT; CSRF
  posture ADEQUATE). Executed TDD-first: **schema.org JSON-LD** (pure
  builders in `src/lib/seo.ts` — Product blocks + canonicals on detail
  pages, Organization + WebSite site-wide; `tests/unit/seo-ld.test.ts` +
  the new `tests/e2e/seo-platform.spec.ts`), honest receipt copy (no email
  is shipped — copy points at the receipt link + Track Order; pinned),
  branded error boundaries (`(storefront)/error.tsx` + `global-error.tsx`),
  `icon.svg` + `manifest.ts`, `poweredByHeader: false` + HSTS
  `includeSubDomains` + `Permissions-Policy`, per-IP limiters on search GET
  (120/min) + cart PATCH/DELETE (60/min), `imageUrlSchema` scheme rule on
  product images, the **transactional cart merge** (pure
  `computeMergedQuantities` planner + one `$transaction` with idempotent
  final-quantity upserts), footer social links wired from settings, and
  `bun.lock` untracked. 149 unit + 38 e2e green.
- **Session 6 (this pass):** re-validation (all session-5 gates green on
  the pulled tree; visual parity + mobile nav re-verified against the LIVE
  reference, logged in) + fresh deep audit (1 HIGH / 6 MEDIUM / 8 LOW /
  5 NIT). Executed TDD-first: **spoof-resistant `clientIp(Headers)`**
  (CF-Connecting-IP → rightmost XFF → direct; the five inline
  `split(",")[0]` copies eliminated — the HIGH), transactional wishlist
  merge + P2002-race-safe cart/wishlist creates, **site-wide OpenGraph +
  Twitter share cards** (branded `public/images/og-default.png`; product
  pages share the first product image), canonical URLs on every public
  page (`siteBaseUrl()`; `/products` facets canonicalize to the base
  listing), `imageUrlSchema` on carousel slide images, **stock-aware cart
  merge** (third clamp dimension), bounded analytics aggregation
  (`orderItem.groupBy` + pure `foldItemAggregates`/`topProducts` in
  `src/lib/analytics.ts`), **ownership-bound idempotent replay**
  (`Order.cartToken` + `replayAuthorized`), honest pagination (reviews
  `?reviews=N`, account orders `?page=N`, real totals + snap-back),
  addresses POST/DELETE limiters, settings-driven legal contact email,
  `priceValidUntil` + validation `.max()` bounds, hamburger toggle +
  carousel-dot a11y, `COUPON_STORAGE_KEY` single-sourced, stray Vite
  `index.html` removed, `docs/DEPLOYMENT.md` rewritten for this codebase.
  174 unit + 39 e2e green.
- Known accepted risks (documented, deferred): 404 shell prerendered
  without nonce (inert islands); cookie `secure` tied to NODE_ENV
  (behind-proxy deployments should revisit); shared-store rate limiter
  (mechanical swap); admin coupon UI (enforcement complete, management
  stays DB-level with create-only seeding); review radiogroup arrow-key
  roving focus (buttons remain individually operable); real email
  delivery (copy is honest; a mailer needs provider credentials + bounce
  handling — an epic); wishlist heart filled-state (feature work: needs
  wishlist ids threaded through product grids; labels name the product).

### Session 7 — data-integrity completion (2026-10-14, v1.4.0)

- Re-validated session-6 on a fresh clone: all gates green (174 unit /
  39 e2e), visual parity + mobile menu re-verified against the LIVE
  reference (logged in) — reference unchanged, clone remains the superset.
- Fresh deep audit (repo code-review-checklist 12-category scan, all lib
  modules + routes + pages read): 2 MEDIUM / 8 LOW / 3 NIT new findings.
- TDD fixes (S7-1..S7-13): guarded guest-cart/wishlist CLAIM at first
  login (cross-device e2e); `resolveReplay` ownership gate on the
  checkout P2002 recovery path; seed policy `src/lib/seed-policy.ts`
  (products refresh CONTENT only — price/stock/rating/reviewCount/badge/
  flags are admin- or traffic-owned; settings + slides create-only) with
  a live reseed verification; `siteBaseUrl()` single-sourcing (4 sites);
  legal body copy `{{contactEmail}}` tokenization (live-verified);
  `imageUrlSchema` root-relative ONLY (CSP-aligned, http(s) branch
  removed); price/compareAtPrice `.max()` bounds; address-book cap
  (20/user, friendly 409) + transactional single-default invariant;
  `jsonLdScript()` escaper on all three ld+json blocks; `newRequestId()`
  secure-context fallback for checkout keys; search/cart-summary `{error}`
  500 shape; hourly opportunistic session sweep (`sessionSweepDue`);
  wishlist hearts label the product name.
- 197 unit + 41 e2e green; 23 screenshots refreshed; DEPLOYMENT seed
  paragraph amended; AGENTS/CLAUDE/README/PAD aligned.

### Session 8 — address-book/review-integrity completion (2026-10-13, v1.5.0)

- Re-validated session-7 on the pulled tree (`636faa5`): all gates green
  (197 unit / 41 e2e), visual parity + mobile menu re-verified against the
  LIVE reference — reference unchanged, clone remains the superset.
- Fresh deep audit (read-only subagent + own verification): session-7
  fixes 12 WIRED / 1 PARTIAL (S7-8 default invariant only on the checkout
  path) / 0 MISSING; new findings 2 MEDIUM / 7 LOW / 4 NIT.
- TDD fixes (S8-1..S8-13): the account address POST runs count+create in
  ONE tx and the FIRST address auto-defaults; new `PATCH /api/addresses`
  promotes a default in-tx + per-card "Set as default" control (S8-1,
  e2e: first address prefills checkout; badge moves); transactional review
  aggregate via `growReviewAggregate` inside `db.$transaction` (S8-2);
  `src/lib/prisma-errors.ts` — `uniqueTargetField` matches field arrays,
  bare strings AND constraint-name strings so the S7-2 recovery branch can
  never silently disable (S8-3, fixture unit tests); wishlist toggle
  delete via `deleteMany` (S8-4); hero carousel derived index clamp when
  slides shrink (S8-5); wishlist bounded at 100 (`assertWishlistCap`),
  page `take`, and `POST /api/cart/bulk` — one request, one tx, shared
  clamp, 10/min limiter — replacing the limiter-fighting add-all loop
  (S8-6, e2e); noindex on cart/track-order/account/checkout/login/register
  (S8-9, e2e-pinned); category P2002 duplicate message (S8-13); dead code
  removed (`ui/sheet.tsx`, `searchOpen` context, 2 unused Radix deps)
  (S8-11); docs model count 17→18 (S8-10). Deferred: drawer focus trap
  (S8-7), login-limiter lockout tradeoff (S8-8), address dedup.
- 212 unit + 48 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/DEPLOYMENT aligned.

### Session 9 — badge/order-transition completion (2026-10-13, v1.6.0)

- Re-validated session-8 on the pulled tree (`401ec63`): all gates green
  (212 unit / 48 e2e), visual parity + mobile menu re-verified against the
  LIVE reference — reference unchanged, clone remains the superset.
- Fresh deep audit (read-only subagent + own verification): session-8
  fixes 11 WIRED / 2 accepted deferrals / 0 MISSING; new findings
  2 MEDIUM / 2 LOW / 4 NIT + 1 doc drift.
- TDD fixes (S9-1..S9-8): the store context's `cartCount` is
  `number | null` initialized `null` so the header badge falls back to the
  server-computed count on every fresh load (S9-1 — it used to initialize
  at 0, making the fallback dead code and every hard load badge-less;
  e2e `cart-badge.spec.ts` was red against the old build); guarded
  `applyOrderStatusTransition` in `order-status.ts` — the status write is
  its own guard (`updateMany` on the in-tx status), the event + restock
  derive from the guarded winner, conflicts return the accurate error
  (S9-2 — two admins cancelling the same order can no longer double-restock);
  race-safe `promoteAddressInTx` promotes FIRST via a scoped conditional
  `updateMany` and aborts on a gone row (S9-3 — no more P2025 500s, no
  stranded zero-default books); the dashboard folds bounded
  `SUM GROUP BY date(placedAt/1000,'unixepoch')` day buckets via pure
  `buildRevenueChart` (S9-4 — Prisma stores SQLite DateTimes as
  epoch-millis INTEGERs, the bare `date()` form returns NULL);
  `@@index([userId])` on Address + `@@index([expiresAt])` on Session
  (S9-5); `/api/cart-summary` metered 120/min (S9-6); search `q` clamped
  to 100 chars (S9-7); bulk plan extracted to pure `cart-bulk.ts`
  (`dedupeBulkWanted`/`planBulkUpsertQuantity`, unit-pinned) (S9-8).
  Deferred: checkout P2002 recovery-loop integration seam (helpers already
  pinned) + the carried a11y/abuse-model items.
- 229 unit + 50 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/DEPLOYMENT aligned.

### Session 10 — address-default/cart-line completion (2026-10-13, v1.7.0)

- Re-validated session-9 on the pulled tree (`fc57d39`): all gates green
  (229 unit / 50 e2e), visual parity + mobile menu re-verified against the
  LIVE reference (the reference's first carousel slide confirmed as
  "New Arrivals" by clicking its slide dot — identical to the clone;
  reference unchanged, clone remains the superset).
- Fresh deep audit (read-only subagent + own file:line verification):
  session-9 fixes 8/8 WIRED / 0 PARTIAL / 0 MISSING; new findings
  1 MEDIUM / 3 LOW / 1 NIT · 0 HIGH.
- TDD fixes (S10-1..S10-5): deleting the DEFAULT address re-promotes the
  newest remaining row in the SAME delete transaction
  (`reassignDefaultAfterDeleteInTx`, S10-1 — the old DELETE stranded the
  book at zero defaults and checkout prefill silently died; live-verified:
  delete default → next-newest auto-promoted → checkout prefill renders
  the promoted address); cart PATCH writes are scoped conditional writes
  with `count === 0` → 404 (S10-2 — a line deleted by a concurrent tab
  surfaces as "not found", never a P2025 500); the address-book cap check
  moved INSIDE the create transaction (S10-3 — `assertAddressCap(tx, …)`
  first statement, `AddressCapError` → friendly 409 from the catch, so
  concurrent POSTs at cap − 1 cannot overshoot); the guest→user wishlist
  merge plans its upserts through pure `planWishlistMerge`
  (S10-4 — order kept, already-owned skip, guest dedupe, cap truncation;
  the old loop was the one create path outside the POST cap and could
  strand overflow permanently invisible behind the page's `take`); the
  bulk add-all reports BOTH skip reasons (S10-5 — `skipped =
  goneInactive + soldOut` so the "added N of M" toast arithmetic adds up).
- 241 unit + 50 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/SKILL aligned; run narrative at `docs/session_13.md`.

### Session 11 — limiter/heart-state completion (2026-10-13, v1.8.0)

- Re-validated session-10 on the pulled tree (`98dc342`): all gates green
  (240 unit / 50 e2e — one e2e flake root-caused instead of dismissed: the
  wishlist toast locators hit the strict-mode race admin.spec fixed in
  session 9), visual parity + mobile menu re-verified against the LIVE
  reference (hero slides 1-3, trust badges, 8 categories, featured
  products identical; reference unchanged, clone remains the superset).
- Fresh deep audit (read-only subagent + own file:line verification):
  session-10 fixes 5/5 WIRED / 0 PARTIAL / 0 MISSING; new findings
  1 MEDIUM / 2 LOW / 3 NIT · 0 HIGH.
- TDD fixes (S11-1..S11-6): the review limiter is two-tier now
  (S11-1 — `reviewRateLimitKeys` gives the authoritative per-IP
  `review-ip:` 20/min ceiling that bounds author rotation + the per-author
  5/min budget; the old key embedded the client-controlled author string
  and let rotation mint fresh budgets while its comment claimed otherwise);
  wishlist hearts render the server-truth filled state (S11-2 — pages pass
  `initialInWishlist` via `getWishlistIds()` through `ProductCard`; the
  heart shows `fill-primary` + `aria-pressed` + honest Add/Remove labels
  and flips from the API response; the AGENTS.md invariant is now TRUE
  instead of weakened); wishlist.spec toast assertions follow the
  documented `.first()` convention (S11-3 — the flake that started the
  session); admin carrier tracking is a guarded write (S11-4 —
  `applyCarrierTracking`: scoped `updateMany`, `count === 0` →
  `OrderGoneError` → friendly message, event only from the guarded
  winner); the login "Forgot password?" mailto follows the admin-editable
  `settings.contactEmail` (S11-5 — the S7-5 sweep's last hardcoded
  shadow); the address cap's authoritative gate is the POST-CREATE count
  (S11-6 — on SQLite the write lock lands at the first write, so
  create-then-verify is airtight where check-then-create was not; the
  pre-create check stays as fast-fail UX).
- 246 unit + 51 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/SKILL aligned; run narrative at `docs/session_15.md`.

### Session 12 — parity-order/demo-hygiene completion (2026-10-13, v1.9.0)

- Re-validated session-11 on the pulled tree (`2d3af58`): all gates green
  (246 unit / 51 e2e), live-reference parity + mobile menu re-verified
  (logged in with the operator credentials; account/order surfaces covered
  by the clone's superset).
- **New parity finding from the live comparison**: the reference's
  `/products` default "Newest" view and home "New Arrivals" both render its
  catalog in authored order (Damascus Steel Chef Knife Set first); the
  clone rendered the REVERSE of its seed order on both surfaces (relying on
  auto-`now()` seed timestamps) while home "Featured" (`createdAt: asc`)
  matched — three surfaces disagreeing with each other.
- Fresh deep audit (read-only subagent + own file:line verification):
  session-11 fixes 6/6 WIRED; new findings 0 CRITICAL / 0 HIGH / 3 LOW /
  1 NIT, with one reported NIT ("mangled accent class") REJECTED on
  verification — the built CSS contains the compiled
  `accent-color:#d96e26` rule, proving the arbitrary utility is valid
  (a text-mangling artifact, not a code defect — verify against build
  output before trusting "dead utility" claims).
- TDD fixes: **S12-1** the checkout sweep deletes through
  `cartClearFilter` — only the ordered line ids (a bare `{ cartId }`
  deleteMany silently ate a line a concurrent tab added between the
  summary read and the sweep); **S12-2** the demo-credentials quick-fill
  (which names the seeded ADMIN account) is OFF by default in production
  builds (opt-in `NEXT_PUBLIC_DEMO_MODE="true"`, dev unchanged — verified
  live both ways on the built server); **S12-4** `/checkout/success`
  verifies the deterministic order-access token BEFORE any DB read (no
  query-weight differential to probe order existence with);
  **S12-5** `productSeedCreatedAt(index)` backdates seed rows one minute
  apart (create-only — reseeds never rewrite them) and home featured
  flipped to `desc`, so all three surfaces render the reference's authored
  order while admin-created products correctly sort as the newest.
- Coverage pins: `settingNumber` extracted pure (an empty/corrupt numeric
  setting is "missing", never "zero"); new `contact-newsletter.spec.ts`
  (the two previously-uncovered capture surfaces: UI success states + the
  400 boundary incl. malformed JSON); cart-PATCH/DELETE lost-line 404/200
  pin (S10-2); guest-wishlist → registration merge e2e (S10-4 wiring).
  The storefront spec's page-split assertions were REWRITTEN — they had
  institutionalized the reversed order (a test pinning the bug).
- 257 unit + 59 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/SKILL/DEPLOYMENT aligned; run narrative at
  `docs/session_17.md`.

### Session 13 — drawer-a11y/bundle-hygiene completion (2026-10-13, v1.10.0)

- Re-validated session-12 on the pulled tree (`8439105`): all gates green
  (257 unit / 59 e2e), live-reference parity re-verified (logged in with the
  operator credentials; the session-12 authored-order fix holds on both
  sides), mobile menu re-verified on the production build.
- Fresh deep audit (read-only subagent + own file:line verification):
  session-12 fixes 4/4 WIRED; new findings 0 CRITICAL / 0 HIGH / 1 MEDIUM /
  4 LOW / 2 NIT.
- Fixes (TDD — RED first): **S13-3** the closed cart drawer gains
  `inert={!open}` + `aria-hidden` (a transform does NOT remove elements from
  the tab order/a11y tree; `inert` is a boolean attribute, not a display
  utility); **S13-1** demo credentials moved behind a server boundary
  (`demoModeEnabled` in `src/lib/demo-mode.ts`, credentials passed as props
  ONLY when enabled — the built chunk no longer contains `Admin123!`);
  **S13-2** every awaited admin-server-action carries a `catch` → inline
  error + destructive toast; **S13-4** the review insert folds into the
  aggregate-growth transaction; **S13-7** `clientIp` gains the
  `TRUST_CF_CONNECTING_IP="false"` opt-out (default preserves the session-6
  invariant); **S13-5** three admin catches narrowed to P2025 + rethrow;
  **S13-6** `utcMonthStart` (UTC month boundary for the analytics KPI).
- New pins: `session13-hardening.test.ts` (17 cases) +
  `review-transactional.test.ts` (3 cases — REAL temp SQLite via
  `datasourceUrl`: rollback semantics for the S13-4 fold) + e2e
  (closed-drawer inert, production login bundle credential-free,
  aborted-admin-save toast).
- Lesson (Appendix B): a `"use client"` file's module scope still ships —
  gating the JSX is not gating the data. Verify "hidden" secrets against the
  BUILT CHUNK, not the source.

### Session 14 — toast-timer/boundary-pin completion (2026-10-13, v1.11.0)

- Re-validated session-13 on the pulled tree (`42a188a`): all gates green
  (277 unit / 61 e2e), live-reference parity re-verified (logged in with the
  operator credentials; reference unchanged, clone remains the superset),
  mobile menu re-verified on the production build.
- Fresh deep audit (read-only subagent + own file:line verification):
  session-13 fixes 8/8 WIRED; new findings 0 CRITICAL / 0 HIGH / 0 MEDIUM /
  0 LOW / 2 NIT — the cleanest surface in the series; 5 coverage gaps +
  2 doc-drift items (the limiter grid understated checkout 20/min,
  contact/newsletter 5/min, coupon/track 30/min; CLAUDE.md listed a phantom
  `src/components/admin/` directory; the S13-2 count was 13 blocks across
  five files, not 12).
- Fixes (TDD — RED first): **S14-1** the Toaster tracks auto-dismiss timers
  in a ref registry — manual close + unmount clear pending timers (pinned by
  the suite's FIRST COMPONENT test, `toaster.test.tsx`, jsdom docblock +
  fake timers); **S14-3** the icon-only toast close button gains
  `aria-label="Dismiss notification"` (discovered by the S14-1 test).
- Coverage pins: `api-boundaries.test.ts` (route handlers verified
  import-safe in Vitest; mocked `db`; health ok/degraded-503, newsletter
  malformed-JSON/invalid-body/429, contact 429, checkout 429 +
  `Retry-After`) + the S14-3 auth e2e profile-edit/Sign Out wiring pin
  (seed name restored afterwards).
- **S14-4 (found during the final e2e gates)**: fourteen sessions of e2e
  checkout traffic had permanently drained the traffic-owned demo stock
  (the S7-3 seed policy never refreshes it) — Damascus hit stock 0 and the
  stock-assuming pins failed. Fix: `scripts/restore-demo-stock.ts` tops
  every product back to its seed value as the e2e webServer's first command;
  `prisma/seed.ts` is direct-execution-guarded so the script can import
  `PRODUCTS` without seeding. Lesson: distinguish DATA-depletion failures
  from code regressions before touching code.
- 287 unit + 62 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/
  README/PAD/SKILL/DEPLOYMENT aligned; run narrative at
  `docs/session_21.md`.


### Session 15 — rate-limit response hygiene + robustness pins (2026-10-13, v1.12.0)

- Re-validated session-14 on the pulled tree (`0701b44`): all gates green
  (287 unit / 62 e2e), live-reference parity re-verified (logged in; the
  reference is unchanged — same nav/hero/categories, Damascus-first order;
  mobile menu open → 7-link panel → navigate → auto-close on the production
  build).
- Fresh deep audit (read-only subagent 16-a + own file:line verification):
  session-14 fixes 5/5 WIRED; older-fix spot-checks 5/5 WIRED; new findings
  **0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW / 3 NIT / 0 doc-drift**.
- Fixes (TDD — RED first): **S15-1** the checkout 429 pin's in-budget
  assertion was vacuous (`toHaveLength` on the loop's own array) — now
  `every(s => s !== 429)`; **S15-3** every one of the 14 metered 429
  responses now carries `Retry-After` (10 sites added; newsletter/contact
  boundary pins assert it); **S15-4** `clampSearchTerm` (pure, in
  validation.ts, unit-pinned) caps every search surface at 100 chars —
  admin products/orders previously fed unbounded `contains` terms;
  **S15-5** the hero carousel caches its MediaQueryList at module level
  (getSnapshot no longer constructs one per read); **S15-2** the restore
  harness also re-activates deactivated seed products, and the storefront
  e2e cardinality pins assert the count FORMAT + seeded slugs while the
  exact seed constants (16 / Damascus-first / 3 cookware / 8 categories)
  moved to `tests/unit/seed-catalog.test.ts` — Playwright cannot import the
  seed (its CJS transform rejects `import.meta`).
- Coverage pins: the order-number allocation-exhaustion pin (five mocked
  P2002s on the NUMBER → 500 with the replay branch never consulted —
  mocked `next/headers` cookies) and the sitemap DB-failure fallback +
  product-URL pins (mocked `db.product.findMany`).
- 299 unit + 62 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/README/
  PAD/SKILL/DEPLOYMENT aligned; run narrative at `docs/session_23.md`.


### Session 16 — modal-integrity hardening + boundary single-sourcing (2026-10-13, v1.13.0)

- Re-validated session-15 on the pulled tree (`e327c82`): all gates green
  (299 unit / 62 e2e), live-reference parity re-verified (reference
  unchanged — same nav/hero/categories, Damascus-first order; mobile menu
  open → 7-link panel → navigate → auto-close on the production build; zero
  console errors).
- Fresh deep audit (read-only subagent 17-a + own file:line verification):
  session-15 fixes 6/7 WIRED + 1 PARTIAL (S15-5 implemented but unpinned →
  S16-4); older-fix spot-checks 7/7 WIRED; new findings **0 CRITICAL /
  0 HIGH / 0 MEDIUM / 2 LOW / 2 NIT / 0 doc-drift** — the fourth
  consecutive session without a CRITICAL/HIGH/MEDIUM.
- Fixes (TDD — RED first): **S16-1** the wishlist cap was check-then-create
  (concurrent POSTs at cap − 1 both created; the P2002 loser mapped to
  `inWishlist: true`, permanently overshooting the cap) — the AUTHORITATIVE
  gate moved inside the create transaction (`createWishlistItemInTx`:
  create FIRST, count under the write lock, `WishlistCapError` rolls the
  create back; the S11-6 shape; the pre-create check is fast-fail UX only);
  **S16-3** the open cart drawer declared `aria-modal` but the background
  stayed keyboard-tabbable (the carried S8-7 deferral) — `StoreChrome` now
  renders the whole page shell (`page-shell`) with `inert={cartDrawerOpen}`
  (the layout passes main/footer through the client component as props),
  plus a Tab-wrap handler (Chromium drops focus to browser chrome at the
  last control instead of wrapping) and opener-capture/focus-restore dialog
  semantics; **S16-2** the three route-local Zod schemas hoisted into
  validation.ts (`wishlistToggleSchema`, `cartLinePatchSchema` — keeping
  the PATCH 0-deletes-line floor — `couponApplySchema`); **S16-4** the
  S15-5 MQL cache pinned by the suite's second component test
  (`hero-carousel.test.tsx`: jsdom + fake timers + per-test
  `vi.resetModules()` for the module-level cache; next/image/link stubbed).
- Coverage pins: C3/C4 wishlist route boundary + create-first ordering
  (mocked `db` + `next/headers`, unique single-hop XFF per request); C5
  carousel cache/motion pins. E2e: the S16-3 open-drawer modal pin
  (shell inert, 25 Tabs stay inside the drawer, Escape → focus returns to
  the header cart toggle).
- 313 unit + 63 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/README/
  PAD/SKILL/DEPLOYMENT aligned; run narrative at `docs/session_25.md`.


### Session 17 — admin-write guard completion + ceiling single-sourcing (2026-10-13, v1.14.0)

- Re-validated session-16 on the pulled tree (`041e877` + operator
  `session_26.md`): all gates green (313 unit / 63 e2e), live-reference
  parity re-verified (reference unchanged; clone mobile menu open → 7-link
  panel → navigate → auto-close/unmount; /products Damascus-first; demo
  login → /account; zero console errors).
- Fresh deep audit (read-only subagent 18-a + own file:line verification):
  session-16 fixes **4/4 WIRED**; older-fix spot-checks **7/7 WIRED**; new
  findings **0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 1 NIT /
  1 Informational / 1 doc-drift** — the fifth consecutive session without a
  CRITICAL/HIGH/MEDIUM.
- Fixes (TDD — RED first): **S17-1** `deleteCategoryAction` was
  check-then-write and the FK-race loss path escaped as an unhandled P2003
  (`Product.category` is a required Restrict FK) — the action now routes
  through `deleteCategoryIfEmpty` (`src/lib/admin-categories.ts`): the
  pre-count stays the fast-fail UX check (exact "N products still use this
  category." message), the delete's P2003 maps to the same in-use outcome
  with an unknown count ("A product was just added to this category."),
  unrelated errors rethrow (the S13-2 contract); `isForeignKeyViolation`
  added to `prisma-errors.ts` (duck-typed, the `isUniqueViolation`
  convention). **S17-2** the cart 99-ceiling single-sourced as
  `MAX_CART_QUANTITY` (`src/lib/cart-quantity.ts`) — consumed by the clamp,
  all three cart Zod schemas (single/patch/bulk per-line), the
  purchase-panel stepper max and the header "99+" flip (cart-merge's local
  constant now aliases it; its "must stay in sync" comment retired).
  **S17-3** (Informational, recorded not fixed) `deleteProductAction`'s
  count-race is benign by design — `OrderItem.product` is optional →
  SetNull, and consumers already model null productIds.
- Coverage pins: C6 the guarded-delete outcome mapping + the
  `isForeignKeyViolation` truth table (`session17-hardening.test.ts`); C7
  the cart DELETE `?all=1` boundary (no-cart → `{itemCount:0}` + no write;
  guest cart → cartId-scoped `deleteMany` + fresh summary — api-boundaries
  pattern). Doc-drift D-1: the session-16 execution-log checkboxes flipped.
- 324 unit + 63 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/README/
  PAD/SKILL/DEPLOYMENT aligned; run narrative at `docs/session_27.md`.


### Session 18 — checkout-address extraction + ceiling UX completion (2026-10-13, v1.15.0)

- Re-validated session-17 on a fresh clone (`14d0bbb` = `6c0d708` + operator
  `session_28.md`): all gates green (324 unit / 63 e2e). Environment: this
  sandbox re-exports a shadow `DATABASE_URL` on shell recycle and BLOCKS
  symlink creation — converged with a hard link
  `/home/z/my-project/db/custom.db` → `<repo>/db/custom.db` (one inode);
  the shadow-absent path verified schema-anchored via a move-the-shadow-dir
  probe (seed succeeded with the shadow relocated — the CLI/seed contract
  holds; the earlier "Unable to open" errors were the absolute-shadow
  passthrough hitting a path that didn't exist yet).
- Fresh deep audit (read-only subagent 19-a + own file:line verification):
  session-16 fixes **4/4 WIRED**; session-17 fixes **3/3 WIRED**; older-fix
  spot-checks **7/7 WIRED** (incl. 14/14 Retry-After + 4/4 clampSearchTerm);
  new findings **0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 2 NIT /
  1 Informational / 0 doc-drift** — the sixth consecutive session without a
  CRITICAL/HIGH/MEDIUM.
- Fixes (TDD — RED first, 9 failed / 1 coverage pin): **S18-1 (Low)** the
  checkout in-tx saveAddress block extracted to `saveCheckoutAddressInTx`
  (`src/lib/addresses.ts`, the S11-6 lib pattern) returning
  `"saved" | "at-cap"` — at cap the order STILL PLACES (S7-8). The cap gate
  deliberately STAYS the PRE-create fast-fail (the OPPOSITE of the S11-6/
  S16-1 create paths): a post-create `AddressCapError` throw here would
  roll back the ENTIRE order transaction and Prisma interactive
  transactions have no savepoints; the residual bounded race recorded as
  accepted debt (the S17-3 pattern). The carried S18-4a "saveAddress
  at-cap skip-save integration pin" (deferred since session 7) closes with
  the same test file. **S18-2 (NIT)** cart-page "+" disables at
  `min(stock, MAX_CART_QUANTITY)`, drawer "+" at 99 (the stock-less drawer
  keeps the server clamp as its stock guard), and the three cart schemas
  carry the interpolated "Quantity is limited to 99 per item." store copy
  (was Zod's default English message in the error toast). **S18-3 (NIT)**
  unused `axe-core` + `@testing-library/user-event` devDeps removed via npm.
- Live verification (agent-browser, fresh production build): reference
  unchanged (nav anatomy, hero slides, 8 categories, Damascus-first, mobile
  panel = 5 links + close); clone mobile menu open → 7-link panel + search →
  navigate → auto-close/unmount; /products Damascus-first; sitemap.xml = 25
  public URLs (no private surfaces) + robots disallows + JSON-LD intact;
  demo login → /account; a full signed-in checkout with "Save this address"
  placed ORD-2026-013 and the address book grew 1 → 2 (the "saved" outcome);
  zero console errors on a fresh session.
- 334 unit + 63 e2e green; 23 screenshots refreshed; AGENTS/CLAUDE/README/
  PAD/SKILL aligned; DEPLOYMENT.md drift-free; `.env.example` unchanged
  (no new env vars); run narrative at `docs/session_29.md`.

### Session 19 — coupon management + module-graph trap (2026-10-13, v1.16.0)
- Re-validated session-18 on a fresh clone (`9a3d22e` = `67861e3` + operator
  `session_30.md`): all gates green (334 unit / 63 e2e). Environment: the
  prior sessions' convergence symlink was found DANGLING (an old workspace
  path) — removed via node, the real dir recreated, and the shadow path
  re-converged with a hard link to `<repo>/db/custom.db` (one inode).
- Live-reference parity re-verified (reference unchanged: nav anatomy, hero
  slides, 8 categories, Damascus-first, mobile panel = 5 links + close);
  clone verified on the fresh production build: mobile menu open → 7 links
  + search → navigate → auto-close/unmount; /products Damascus-first;
  sitemap = 25 public URLs; robots + JSON-LD intact; demo login → /account;
  desktop visual parity re-confirmed; zero console errors.
- Fresh deep audit (read-only subagent 20-a + own file:line verification):
  session-18 fixes **4/4 WIRED**; older-fix spot-checks **10/10 WIRED**;
  static counts re-verified (334/35 files · 63/12 specs · 18 models ·
  11/11 requireAdmin · 14 metered sites · 13 catch blocks); new findings
  **0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 1 NIT / 2 Informational /
  0 doc-drift** — the seventh consecutive session without a
  CRITICAL/HIGH/MEDIUM.
- Fixes (TDD — RED first, 23 failed / 3 by-design pins): **S19-1 (NIT)**
  the QuantityStepper's default `max = 99` literal replaced with the
  imported `MAX_CART_QUANTITY`, pinned by a jsdom test mocking the constant
  to 7 (impossible with a retyped literal). **S19-2 (Low)** the S18-1
  extraction's unset-defaults scope restored to the pre-extraction
  `where: { userId, isDefault: true }` (the broad clause touched every row
  of the book inside the checkout tx); the session-18 pin extended.
  S19-3/S19-4 (Informational) recorded as reviewed dispositions, no change.
- **Feature (S19-5) — the admin coupon-management UI** (the increment the
  audit trail carried for two sessions): `couponInputSchema` + the pure
  `couponLabel` (single-sourced with `couponDiscount`),
  `upsertCouponAction`/`deleteCouponAction` (requireAdmin, uppercase code
  normalization matching `findActiveCoupon`, S8-13 P2002/P2025 mappings,
  S13-2 rethrows), and the role-gated `/admin/coupons` surface (list with
  usage/expiry/cap badges + the category-dialog-pattern Add/Edit island +
  delete confirm + active toggle + the admin-nav Ticket item). Orders keep
  their discount snapshot across deletes. Unit-pinned + the e2e CRUD loop
  (`admin-coupons.spec.ts`: create → apply at the cart → deactivate →
  reject → delete, leaving the seeds as found).
- **NEW TRAP (Turbopack panic)**: a `export { couponLabel } from
  "@/lib/coupons"` re-export in validation.ts (client-imported) pulled
  `db` → `@prisma/client` → `node:fs` into a browser chunk — Turbopack
  PANICKED with "chunking context does not support external modules
  (request: node:fs)" pointing at an UNRELATED route (/admin/orders).
  Diagnosed by stash-bisect (pristine baseline built clean); fix = define
  the label in coupons.ts, import it directly where needed, and record the
  client-safe module-graph rule in AGENTS.md's trap section.
- 360 unit + 64 e2e green; 24 screenshots refreshed (incl.
  `15b-admin-coupons`); AGENTS/CLAUDE/README/PAD/SKILL aligned;
  DEPLOYMENT.md drift-free; `.env.example` unchanged; run narrative at
  `docs/session_31.md`.

### Session 20 — free_shipping engine + e2e isolation (2026-10-13, v1.17.0)

- Re-validated session-19 on a fresh clone (`9ed652d` = `9dad2fc` +
  operator `session_32.md`): gates green EXCEPT one e2e failure
  (`admin-coupons.spec.ts:46`) — investigated, root-caused, and turned into
  the session's first finding (below). Environment: the sandbox re-exports
  `DATABASE_URL=file:/home/z/my-project/db/custom.db` and the convergence
  symlink pointed at the fresh clone's db dir — the FIRST `db:push` with an
  explicit `DATABASE_URL=file:../db/custom.db` override created
  `<repo>/db/custom.db`, and the pre-existing symlink resolved both paths
  onto one inode (seed verified 16/8/3/2 constants).
- Live-reference parity re-verified via agent-browser (reference unchanged
  — mobile panel = 5 links + close; logged in with the provided
  credentials); clone verified: mobile menu open → 7 links → navigate →
  auto-close/unmount; sitemap = 25 public URLs; robots + JSON-LD; desktop
  parity; zero console errors.
- Fresh deep audit (read-only subagent 21-a + own file:line verification):
  session-19 fixes **ALL WIRED** (incl. the Turbopack trap staying closed);
  older-fix spot-checks **10/10 WIRED** (14/14 Retry-After, 4/4
  clampSearchTerm, all seven guarded helpers, credential boundary, v4
  pattern, MAX_CART_QUANTITY single-sourcing); static counts re-verified
  (360/38 files · 64/13 specs · 18 models · 13 requireAdmin · 14 metered
  sites · 16 catch blocks across SIX files); new findings **0 CRITICAL /
  0 HIGH / 0 MEDIUM / 1 LOW code + 1 LOW doc / 2 NIT / 4 Informational** —
  the eighth consecutive session without a CRITICAL/HIGH/MEDIUM.
- **S20-1 (High, test reliability — the observed failure)**: the
  admin-coupons spec pinned an absolute cart-badge "1" on the DURABLE admin
  cart (a Playwright actionability re-dispatch double-fired the Add-to-Cart
  POST — badge "2"→"3" observed live) and was not idempotent (an aborted
  prior run left an active SESSION5 breaking the next create). Fixed: the
  cart is seeded through the `request` fixture with a snapshot-restore
  cleanup, the setup self-heals a leftover code via delete-before-create,
  and the cart-line leak is gone ("as found" holds). The two observed
  failures WERE the RED evidence; the isolation convention is documented in
  AGENTS.md.
- **S20-2 (Low, the audit's F1)**: the coupon active-toggle round-tripped
  EVERY field from the rendered snapshot through `upsertCouponAction`
  (silent lost-update + expiry renormalization) — replaced with the narrow
  `toggleCouponActiveAction` (writes ONLY `isActive`, P2025 narrowed,
  unknown rethrown; the `toggleProductActiveAction` precedent), unit-pinned
  in `session20-hardening.test.ts`.
- **S20-6 (feature — the audit's I1 at the engine level)**: the
  first-class `free_shipping` coupon type — `couponLabel` → "Free
  shipping", `couponDiscount` → discount 0 + `freeShipping: true`
  (minSubtotal enforced), `computeOrderMoney.couponFreeShipping` zeroes
  shipping for BOTH methods independent of the spend threshold, the
  checkout mirror + `CouponApplyResponse` carry the flag, `couponInputSchema`
  pins value at 0, the dialog offers the type (value hidden; value reset on
  type switch — S20-5), the seed row ships the real type (create-only:
  fresh DBs get it; existing DBs keep the fixed row — both work), and the
  checkout increment's atomic guard gains the always-on `isActive` clause
  (`couponRedemptionFilter` — the audit's I4). The cart hint drops the
  capped SAVE20 (S20-7). S20-3/S20-4 close the doc-drift items (catch count
  13→16 across six files; the stale seed comment).
- 379 unit + 65 e2e green (the new `free-shipping-coupon.spec.ts` pins the
  full money path through the SERVER-derived receipt's "FREE"); 24
  screenshots refreshed; AGENTS/CLAUDE/README/PAD/SKILL aligned;
  DEPLOYMENT.md drift-free; `.env.example` unchanged; run narrative at
  `docs/session_33.md`.

### Session 21 — the checkout mirror fix + the request-fixture identity trap (2026-10-14, v1.18.0)

- Re-validated session-20 on a fresh clone (`dbd8674` = `a857949` + operator
  `session_34.md`): gates green EXCEPT **63/65 e2e** — `admin-coupons` and
  `auth` profile both failed. Environment: the sandbox db symlink was
  re-pointed at the fresh clone's db dir (one inode verified); seed 16/8/3/2
  verified. Live-reference parity re-verified (reference unchanged; logged
  in with the provided credentials; mobile menu 7 links → navigate →
  auto-close; sitemap 25 URLs; robots; JSON-LD; desktop parity; zero
  console errors).
- **S21-1 (High, test reliability — the observed failure, root-caused with
  a probe matrix)**: the per-test Playwright `request` fixture is
  IDENTITY-ISOLATED — it does NOT share the browser context's cookies
  (`request.storageState()` returned an EMPTY jar while `context.cookies()`
  held the session), and the production session cookie is `Secure`, which a
  plain-HTTP API client refuses to send anyway. The S20-1 "API-seeded
  cart" therefore acted as a GUEST for its entire life: the POST landed on
  a throwaway guest cart (DB-verified `userId: null`), the /cart page (the
  admin's own cart) stayed empty, and the coupon box never rendered. It
  only ever passed on a DB whose durable admin cart already had content —
  the failure was masked, not fixed, in run-21. Fix: read `homenest_session`
  from `context.cookies()` and send it as an explicit `Cookie` header on
  every admin-identity request-fixture call (the header POST is DB-verified
  to land on the admin's cart); `page.request` is the sharing alternative
  for read-shaped calls. Documented as its own AGENTS.md trap-log entry.
- **S21-2 (Medium, test reliability — observed live)**: the auth profile
  spec's `getByText("Profile updated")` raced the session-9 strict-mode
  class (2-element resolution: toast title + the aria-live wrapper) —
  `.first()` applied to all three assertions; the setup now SELF-HEALS a
  demo name left dirty by an aborted run (the seed's `update: {}` never
  re-resets it — the self-breaking cascade observed in this run).
- **S21-3 (Medium, product — the audit's F-1, session-20 regression)**: the
  checkout mirror DROPPED the `freeShipping` flag — the S20-6 diff typed it
  on `AppliedCoupon`/`CouponApplyResponse` and read it for `shippingCost`
  but never stored it in `setCoupon`, so FREESHIP rendered full shipping
  ($6.95/$15.95) and an inflated total on the checkout page (no overcharge:
  the server re-derives in-tx; the mirror contradicted the receipt). Fix:
  the setter passes the flag through. Verified live end-to-end: mirror
  total $37.61 = subtotal + tax; shipping FREE on the review card, the
  sticky summary, AND the server receipt.
- **S21-4 (Low — the vacuous pin that let S21-3 slip through 65/65)**: the
  free-shipping spec's `getByText("FREE")` is a case-insensitive substring
  match that also hits the coupon label's "Free shipping" — replaced with
  pins scoped to the actual Shipping rows (review card `dl` + the
  `aside[aria-label="Order summary"]` `dl`, each `toHaveCount(1)` +
  `toContainText("FREE")`). The RED run against the unfixed mirror printed
  `"Shipping$6.95"` — the exact defect — before the fix turned it green.
- **S21-5/S21-6 (NITs)**: the stale "the request fixture shares the admin
  session cookies" inline comment (the exact premise S21-1 disproved)
  reworded; the `couponRedemptionFilter` doc comment no longer overclaims
  expiry coverage (expiry stays READ-guarded by the in-tx
  `isCouponRedeemable`; the sub-second expiry residue is the accepted class
  the deactivation gap was in). **S21-7 (NIT, disposition recorded)**: the
  cart's server-rendered threshold hint does not know an applied
  free_shipping coupon — no money-path impact; lifting client coupon state
  into the page is structural change for marginal benefit (S20-7
  precedent).
- Fresh deep audit (read-only subagent 22-a + own file:line verification):
  session-20 fixes WIRED (with the S21-3 gap found); defect-class sweeps
  CLEAN elsewhere (every remaining `request.*` identity site audited; every
  remaining toast assertion carries `.first()`); static counts all match
  the docs (379/38 · 65/13 · 18 models · 14 requireAdmin · 14 metered · 16
  catch blocks across six files); **0 CRITICAL / 0 HIGH / 1 MEDIUM product
  + 2 test-reliability / 1 LOW / 2 NIT / 2 Informational** — the ninth
  consecutive session without a CRITICAL/HIGH product defect.
- 379 unit + 65/65 e2e green; 24 screenshots refreshed; AGENTS (2 trap-log
  entries + the coupon invariant), CLAUDE, README, PAD (§8.2 + known issues
  #82–83), SKILL v1.18.0 aligned; DEPLOYMENT.md drift-free; run narrative
  at `docs/session_35.md`.

### Session 22 (run 23) — the coupon engine's single-lookup contract

- Fresh clone at `5835fdd`; gates re-validated green on the pulled tree
  (379/379 unit · 65/65 e2e); environment converged (sandbox DATABASE_URL
  symlink re-pointed at the clone's db dir, one inode; seeded 16/8/3/2).
- Live-reference parity re-verified via agent-browser (reference unchanged,
  logged in with the provided credentials); clone: mobile menu open → 7
  links + search → navigate → auto-close/unmount (Tailwind v4
  conditional-mount intact), sitemap 25 URLs, robots disallows + sitemap
  ref, home JSON-LD, desktop visual parity, zero console errors.
- Fresh deep audit (read-only subagent 23-a + own file:line verification):
  session-21 fixes **6/6 WIRED**; defect-class sweeps CLEAN (14/14
  requireAdmin, 14/14 metered `Retry-After`, Zod boundaries, money,
  stock reservation, order access, SEO privacy, CSP, v4 traps, module
  graph, `gotoHydrated` 14/14, toast `.first()` everywhere); static counts
  ALL matching the live docs (379/38 · 65 e2e across **14 spec files** ·
  18 models · 16/8/3/2 seed · 14 requireAdmin · 14 metered · 16 catch
  blocks across six files); **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW /
  2 NIT / 2 Informational — the tenth consecutive session without a
  CRITICAL/HIGH/MEDIUM finding, zero live-doc drift**.
- TDD S22-2 (RED 5 failed / 2 passed — `description` undefined on the
  engine result, `db.coupon.findUnique` called 2×; the response pin passed
  via the wasteful second lookup — the exact defect shape): GREEN —
  `CouponApplication`'s ok-branch + `couponDiscount`'s three success
  branches carry `description`; the route reads `applied.description`, the
  second lookup + import gone; the four exact-shape `toEqual` pins updated
  to the widened contract. S22-1: the admin-coupons spec's duplicated
  comment + 6-space indent cleaned. Dispositions: D1 the stale "13 specs"
  historical figure (append-only records stay as-written; this entry
  carries 14), D2 the S21-1 mid-abort self-correcting residue.
- Final gates: **386/386 unit · 65/65 e2e · lint/typecheck/typecheck:tests/
  build green**; manual verification on the fresh build: the cart's applied
  block renders "FREESHIP: Free standard shipping on orders over $30 —
  applied at checkout" from the single-lookup path; mobile menu
  open/navigate/auto-close; zero console errors; 24 screenshots refreshed.
- Docs aligned: AGENTS (the coupon invariant extended with the S22-2
  single-lookup contract; plan range 2..22), CLAUDE (lib entry + the
  session-22 coverage tail), README (badge 386/65 + the coverage tail),
  PAD (§8.1 row + §12 table + known issue #84), SKILL v1.19.0
  (project_state + this entry), DEPLOYMENT.md drift-free (no new env
  vars), .env.example unchanged; run narrative at `docs/session_37.md`.

### Session 23 (run 24) — the coupon-aware cart hint (S21-7 resolved)

- Fresh clone at `a7b19a1`; gates re-validated green on the pulled tree
  (386/386 unit · 65/65 e2e); environment converged (sandbox DATABASE_URL
  symlink re-pointed at the clone's db file via an atomic node call —
  shell `ln -s` is sandbox-blocked; write-sharing through both paths
  verified on one storeSetting row; seeded 16/8/3/2/3/13).
- Live-reference parity re-verified via agent-browser (reference unchanged,
  logged in with the provided credentials — Damascus-first in both
  sections, "Continue with Google" still on the reference login); clone:
  mobile menu open → 7 links + search → navigate → auto-close/unmount,
  sitemap 25 URLs, robots, JSON-LD, desktop parity, zero console errors.
- Fresh deep audit (read-only subagent 24-a + own file:line verification):
  session-22 fixes **2/2 WIRED**; defect-class sweeps CLEAN (14/14
  requireAdmin, 14/14 metered `Retry-After`, Zod boundaries, money,
  stock reservation, order access, SEO privacy, CSP, v4 traps, module
  graph, `gotoHydrated` 14/14, toast `.first()` everywhere, 16 catch
  blocks); pre-session-21 invariant spot-checks 5/5 WIRED; static counts
  ALL matching the live docs (386 unit / 39 files · 65 e2e / 14 specs ·
  18 models · 16/8/3/2/3/13 seed · 14 requireAdmin · 14 metered);
  **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 1 NIT / 2 Informational —
  the eleventh consecutive session without a CRITICAL/HIGH/MEDIUM finding,
  zero live-doc drift**. (PAD §8.2's "64 tests" header — stale since
  session 20 — corrected to the per-project breakdown.)
- TDD S23-2 (the S21-7 deferral PROMOTED once the defect surface had been
  clean for eleven consecutive sessions): RED — `cart-widgets.test.tsx`
  failed on the missing `CartSummaryWidgets` export; GREEN — the new
  `src/app/(storefront)/cart/cart-widgets.tsx` composite renders the hint
  from the applied-coupon state lifted through CouponBox's optional
  `onAppliedChange` callback (success → payload, not-ok/remove → null; the
  network-catch branch fires nothing; the sessionStorage CODE-string
  contract with checkout-client untouched) — an applied `free_shipping`
  coupon swaps the "Add $X more" nag + progressbar for the
  coupon-attributed block; a percent/fixed coupon leaves the threshold
  states unchanged; the page passes the SERVER facts as props (no
  hydration mismatch by construction). 5 jsdom component pins green
  through the REAL CouponBox with stubbed fetch; the free-shipping spec's
  second test pins the swap end-to-end (66/66).
- S23-1: the whitespace-only line at the checkout limiter dropped.
- Final gates: **391/391 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; manual verification on the fresh build: the cart hint
  swaps on FREESHIP apply and restores on remove (the "Something went
  wrong" seen mid-run was the rebuild-under-running-server artifact, not a
  code defect — the e2e suite and the fresh server both confirm); mobile
  menu open/navigate/auto-close; zero console errors; **25 screenshots**
  refreshed — the new `04b-cart-coupon-hint` evidence shot documents the
  coupon-attributed state, and the capture script's cart step now gates
  the navigation on the `cart-count` badge (the run-24 capture hit the
  click→goto race).
- Docs aligned: AGENTS (the coupon invariant extended with the S23-2
  state-lift contract + the capture-script badge gate; plan range 2..23),
  CLAUDE (the session-23 unit + e2e coverage tails), README (badge 391/66
  + the tails), PAD (§8.1 row + §8.2 header fix + §12 table + known issue
  #83 → Resolved (session 23)), SKILL v1.20.0 (project_state + this
  entry), DEPLOYMENT.md drift-free (no new env vars), `.env.example`
  unchanged; run narrative at `docs/session_38.md`.

### Session 24 (run 25) — the carried wiring-pin deferrals resolved

- Deep audit 25-a at HEAD `e0bcd23` (workspace refreshed by `git pull` —
  fast-forward `38301d3` → `e0bcd23`, the operator's session-log commits):
  session-23 fixes **2/2 WIRED** with file:line evidence; defect-class sweeps
  13/13 CLEAN; static counts ALL matching the live docs (391/40 unit · 66/14
  e2e · 18 models · 14 requireAdmin · 14 metered · 16 catch blocks · 25
  screenshots); **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT / 3
  Informational — the twelfth consecutive session without a
  CRITICAL/HIGH/MEDIUM/LOW finding, zero live-doc drift** (the StrictMode
  no-op hazard on the silent-reapply effect is safe under the pinned
  `reactStrictMode: false`; the stale-code inline error and the
  non-pending-gated Enter path are pre-existing, internally consistent).
- Operator verification surfaced one NIT the subagent missed (S24-1: a
  whitespace-only line at `track-order/page.tsx:99`) and re-examined the
  carried deferrals: the session-15 "actions not import-safe in Vitest"
  rationale has been DISPROVEN by the session-19 guarded-action mock
  precedent — the S23-2 logic applies (clean defect surface + blocker gone +
  calculus flipped), so three deferrals were promoted:
  **S24-2** the review action's two-tier gate wiring pin,
  **S24-3** the /track-order page-limiter wiring pin, and
  **S24-4** the real-engine P2002 integration seam (all prior
  `uniqueTargetField` pins were synthetic — the temp-SQLite harness now
  proves a GENUINE idempotency-key collision satisfies the tolerant matcher
  against the live field-array `meta.target` shape, with cross-field
  number/key discrimination).
- RED (mutation checks) — 6 of the 11 new pins failed exactly as predicted
  (the ip-only gate; the stripped field-array branch against the real engine;
  the bypassed limiter); the RED run also hardened the mock hygiene (per-test
  `vi.resetAllMocks()` — a partially-consumed `mockReturnValueOnce` queue
  must never leak across tier-count differences). GREEN — all three wiring
  sites restored byte-for-byte; **11/11 new pins green**. S24-1 dropped.
- Final gates: **402/402 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; manual verification on the fresh build: the track-order
  denial shell + the tracking surface render (the EADDRINUSE'd stale server
  from a pre-rebuild start served the error boundary mid-session — killed by
  PID, one fresh server, all clean — the documented artifact class); mobile
  menu open → 7 links + search → navigate → auto-close/unmount; zero console
  errors; **25 screenshots** refreshed.
- Docs aligned: AGENTS (plan range 2..24), CLAUDE (the session-24 wiring-pin
  tail), README (badge 402/66 + the tail), PAD (§8.1 header + the three new
  rows + §12 table), SKILL v1.21.0 (project_state + this entry),
  DEPLOYMENT.md drift-free (no new env vars), `.env.example` unchanged; run
  narrative at `docs/session_40.md`.

### Session 25 (run 26) — the real-engine harness family + the doc-NIT sweep

- Deep audit 26-a at HEAD `496761e` (workspace refreshed by `git pull` —
  fast-forward `4659776` → `496761e`, the operator's session-log commit
  appending `docs/session_41.md`): session-24 fixes **4/4 WIRED** with
  file:line evidence (the whitespace scan of `track-order/page.tsx` returns
  zero; the two-tier gate consults BOTH real-derived keys before any lookup;
  the page limiter fails CLOSED before the DB read; the real-engine P2002
  seam cross-checked against `prisma-errors.ts` and the live recovery loop);
  defect-class sweeps 13/13 CLEAN; static counts ALL matching the live docs
  (402/43 unit · 66/14 e2e · 18 models · 14 requireAdmin · 14 metered · 16
  catch blocks · 25 screenshots · 3 DSIH sites); **0 CRITICAL / 0 HIGH / 0
  MEDIUM / 0 LOW / 2 NIT / 2 Informational — the thirteenth consecutive
  session without a CRITICAL/HIGH/MEDIUM/LOW finding**. Both NITs are
  documentation-class: **S25-1** the SKILL `project_state` carried the
  ENTIRE stale session-23 value glued after the session-24 value's closing
  quote (a non-idempotent doc-patch artifact from run 25; the operator
  surfaced it during the doc review — 26-a's `)"`-glued-text scan confirmed
  it was the only instance), and **S25-2** the §5 structural stats were
  frozen at the session-6 era (101/14+9/35 → measured **126/13+9/38**);
  **S25-3** (operator find) a CJK paste artifact in the PAD ADR ("—任何人
  can mint an admin", pre-existing since the original migration).
- **Plan bookkeeping (S25-4):** the carried-deferrals list still carried
  "admin coupon-management UI" — resolved back in session 19 by S19-5; the
  entry was copy-forwarded through sessions 20-24's dispositions
  unexamined. Dropped from session 25's live list (history never rewritten).
- **Two deferrals promoted** (the S24-4 temp-SQLite pattern generalized):
  **S25-5** the coupon-cap real-engine seam (`tests/unit/coupon-cap-integration.test.ts`
  — the LIVE `couponRedemptionFilter` increment shape against a REAL db:
  at-cap blocks, one-under lands, deactivated blocks, unlimited passes) and
  **S25-6** the saveAddress at-cap real-engine seam
  (`tests/unit/save-address-integration.test.ts` — "saved"/"at-cap" inside a
  REAL transaction, the no-writes-at-cap contract, the single-default
  promotion). The "review two-tier budgets e2e" deferral was DISPOSED as
  redundant coverage (S24-2's unit pin is the right altitude; an e2e would
  need 20+ submissions/min and pollute limiter state).
- RED (mutation checks) — 3 of the 7 new pins failed exactly as predicted
  against the REAL engine (the stripped `isActive` guard; the stripped cap
  clause; the no-op `assertAddressCap` — 21 rows + the default unset
  instead of "at-cap" + a frozen book); the other 4 stayed green under
  every mutation. GREEN — all mutation sites restored byte-for-byte;
  **7/7 new pins green** (409/409 unit). **S25-7**: `track-order-limiter.test.ts`
  joined the `vi.resetAllMocks()` discipline.
- Final gates: **409/409 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; the run's one ChunkLoadError was the documented
  stale-server artifact class (a leftover `next-server` from the prior run
  survived on :3000 and served old chunks — killed by PID, fresh server,
  zero console errors); mobile menu open → 7 links + search → navigate →
  auto-close/unmount; **25 screenshots** refreshed.
- Docs aligned: AGENTS (plan range 2..25), CLAUDE (the session-25
  harness-family tail), README (badge 409/66 + the tail), PAD (§8.1 header
  + the two new rows + §12 table + the ADR-003 paste fix), SKILL v1.22.0
  (project_state + the §5 stats refresh + this entry), DEPLOYMENT.md
  drift-free (no new env vars), `.env.example` unchanged; run narrative at
  `docs/session_42.md`.

### Session 26 (run 27) — the money-path real-engine harness + the doc-drift sweep

- Deep audit 27-a at HEAD `2e92db8` (workspace refreshed by `git pull` —
  fast-forward `32116ee` → `2e92db8`, the operator's session-log commit
  appending `docs/session_43.md`): session-25 fixes **7/7 WIRED** with
  file:line evidence; defect-class sweeps 12/13 CLEAN + 1 NIT-class
  observation; static counts ALL matching the live docs (409/45 unit ·
  66/14 e2e · 18 models · 14 requireAdmin · 14 metered · 16 catch blocks ·
  25 screenshots · 3 DSIH sites · 126 src files); **0 CRITICAL / 0 HIGH /
  0 MEDIUM / 0 LOW / 2 NIT / 2 Informational — the fourteenth consecutive
  session without a CRITICAL/HIGH/MEDIUM/LOW finding**. The NITs:
  **S26-1** the account-snapshot raw `<img>` (deliberate, inline-justified)
  vs CLAUDE.md's "`next/image` everywhere" wording (doc drift — the code
  is right; the docs now carry the exception), **S26-2** two
  double-blank-line sites in the checkout route (the S24-1 whitespace
  class, resolved structurally by the extraction). Informational: the
  dormant `OrderItem.variantLabel` display hook (DISPOSED —
  future-proofing, no action) and the run's own `01-home.png` capture
  artifact (resolved by the screenshot refresh).
- **The flagship (S26-3):** `placeOrderTx` — the money authority —
  extracted VERBATIM from the route into `src/lib/order-placement.ts` with
  the db client injected (the S18-1/S25-6 pattern generalized; structural
  `Pick<Prisma.TransactionClient, …>` tx), the route importing the three
  exports — behavior byte-equivalent (the C1/C3 boundary pins 10/10 green
  UNCHANGED). Then `tests/unit/place-order-integration.test.ts` (12 pins):
  server-derived money (the args' cosmetic mirrors carry garbage — the
  LIVE rows win), the receipt snapshots (in-tx product price/name, the
  line's image), the "placed" event, stock reservation, the read-side
  insufficient-stock fast-fail, the WRITE-side atomic decrement guard (a
  duplicate-product handoff makes the first guarded decrement the
  concurrent writer for the second — getCartSummary can never produce it,
  the tx must not over-sell regardless), the coupon burn, the
  engine-level atomic rollback (a mid-tx failure after the burn restores
  `timesUsed` — the complement of the C1 synthetic retry pin), the S12-1
  cart-clear scoping (the concurrent-tab line survives), and the S7-8
  best-effort save (the order places at the address cap; below cap the
  address saves in the SAME tx).
- RED (mutation checks) — the honest record: M1 (trust the summary's
  `unitPrice`) failed the money + receipt pins; **the first M2 run ESCAPED
  detection** — the insufficient-stock pin only exercises the READ-side
  guard, and a single-connection state harness cannot interleave a
  competing writer between the in-tx read and the guarded decrement; the
  pin family grew the duplicate-product write-guard seam and M2 went RED
  exactly as predicted; M3 (blanket cart clear) failed the concurrent-tab
  pin. 4 of the 12 pins failed exactly as predicted; the other 8 stayed
  green under every mutation. GREEN — all mutation sites restored
  byte-for-byte; **12/12 pins green (421/421 unit)**; the temp-SQLite
  family intact (10/10 across the other three harnesses).
- Final gates: **421/421 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; the documented stale-`next-server`-on-:3000 artifact
  killed by PID before any browser check; mobile menu open → 7 links +
  search → navigate → auto-close/unmount; sitemap 25 URLs; **25
  screenshots** refreshed.
- Docs aligned: AGENTS (plan range 2..26), CLAUDE (the session-26
  money-path tail + the documented `<img>` exception), README (badge
  421/66 + the tail), PAD (§8.1 header + the new row + §12 table), SKILL
  v1.23.0 (project_state + the §5 count + this entry), DEPLOYMENT.md
  drift-free (no new env vars), `.env.example` unchanged; run narrative
  at `docs/session_44.md`.

### Session 27 (run 28) — the 429 wiring-pin grid completed

- Deep audit 28-a at HEAD `8059a67` (fresh clone — the sandbox reset
  between runs): session-26 fixes **4/4 WIRED** with file:line evidence;
  defect-class sweeps effectively CLEAN; static counts **11/11 MATCH**
  (46 unit files · 421 unit · 14 e2e files · 66 e2e · 18 models ·
  14 requireAdmin · 14 metered · 16 catch blocks · 127 tracked TS files ·
  25 screenshots · 3 DSIH); **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW /
  2 NIT / 1 Informational — the fifteenth consecutive session without a
  CRITICAL/HIGH/MEDIUM/LOW finding.** The NITs: **S27-2** two space-only
  lines (newsletter:20, contact:24 — the whitespace-only-line variant the
  double-blank scans miss) + a triple blank run in seo-ld.test.ts:121-123
  (the class extended to tests/ for the first time). Informational: the
  `OrderTxClient` structural tx Pick names 5 models (incl. `"address"`)
  where the S26-3 plan sketch listed 4 — the 5th is REQUIRED by
  `saveCheckoutAddressInTx`; recorded, no action.
- **The flagship (S27-1):** the LAST 11 metered surfaces joined the
  route-level 429 boundary-pin grid — cart POST/PATCH/DELETE (60/min
  shared `cart:` prefix), cart/bulk (10/min), cart-summary GET (120/min),
  coupon/apply POST (30/min — the 429 body is the `CouponApplyResponse`
  shape `{ ok: false, error }`, NOT the generic sibling copy), search GET
  (120/min), wishlist POST (60/min), and the three auth-gated addresses
  handlers (60/min behind a mocked `getCurrentUser` — safe: no
  `src/lib/**` module imports `@/lib/auth`). Key mechanics: the file's
  `post()` helper appends a constant proxy hop which BECOMES the rightmost
  `x-forwarded-for` hop, so same-key describes would exhaust each other's
  budgets — every new pin uses the `nextReq()` SINGLE-HOP helper with a
  UNIQUE per-test IP (the C1 pin's isolation convention). **21/21 green on
  the first run** (the lessons pre-applied); RED verified by M1 (coupon
  30→29 → exactly the coupon pin fails) and M2 (cart 60→59 → exactly the
  three cart pins fail — the isolation proof); sites restored
  byte-for-byte. **432/432 unit.**
- S27-2: the two space-only lines stripped, the triple blank collapsed —
  zero whitespace-only lines / double-blank sites in src/ and the touched
  test file.
- Final gates: **432/432 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; 25 screenshots refreshed on the fresh production server;
  mobile menu open → links + search → navigate → auto-close/unmount;
  sitemap 25 URLs; zero console messages/errors.
- Docs aligned: AGENTS (plan range 2..27), CLAUDE (the session-27
  grid-completion tail), README (badge 432/66 + the tail), PAD (§8.1
  header 432 + the api-boundaries row + §12 table), SKILL v1.24.0
  (project_state + this entry), DEPLOYMENT.md drift-free (no new env
  vars), `.env.example` unchanged; run narrative at `docs/session_46.md`.

### Session 28 (run 29) — hygiene & precision pass (16th clean session)

- Deep audit 29-a at HEAD `62cfdc5` (fresh clone — the sandbox reset
  between runs; the clone tip = `a37508a` + the operator's
  `session_47.md` log commit): session-27 fixes **3/3 WIRED** with
  point-by-point evidence (all 11 new boundary pins re-verified — budgets,
  single-hop unique-IP isolation, the full 429 contract incl. the coupon
  `CouponApplyResponse` body, S15-1 slot accounting, the `@/lib/auth`
  mock reset + per-describe user override; the whitespace classes at
  zero; the docs claims match). Defect-class sweeps clean (9 fully clean
  + 4 documented-pattern-only). Static counts **11/11 MATCH**. All 8
  carried deferrals accurate. **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW /
  2 NIT / 4 Informational — the sixteenth consecutive session without a
  substantive code finding.**
- **The NITs (S28-1/S28-2):** the S27-1 comment lost its space after
  `//` (`api-boundaries.test.ts:440` — `//CouponApplyResponse`), and the
  `CouponApplyResponse` failure variant mixed member styles
  (`{ ok: false, error: string }` comma-style next to the semicolon-style
  success variant — `coupon/apply/route.ts:12`). Both fixed; the boundary
  suite green before AND after is the zero-behavior evidence (no RED
  phase is possible for comment/annotation-only changes — stated in the
  plan, not skipped silently).
- **The precision pass (S28-3):** the plan's S27-3 execution-log box was
  left unticked in run 28 although the work shipped in the same commit —
  ticked with a transparency note (recorded as Informational-2); the
  S27-1 log line's "21/21 (11 new + 10 existing)" clarified to "boundary
  CASES … 17 describes / 21 cases total in the file" (Informational-1);
  SKILL §5 now carries the reproducible count command
  (`git ls-files src/ | grep -E '\.(ts|tsx)$'` — a `src/**/*.ts` GLOB
  pathspec misses `src/proxy.ts`; Informational-4). Informational-3 (the
  review-form path drift lives in the operator's audit brief, not in any
  repo doc) recorded as a disposition, no repo change.
- Final gates: **432/432 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green**; 25 screenshots refreshed; mobile menu contract + sitemap
  25 URLs + JSON-LD + zero console messages/errors re-verified.
- Docs aligned: AGENTS (plan range 2..28), CLAUDE (the session-28 tail),
  SKILL v1.25.0 (project_state + this entry), DEPLOYMENT.md drift-free,
  `.env.example` unchanged; run narrative at `docs/session_48.md`.

### Session 29 (run 30) — the first fully-empty remediation cycle (17th clean session)

- Deep audit 30-a at HEAD `8e33006` (fresh clone — the sandbox reset
  between runs; the clone tip = `d5061c2` + the operator's
  `session_49.md` log commit): session-28 fixes **3/3 WIRED** with
  file:line evidence (the spaced comment holds; a programmatic `//\S`
  scan over src/ + tests/ found 8 string/regex-literal false-positives
  and ZERO real unspaced comments; the semicolon-style failure variant
  holds with the type-heavy files cross-checked — no mixed-style
  annotation anywhere; the docs precision items all present).
- Defect-class sweeps clean (all 13). Static counts **12/12 MATCH**
  (46/432 unit · 14/66 e2e · 18 models · 14 requireAdmin · 14 metered ·
  16 catch blocks · 127 tracked TS files · 25 screenshots · 3 DSIH · the
  boundary suite 17 describes / 21 cases). All 8 carried deferrals
  accurate; the 429 grid re-verified complete (14/14 metered surfaces
  pinned). **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT /
  1 Informational — the seventeenth consecutive session without a
  substantive code finding, and the first with not even a NIT.** The
  Informational was workspace-side bookkeeping (the sandbox reset
  truncated the shared workspace log to its Task-21 snapshot; the Task
  28/29 records were restored from the repo's own worklog — the repo
  record was always complete).
- **No code changes this cycle** — the first in the project's history
  with a fully empty remediation surface. The gates ran twice (on the
  pulled tree and on the final tree) and carry the no-regression
  evidence.
- Final gates: **432/432 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green** (both runs); 25 screenshots refreshed; mobile menu
  contract + sitemap 25 URLs + JSON-LD + zero console messages/errors
  re-verified on the fresh production server.
- Docs aligned: AGENTS (plan range 2..29), CLAUDE (the session-29 tail),
  SKILL v1.26.0 (project_state + this entry), DEPLOYMENT.md drift-free,
  `.env.example` unchanged; run narrative at `docs/session_50.md`.

### Session 30 (run 31) — the second consecutive fully-empty cycle (18th clean session)

- Deep audit 31-a at HEAD `712b5e7` (fresh clone — the sandbox reset
  between runs; the clone tip = `91ea3ad` + the operator's two session-log
  commits, `session_49.md` and `session_51.md`): the session-29 docs-sweep
  claims **9/9 WIRED** with file:line evidence (plan section complete with
  all checkboxes ticked; AGENTS range 2..29; CLAUDE tail; SKILL v1.26.0
  project_state + Appendix B; session_50.md consistent with its commit;
  exactly one well-formed Task-30 worklog entry; README/PAD badges;
  `.env.example` contract; DEPLOYMENT.md drift-free).
- Defect-class sweeps clean (all 13 — including a full classification of
  all 60 Prisma write sites against the guarded family and a complete read
  of all 16 route handlers + 3 action files). Static counts **12/12
  MATCH** (46/432 unit — the 432 independently recounted from the test
  declarations · 14/66 e2e · 18 models · 14 requireAdmin · 14 metered ·
  16 catch blocks · 127 tracked TS files · 25 screenshots · 3 DSIH · the
  boundary suite 17 describes / 21 cases). All 8 carried deferrals
  accurate; the 429 grid re-verified complete (14/14, 3 spot-verified in
  full). **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT /
  3 Informational — the eighteenth consecutive session without a
  substantive code finding, and the second consecutive fully-empty
  remediation surface.** All 3 Informational verified at file:line and
  disposed no-change: the drawer's silent PATCH rollback IS the documented
  L10 remediation (deliberate design); the DSIH gloss drift lives in the
  audit brief, not the repo; the mobile-nav eslint-disable rationale is
  present adjacent to the disable.
- **No code changes this cycle** — verified by `git diff --stat
  d5061c2..HEAD` showing only docs/PNGs since the last-audited tree. The
  gates run twice (pulled tree + final tree) as the no-regression
  evidence.
- Final gates: **432/432 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green** (both runs); 25 screenshots refreshed; mobile menu
  contract + sitemap 25 URLs + robots + JSON-LD + zero console
  messages/errors re-verified on the fresh production server.
- Docs aligned: AGENTS (plan range 2..30), CLAUDE (the session-30 tail),
  SKILL v1.27.0 (project_state + this entry), DEPLOYMENT.md drift-free,
  `.env.example` unchanged; run narrative at `docs/session_52.md`.

### Session 31 (run 32) — the third consecutive fully-empty cycle (19th clean session)

- Deep audit 32-a at HEAD `168d830` (fresh clone — the workspace reset
  again; the clone tip = `d41aa14` + the operator's session-log commit
  appending `docs/session_53.md` and the CLAUDE workflow section;
  `git diff d41aa14..168d830 --stat` = docs-only): the session-30
  docs-sweep claims WIRED with file:line evidence (plan section complete,
  AGENTS range 2..30, CLAUDE tail, SKILL v1.27.0 project_state +
  Appendix B, session_52/53 consistent, one well-formed Task-31 worklog
  entry, README/PAD badges, `.env.example` contract, DEPLOYMENT
  drift-free with 5/5 env vars verified against their read sites).
- Defect-class sweeps clean (all 12; the two raw query-param id DELETE
  handlers recorded as the standing accepted shape — both
  ownership-scoped compound filters with route-level boundary pins).
  Static counts **13/13 MATCH** (46/432 unit — independently recounted ·
  14/66 e2e · 18 models · 14 requireAdmin · 14 metered · 3 DSIH · 127
  tracked TS files · 25 screenshots · 16 admin-dialog catches / 6 files ·
  16 route handlers / 11 files · boundary-suite recounts). All 8 carried
  deferrals accurate; the 429 grid complete (14/14). **0 CRITICAL /
  0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT / 4 Informational — the nineteenth
  consecutive session without a substantive code finding, and the third
  consecutive fully-empty remediation surface.** The 4 Informationals
  verified and disposed no-change: the raw query-param id DELETEs (the
  accepted shape); the prisma `^6.11.1` range resolving to 6.19.3
  (lockfile-coherent, semver-consistent, the tolerant matcher absorbing
  engine-shape drift); the seed.ts lint/typecheck split (deliberate);
  the operator's docs-only CLAUDE.md commit.
- **No code changes this cycle** — verified by `git diff --stat
  d41aa14..168d830` showing only docs since the last-audited tree. The
  gates run twice (pulled tree + final tree) as the no-regression
  evidence.
- Environmental notes this cycle: the sandbox now BLOCKS symlink
  creation, so the shadow `DATABASE_URL` convergence moved to per-command
  absolute-path exports (one inode, seed 16/8/3/3/13 verified); and the
  Playwright browser cache was re-paired with the lockfile
  (`@playwright/test` 1.64.0 needs chromium rev 1248 — `npx playwright
  install chromium` restored the match before the 66/66 run).
- Final gates: **432/432 unit · 66/66 e2e · lint/typecheck/typecheck:tests/
  build green** (both runs); 25 screenshots refreshed (11 dynamic-content
  deltas, 14 byte-identical); mobile menu contract + sitemap 25 URLs +
  robots + noindex + security headers + JSON-LD + zero console
  messages/errors re-verified on the fresh production server; the
  reference site's mobile push-down panel anatomy re-confirmed live.
- Docs aligned: AGENTS (plan range 2..31), CLAUDE (the session-31 tail),
  SKILL v1.28.0 (project_state + this entry), DEPLOYMENT.md drift-free,
  `.env.example` unchanged; run narrative at `docs/session_54.md`.

### Session 32 (run 33) — the fourth consecutive fully-empty cycle (20th clean session)

- Deep audit 33-a at HEAD `6e62d01` (= `a850067`, the session-31 cycle,
  + the operator's session-log commit appending `docs/session_55.md`;
  `git diff a850067..6e62d01 --stat` = docs-only, +78 lines, zero
  src/tests/prisma deltas from the last-audited tree): the session-31
  docs-sweep claims **8/8 WIRED** with file:line evidence (plan Session 31
  section complete with all boxes ticked, AGENTS range 2..31, SKILL
  v1.28.0 project_state + Appendix B, session_54/55 consistent, one
  well-formed Task-32 worklog entry, README/PAD badges, `.env.example`
  contract with all 5 env vars verified against their read sites,
  DEPLOYMENT drift-free).
- Defect-class sweeps clean (all 12 — the two raw query-param id DELETE
  handlers re-confirmed as the standing accepted shape, both
  ownership-scoped compound filters with route-level boundary pins).
  Static counts **12/13 exact MATCH + 1 count-convention gloss**: the
  "16 route handlers / 11 files" anchor counts 16 top-level route-file
  exports, which is precisely **15 HTTP handlers + 1 exported response
  type** (`CouponApplyResponse`, coupon/apply/route.ts:10) across the 11
  files — reproducible under its raw-export convention, restated in the
  precise form going forward (this entry + the Session 32 plan section);
  the historical records stay untouched. All 8 carried deferrals
  accurate; the 429 grid complete (14/14).
- **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT / 2 Informational —
  the twentieth consecutive session without a substantive code finding,
  and the fourth consecutive fully-empty remediation surface.** The 2
  Informationals verified and disposed no-change: (1) the route-handler
  count-convention gloss above (docs-precision, zero code impact —
  clarified in this entry, history untouched); (2) the sandbox process-env
  shadow `DATABASE_URL` pointing at a non-existent path (the documented
  Task-32 environmental trap — every DB-touching command this run
  exported the absolute repo path so the shadow and the repo contract
  resolve to ONE inode; seed 16/8/3/3/13 verified through it).
- **No code changes this cycle** — verified by `git diff --stat
  a850067..6e62d01` showing only the operator's session log since the
  last-audited tree. The gates run twice (pulled tree + final tree) as
  the no-regression evidence.
- Final gates: **432/432 unit (46 files) · 66/66 e2e (1.9m) ·
  lint/typecheck/typecheck:tests/build green** (both runs); 25
  screenshots refreshed (11 dynamic-content deltas, 14 byte-identical);
  live-reference parity re-verified via agent-browser (the reference
  logged in with the operator's credentials: Damascus-first featured
  order card-for-card, and the reference's mobile push-down panel
  anatomy confirmed live at 390×844 — nav links + search + close);
  clone verified on the fresh production server: home parity + the 4
  trust badges + JSON-LD Organization/WebSite (+ Product on detail
  pages) + zero console messages/errors + sitemap 25 URLs + robots +
  noindex on private surfaces + the full security-header set (CSP
  per-request nonce + strict-dynamic, HSTS, X-Frame-Options DENY,
  nosniff, Referrer-Policy, Permissions-Policy, no X-Powered-By) + the
  mobile menu contract intact (open → `nav[aria-label="Mobile"]` with
  exactly 7 links + the search box in the panel container + close →
  navigate → drawer unmounted, `aria-expanded` bound).
- Docs aligned: AGENTS (plan range 2..32), CLAUDE (the session-32 tail),
  SKILL v1.29.0 (project_state + this entry), DEPLOYMENT.md drift-free,
  `.env.example` unchanged; run narrative at `docs/session_56.md`.

### Session 33 (run 34) — the reference-parity cycle (S33-1)

- **The finding (live-reference drift):** the reference site re-ordered its
  catalog — /products "Newest", home New Arrivals AND home Featured now
  render Enameled Cast Iron Dutch Oven first (Dutch Oven → Glass Storage →
  Damascus → Walnut → Mixing Bowl → Copper Frying → Stand Mixer → Ceramic
  Dinner; Featured = that order filtered by the featured flag), while the
  clone still rendered the session-12 pinned Damascus-first order. The
  reference's VISIBLE catalog also shrank 16 → 8 (8 products removed
  server-side); prices/review-counts/categories/hero/mobile-menu all
  unchanged.
- **S33-1 fix (TDD, red → green):** the seed-catalog order pin
  (`tests/unit/seed-catalog.test.ts`) extended FIRST to assert the full
  8-slug reference order (red against the old seed); then the PRODUCTS
  array in `prisma/seed.ts` reordered — the 8 reference-core blocks in the
  reference's live order, the 8 superset blocks untouched as the tail
  (superset principle: never delete working content); the order-related
  comments re-anchored (seed-policy.ts, storefront.spec.ts, seed.ts);
  fresh-DB re-seed (createdAt is create-only — existing rows keep their
  order, so re-ordering requires deleting `db/custom.db` and re-running
  `npm run db:setup`).
- **Verification:** /products, Featured and New Arrivals render the
  reference's order card-for-card (agent-browser, fresh production
  server); the e2e storefront pins are order-agnostic by design and stayed
  green untouched; full gate chain green twice (pulled tree + final tree):
  lint · typecheck · typecheck:tests · 432/432 unit · build · 66/66 e2e.
- Deep audit 34-a (repo-side): 9/9 docs claims WIRED · 13/13 sweeps clean ·
  7/7 counts MATCH · 8/8 deferrals standing · 0 repo-side findings — the
  parity finding was live-reference-side, discoverable only through the
  logged-in reference comparison.
- Docs aligned: AGENTS (the S12-5 invariant reworded + plan range 2..33),
  CLAUDE (the session-33 tail + the seed-catalog pin description),
  README/PAD (the authored-order wording), SKILL v1.30.0 (project_state +
  this entry), DEPLOYMENT.md drift-free, `.env.example` unchanged; run
  narrative at `docs/session_58.md`.

### Session 34 (run 35) — the second consecutive reference-parity cycle (S34-1)

- **The finding (live-reference drift, again):** the reference site
  re-ordered its catalog a SECOND time since the original pinning —
  /products "Newest", home New Arrivals AND home Featured now render
  Damascus Steel Chef Knife Set first (Damascus → Copper Frying →
  Ceramic Dinner → Dutch Oven → Walnut → Mixing Bowl → Glass Storage →
  Stand Mixer; Featured = that order filtered by the featured flag),
  while the clone still rendered the session-33 re-aligned
  Dutch-Oven-first order. Everything else matched again: prices (all 8,
  compare-at included), review counts (±1 live-traffic noise), the 8
  category tiles, the hero carousel (3 rotating slides), the section
  anatomy, the 4 trust badges, the mobile-menu anatomy at 390×844, and
  the track-order/about surfaces — the catalog ORDER was the only delta,
  exactly the S33-1 class.
- **S34-1 fix (TDD, red → green):** the seed-catalog order pin
  (`tests/unit/seed-catalog.test.ts`) extended FIRST to the new 8-slug
  reference order (red: 1 failed | 5 passed); then the PRODUCTS array in
  `prisma/seed.ts` reordered through a persisted sandbox script
  (`reorder_seed_s34.py`) — a pure block move with a line-multiset
  purity check (97 insertions / 97 deletions, zero product-data
  changes), the 8 superset blocks untouched as the tail, and the S33-1
  move's mixed opening-brace indentation normalized to the canonical
  2-space shape; the order-related comments re-anchored
  (seed-policy.ts, storefront.spec.ts, seed.ts — now documenting the
  twice-re-aligned history); fresh-DB re-seed (createdAt is
  create-only).
- **Verification:** /products, Featured and New Arrivals render the
  reference's current order card-for-card (agent-browser, fresh
  production server); the mobile-menu contract re-verified live at
  390×844 (open → 7 links + close → navigate → panel unmounted,
  aria-expanded bound); the e2e storefront pins are order-agnostic by
  design and stayed green untouched; full gate chain green twice
  (pulled tree + final tree): lint · typecheck · typecheck:tests ·
  432/432 unit · build · 66/66 e2e.
- Deep audit 35-a (repo-side): 9/9 docs claims WIRED · 12/12 sweeps
  clean · 9/9 counts MATCH (incl. the audit's own dynamic 432/432
  re-run) · 8/8 deferrals standing · 0 repo-side findings + 3
  Informational disposed no-change (the brief-side DELETE-handler
  wording gloss — the actual accepted pair is cart `?line=` +
  addresses `?id=`; the untracked sandbox verify-seed scratch; the
  parent-worklog stub after the reset) — the parity finding was
  live-reference-side again, discoverable only through the logged-in
  reference comparison.
- Docs aligned: AGENTS (the S12-5 invariant reworded for the twice
  re-aligned history + plan range 2..34), CLAUDE (the session-34 tail +
  the seed-catalog pin description), README/PAD (the authored-order
  wording), SKILL v1.31.0 (project_state + this entry), DEPLOYMENT.md
  drift-free, `.env.example` unchanged; run narrative at
  `docs/session_60.md`.


### Session 35 (run 36) — the fifth fully-empty remediation cycle, both surfaces clean (S35-1)

- **No finding this cycle — the first cycle since the two
  reference-parity rounds where BOTH audit surfaces came back clean.**
  The live reference KEPT its catalog in the session-34-pinned
  Damascus-first order (/products "Newest" · home Featured · home New
  Arrivals all unchanged; count text "8 products found"), so there was
  no S33-1/S34-1-class re-alignment item: the clone renders all three
  surfaces card-for-card in exactly the pinned order (verified
  agent-browser against a fresh production server, logged into the
  reference with the operator's credentials). Everything else matched
  too: prices (all 8, compare-at included), review counts (the
  reference shows 412 on Damascus = the seed's authored display count;
  the clone's local DB shows 413 from run-36's own e2e
  review-submission traffic — a fresh re-seed restores 412 exactly),
  the 8 category tiles, the 3-slide rotating hero, the section
  anatomy, the 4 trust badges, the mobile-menu contract at 390×844,
  and the track-order/about surfaces.
- **Repo-side audit (36-a, read-only):** 9/9 docs claims WIRED · 11/11
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run) · 8/8 carried deferrals standing ·
  **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 3 Informational** disposed
  no-change (two environmental — the sandbox verify-seed scratch and
  the parent-worklog stub; one docs-precision — the "16 admin-dialog
  catches / 6 files" anchor's file-set convention: the five admin
  `*-dialog.tsx` files (15 catches) + `settings-form.tsx` (1), with
  the account `address-dialog.tsx`'s three catches outside the admin
  set, 18 total across dialog-named files all handled uniformly —
  restated precisely here so future audits count the intended set).
- **S35-2 (LOW — docs tooling):** the 11-checkout screenshot capture
  lost the fire-and-forget add-to-cart race in run 35 and silently
  shipped the EMPTY-CART shell at `/checkout` (the session-23/run-24
  class — the 04-cart shot got the `expectBadgeCount` gate in
  session-24, the checkout shot never did; the run-36 capture won the
  race by timing luck, and the 59KB→101KB byte flip between two
  captures of an UNCHANGED page was the race itself, surfaced by a
  VLM-assisted diff in the operator's post-audit verification).
  Fixed: the capture now awaits `expectBadgeCount(page, 1)` before
  the navigation — verified deterministic (byte-identical md5 across
  consecutive full capture runs); the shot now stably documents the
  real checkout form. Environmental note: back-to-back full capture
  runs trip the 10/min per-email login limiter — a clean single run
  after a 60s window recovers all 25.
- **S35-1 (docs sweep):** SKILL v1.31.0 → v1.32.0 (project_state
  sessions 2-35 + this entry), AGENTS plan range 2..34 → 2..35 + the
  capture-script trap note extended, CLAUDE tail, README/PAD/
  DEPLOYMENT drift checks, `.env.example` verified unchanged, the 25
  screenshots refreshed on a final single clean run (11 changed vs
  repo HEAD — the gated checkout shot, the Damascus review-count
  413→414 delta from this session's two e2e runs, and the
  admin/account dynamic deltas; 14 byte-identical), the plan's
  Session 35 section, `docs/session_62.md`, worklog Task 36. No
  changes in src/tests/prisma — the 432/66 suites carry the
  no-regression evidence by their green runs on the pulled tree AND
  on the final tree (the twice-run evidence).
- **Reference-tech-stack re-verification:** the `ecommerce-store` repo
  re-cloned at `1ffda3d` (the same commit reviewed in run 35); skills
  folders byte-identical; the sitemap/SEO comparison re-run —
  homenest's remains the stricter superset (private surfaces excluded;
  the reference's own sitemap lists login/register/wishlist;
  single-sourced `siteBaseUrl()`; DB-failure tolerance).
- Run narrative at `docs/session_61.md` (the operator's raw run-35
  log) and `docs/session_62.md` (this run).

### Session 36 (run 37) — the sixth fully-empty remediation cycle, both surfaces clean again (S36-1)

- **No finding this cycle — the second consecutive cycle with BOTH
  audit surfaces clean, and the third consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found"), so
  there was no S33-1/S34-1-class re-alignment item: the clone renders
  all three surfaces card-for-card in exactly the pinned order
  (verified agent-browser against a fresh standalone server, logged
  into the reference with the operator's credentials). All 8 prices
  re-verified to the cent (199.99 / 89.99 / 119.99 / 149.99 / 79.99 /
  54.99 / 42.99 / 349.99 + the Damascus -29% compare-at), review
  counts (reference 412 = the seed's authored display count; the
  clone's local DB 416 from accumulated e2e review traffic across
  runs — a fresh re-seed restores 412 exactly), the 8 category tiles,
  the 3-slide rotating hero, the 4 trust badges, the mobile-menu
  contract at 390×844 verified on BOTH sides (the reference's
  push-down panel + navigate-closes; the clone's Tailwind v4
  conditional-mount, 7 links, unmount-on-navigate, aria-expanded),
  and the track-order/about surfaces. The clone's SEO re-verified
  live: sitemap 25 URLs, robots disallow set, noindex on private
  surfaces, health ok/db-up.
- **Repo-side audit (37-a, read-only):** 9/9 docs claims WIRED · 11/11
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 20.16s) · 8/8 carried deferrals
  standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 2 Informational**
  disposed no-change (one environmental — the parent-worklog stub;
  one informational — the Appendix B session-35 entry citing
  session_62 but not session_63, an inherent commit-chronology
  artifact: the operator's raw log lands as a post-push commit, so
  pre-push Appendix B entries cannot cite it). 36-a's untracked
  verify-seed scratch item RESOLVED — the workspace survived this
  cycle (git pull refresh only, the first non-reset environment since
  the reset streak), so the working tree was fully clean at cycle
  start.
- **S36-1 (docs sweep):** SKILL v1.32.0 → v1.33.0 (project_state
  sessions 2-36 + this entry), AGENTS plan range 2..35 → 2..36,
  CLAUDE tail, README/PAD/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e so the pushed shots
  match the committed DB state (9 changed vs repo HEAD — the Damascus
  review-count 414→417 delta from run-36's final-tree e2e runs plus
  this cycle's two e2e runs, and the admin/account dynamic deltas
  incl. the order count 20→25; 16 byte-identical — including both
  order-bearing card grids where the review-count text is the only
  pixel delta, and the S35-2-gated 11-checkout shot byte-stable
  across both of this cycle's captures), the plan's Session 36
  section,
  `docs/session_64.md`, worklog Task 37. No changes in
  src/tests/prisma — the 432/66 suites carry the no-regression
  evidence by their green runs on the pulled tree AND on the final
  tree (the twice-run evidence).
- **Reference-tech-stack re-verification:** the `ecommerce-store` repo
  re-checked at `1ffda3d` (still up to date with its origin/main —
  the same commit reviewed in runs 35/36); skills folders
  byte-identical; the sitemap/SEO comparison re-run — homenest's
  remains the stricter superset.
- Run narrative at `docs/session_63.md` (the operator's raw run-36
  log) and `docs/session_64.md` (this run).

### Session 37 (run 38) — the seventh fully-empty remediation cycle, both surfaces clean for the third consecutive time (S37-1)

- **No finding this cycle — the third consecutive cycle with BOTH
  audit surfaces clean, and the FOURTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found"), so
  there was no S33-1/S34-1-class re-alignment item: the clone renders
  all three surfaces card-for-card in exactly the pinned order
  (verified agent-browser against a fresh standalone server, logged
  into the reference with the operator's credentials). All 8 prices
  re-verified to the cent with their compare-at values and discount
  badges (199.99/279.99 −29% · 89.99/129.99 −31% · 119.99/159.99 −25%
  · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21% · 42.99 ·
  349.99/429.99 −19%), review counts (reference 412 = the seed's
  authored display count; the clone's local DB 418 from accumulated
  e2e review traffic across runs — a fresh re-seed restores 412
  exactly), the 8 category tiles, the 3-slide rotating hero ("Sale Up
  to 40% Off" observed mid-rotation), the 4 trust badges, the
  mobile-menu contract at 390×844 verified on BOTH sides (the
  reference's push-down panel + navigate-closes; the clone's Tailwind
  v4 conditional-mount, 7 links, close button + search box present,
  unmount-on-navigate), and the track-order/about surfaces. The
  clone's SEO re-verified live: sitemap 25 URLs, robots disallow
  set, noindex on private surfaces, health ok/db-up.
- **Repo-side audit (38-a, read-only):** 9/9 docs claims WIRED · 11/11
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 20.10s) · 8/8 carried deferrals
  standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 2 Informational**
  disposed no-change (one environmental — the parent-worklog stub,
  now RESOLVED: the workspace survived for the second consecutive
  cycle and the sandbox worklog carried the in-progress Task-38
  record; one informational — README/PAD carry the accurate 432/66
  test-count badges while the plan-range/SKILL-version strings live
  in AGENTS/CLAUDE/SKILL per the long-standing doc layout, a
  layout-consistency note, not drift).
- **S37-1 (docs sweep):** SKILL v1.33.0 → v1.34.0 (project_state
  sessions 2-37 + this entry), AGENTS plan range 2..36 → 2..37,
  CLAUDE tail, README/PAD/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e so the pushed shots
  match the committed DB state (the run-36/37 discipline), the plan's
  Session 37 section, `docs/session_66.md`, worklog Task 38. No
  changes in src/tests/prisma — the 432/66 suites carry the
  no-regression evidence by their green runs on the pulled tree AND
  on the final tree (the twice-run evidence). Plus **S37-2**, a LOW
  docs-tooling fix surfaced during this cycle's screenshot refresh:
  the 04b capture's coupon-toast animation frame made the shot
  run-to-run byte-non-deterministic (pixel-diff isolated the only
  differing region to the toast itself — not the S35-2 content-race
  class); the capture now waits for the toast's 4s auto-dismiss,
  verified deterministic by a byte-identical md5 across consecutive
  capture runs (the S35-2 pin style).
- **Reference-tech-stack re-verification:** the `ecommerce-store` repo
  re-checked at `1ffda3d` (still up to date with its origin/main —
  the same commit reviewed in runs 35/36/37); skills folders
  byte-identical (md5-verified); the sitemap/SEO comparison re-run —
  homenest's remains the stricter superset.
- Run narrative at `docs/session_65.md` (the operator's raw run-37
  log) and `docs/session_66.md` (this run).

### Session 38 (run 39) — the eighth fully-empty remediation cycle, both surfaces clean for the fourth consecutive time (S38-1)

- **No finding this cycle — the fourth consecutive cycle with BOTH
  audit surfaces clean, and the FIFTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found"), so
  there was no S33-1/S34-1-class re-alignment item: the clone renders
  all three surfaces card-for-card in exactly the pinned order
  (verified agent-browser against a fresh standalone server, logged
  into the reference with the operator's credentials). All 8 prices
  re-verified to the cent with their compare-at values and discount
  badges (199.99/279.99 −29% · 89.99/129.99 −31% · 119.99/159.99 −25%
  · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21% · 42.99 ·
  349.99/429.99 −19%), review counts (reference 412 = the seed's
  authored display count; the fresh-clone re-seed restores 412
  exactly), the 8 category tiles, the rotating hero ("Sale Up to 40%
  Off" observed mid-rotation), the 4 trust badges, the mobile-menu
  contract at 390×844 verified on BOTH sides (the reference's
  push-down panel + navigate-closes; the clone's Tailwind v4
  conditional-mount, 7 links, the green circular close button RENDERED
  44×44, the panel's own search box RENDERED 209×40, unmount-on-
  navigate — an unscoped document-wide query had matched the HEADER's
  desktop search input (hidden on mobile) and false-alarmmed hidden;
  the panel-scoped re-check and the e2e `panel.getByRole("searchbox")`
  pin are the correct methodology), and the track-order/about
  surfaces. The clone's SEO re-verified live: sitemap 25 URLs, robots
  disallow set, noindex on all 8 probed private surfaces, health
  ok/db-up.
- **Repo-side audit (39-a, read-only):** 9/9 docs claims WIRED · 12/12
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 19.77s, plus an empirical temp-DB
  verification that concurrent interactive Prisma transactions
  serialize under the single-process deployment) · 8/8 carried
  deferrals standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 3
  Informational** disposed no-change (a phrasing gloss on the
  deliberate empty-catch census — precisely **7 src comment-only
  swallows + 1 test**, the prior narratives' "8 + test" shorthand
  counted the test twice; the documented admin layout-level gating
  design; the SQLite per-single-process serialization scope).
- **S38-1 (docs sweep):** SKILL v1.34.0 → v1.35.0 (project_state
  sessions 2-38 + this entry), AGENTS plan range 2..37 → 2..38,
  CLAUDE tail, README/PAD/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e so the pushed shots
  match the committed DB state (the run-36/37/38 discipline), the
  plan's Session 38 section, `docs/session_68.md`, worklog Task 39.
  No changes in src/tests/prisma — the 432/66 suites carry the
  no-regression evidence by their green runs on the pulled tree AND
  on the final tree (the twice-run evidence).
- **Environment (fresh-clone recovery, the run-34/35 pattern):** the
  sandbox RESET again after two surviving cycles — `.env` rewritten
  (the `file:../db/custom.db` contract + a strong random AUTH_SECRET;
  the standalone production server enforces `assertAuthSecret`, so
  the dev fallback would refuse to boot under `npm run start`),
  `npm install` (588 packages), `db:setup` re-seeded (the Damascus-
  first order re-confirmed straight from the seed), and the Playwright
  chromium-1248 cache re-paired. The per-command absolute-export
  `DATABASE_URL` convergence applied to `next build` too (without it
  the sitemap's static generation logs `prisma:error 14` against the
  shadow path — the build still succeeds via the documented DB-failure
  tolerance, but the sitemap would miss the 16 product URLs).
- **Reference-tech-stack re-verification:** the `ecommerce-store` repo
  re-cloned at `1ffda3d` (still up to date with its origin/main — the
  same commit reviewed in runs 35/36/37/38); skills folders
  byte-identical (md5-verified); the sitemap/SEO comparison re-run —
  homenest's remains the stricter superset.
- **Environment (third-consecutive surviving workspace):** git pull
  refresh only — `.env`, the repo-root `db/custom.db` (verified to
  match the pushed run-39 state: 16 products, 10 orders,
  Damascus-first pinned order, reviewCount 414 / stock 24),
  `node_modules`, and the chromium-1248 cache all intact; the only
  standing recovery item is the per-command absolute-export
  `DATABASE_URL` convergence for the sandbox's process-level shadow
  (applies to `next build` too — the sitemap's static generation
  otherwise logs `prisma:error 14` and loses the 16 product URLs).
- **Reference-tech-stack re-verification:** the `ecommerce-store` repo
  re-checked at `1ffda3d` (still up to date with its origin/main — the
  same commit reviewed in runs 35–39); skills folders byte-identical
  (md5-verified); the sitemap/SEO comparison re-run — homenest's
  remains the stricter superset.
- Run narrative at `docs/session_69.md` (the operator's raw run-39
  log) and `docs/session_70.md` (this run).

### Session 39 (run 40) — the ninth fully-empty remediation cycle, both surfaces clean for the fifth consecutive time (S39-1)

- **No finding this cycle — the fifth consecutive cycle with BOTH
  audit surfaces clean, and the SIXTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found") for
  the sixth consecutive cycle — no S33-1/S34-1-class re-alignment
  item. All 8 prices re-verified to the cent WITH compare-at values
  and discount badges (199.99/279.99 −29% · 89.99/129.99 −31% ·
  119.99/159.99 −25% · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21%
  · 42.99 · 349.99/429.99 −19%); review counts match the seed's
  authored display counts exactly (412/234/203/367/142/187/156/298);
  the 8 category tiles, the rotating hero ("New Arrivals" first,
  "Sale Up to 40% Off" mid-rotation 4.5s later), the 4 trust badges,
  and the mobile-menu contract at 390×844 verified on BOTH sides —
  the reference's navigate-closes verified with a REAL Playwright
  click on the panel link (a synthetic `dom.click()` on
  `a[href="/products"]` had hit the hidden DESKTOP nav's first
  matching link and left the panel mounted — a testing artifact, not
  reference behavior); the clone's contract verified with 16/16
  automated checks (7 links · Close-menu 44×44 @330,78 · panel
  search box 209×40 @16,80 · unmount-on-navigate), plus the clone's
  full SEO surface re-verified live (sitemap 25 URLs, robots
  disallow set, noindex 8/8 private surfaces, health ok/db-up).
- **Repo-side audit (40-a, read-only):** 9/9 docs claims WIRED · 12/12
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 21.63s) · 8/8 carried deferrals
  standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 3 Informational**
  (all audit-brief citation glosses — the verification-only-cycle
  2-box convention; the login-limiter's actual home in
  `src/lib/actions/auth.ts:85-91` vs the brief's `src/lib/auth.ts`;
  the button-based ARIA radiogroup shape vs the brief's "native
  radio inputs") all disposed no-change. The audit also hunted fresh
  surfaces (no open redirects — all 6 `redirect()` calls static; all
  `fetch()` same-origin; no client component importing db/prisma;
  timing-safe HMAC with length guard; health degraded-503 path; no
  undocumented env vars in src) — all clean.
- **S39-1 (docs sweep):** SKILL v1.35.0 → v1.36.0 (project_state
  sessions 2-39 + this entry), AGENTS plan range 2..38 → 2..39,
  CLAUDE tail, README/PAD/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e AND after
  `restore-demo-stock` re-topped the demo stock (the S14-4 healthy
  state — the run-39 discipline), the plan's Session 39 section,
  `docs/session_70.md`, worklog Task 40. No changes in
  src/tests/prisma — the 432/66 suites carry the no-regression
  evidence by their green runs on the pulled tree AND on the final
  tree (the twice-run evidence).

### Session 40 (run 41) — the tenth fully-empty remediation cycle, both surfaces clean for the sixth consecutive time (S40-1)

- **No finding this cycle — the sixth consecutive cycle with BOTH
  audit surfaces clean, and the SEVENTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found") for
  the seventh consecutive cycle — no S33-1/S34-1-class re-alignment
  item. All 8 prices re-verified to the cent WITH compare-at values
  and discount badges (199.99/279.99 −29% · 89.99/129.99 −31% ·
  119.99/159.99 −25% · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21%
  · 42.99 · 349.99/429.99 −19%); review counts match the seed's
  authored display counts exactly (412/234/203/367/142/187/156/298 —
  the reference renders them parenthesized next to the category,
  e.g. "(412)" on Damascus); the 8 category tiles (extracted via
  their `/products?category=` deep links), the rotating hero ("New
  Arrivals" first, "Sale Up to 40% Off" mid-rotation ~5s later), the
  4 trust badges, and the mobile-menu contract at 390×844 verified
  on BOTH sides — the reference's hamburger (the rightmost icon-only
  header button, 36×36 at x338,y14) → push-down panel with 5 nav
  links (each 358×44 stacked from y121) + the icon-only "Search
  products..." search BUTTON (40×28 at x16,y81); toggle-closes; and
  navigate-closes verified with a REAL Playwright click on the
  panel's Products link (URL → /products, panel unmounted, re-checked
  defensively: zero visible panel links AND zero panel search
  buttons); the clone's contract verified with 16/16 automated
  checks (7 links · Close-menu 44×44 @330,78 · panel search box
  209×40 @16,80 · unmount-on-navigate), plus the clone's full SEO
  surface re-verified live (sitemap 25 URLs, robots disallow set,
  noindex 8/8 private surfaces, health ok/db-up, home h1 renders).
- **Repo-side audit (41-a, read-only):** 9/9 docs claims WIRED · 12/12
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 19.86s, plus lint ✓ · typecheck ✓ ·
  typecheck:tests ✓ as extra permitted gates) · 8/8 carried
  deferrals standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 2
  Informational** (both brief-side citation glosses — the
  git-ls-files pathspec convention: the documented 127 tracked src
  TS files is the true count, a bare `src/**/*.ts` pathspec drops
  zero-depth `src/proxy.ts` on this git build; the redirect anchor =
  6 textual occurrences, 5 executable + 1 comment) both disposed
  no-change. The audit also hunted fresh surfaces (redirects
  static/role-derived; 4 `router.push` sites same-origin incl. the
  server-minted order+token pair; all 15 `fetch()` same-origin; no
  client component importing db/prisma; timing-safe HMAC with length
  guard; health degraded-503; demo credentials server-side props
  only; zero Math.random/@ts-ignore/innerHTML writes;
  `target="_blank"` hardened) — all clean.
- **S40-1 (docs sweep):** SKILL v1.36.0 → v1.37.0 (project_state
  sessions 2-40 + this entry), AGENTS plan range 2..39 → 2..40,
  CLAUDE tail, README/PAD/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e AND after
  `restore-demo-stock` re-topped the demo stock (the S14-4 healthy
  state — the run-39/40 discipline), the plan's Session 40 section,
  `docs/session_72.md`, worklog Task 41. No changes in
  src/tests/prisma — the 432/66 suites carry the no-regression
  evidence by their green runs on the pulled tree AND on the final
  tree (the twice-run evidence).

### Session 41 (run 42) — the eleventh fully-empty remediation cycle, both surfaces clean for the seventh consecutive time (S41-1, S41-2)

- **No finding this cycle — the seventh consecutive cycle with BOTH
  audit surfaces clean, and the EIGHTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found") for
  the eighth consecutive cycle — no S33-1/S34-1-class re-alignment
  item. All 8 prices re-verified to the cent WITH compare-at values
  and discount badges (199.99/279.99 −29% · 89.99/129.99 −31% ·
  119.99/159.99 −25% · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21%
  · 42.99 · 349.99/429.99 −19%); review counts match the seed's
  authored display counts exactly (412/234/203/367/142/187/156/298 —
  the reference renders them parenthesized next to the category);
  the 8 category tiles, the rotating hero ("Sale Up to 40% Off"
  observed mid-rotation), the 4 trust badges, and the mobile-menu
  contract at 390×844 verified on BOTH sides — the reference's
  hamburger (36×36 at x338,y14) → push-down panel with 5 nav links
  (each 358×44 stacked from y121) + the icon-only search BUTTON
  (40×28 at x16,y81); toggle-closes; navigate-closes verified with a
  REAL Playwright click on the panel's Products link (URL →
  /products, panel unmounted, re-checked defensively); the clone's
  contract verified with 15/15 automated checks (7 links · Close-menu
  44×44 @330,78 · panel search box 209×40 @16,80 · unmount-on-
  navigate) plus the clone's full SEO surface re-verified live
  (sitemap 25 URLs, robots disallow set, noindex 8/8 private
  surfaces, health ok/db-up, home h1 renders).
- **Repo-side audit (42-a, read-only):** 9/9 docs claims WIRED · 12/12
  defect sweeps clean · 10/10 counts MATCH (incl. the audit's own
  dynamic 432/432 unit re-run, 19.97s, plus lint ✓ · typecheck ✓ ·
  typecheck:tests ✓ as extra permitted gates) · 8/8 carried
  deferrals standing · **0 CRITICAL/HIGH/MEDIUM/LOW + 1 NIT + 4
  Informational**. The NIT is a genuine latent docs-quality defect
  inside the documented state (not drift from it): PAD §1.2's
  Technology Stack Summary still carried blueprint-time counts ("131
  tests" / "32 tests") contradicting the same document's §8.1 (432)
  and §12 (432 unit · 66 e2e) — the S25-2 stale-stats class,
  pre-existing since the session-6-era authoring and never surfaced
  in 40 cycles of audits — **fixed as S41-2** (the two cells now
  carry 432/66 aligned with §8.1/§12). The 4 Informational are
  brief-side citation glosses disposed no-change (the 2-box
  both-checked execution-log shape for verification-only cycles; the
  single legitimate console.error's home at `(storefront)/error.tsx:15`
  — the health route's degraded-503 path logs nothing; the
  git-ls-files pathspec convention — the documented 127 tracked src
  TS files is the true count, a bare `src/**/*.ts` pathspec drops
  zero-depth `src/proxy.ts` on this git build; the redirect anchor =
  6 textual occurrences, 5 executable + 1 comment). The audit also
  hunted fresh surfaces (redirects static/role-derived; 4
  `router.push` sites same-origin incl. the server-minted order+token
  pair; all 15 `fetch()` same-origin; no client component importing
  db/prisma; timing-safe HMAC with length guard; health degraded-503;
  demo credentials server-side props only; zero
  Math.random/@ts-ignore/innerHTML writes; `target="_blank"`
  hardened) — all clean.
- **S41-2 (NIT, docs-only):** the PAD §1.2 stale-stats cell fixed —
  "Node-env suite (432 tests; grew with every remediation session —
  see §8.1)" and "66 tests incl. the Tailwind v4 mobile-nav
  regression guard" — the Technology Stack Summary, §8.1 and §12 now
  agree.
- **S41-1 (docs sweep):** SKILL v1.37.0 → v1.38.0 (project_state
  sessions 2-41 + this entry), AGENTS plan range 2..40 → 2..41,
  CLAUDE tail, README/DEPLOYMENT drift checks, `.env.example`
  verified unchanged, the 25 screenshots refreshed on a final single
  clean run captured AFTER the final-tree e2e AND after
  `restore-demo-stock` re-topped the demo stock (the S14-4 healthy
  state — the run-39/40/41 discipline), the plan's Session 41
  section, `docs/session_74.md`, worklog Task 42. No changes in
  src/tests/prisma — the 432/66 suites carry the no-regression
  evidence by their green runs on the pulled tree AND on the final
  tree (the twice-run evidence). Environmental note: the fresh-clone
  recovery pattern applied again (the sandbox reset — .env rewrite,
  npm install, db:setup, chromium-1248 re-pairing) with the
  per-command absolute-export DATABASE_URL convergence standing.
- **Parity-script methodology refinements (recorded for future
  cycles):** measure the mobile-panel geometry only AFTER the mount
  animation settles (waitForTimeout(700) past visibility —
  transform none; mid-animation reads give y≈73–77 and false-alarm
  the documented 78/80 pins as drifted), and target the panel's
  search box as `input[placeholder="Search products..."]` — a
  `role="search"` locator matches the 314-wide wrapping FORM, not
  the 209-wide input. With those corrections the run-39/40/41
  geometry reproduces exactly.

### Session 42 (run 43) — the twelfth fully-empty remediation cycle, both surfaces clean for the eighth consecutive time (S42-1, S42-2)

- **No finding this cycle — the eighth consecutive cycle with BOTH
  audit surfaces clean, and the NINTH consecutive stable-reference
  cycle.** The live reference KEPT its catalog in the session-34-
  pinned Damascus-first order (/products "Newest" · home Featured ·
  home New Arrivals all unchanged; count text "8 products found") for
  the ninth consecutive cycle — no S33-1/S34-1-class re-alignment
  item. All 8 prices re-verified to the cent WITH compare-at values
  and discount badges (199.99/279.99 −29% · 89.99/129.99 −31% ·
  119.99/159.99 −25% · 149.99/199.99 −25% · 79.99 · 54.99/69.99 −21%
  · 42.99 · 349.99/429.99 −19%); review counts match the seed's
  authored display counts exactly (412/234/203/367/142/187/156/298 —
  the reference renders them parenthesized next to the category);
  the 8 category tiles, the rotating hero ("New Arrivals" observed
  mid-rotation), the 4 trust badges, and the mobile-menu contract at
  390×844 verified on BOTH sides — the reference's hamburger (36×36
  at x338,y14) → push-down panel with 5 nav links (each 358×44
  stacked from y121) + the icon-only search BUTTON (40×28 at
  x16,y81); toggle-closes (verified by clicking the hamburger again
  — 5 links → 0); navigate-closes verified with a REAL Playwright
  click on the panel's Products link (URL → /products, panel
  unmounted, re-checked defensively); the clone's contract verified
  with 15/15 automated checks (7 links · Close-menu 44×44 @330,78 ·
  panel search box 209×40 @16,80 · unmount-on-navigate — the
  run-42 settle-wait + input[placeholder] methodology applied)
  plus the clone's full SEO surface re-verified live (sitemap 25
  URLs, robots disallow set, noindex 8/8 private surfaces, health
  ok/db-up, home h1 renders).
- **Repo-side audit (43-a, read-only):** 10/10 docs claims WIRED ·
  12/12 defect sweeps clean · 12/12 counts MATCH (incl. the audit's
  own dynamic 432/432 unit re-run, 22.37s, plus lint ✓ · typecheck ✓
  · typecheck:tests ✓ as extra permitted gates) · 8/8 carried
  deferrals standing · **0 CRITICAL/HIGH/MEDIUM/LOW/NIT + 5
  Informational**. The 5 Informational: the four standing brief-side
  citation glosses re-confirmed (the execution-log shape — the
  Session 41 log is 3-box all-checked because it carried the S41-2
  fix, the 2-box convention applies to pure verification-only
  cycles; the git-ls-files pathspec convention — the documented 127
  tracked src TS files is the true count, a bare `src/**/*.ts`
  pathspec drops zero-depth `src/proxy.ts` on this git build; the
  redirect anchor = 6 textual occurrences, 5 executable + 1 comment;
  the single legitimate console.error's home at
  `(storefront)/error.tsx:15`) plus one new observational note (the
  dynamic unit duration 22.37s vs the 19.97–21.63s prior-cycle
  range — sandbox load variance; 432/432 fully green; no action) —
  all disposed no-change. The audit also hunted fresh surfaces
  (redirects static/role-derived; 4 `router.push` sites same-origin
  incl. the server-minted order+token pair; all 15 `fetch()`
  same-origin; no client component importing db/prisma; timing-safe
  HMAC with length guard; health degraded-503; demo credentials
  server-side props only; zero Math.random/@ts-ignore/innerHTML
  writes; `target="_blank"` hardened) — all clean.
- **S42-2 (LOW, docs-tooling — found during the screenshot refresh,
  the S37-2 class):** the `21-mobile-menu-open` capture flipped bytes
  run-to-run — two back-to-back re-captures (same server, same DB,
  seconds apart) differ by the SAME band structure (the photographic
  hero region, the header's backdrop-blur band, the evenly-spaced
  category-tile photo bands — 12.6% of pixels) while the VLM confirms
  the CONTENT is identical and the mobile-menu geometry pins are
  EXACT. Root cause: the panel mount re-rasterizes the photographic
  content behind it, and screenshotting before the re-raster settles
  catches it mid-flight. Fix (the S35-2/S37-2 precedent shape):
  `scripts/capture-screenshots.mjs`'s shot-21 flow now waits 700ms
  past the panel mount (the parity-script methodology). Verified
  deterministic: consecutive settled captures byte-identical (md5
  `5e59d090…`), a reduced-motion freeze reproduces the same bytes
  (the settled state IS the natural slide-1 rest state), a 3200ms
  stress capture reproduces it, and the final clean run landed on it.
- **S42-1 (docs sweep):** SKILL v1.38.0 → v1.39.0 (project_state
  sessions 2-42 + this entry), AGENTS plan range 2..41 → 2..42,
  CLAUDE tail, README/DEPLOYMENT drift checks, `.env.example`
  verified unchanged (all 5 env vars re-verified against their read
  sites by the audit, no undocumented vars), the 25 screenshots
  refreshed on a final single clean run captured AFTER the
  final-tree e2e AND after `restore-demo-stock` re-topped the demo
  stock (the S14-4 healthy state — the run-39/40/41/42 discipline),
  the plan's Session 42 section, `docs/session_76.md`, worklog Task
  43. No changes in src/tests/prisma — the 432/66 suites carry the
  no-regression evidence by their green runs on the pulled tree AND
  on the final tree (the twice-run evidence). Environmental note:
  the fresh-clone recovery pattern applied again (the sandbox reset
  — .env rewrite, npm install, db:setup, chromium-1248 re-pairing)
  with the per-command absolute-export DATABASE_URL convergence
  standing (the cycle's build ran clean with zero prisma:error
  lines; sitemap 25 URLs live-verified on the running server).

### Session 43 (run 44) — the thirteenth fully-empty remediation cycle, both surfaces clean for the ninth consecutive time (S43-1, S43-2)

> The run/plan numbering drift is documented in `docs/session_52.md`;
> this cycle executed the plan's "Session 43" section; the narrative is
> `docs/session_78.md` and the operator's raw log is `docs/session_77.md`.

- **Cycle shape:** the thirteenth consecutive verification-only cycle on
  the remediation surface. Gates green on the pulled tree AND the final
  tree (the twice-run evidence): lint · typecheck · typecheck:tests ·
  432/432 unit (19.99s pulled / final-tree re-run) · build (zero
  `prisma:error`) · 66/66 e2e (1.9m). Both audit surfaces clean for the
  ninth consecutive cycle: the live reference kept its catalog in the
  session-34-pinned Damascus-first order for the TENTH consecutive cycle
  (navigate-closes AND toggle-closes verified with REAL clicks; hero
  rotation observed; login verified), and the clone passed the
  consolidated 13/13 parity grid with the run-39/40/41/42 geometry
  reproducing EXACTLY.
- **Deep audit 44-a (read-only subagent):** 8/9 docs claims fully WIRED
  + 1 partial, 12/12 defect sweeps clean, 12/12 counts MATCH (incl. the
  audit's own dynamic 432/432 re-run at 20.16s plus lint/typecheck/
  typecheck:tests as extra permitted gates), 8/8 carried deferrals
  standing, fresh hunts all clean — **0 CRITICAL/HIGH/MEDIUM/LOW +
  1 NIT + 4 Informational.**
- **S43-1 (NIT, docs-only — the audit's one finding):** the SKILL
  frontmatter's `project_state` range phrase missed its session-42 bump —
  the S42-1 sweep claimed "(project_state sessions 2-42)" in three
  places (the plan, the Appendix B entry, the commit message) but the
  phrase itself still read "post-remediation sessions 2-41" at v1.39.0.
  Git history proves the lockstep convention (5511f1d→2-38, 6c7fc3d→2-39,
  5828a76→2-40, 732ea36→2-41, then the stall). Fixed this cycle by the
  catch-up: 2-41 → 2-43 (the missed intermediate value folds into the
  catch-up; documented in the plan's Session 43 dispositions).
- **S43-2 (docs sweep):** SKILL v1.39.0 → v1.40.0 (project_state
  sessions 2-43 via the S43-1 catch-up + this entry), AGENTS plan range
  2..42 → 2..43, CLAUDE tail, README/DEPLOYMENT drift checks,
  `.env.example` verified unchanged, the 25 screenshots refreshed on a
  final single clean run captured AFTER the final-tree e2e AND after
  `restore-demo-stock` re-topped the demo stock (the S14-4 healthy
  state — the run-39..43 discipline), the plan's Session 43 section,
  `docs/session_78.md`, worklog Task 44. No changes in
  src/tests/prisma — the 432/66 suites carry the no-regression evidence.
- **Environmental note (capture discipline, the session-43 refinement):**
  `pkill -f "standalone/server.js"` misses the forked
  `next-server (vNN)` child that owns the port — after a rebuild, a
  stale next-server serves HTML referencing wiped chunks (the
  auth-surface shots 500 on chunk loads → hydration timeouts while
  static pages still render; the nohup'd replacement dies silently on
  EADDRINUSE). After any rebuild: kill the port owner by PID
  (`ss -tlnp`), re-top the demo stock, verify the fresh server's PID
  start time, and spot-check its served chunk URLs exist on disk
  before capturing. Recorded in AGENTS.md's screenshot-discipline
  line; the re-run captured all 25 green on the first pass.
- **Audit Informational notes (disposed no-change, recorded for future
  briefs):** (1) the tool-result display pipeline strips the two-char
  sequence `[h` from displayed output — `a[href]` displays as `aref]`;
  byte-level `includes()` checks prove both suspect strings are intact
  in the source (store-chrome.tsx's focus-trap selector, mobile-nav's
  `[hidden]` comment) — future audits must verify bracket-bearing
  strings at byte level, never by eye; (2) the dynamic unit duration
  20.16s sits within the prior 19.77–22.37s range; (3) the standing
  git-ls-files convention — the 127 anchor = 53 `.ts` + 74 `.tsx`
  (`grep -cE '\.tsx?$'`); (4) the repo's git-tracked `worklog.md`
  carries Task 43 (the sandbox parent-worklog is the fresh-cycle stub
  — the documented reset pattern).

## Appendix C — Quick Reference Card

```bash
# full gate chain (the only gate)
npm run lint && npm run typecheck && npm run typecheck:tests && npm run test && npm run build && npm run test:e2e

# db
npm run db:setup                 # push + idempotent seed
node -e "console.log(process.env.DATABASE_URL)"   # env-shadowing check

# e2e single spec / mobile regression
npx playwright test tests/e2e/mobile-navigation.spec.ts

# screenshots for docs (server on :3000)
node scripts/capture-screenshots.mjs

# standalone smoke
npm run start & curl localhost:3000/api/health

# push (see docs/how-to-git-push-using-ssh-wrapper_SKILL.md)
python3 docs/ssh_git_wrapper_v3.py push origin main
```

Key files: `src/lib/demo-mode.ts` · `src/lib/settings-schema.ts` · `src/lib/db-path.ts` · `src/lib/money.ts` ·
`src/lib/order-money.ts` · `src/lib/rate-limit.ts` (incl. `clientIp`) ·
`src/lib/order-tracking.ts` · `src/lib/order-access.ts` ·
`src/lib/order-status.ts` · `src/lib/coupons.ts` (incl.
`couponRedemptionWhere`) · `src/lib/review-aggregate.ts` ·
`src/lib/auth-secret.ts` ·
`src/app/api/checkout/route.ts` · `src/components/store/mobile-nav.tsx` ·
`src/app/globals.css` · `prisma/seed.ts` · `tests/e2e/helpers.ts`
