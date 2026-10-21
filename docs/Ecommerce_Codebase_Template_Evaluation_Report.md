# E-Commerce Codebase Template Evaluation

## A Comparative Technical Audit of Three Next.js Storefront Codebases

| | |
|---|---|
| **Report type** | Comparative technical evaluation and ranking |
| **Subject** | `nordeim/ecommerce-store`, `nordeim/homenest-store-s`, `nordeim/luxury-fashion-store` |
| **Evaluation question** | Which codebase is the best template / foundation for scaffolding a production e-commerce website? |
| **Criteria** | Code quality · Feature completeness for production · Architectural robustness · Template adaptability |
| **Method** | Static audit (Mode C: review without unrequested fixes) of full local clones; docs-first, evidence-graded |
| **Snapshot date** | October 21, 2026 |
| **Companion artifact** | `Ecommerce_Website_Scaffold_SKILL.md` — generalized build skill distilled from the three repos' SKILL documents |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Methodology and Evidence Base](#2-methodology-and-evidence-base)
3. [Repository Profiles](#3-repository-profiles)
4. [Criterion I: Code Quality](#4-criterion-i-code-quality)
5. [Criterion II: Feature Completeness for Production](#5-criterion-ii-feature-completeness-for-production)
6. [Criterion III: Architectural Robustness](#6-criterion-iii-architectural-robustness)
7. [Criterion IV: Template Adaptability and Repository Hygiene](#7-criterion-iv-template-adaptability-and-repository-hygiene)
8. [Weighted Scorecard and Final Ranking](#8-weighted-scorecard-and-final-ranking)
9. [Consolidated Findings Register](#9-consolidated-findings-register)
10. [Recommendations and Adoption Paths](#10-recommendations-and-adoption-paths)
11. [Verification Ledger and Limitations](#11-verification-ledger-and-limitations)

---

## 1. Executive Summary

This report compares three repositories by the same author (nordeim): **ecommerce-store** (LUXE Store), **homenest-store-s** (HomeNest Kitchen), and **luxury-fashion-store** (AURELIA / VELOUR). Each is a Next.js 16 App Router storefront with an admin console, developed through an intensive AI-session workflow (126 to 171 commits between October 2 and October 21, 2026), and each ships an unusually deep documentation set: AGENTS.md, CLAUDE.md, a Project Architecture Document, and a root SKILL.md distilled for agent onboarding. The evaluation question is narrow and practical: which of the three is the best template or foundation for scaffolding a production e-commerce website, judged on code quality, feature completeness for production deployment, architectural robustness, and template adaptability.

**Table 1: Final ranking for template / foundation suitability**

| Rank | Codebase | Score | Verdict |
|---|---|---|---|
| 1 | homenest-store-s | 7.9 / 10 | The most complete commerce foundation: full admin CRUD, coupons, reviews, analytics, the strictest toolchain, and the only documentation set whose claims verified 100 percent. Payment gateway is the main gap, with a documented extension seam. |
| 2 | ecommerce-store | 7.0 / 10 | The only repo with production-grade Stripe payments (Payment Element, webhook backstop, refunds), undermined by a High-severity rate-limiting defect, no product CRUD, weakened type and lint gates, and triple brand naming. |
| 3 | luxury-fashion-store | 6.8 / 10 | The most disciplined engineering and test culture of the three, but least usable as a template: an explicit Proprietary license with no LICENSE file, a committed restorable SSH private key, the thinnest commerce feature set, and a test suite pinned to a third-party prototype's pixels. |

The three application cores are, by ordinary industry standards, remarkably strong: all three use TypeScript with zero `any` escapes in application code, scrypt password hashing with database-backed revocable sessions, Zod validation at every input boundary, integer-cent money, order-item snapshots, per-request CSP nonces, and behavioral test suites that run against the production standalone build. The differentiators sit at the edges: what the admin can manage, whether a real payment gateway is wired, how much unrelated baggage the repository carries, and whether the code can legally and practically be reused at all.

| 7.9 / 10 | 0 | 192 MB |
|:---:|:---:|:---:|
| **Top weighted score — homenest-store-s** | **Critical vulnerabilities in application code, all three repos** | **Unrelated `skills/` baggage committed in every repo** |

Severity-classified findings across the three audits total one Critical (a restorable Ed25519 private key committed to luxury-fashion-store's git history), eight High (a permissive-looking but legally absent license regime, a checkout-wide rate-limiting defect in ecommerce-store, missing product CRUD, weakened verification gates, absent CI, and the shared 192 MB baggage directory), and ten notable Medium findings, dominated by demo-only payments, absent email delivery, single-instance SQLite with in-memory rate limiting, and external CDN imagery dependencies. None of the three is deployable to production as-is; all three are strong enough to be worth adopting after targeted remediation.

> The application cores are production-minded; the repositories around them are not yet reusable artifacts.

---

## 2. Methodology and Evidence Base

The audit was performed in Mode C (review without unrequested fixes) against full local clones of each repository. Analysis was static: documentation was read first (README, AGENTS.md, CLAUDE.md, Project_Architecture_Document.md, and each root SKILL.md, totaling roughly 1.8 MB of markdown), then configuration, Prisma schemas, source trees, and test suites were examined with targeted searches and file reads. Objective metrics were collected with read-only commands: git history statistics, disk usage, anchored test-case counts, and pattern searches for type escapes and dead markers. Three parallel deep-dive audits (one per repository) were consolidated, and every Critical or High finding cited in this report was independently re-verified in the primary repository before inclusion.

**Table 2: Evaluation criteria and weights**

| Criterion | Weight | Rationale |
|---|---|---|
| Feature completeness for production | 30% | The stated goal is scaffolding a production store; breadth of commerce capability (catalog management, payments, orders, admin) is the primary value of a foundation. |
| Code quality | 25% | Type discipline, verification gates, error handling, comment hygiene, and documentation accuracy determine how safely a team can extend the codebase. |
| Architectural robustness | 25% | Mutation-seam design, data modeling, session and security architecture, and test architecture determine how the codebase behaves under change and load. |
| Template adaptability | 20% | Licensing, repository hygiene, branding depth, and rebrand effort determine whether the repo can actually be forked as a starting point. |

Confidence labels follow a strict convention. **Verified** means the claim was directly observed in this environment (file contents, command output, or counted metrics). **Reasoned** means the claim is a logical inference from static code inspection and was not executed. **Assumed** and **Unverified** mark claims that rest on stated assumptions or could not be checked. Notably, no package installations, builds, or test suites were executed: the audit environment did not run the applications, so all behavioral descriptions (checkout flows, webhook handling, rate-limit outcomes) are Reasoned from code, while all counts, file contents, and configuration states are Verified. The full ledger appears in Chapter 11.

---

## 3. Repository Profiles

All three repositories share one lineage and one development method. Each is a self-hosted, database-backed rebuild of a Base44 reference application, reproduced at measured computed-style parity and then extended into a functional superset with real persistence. Each was built through numbered AI development sessions with remediation plans committed alongside the code, and each carries the same five-document documentation set plus a large session archive. The family relationship is explicit: luxury-fashion-store archives its predecessor's documentation under `docs/legacy-homenest/` and credits the ecommerce-store architecture in its creation prompt, while homenest-store-s carries a committed zip of its own v1 codebase inside `docs/`.

**Table 3: Identity matrix**

| Attribute | ecommerce-store | homenest-store-s | luxury-fashion-store |
|---|---|---|---|
| Store codename | LUXE Store (metadata brand: Lumina) | HomeNest Kitchen | AURELIA (VELOUR) |
| Reference app cloned | fuzzy-lumina-style-hub.base44.app | nest-culinary-hub.base44.app | pastel-aurelia-fashion-edit.base44.app |
| Vertical | General lifestyle commerce | Premium kitchenware | Luxury fashion |
| Toolchain | Bun (npm fallback documented) | npm | npm |
| Framework / ORM | Next.js 16.1, React 19, Prisma 6.11 | Next.js 16.1, React 19, Prisma 6.11 | Next.js 16.4, React 19.3, Prisma 6.19 |
| Prisma models | 15 | 18 | 13 |
| Commits (window) | 152 (Oct 2 to 15) | 126 (Oct 12 to 20) | 171 (Oct 12 to 20) |

**Table 4: Scale and hygiene metrics (Verified)**

| Metric | ecommerce-store | homenest-store-s | luxury-fashion-store |
|---|---|---|---|
| Application source (`src/`) | 1.1 MB | 1.1 MB | 0.86 MB |
| `skills/` baggage | 192 MB (276 entries) | 192 MB (280 entries) | 192 MB (279 entries) |
| `docs/` directory | 73 MB (123 session logs, 332 screenshots) | 14 MB (110 logs, v1 zip) | 13 MB (77 logs, legacy archive) |
| `scripts/` directory | 3.2 MB (442 probe scripts) | 20 KB (2 scripts) | 472 KB (51 scripts) |
| Unit tests | 356 cases / 23 files | 444 cases / 49 files | 173 cases / 19 files |
| End-to-end tests | approx. 503 cases / 39 specs | 67 cases / 14 specs | 158 cases x 2 projects / 19 specs |
| Integration harnesses | 18 Stripe-webhook + 3 fixture-guard | 6 real-SQLite-engine harnesses | Wire-level security gates |
| CI pipeline / Dockerfile | None / None | None / None | None / None |
| LICENSE file | None | None (README claims MIT) | None (README says Proprietary) |

### Documentation inventory

Each repository ships five core documents. The README is the store's feature and operations manual; AGENTS.md is an agent cheat-sheet of commands, environment traps, and architecture invariants; CLAUDE.md defines a six-phase workflow; the Project Architecture Document (PAD) carries ADRs, threat models, and known-issues ledgers; and the root SKILL.md is a distilled, self-contained onboarding skill (1,100 to 1,400 lines) covering design tokens, component patterns, debugging playbooks, and trap logs. Documentation accuracy was spot-checked against code in all three repos, with materially different results detailed in Chapter 4: homenest's claims verified exactly, luxury's verified with two minor drifts, and ecommerce-store's contained two false enforcement claims. The documentation volume is itself a template consideration — 450 KB to 960 KB of overlapping, session-annotated markdown per repository is both an onboarding asset and a maintenance liability.

---

## 4. Criterion I: Code Quality

By the raw hygiene signals, all three codebases are exceptionally clean. Verified counts show zero occurrences of `: any`, `as any`, `@ts-ignore`, and `@ts-expect-error` in every `src/` tree, zero TODO or FIXME markers, no silent uncommented catch blocks, and comment density that consistently explains rationale (each non-obvious decision cites its session or finding number). The differences emerge in compiler and linter enforcement, in one real logic defect, and in documentation truthfulness.

**Table 5: Toolchain strictness comparison (Verified from configs)**

| Signal | ecommerce-store | homenest-store-s | luxury-fashion-store |
|---|---|---|---|
| TypeScript strict | true | true | true |
| noImplicitAny | false (weakened) | true | true |
| noUncheckedIndexedAccess | absent | true (strongest) | absent (uses noUnused*) |
| Tests type-checked | partial | yes (tsconfig.tests.json) | partial |
| ESLint posture | approx. 15 core rules disabled | next preset; seed excluded | next preset + restricted-globals guard |
| ignoreBuildErrors | true (external tsc gate) | false | false |
| any / ts-ignore / TODO in src | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

### The empty-Headers rate-limiting defect (ecommerce-store)

The single worst application-code defect found across the three audits sits in ecommerce-store's server actions. Five rate-limited entry points — `loginAction`, `resendVerificationAction`, `requestPasswordResetAction` (actions/auth.ts lines 52, 204, 262), `placeOrderAction` (actions/checkout.ts line 50), and `createPaymentIntentAction` (actions/stripe.ts line 47) — derive the client identity from `clientIp(new Headers())`. An empty Headers object always yields the same fallback identity, so every visitor shares one bucket per key. In production this means guest checkout is capped at roughly ten order placements per ten minutes across the entire site (a trivial cross-customer denial of checkout), and login limiting becomes a per-email global lockout that any attacker can trigger against any user. The in-code comment asserts that server actions have no request-header access, which is incorrect for Next.js 16 — `headers()` from next/headers is available in actions, and the same files already import `cookies()`. The sibling repos prove the point: both pin their limiter floors with wire-level tests that this repo's process did not catch, which is direct evidence of the verification-culture gap. Severity: High. Confidence: Verified (five call sites confirmed by search).

### Documentation truthfulness

**Table 6: Documentation claim spot-checks (Verified)**

| Repository | Checks | Result | Notable drift |
|---|---|---|---|
| homenest-store-s | 6 claims | 6 exact | 444 unit and 67 e2e counts, 18 models, 14 metered surfaces, 16 seed products — all exact. |
| luxury-fashion-store | 7 claims | 5 exact, 2 drift | PAD claims 27 e2e files vs 19 actual; catalog.ts references a docs/reference-spec.md that does not exist. |
| ecommerce-store | 5 claims | 2 exact, 1 drift, 2 false | PAD claims React Compiler rules ON while eslint.config.mjs disables the rule; PAD claims no dangerouslySetInnerHTML anywhere while 3 JSON-LD usages exist; DEPLOYMENT.md claims 16 API route handlers vs 4 actual and calls the product ORBITAL. |

The pattern matters for a foundation choice: documentation that survives verification (homenest, and mostly luxury) can be trusted as an operating manual during extension work; documentation with false enforcement claims (ecommerce-store) forces adopters to re-verify every guarantee independently. All three READMEs also embed session-by-session changelog prose directly into feature tables, which inflates reading cost without adding operator value — a style choice a template consumer will likely rewrite.

---

## 5. Criterion II: Feature Completeness for Production

Feature completeness is where the three repos diverge most sharply, and where the template-purpose framing reverses raw engineering rankings. ecommerce-store is the only repository with a real payment gateway, and its Stripe implementation is genuinely excellent: server-minted PaymentIntents with deterministic idempotency keys, a verify-then-place gate that re-retrieves intent status and amount server-side, a webhook backstop that verifies raw-body HMAC signatures before any database write, deduplication rows committed inside the placement transaction, duplicate/permanent/transient failure classification, and full and partial refund reflection with an admin payments-operations console. It also scaffolds email verification and password reset flows, although no email provider is wired and codes log to a console seam.

**Table 7: Production feature matrix (Verified unless noted)**

| Capability | ecommerce-store | homenest-store-s | luxury-fashion-store |
|---|---|---|---|
| Real payment gateway | Stripe end-to-end (webhooks, refunds) | None (demo card, last-4 only) | None (demo Luhn card + COD) |
| Product CRUD (admin) | None — seed-file only | Full CRUD + visibility + stock | Stock and visibility toggles only |
| Category management | Seed only | Full CRUD with guarded delete | Seed only |
| Coupons / promotions | None | 3 types incl. free-shipping; atomic redemption caps | None |
| Customer reviews | Display ratings only | Submit + read; transactional aggregates | None |
| Wishlist | Yes, guest-to-user merge | Yes, bounded 100, one-request add-all | Yes, deduplicating merge |
| Guest checkout | Yes, HMAC token receipts | Yes, token-gated receipts | Yes, capability-token matrix |
| Auth flows | Login, register, forgot, verify, reset | Login, register | Login, register, rotation revokes sessions |
| Email delivery | No (console seam) | No | No |
| Admin surfaces | Dashboard, orders, products, payments | Dashboard, products, categories, coupons, carousel, orders, analytics, settings | Dashboard, orders, products |
| Fulfillment | Status, tracking, refunds | Status, tracking, cancel-restocks-stock | Status, tracking, event minting |
| Analytics | Payments operations views | SQL day-bucket revenue, top products | True-count low-stock KPI |
| SEO | sitemap, robots, JSON-LD, OG + gates | sitemap, robots, JSON-LD, OG, noindex pins | Adds security.txt, per-product OG, PWA manifest |
| Accessibility | axe gates, desktop + mobile | a11y e2e pins, focus containment | axe gate over 14 surfaces |
| Search | LIKE typeahead + results page | LIKE + category/sort filters | Overlay with trending chips |
| Tax / shipping zones | Flat-rate shipping, no tax | Threshold + coupon shipping, no tax | Threshold shipping, no tax |
| i18n / multi-currency | No | No | No |

### Gap analysis

For a real store, ecommerce-store's gap is catalog operations: the admin can toggle visibility and adjust stock, but adding or editing products requires editing prisma/seed.ts and reseeding, which is not a viable operating model for a store with any catalog churn. homenest-store-s inverts the gap: its admin is a complete back office (the only one of the three with product, category, coupon, carousel, and settings management, plus SQL-backed analytics), but checkout runs on a clearly-labeled demo card that stores only the last four digits. The saving grace is that the money path is already isolated in a documented transaction seam (`src/lib/order-placement.ts` with the database client injected, pinned by real-engine tests), and the family architecture means ecommerce-store's Stripe stack can be ported into it with modest effort. luxury-fashion-store has the thinnest commerce surface of the three — thirteen models, no coupons, no reviews, no product creation, and no tax line at checkout — a deliberate consequence of its parity-first scope. All three share the same production omissions: no email provider, LIKE-based search with no relevance ranking, no caching or ISR (every page is force-dynamic), single-writer SQLite, in-memory rate limiting, and English-only United States defaults.

---

## 6. Criterion III: Architectural Robustness

All three repositories share a sound architectural skeleton: React Server Components by default with a small set of client islands, a single server-hydrated StoreProvider, Prisma over SQLite with integer-cent money, order-item snapshots that survive product edits, guest carts keyed by cookie tokens and merged into accounts at login, and a per-request CSP nonce minted in `src/proxy.ts`. They differ in mutation-seam policy, session lifecycle rigor, and test architecture — and the differences are instructive rather than merely ranked.

**Table 8: Mutation-seam and security architecture**

| Aspect | ecommerce-store | homenest-store-s | luxury-fashion-store |
|---|---|---|---|
| Mutation seams | 6 server-action modules + 4 route handlers | 3 action modules + 11 route handlers | 6 action modules + 3 route handlers (purest) |
| Session storage | DB rows, sha256 token hash, revocable | DB rows, sha256 token hash, hourly sweep | DB rows + expiry denylist + sweeper |
| Password rotation | Sessions persist | Sessions persist | Revokes all other sessions |
| Logout | Deletes row | Deletes row | Deletes row (wire-pinned) |
| Guest order access | HMAC view token, constant-time | HMAC token + anti-enumeration tracking | HMAC capability matrix, no existence leak |
| Rate limiting | 14+ surfaces, one High defect | 14 surfaces, Retry-After, spoof-resistant IP | All mutation seams, wire-pinned floors |
| Prod secret guard | Dev fallback (silent) | Boot refuses to start | Boot refuses to start (instrumentation) |

### Test architecture depth

The test cultures are the most distinctive architectural feature of this family, and each repo pushes a different discipline. luxury-fashion-store is the deepest: its action-seam security gate POSTs crafted server actions over the wire (Next-Action headers with JSON and multipart shapes read from the build's manifests) to prove IDOR walls, role walls, and Zod bounds fail closed with zero writes; its throwaway-standalone pattern spawns scratch production servers on fixed ports to pin limiter floors and the runtime sweeper against real Prisma state; and its commit history documents mutation-testing cycles (rebuild, predicted-runs-red, restore, green) for every gate. The cost is coupling: the harness depends on the exact Next.js 16.4 wire format, so a framework upgrade breaks it in non-obvious ways, and everything runs on a single worker with no CI to run it at all. ecommerce-store contributes the family's best integration testing asset — an 18-case Stripe webhook suite that drives the real route handler with real HMAC-signed events against a scratch database, plus axe, Core Web Vitals, INP, and SEO standing gates. homenest-store-s contributes the real-engine harness pattern: six suites that run the actual checkout transaction, coupon-cap increments, and address caps against temporary SQLite files, catching money-path defects that mocks cannot. All three boot the production standalone build for e2e rather than a dev server, which is the right call for a commerce template.

### The single-instance ceiling

Every repository documents the same deployment shape: one Node process, one SQLite file, in-memory rate-limit buckets, and force-dynamic rendering on every data-touching page. That is an honest and defensible architecture for a self-hosted small store, and each PAD states the constraint rather than hiding it. But a template adopter planning horizontal scale must treat the persistence layer as replaceable: the Prisma schema is portable to PostgreSQL (documented paths exist in two repos), while the in-memory limiter and the sweeper scheduling need a shared store before a second instance can be added. ecommerce-store's schema also omits non-unique indexes on foreign keys, which is invisible at demo scale and costly after a PostgreSQL port. These are Reasoned assessments from configuration and schema inspection; none were executed at load.

---

## 7. Criterion IV: Template Adaptability and Repository Hygiene

This criterion decides the ranking more than any other, because it measures what a template consumer actually inherits on day one. Three findings dominate: no repository ships a LICENSE file; every repository embeds approximately 192 MB of the author's unrelated personal AI-skill library; and one repository carries a restorable private key in its git history.

**Table 9: Licensing posture (Verified)**

| Repository | README claim | Legal reality and implication |
|---|---|---|
| homenest-store-s | MIT — see the repository settings | No LICENSE file exists; default all-rights-reserved applies until the author adds one. The stated intent makes this a one-commit fix, but today a fork has no granted rights. |
| ecommerce-store | Silent (no license section) | No LICENSE file, no license field, no claim. Reuse rights are entirely unspecified. |
| luxury-fashion-store | Proprietary — internal reference implementation | No LICENSE file; the README explicitly disclaims reuse. As-is, this is a hard legal blocker for template use. |

### Committed secrets (Critical)

`luxury-fashion-store/docs/prompt-to-review-2.md` lines 33-39 contain a complete Ed25519 OpenSSH private key body beneath a redacted BEGIN line — the base64 payload and the END marker are intact, so the key is restorable in seconds, and it is the push key for the GitHub repository itself. Key material also appears in `docs/how-to-git-push-using-ssh-wrapper_SKILL.md` and `docs/ssh_git_wrapper_v3.py`, and login credentials for the cloned reference site appear in nine further documentation files. Because these sit in git history, remediation requires key rotation plus a history rewrite (git filter-repo) before the repository can safely be shared or forked. Severity: Critical (key exposure), High (credential sprawl). Confidence: Verified by direct file read.

### Repository baggage

Each repository vendors the same 192 MB `skills/` directory — roughly 2,600 tracked files and 276 to 280 top-level entries spanning college-admissions tooling, PDF and spreadsheet skills, finance-model agents, and archived tarballs, none load-bearing for the store. The application itself is under 1.1 MB of source in every case, meaning 86 to 87 percent of tracked files are unrelated payload, and a full clone weighs 271 MB to 440 MB (the `.git` directories carry 157 to 217 MB of history on top). The toolchain actively fights the baggage: tsconfig, ESLint, and Vitest configurations in all three repos must explicitly exclude `skills/` and `docs/`. homenest additionally commits a 1.3 MB zip of its own v1 codebase, and ecommerce-store commits 73 MB of session screenshots plus 442 one-off probe scripts. For a template whose value proposition is a clean starting point, this is severe dead weight: it slows clones, pollutes search, complicates license scanning, and buries the actual product.

### Branding depth and the parity constraint

Rebranding effort differs by an order of magnitude. homenest-store-s is a settings-driven kitchenware store: swapping theme tokens, fonts, seed catalog, and copy is mechanical, and its commerce domain (carts, coupons, orders) is vertical-agnostic. ecommerce-store is triple-named (the package says LUXE, user-visible metadata says Lumina after the reference app, and its deployment doc says ORBITAL), pins its design tokens to the measured values of the external reference, and serves product imagery and its favicon from the reference app's public CDN — an availability and rebranding dependency the repo itself registers as a known issue. luxury-fashion-store is the most locked: its parity law pins roughly nine surfaces to the measured pixels of a third-party prototype, and the majority of its 158 e2e cases assert those reference-measured values (geometry bands, class strings, computed styles), so a rebrand invalidates the suite that is the repo's main asset. The parity approach is the family's engineering identity and simultaneously its biggest reuse constraint: it produces exceptional visual fidelity tests that a new brand must delete or re-measure.

---

## 8. Weighted Scorecard and Final Ranking

Scores were assigned per criterion on a 10-point scale from the verified evidence in Chapters 4 through 7, then combined with the Chapter 2 weights. Two deliberate judgments shaped the scoring. First, feature completeness rewards catalog operability and admin breadth alongside payments, because a foundation missing product CRUD is not operable as a store regardless of its payment maturity. Second, template adaptability penalizes legal blockers and committed secrets heavily, because they prevent adoption outright rather than merely slowing it.

**Table 10: Weighted scorecard**

| Criterion (weight) | homenest-store-s | ecommerce-store | luxury-fashion-store |
|---|---|---|---|
| Code quality (25%) | 8.8 | 7.6 | 9.0 |
| Feature completeness (30%) | 7.6 | 7.2 | 5.4 |
| Architectural robustness (25%) | 8.6 | 7.6 | 9.0 |
| Template adaptability (20%) | 6.2 | 5.0 | 3.2 |
| **Weighted total** | **7.9** | **7.0** | **6.8** |

![Figure 1: Per-criterion scores (0-10) by repository](assets/scorecard_chart.png)

*Figure 1: Per-criterion scores (0-10) by repository. luxury-fashion-store leads engineering discipline but collapses on adaptability; homenest-store-s is the balanced leader.*

The final ordering is homenest-store-s at 7.9, ecommerce-store at 7.0, and luxury-fashion-store at 6.8. The gap between first and second is the widest in the field: homenest combines the most complete commerce domain with the most trustworthy documentation and the only zero-finding security review above Low severity, and its single material gap (payments) is the one gap the family has already solved elsewhere. The gap between second and third is narrow but decisive in direction: ecommerce-store is meaningfully more usable as a foundation than luxury-fashion-store despite weaker engineering discipline, because its liabilities are fixable defects rather than structural blockers. luxury-fashion-store's scores are the most polarized in the set — the best code quality and architecture, the worst adaptability — which is precisely the profile of a reference implementation rather than a template.

---

## 9. Consolidated Findings Register

Findings are ordered by severity, then by repository. Each entry gives location, evidence, impact, a concrete fix, and a confidence label. Counts: 1 Critical, 8 High, 10 notable Medium. Low and Informational findings (doc verbosity, minor naming drift, HSTS flag breadth, and similar) are summarized in the repository worklogs and omitted here for signal.

**Table 11: Critical finding**

| ID / Location | Finding and evidence | Impact, fix, confidence |
|---|---|---|
| **C-1**<br>luxury `docs/prompt-to-review-2.md:33-39` | Restorable Ed25519 OpenSSH private key committed to git. The BEGIN line was replaced with a placeholder but the full base64 key body and END marker are intact; key material also appears in `how-to-git-push-using-ssh-wrapper_SKILL.md` and `ssh_git_wrapper_v3.py`. The key is the GitHub push key for this repository. | **Impact:** repository compromise vector; blocks any safe fork. **Fix:** rotate the key immediately, purge history with `git filter-repo`, audit push access. **Confidence:** Verified. |

**Table 12: High findings**

| ID / Location | Finding and evidence | Impact, fix, confidence |
|---|---|---|
| **H-1**<br>luxury (repo root) | No LICENSE file; README states Proprietary — internal reference implementation. | **Impact:** reuse legally blocked (all-rights-reserved default). **Fix:** owner must relicense explicitly or consumers must treat it as read-only reference. **Confidence:** Verified. |
| **H-2**<br>luxury `docs/` (9 files) | Reference-site login credentials committed across prompt-to-create, prompt-to-review, prompt-to-validate, and remediation files. | **Impact:** credential sprawl; complicates history cleanup. **Fix:** rotate credentials, remove during the C-1 history rewrite. **Confidence:** Verified. |
| **H-3**<br>ecommerce `src/lib/actions/` (5 sites) | All server-action rate limits key on `clientIp(new Headers())` — auth.ts lines 52, 204, 262; checkout.ts line 50; stripe.ts line 47 — so every visitor shares one bucket per key. | **Impact:** guest checkout capped globally at 10 orders / 10 min (cross-customer DoS); per-email login lockout. **Fix:** read `await headers()` from next/headers in actions. **Confidence:** Verified. |
| **H-4**<br>ecommerce admin | No product CRUD. Admin actions cover order status, tracking, visibility, stock, refunds only; product creation requires editing `prisma/seed.ts` and reseeding. | **Impact:** store not operable for catalog churn. **Fix:** add product and category admin CRUD (pattern exists in homenest). **Confidence:** Verified. |
| **H-5**<br>ecommerce tsconfig / eslint | Gates weaker than documented: `noImplicitAny` false; ESLint disables `no-explicit-any`, `no-unused-vars`, `no-console`, `no-empty`, and roughly a dozen more; `typescript.ignoreBuildErrors` true; `reactStrictMode` false. | **Impact:** the lint-must-pass gate proves little; doc claims overstate enforcement. **Fix:** restore strict flags, re-enable rules, fix violations. **Confidence:** Verified. |
| **H-6**<br>homenest (repo root) | No LICENSE file despite README claiming MIT — see the repository settings. | **Impact:** fork has no granted rights despite stated intent. **Fix:** commit an MIT LICENSE file (one-commit fix by the author). **Confidence:** Verified. |
| **H-7**<br>all three repos | No CI pipeline (`.github` absent) and no Dockerfile in any repository; the 500+ case suites run only locally. | **Impact:** nothing protects pushes; suites decay silently. **Fix:** add a CI workflow running typecheck, lint, unit, build, and e2e. **Confidence:** Verified. |
| **H-8**<br>all three repos | Approximately 192 MB `skills/` directory of unrelated personal AI skills in each repo (2,600 files, 86-87 percent of tracked files); clone weight 271-440 MB for a sub-1.1 MB application. | **Impact:** clone cost, cognitive load, license-scanning noise. **Fix:** strip `skills/`, `docs/` session archives, probe scripts, and the committed v1 zip before adoption. **Confidence:** Verified. |

**Table 13: Notable Medium findings**

| ID / Scope | Finding | Impact and fix |
|---|---|---|
| **M-1**<br>homenest, luxury | Demo-only payment (labeled, last-4 stored, no gateway). | Wire a PSP at the documented transaction seam; port the ecommerce-store Stripe stack. |
| **M-2**<br>all three | No email provider; verification codes and reset links log to console seams. | Integrate a transactional email service before enabling verification flows. |
| **M-3**<br>ecommerce | Product imagery and favicon served from external `media.base44.com` CDN; CSP img-src pinned to it. | Self-host assets; update CSP and seed URLs during rebrand. |
| **M-4**<br>ecommerce | No `error.tsx`, `loading.tsx`, or `global-error.tsx` route boundaries anywhere. | Add error and loading boundaries for resilience. |
| **M-5**<br>ecommerce | Rate-limit Map never evicts (unbounded growth); `registerAction` has no rate limit. | Add TTL eviction; meter registration. |
| **M-6**<br>homenest | Legal pages claim a payment processor and status emails that do not exist. | Align legal copy with actual capabilities. |
| **M-7**<br>luxury | No tax line at checkout (subtotal plus shipping only); no coupon model. | Add tax computation before production use in taxing jurisdictions. |
| **M-8**<br>luxury | Test harness coupled to Next.js 16.4 server-action wire format (multipart field ordering, fixed ports). | Budget rework on every framework upgrade; isolate wire-shape readers. |
| **M-9**<br>all three | Single-instance ceiling: SQLite single-writer, in-memory limiter, force-dynamic everywhere, no ISR or cache layer. | Documented tradeoff; needs shared store and caching strategy before horizontal scale. |
| **M-10**<br>ecommerce | Documentation factual drift: 16-vs-4 API handler claim, ORBITAL naming, false React-Compiler and dangerouslySetInnerHTML claims, 509-vs-503 e2e count drift. | Reconcile docs with code; adopt per-session doc verification like the sibling repos. |

---

## 10. Recommendations and Adoption Paths

The recommended primary path is **homenest-store-s as the foundation, with the Stripe stack ported from ecommerce-store**. The two repositories share the same architecture family (actions plus route handlers, ActionResult envelopes, Prisma integer-cent money, identical auth and CSP seams), so the port is an integration project rather than a rewrite: bring across ecommerce-store's `stripe`, `stripe-config`, and `stripe-payment` modules, its Payment Element island, its webhook route with the StripeEvent dedup model, and its 18-case webhook integration suite, then adapt the payment step to homenest's `order-placement` transaction. This yields the only combination in the family that has both a complete back office and production payments, while inheriting the strictest toolchain and the most accurate documentation.

### Pre-adoption remediation (in order)

1. **Licensing (blocking):** obtain a committed LICENSE from the repository owner before any fork. For homenest this matches the README's stated MIT intent; for ecommerce-store the license is currently unspecified.
2. **Repo slimming:** delete `skills/`, `docs/` session logs and screenshots, probe scripts, and the committed v1 zip; re-clone shallow before beginning work.
3. **CI and Docker:** add a pipeline running typecheck, lint, unit tests, build, and e2e against the standalone output; ship a Dockerfile for the documented standalone deployment.
4. **Payments and email:** port or wire the Stripe stack (above) and a transactional email provider; enable email verification only after the provider exists.
5. **Scale plan:** if horizontal scale is expected, move to PostgreSQL via the documented Prisma path, externalize the rate limiter, and add FK indexes (ecommerce-store's schema omits them).

### Per-repository guidance

- **homenest-store-s:** best foundation for most store builds (complete admin, coupons, reviews, analytics, settings). Fix the license, slim the repo, add CI, port payments.
- **ecommerce-store:** choose when payment maturity is the priority and catalog CRUD will be built in-house; fix the H-3 rate-limit defect and the H-5 gate weakening first, and unify the triple naming.
- **luxury-fashion-store:** do not scaffold from it (license, committed key, parity lock). Mine it instead: the ActionResult envelope, the session-revocation and sweeper design, the CSP nonce seam, the JSON-LD serializer, and above all the wire-gate testing pattern are all worth copying into whichever foundation you choose.

**Table 14: Decision guide by use case**

| If you need... | Start from | Then |
|---|---|---|
| The most complete store foundation with the safest extension base | homenest-store-s | Port the Stripe stack; add LICENSE, CI, email |
| Payments live fastest, catalog managed in-house | ecommerce-store | Fix H-3 and H-5 first; add product CRUD |
| An architectural reference for a fresh build | luxury-fashion-store | Read-only: adopt its patterns, not its code |
| A minimal learning example of Next.js commerce | any of the three | All are readable, documented, and runnable locally |

---

## 11. Verification Ledger and Limitations

This chapter records what was checked, how, and with what result, following the audit discipline that every non-trivial claim carry an evidence grade. Static findings below are Verified; behavioral characterizations of flows that were not executed are Reasoned; and the pass/fail state of the shipped test suites is explicitly Not Verified in this environment.

**Table 15: Verification ledger**

| Check | Method | Result and confidence |
|---|---|---|
| Repository cloning and history | `git clone`; `git rev-list`; `git log` dates | 152 / 126 / 171 commits, all October 2026, multi-author (human and agent identities). Verified. |
| Documentation claims | Anchored pattern counts compared against doc claims | homenest 6/6 exact; luxury 5 exact + 2 drifts; ecommerce 2 exact + 1 drift + 2 false claims. Verified. |
| Test suite sizes | Anchored `it(` / `test(` counts per file | 356 / 444 / 173 unit; approx. 503 / 67 / 158x2 e2e. Verified as static counts (runtime totals may differ slightly). |
| Committed SSH key | Direct read of prompt-to-review-2.md lines 30-42 | Real Ed25519 body present under a redacted header, plus 2 further files with key material. Verified. |
| Empty-Headers defect | Search for `new Headers()` across src | 5 sites in ecommerce-store server actions. Verified. |
| Licenses | Directory listing, package.json, README | No LICENSE file in any repository. Verified. |
| CI absence | Directory listing of `.github` | Absent in all three repositories. Verified. |
| Repo baggage | `du` and file counts | 192 MB `skills/` each; src under 1.1 MB; docs 13-73 MB. Verified. |
| Application behavior (auth, checkout, Stripe, CSP) | Static code inspection | Assessed as described in Chapters 5-6; not executed. Reasoned. |
| Test pass / fail state | Not executed (no installs or builds) | Unknown; READMEs claim green suites. Not verified. |
| Parity pins vs live reference sites | Not executed | Reference measurements not re-taken. Not verified. |

### Limitations

Three limitations bound these conclusions. First, this was a static audit: no dependency installation, build, or test execution was performed, so runtime behavior, test pass rates, and performance are characterized from code and documentation rather than observation, and the mutation-testing culture documented in the repos' commit logs was accepted as evidence rather than re-run. Second, all three repositories are two to three weeks old at audit time, single-family, and largely AI-authored with no external review; they are moving targets, and findings such as the licensing posture and the empty-Headers defect may be remediated upstream after this report's snapshot date (October 21, 2026). Third, scoring involves judgment: the weights in Chapter 2 encode the template-use framing supplied by the request, and a different framing (for example, pure engineering-quality ranking, or learning-resource ranking) would elevate luxury-fashion-store substantially.

### Reproduction commands

Key verified checks can be reproduced against local clones with:

```bash
git clone https://github.com/nordeim/<repo>.git

# H-3: the empty-Headers rate-limit defect (ecommerce-store)
rg -n "new Headers\(\)" src/lib/actions/

# C-1: committed private key material (luxury-fashion-store)
rg -c "OPENSSH PRIVATE KEY" docs/

# Repository baggage
du -sh skills docs src .git

# Anchored unit-test counts
rg -c "^\s*(it|test)\(" --glob "*.test.ts"
```

Suites themselves are runnable per each README (`npm` or `bun install`, `db:setup`, `test`, `test:e2e`) and were not run here.
