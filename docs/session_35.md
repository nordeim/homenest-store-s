# Session 35 — Run narrative (session-21 remediation execution)

> This file is the narrative log of the **22nd run**: it executes the section
> numbered **"Session 21"** in `docs/REMEDIATION_PLAN.md` (findings S21-1..
> S21-7 — the request-fixture identity-isolation trap, the auth profile toast
> race, the checkout free-shipping mirror defect, the vacuous FREE pin, and
> the comment/disposition bundle). File names increment by run number (the
> run/plan numbering drift is documented); `docs/session_33.md` holds the
> previous run's closing narrative and `docs/session_34.md` its raw log.

## 1. Workspace refresh & documentation review

The workspace had been reset — fresh-cloned
`https://github.com/nordeim/homenest-store-s.git` at `dbd8674` (= `a857949`,
the run-21 commit, + the operator-committed `docs/session_34.md` raw log).
Reviewed in order: the operator's `coding_agent_prompt.md` (operating modes,
decision hierarchy, evidence discipline), AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md v1.17.0; then
docs/session_33.md (run-21 narrative), docs/session_34.md (its raw log),
docs/REMEDIATION_PLAN.md (sessions 2–20), worklog.md — cross-checked against
the codebase: docs and code agree; the project was in the session-20-completed
state.

**Environment**: the sandbox re-exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db`; the pre-existing
convergence symlink pointed at a NONEXISTENT path
(`/home/z/homenest-store-s/db`). Converged by re-pointing the symlink at the
clone's db dir: the first `db:push` ran with an explicit
`DATABASE_URL="file:../db/custom.db"` override (process env beats the .env
shadow), creating `<repo>/db/custom.db`; the symlink then resolved the shadow
path onto the SAME file (one inode verified by `stat -c '%i'`). `.env`
carries the `file:../db/custom.db` contract + a dev `AUTH_SECRET`;
`db/custom.db` pushed + seeded at the repo root (16 products / 8 categories /
3 coupons / 2 users verified); `skills/` excluded from all
checking/testing/compilation per the operator contract.

## 2. Gate re-validation — two REAL e2e failures

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **379/379 unit** ✓ · build ✓ ·
**63/65 e2e** — `admin-coupons.spec.ts` (timeout waiting for the cart's
coupon input) and `auth.spec.ts` (S14-3 profile flow). Both investigated to
ROOT CAUSE before any code change (Mode B discipline), each becoming this
session's first findings:

1. **admin-coupons — S21-1.** The page snapshot showed "Your cart is empty";
   DB inspection showed the seeded line on a GUEST cart (`userId: null`)
   while the admin's own cart stayed empty. A Playwright probe matrix then
   proved the mechanism: after a page login, `context.cookies()` holds
   `homenest_session` (Secure — production build) but
   `request.storageState()` returns an EMPTY jar (the per-test `request`
   fixture does NOT share the browser context's cookies); an un-headered
   `request.post("/api/cart")` created a guest cart while the same call with
   an explicit `Cookie: homenest_session=…` header landed on the admin's
   cart (DB-verified ownership). The S20-1 "API-seeded cart" had therefore
   acted as a GUEST for its entire life — masked in run-21 by the durable
   admin cart's pre-existing content (the /cart page showed it regardless),
   deterministic on a fresh database (this run's state).
2. **auth profile — S21-2.** Captured live:
   `getByText('Profile updated')` resolved to **2 elements** (the toast
   title div + the toaster's `aria-live` announcement span) — the exact
   session-9 strict-mode class the suite had fixed in admin.spec (session 9),
   wishlist.spec (session 11) and admin-coupons (run 21) but never in the
   auth profile spec. Intermittent by nature (the wrapper carries the text
   only while the announcement is live). Secondary effect observed: a run
   aborted between the edit and the restore leaves the demo user's name
   "Edited", and the seed's `update: {}` policy never re-resets it — the
   next run then fails its own seed-name pin (self-breaking).

## 3. Live-reference parity + mobile menu + SEO (agent-browser)

Reference unchanged (verified logged-in with the provided credentials —
login → home redirect, same anatomy): same nav (Home/Products/Track
Order/About/Contact + search), same hero ("Elevate Your Kitchen", 5 slide
dots), same 8 category tiles, same featured set and authored order
(Damascus-first, −29% / (412) / $199.99). The reference's login page still
shows "Continue with Google" (the clone's recorded OAuth deferral).

**Clone verified on the fresh production build**: mobile menu (390×844)
open → `nav[aria-label=Mobile]` with all 7 links + search box → click Track
Order → lands on `/track-order` → panel closed (nav unmounted; button back
to "Open menu") — the Tailwind v4 conditional-mount pattern intact.
`/sitemap.xml` = 25 public URLs (zero private surfaces); `robots.txt`
disallows /admin, /account, /checkout, /api and references the sitemap;
home JSON-LD carries Organization + WebSite (+ SearchAction + ContactPoint).
Desktop visual parity re-confirmed (cream background, terracotta primary,
Playfair display headings, identical header anatomy + trust badges). Zero
console errors on a fresh browser session.

## 4. Fresh deep audit (session 21)

A read-only subagent (22-a) executed the repo `code-review-checklist`
12-category scan (`src/`, `prisma/`, `scripts/`, `tests/`, root configs;
`skills/` excluded); every finding was personally re-verified with file:line
evidence before planning.

**Result: 0 CRITICAL / 0 HIGH / 1 MEDIUM (product) + 1 LOW / 2 NIT /
2 Informational — plus the two test-reliability findings already fixed in
§2. The ninth consecutive session without a CRITICAL/HIGH product defect.**
Session-20 fixes **WIRED** (S20-2 narrow toggle at its call site; S20-6
engine chain end-to-end — WITH one gap: the checkout mirror, S21-3);
defect-class sweeps CLEAN elsewhere (every remaining `request.*` identity
site audited — seo/contact/shopping/admin/auth/addresses all correct,
including the two `page.request` sites that DO share cookies; every
remaining toast-title assertion carries `.first()`; no Tailwind v4 traps).
Static counts re-verified and ALL MATCHING the docs: 379 unit (38 files) ·
65 e2e (13 specs) · 18 models · 14 requireAdmin'd actions · 14 metered
`Retry-After` sites · 16 admin catch blocks across six files · 16/8/3 seed
constants.

Findings (all evidence-confirmed): **S21-3 = audit F-1 (Medium, product)**
the checkout mirror's `setCoupon` dropped the `freeShipping` flag — the
S20-6 diff typed it on `AppliedCoupon`/`CouponApplyResponse` and read it for
`shippingCost`, but never stored it, so FREESHIP rendered full shipping
($6.95 standard / $15.95 express) and an inflated total directly beneath
"Coupon FREESHIP — Free shipping" (no overcharge — the server re-derives
shipping = 0 inside the order transaction; the mirror contradicted the
receipt). **S21-4 = audit F-2 (Low)** the free-shipping e2e's
`getByText("FREE")` pin was vacuous — a case-insensitive substring match
that also hits the coupon label's "Free shipping" row — which is exactly why
S21-3 slipped through 65/65. **S21-5 = F-3 (NIT)** the stale inline comment
("the request fixture shares the admin session cookies") contradicted the
S21-1 fix in the same file. **S21-6 = F-4 (NIT)** the
`couponRedemptionFilter` doc comment overclaimed expiry coverage (the filter
guards code + isActive + cap; expiry stays READ-guarded by the in-tx
`isCouponRedeemable`). **F-5 (Informational)** the hardcoded
`"homenest_session"` literal in the spec (importing `SESSION_COOKIE` would
pull `next/headers` + Prisma into the Playwright bundle; the loud
`toBeTruthy()` guard fails on drift) — accepted. **F-6 (Informational)**
request-fixture guest rows / the durable cancelled order in admin.spec —
pre-existing and intentional — accepted.

## 5. Remediation plan

Appended the "Session 21" section to `docs/REMEDIATION_PLAN.md` (TDD steps +
dispositions), re-validated it against the codebase, then executed.

## 6. TDD execution (RED → GREEN)

**S21-1/S21-2 (GREEN before the plan was written — the two observed suite
failures WERE the RED evidence):**

- `admin-coupons.spec.ts` reads the session cookie from `context.cookies()`
  (with a loud `expect(...).toBeTruthy()` guard) and sends it as an explicit
  `Cookie` header on ALL five admin-identity request-fixture calls
  (cart-summary snapshot, cart POST seed, cleanup summary/DELETE/PATCH);
  the headerless `/api/search` call is identity-free and stays as-is.
  Verified on the exact failing scenario (fresh DB, empty admin cart):
  passes, and the DB-verified as-found cleanup holds (admin cart empty, the
  3 seed coupons active, no SESSION5).
- `auth.spec.ts`: `.first()` on all three "Profile updated" assertions plus
  the self-healing setup (a non-seed name is restored through the same
  fill → Save → toast flow before the flow pins it).

**S21-3/S21-4 (RED → GREEN):**

- **RED**: the free-shipping spec's checkout pin replaced with pins scoped
  to the ACTUAL Shipping rows — the review card's `dl` row AND the sticky
  summary's (`aside[aria-label="Order summary"]` `dl`), each
  `toHaveCount(1)` + `toContainText("FREE")`. Run against the unfixed
  mirror: failed with received string **"Shipping$6.95"** — the exact
  defect, captured as the RED evidence.
- **GREEN**: `setCoupon` in `checkout-client.tsx` passes the flag through
  (`...(data.freeShipping ? { freeShipping: true } : {})`); rebuild; the
  spec passes.

**S21-5/S21-6**: the stale spec comment reworded (the fixture is
identity-isolated — the explicit header is what makes the call the admin's);
the `couponRedemptionFilter` comment corrected (expiry is read-guarded only;
the sub-second expiry residue recorded as the accepted class).

**S21-7 (operator-found during manual verification — disposition recorded,
not taken)**: the cart page's server-rendered threshold hint ("Add $15.01
more for free shipping") does not know an applied free_shipping coupon;
no money-path impact (the row says "Calculated at checkout"); making it
coupon-aware requires lifting client coupon state into the page — the S20-7
precedent applies (structural change for marginal benefit).

## 7. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **379/379 unit** ✓ · build ✓ · **65/65 e2e** ✓
- **Manual verification** (agent-browser, fresh production build): guest
  adds the $34.99 French Rolling Pin → applies FREESHIP at the cart (below
  the $50 threshold, above the $30 minimum) → checkout → step 3: **both**
  shipping rows render FREE and the Place Order button reads **$37.61**
  (= $34.99 + $2.62 tax — shipping $0) → order placed → the server-derived
  receipt confirms Subtotal $34.99 / Shipping FREE / Tax $2.62 / Total Paid
  $37.61. Before the fix the mirror showed $44.41 while the receipt showed
  $37.61 — mirror and receipt now AGREE. Mobile menu re-checked (open →
  7 links → navigate → auto-close/unmount); zero console errors.

## 8. Screenshots & documentation

24 screenshots refreshed to `docs/screenshots/` (the same suite). Docs
aligned: AGENTS.md (the coupon invariant extended with the S21-3 mirror fix
+ the hardened pins; the NEW trap-log entry "the per-test `request` fixture
is IDENTITY-ISOLATED" with the masking history; the plan range 2..21),
CLAUDE.md (the e2e coverage list: S21-1 cookie-corrected admin-coupons,
S21-4 hardened free-shipping pins, S21-2 auth profile self-heal), README.md
(the same three spec notes), PAD (§8.2 spec rows + known issues #82 Fixed
and #83 Accepted), SKILL.md v1.18.0 (project_state + Appendix B Session-21
entry), DEPLOYMENT.md (no drift — no new env vars), `.env.example`
unchanged, this file, and the worklog entry.

## 9. Final state

**379/379 unit · 65/65 e2e · all gates green**; 24 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the carried deferrals remain (login-limiter
lockout tradeoff S8-8, the checkout P2002 recovery-loop integration seam,
the review action two-tier gate pin, the `/track-order` page-limiter wiring
pin, S21-7's coupon-aware cart hint, and the external-service epics — real
email delivery, OAuth, real payments — blocked on sandbox-external
credentials/SMTP). With the coupon engine now verified mirror-to-receipt,
natural next increments are **order-status email notifications once a
mailer lands** and the **OAuth "Continue with Google" affordance** the
reference shows.
