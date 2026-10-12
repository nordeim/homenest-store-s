# Remediation Plan — HomeNest Kitchen (Session 2)

> **Status:** EXECUTED (this document records the plan and its outcome; see the Execution Log at the end)
> **Date:** 2026-10-12
> **Scope:** Post-migration security & correctness hardening of the Next.js 16 + Prisma/SQLite codebase, following a full re-audit (session 2). The session-1 migration (Vite SPA → Next.js 16 storefront + admin superset of `nest-culinary-hub.base44.app`) was verified green before this plan was drafted: lint ✓ · typecheck ✓ · 69/69 unit ✓ · build ✓ · 28/28 e2e ✓ · health `db:up` ✓ · visual parity + mobile nav re-verified with agent-browser ✓.
> **Method:** TDD — the failing test for every fix is written first (or an existing spec is extended), then the fix, then the full gate chain (`lint && typecheck && test && build && test:e2e`).

---

## 1. Audit summary (evidence-based)

A read-only audit of every critical path (auth, admin actions, checkout/money, validation boundaries, route handlers, mobile nav, CSP/db-path contracts) was performed in session 2 against the repo's `code-review-checklist` skill (12-category scan: correctness, security, performance, quality, testing, docs).

**Result: 0 CRITICAL · 1 HIGH · 6 MEDIUM · 12 LOW.** All five documented architecture invariants verified PASS:

| Invariant | Verdict | Evidence |
|---|---|---|
| Money is integer cents everywhere | PASS | All money columns are `Int`; only `parseDollarsToCents` converts; `computeOrderMoney` is pure integer math; checkout never sees a client price |
| Zod at every API boundary | PASS* | All POST bodies Zod-validated; *deviation:* `/api/wishlist` used a manual `typeof` check (fixed in WI-8) |
| Admin actions all role-gated | PASS | All 11 actions in `src/lib/actions/admin.ts` begin with `requireAdmin()` |
| Mobile nav conditional-mount (Tailwind v4 trap) | PASS | `mobile-nav.tsx` returns `null` when closed; no `hidden`+flex JS toggling anywhere in `src/` |
| No client-trusted prices in checkout | PASS | Server re-derives unit prices, coupon, shipping, tax, total inside the transaction |

Clean checks: no SQL injection (Prisma parameterized), no XSS sinks (zero `dangerouslySetInnerHTML`), no `eval`, no secrets committed (`.env`, `db/*.db` git-ignored), no N+1 queries (batched `Promise.all` + includes throughout).

---

## 2. Findings → work items

### WI-1 (HIGH) — Unauthenticated PII disclosure via guessable order tracking

- **Evidence:** `src/app/(storefront)/track-order/page.tsx:80-85` looks up an order by sequential number only (`ORD-YYYY-NNN`, allocated from a row count in `checkout/route.ts`) and renders the customer's **email, full name, phone, complete shipping address, items and spend** (lines 147-149, 223-241) with no auth and no rate limit. Anyone can iterate `?number=ORD-2026-001…` and harvest the customer base.
- **Fix (TDD):**
  1. New unit tests `tests/unit/tracking-access.test.ts` for the new pure helpers in `src/lib/order-tracking.ts`: `normalizeEmail()` (trim/lowercase) and `emailsMatch()`.
  2. Extend `src/lib/validation.ts` with `trackOrderSchema` (`number` + `email`), unit-tested in `tests/unit/validation.test.ts`.
  3. `/track-order` form gains a required **Email** field; lookup becomes `findUnique({ where: { number } })` + `emailsMatch(order.email, email)`; a mismatch returns the **same** "couldn't find an order" message (anti-enumeration). Lookups are rate-limited (WI-4).
  4. `checkout/success/page.tsx:245` deep-link becomes `/track-order?number=…&email=…` so the legitimate buyer lands pre-filled; the header/footer/mobile-nav links are unchanged (plain form).
  5. E2E: `tests/e2e/shopping-flow.spec.ts` "track-order finds a placed order" fills both fields; new assertion that a wrong email shows the not-found alert.

### WI-2 (MEDIUM) — Hardcoded `AUTH_SECRET` fallback silently weakens cookie signing

- **Evidence:** `src/lib/auth.ts:16` — `process.env.AUTH_SECRET || "insecure-dev-only-secret-change-me"`. In production with a missing env var, the HMAC integrity layer runs on a public constant.
- **Fix (TDD):** extract `assertAuthSecret(env)` into `src/lib/auth-secret.ts` (throws when `NODE_ENV === "production"` and the secret is missing or equals the dev constant); call it at `auth.ts` module load; unit-test both branches in `tests/unit/auth-secret.test.ts`. Dev/test behavior unchanged.

### WI-3 (MEDIUM) — Login user enumeration (distinct "no account" vs "wrong password" errors)

- **Evidence:** `src/lib/actions/auth.ts:29-34` returns "No account found with this email." and early-returns before any scrypt work → account existence is trivially enumerable and timing-observable.
- **Fix (TDD):** always run `scryptVerify` (against a module-level dummy hash when the user is missing — constant-ish time), return the uniform error **"Invalid email or password."** Update `tests/e2e/auth.spec.ts` ("unknown email" case now asserts the uniform message).

### WI-4 (MEDIUM) — No rate limiting on unauthenticated write/lookup endpoints

- **Evidence:** login, register, reviews, contact, newsletter, coupon probes and order-tracking lookups are unmetered (spam/brute-force/enumeration surface).
- **Fix (TDD):** new `src/lib/rate-limit.ts` — in-memory fixed-window limiter, `rateLimit(key, limit, windowMs) → { ok, retryAfterSec }`, with periodic stale-bucket cleanup. Unit tests in `tests/unit/rate-limit.test.ts` (limit hit, window reset, key isolation, cleanup). Applied to: `loginAction`, `registerAction`, `reviewAction`, `/api/contact`, `/api/newsletter`, `/api/coupon/apply`, `/api/checkout`, and the `/track-order` lookup. Limits are generous (e.g. 10/min login, 30/min tracking) so legitimate flows and e2e are unaffected.

### WI-5 (MEDIUM) — Zero-quantity cart lines survive and can be "purchased"

- **Evidence:** `src/app/api/cart/route.ts:69-71` clamps `Math.min(qty, stock)` and writes `quantity: 0` when stock is 0 without deleting the line; checkout's guard `product.stock < line.quantity` passes for `0 < 0`, creating a $0 order item that still triggers shipping/tax.
- **Fix (TDD):** new pure helper `clampPurchaseQuantity(qty, stock)` in `src/lib/cart-quantity.ts` (returns 0 when the clamp would floor to ≤ 0); unit tests in `tests/unit/cart-quantity.test.ts`. PATCH deletes the line when the clamp yields 0; checkout filters `quantity <= 0` lines into a 409 ("please update your cart") defensively.

### WI-6 (MEDIUM) — Check-then-decrement stock race (oversell under concurrency)

- **Evidence:** `src/app/api/checkout/route.ts:187-202,228-233` validates stock with `findUnique` then decrements in a separate statement — two concurrent transactions can both pass validation before either decrement commits (the "(no races)" comment notwithstanding).
- **Fix:** inside the same transaction, per item, perform a **conditional atomic decrement** first: `tx.product.updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`; when `count === 0` throw the existing 409 "Only N left of …". Product row is still fetched for price/name snapshots. Existing e2e checkout specs pin the happy path; the change is race-free by construction (single conditional UPDATE).

### WI-7 (MEDIUM) — Register email-uniqueness race → unhandled P2002 (500 to the user)

- **Evidence:** `src/lib/actions/auth.ts:49-61` pre-checks `findUnique` then `create` with no `P2002` handler — a concurrent duplicate registration throws an unhandled server error.
- **Fix:** wrap `create` in try/catch; on Prisma `P2002` return the friendly "An account with this email already exists." (matches the pre-check message, so no e2e change needed).

### WI-8 — Low-severity fixes bundled (each small, verified by existing or new tests)

| # | Finding | Fix |
|---|---|---|
| L1 | Wishlist cookie omits `secure`; wishlist route validates with `typeof` | Align cookie options with the cart's (`secure` in production); Zod `z.object({ productId: z.string().min(1) })` in `/api/wishlist` POST/PATCH/DELETE |
| L2 | Expired sessions never purged | Opportunistic `session.deleteMany({ expiresAt: { lt: now } })` inside `loginAction` |
| L3 | Malformed JSON body → 500 instead of 400 | Split body-parse into its own try/catch in `/api/checkout` + `/api/cart` returning 400 |
| L5 | Carousel `ctaLink` accepts `javascript:` URLs (admin-only input; defense-in-depth) | `trackOrderSchema`-adjacent: constrain `slideSchema.ctaLink` to internal paths or `http(s)://` via regex; unit-tested |
| L6 | `updateSettings` sequential upserts, no transaction | Wrap in `db.$transaction` |
| L7* | Home page fetches all products then slices | Add `take: 8` to the featured/new-arrival queries (`src/app/(storefront)/page.tsx`) |
| L8 | Hamburger `aria-expanded={false}` hardcoded | Bind to `mobileNavOpen` from the store context |
| L9 | Demo credentials (incl. admin) rendered unconditionally in the login UI | Render the demo box unless `NEXT_PUBLIC_DEMO_MODE === "false"` — visible by default (reference parity, e2e unaffected), switch-off documented in `.env.example` |
| L10 | Cart-drawer `updateQty` races optimistic updates against `/api/cart-summary` (rapid clicks desync the badge) | Per-line pending lock + error rollback, mirroring `cart-lines.tsx` |
| L12 | `/api/cart` re-implements cart lookup with a hardcoded `"homenest_cart"` string | Import `CART_COOKIE`/`findCartId` from `@/lib/cart` (single source of truth) |

### Deferred (documented, out of scope for this session)

| # | Finding | Why deferred |
|---|---|---|
| L4 | No idempotency key on order placement | Designed seam for the Stripe milestone (`/api/checkout` + `computeOrderMoney`); retrofitting without a payment provider adds surface, not safety. Recorded as the first task of the payments epic. |
| L7 (rest) | Analytics aggregates all `orderItem` rows in JS; reviews/orders unpaged | Correct today at seeded volume; needs `groupBy` + pagination design when data grows |
| L11 | `metadataBase` falls back to `localhost:3000` | `.env.example` already documents `NEXT_PUBLIC_SITE_URL`; deployment-time concern |
| L13 | Prerendered 404 shell carries no CSP nonce | Cosmetic (no interactive islands on `not-found`); the `(auth)` fix pattern is documented in AGENTS.md if it ever matters |
| L14 | `secure` cookie tied to `NODE_ENV`, no `__Host-` prefix | Correct for the standalone deploy; behind-TLS-proxy setups should revisit |

---

## 3. Execution order & gates

1. **Foundation tests first** (red): `auth-secret`, `rate-limit`, `tracking-access`, `cart-quantity`, validation additions.
2. **Implement** the lib modules + schema additions (green).
3. **WI-3/WI-4/WI-7** in `actions/auth.ts` (uniform error, limiter wiring, session purge, P2002 catch).
4. **WI-5/WI-6** in cart + checkout routes (zero-qty deletion, atomic decrement, JSON 400).
5. **WI-1** tracking UI + success-page deep link + e2e updates.
6. **WI-8** bundle (wishlist, settings txn, aria, ctaLink, home `take`, drawer lock, CART_COOKIE, demo gate).
7. **Full gate chain:** `npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e`.
8. **Manual verification:** production server + agent-browser (home, mobile menu, tracking flow incl. wrong-email rejection).
9. **Screenshots** refreshed into `docs/screenshots/`; docs (`AGENTS.md`, `README.md`, `CLAUDE.md`, PAD) updated for every changed contract; `.env.example` extended (`NEXT_PUBLIC_DEMO_MODE`).

## 4. Explicitly out of the box

- `skills/` folder is excluded from linting, typechecking, testing and compilation (tsconfig/eslint already exclude it).
- No new git branch — all work lands on `main` as an atomic Conventional Commit.
- No real payment integration (the demo payment stays clearly labeled).

---

## 5. Execution log

- [x] WI-1 — tracking access control (`number` + `email`, anti-enumeration message, rate-limited, success deep-link, e2e updated)
- [x] WI-2 — `assertAuthSecret` production enforcement + unit tests
- [x] WI-3 — uniform login error + dummy-hash burn + e2e updated
- [x] WI-4 — `rate-limit.ts` + unit tests + wired into login/register/reviews/contact/newsletter/coupon/checkout/tracking
- [x] WI-5 — `clampPurchaseQuantity` + unit tests; zero-qty lines deleted; checkout 409 filter
- [x] WI-6 — atomic conditional stock decrement inside the checkout transaction
- [x] WI-7 — register P2002 catch → friendly message
- [x] WI-8 — L1, L2, L3, L5, L6, L7*, L8, L9, L10, L12 fixed
- [x] Gates re-run green after the changes (see final section of this file)
- [x] Docs + `.env.example` + `homenest-store-s_SKILL.md` + `worklog.md` updated
- [x] Screenshots refreshed; committed to `main` and pushed via the SSH wrapper

**Post-remediation totals:** 94/94 unit tests, 28/28 e2e tests (the track-order spec now pins the number+email access contract end-to-end), lint/typecheck/build clean.
