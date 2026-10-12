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

---

# Session 3 — Post-push audit & superset hardening (2026-10-12)

> **Status:** EXECUTED (see the Session-3 Execution Log at the end)
> **Scope:** Re-validation of the session-2 deliverables on the pulled tree (`86bf17f`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan + targeted validation of the session-2 deferred items), and TDD remediation of the newly identified findings.
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && test && build && test:e2e`).

## 1. Re-validation of session-2 claims (all green)

- `lint` ✓ · `typecheck` ✓ · **94/94 unit** ✓ · `build` ✓ · **28/28 e2e** ✓
- `.env` contract intact (`DATABASE_URL="file:../db/custom.db"`, real `AUTH_SECRET`); env-shadowing convergence (hardlink) re-confirmed
- Visual parity re-verified with agent-browser: desktop home (header anatomy, hero carousel, trust badges) and the **mobile menu** (push-down panel, orange active pill, green circular close button, open→navigate→close, `aria-expanded` bound)
- Tailwind v4 pattern compliance re-audited: zero display-utility JS toggling in `src/`, no `tailwind.config.js`, full `hsl()` values in `@theme inline`

## 2. Fresh audit findings → work items (S3-*)

### S3-1 (HIGH) — `/checkout/success` renders full buyer PII from a guessable order number
- **Evidence:** `checkout/success/page.tsx` looked up the order by `?order=` only (sequential `ORD-YYYY-NNN`) and rendered buyer email, full shipping address, items, spend, payment label and coupon — no session check, no token, no rate limit, and the page was indexable. Same bug class as session-2 WI-1, but this page was missed (only its deep-link was changed). **Confirmed live**: `curl /checkout/success?order=ORD-2026-001` returned buyer PII unauthenticated.
- **Fix (TDD):** new `src/lib/order-access.ts` — `orderAccessToken(number)` (HMAC-SHA256 keyed by the auth secret, domain-separated, 128-bit hex) + `verifyOrderAccessToken` (timing-safe). `/api/checkout` returns `{ orderNumber, token }`; the success page renders the full receipt **only** for a valid `order`+`token` pair; any other combination (missing/bad token) renders the same "We couldn't find that order" shell (anti-enumeration — order existence is no longer observable). `robots: { index: false }`. Checkout client carries the token in the redirect. Unit tests `tests/unit/order-access.test.ts`; e2e pins the guess-denial.

### S3-2 (MEDIUM) — Order money derived from a pre-transaction snapshot
- **Evidence:** subtotal/discount/shipping/tax/total were computed from `getCartSummary()` read *before* the tx while item `unitPrice` was re-read from products *inside* the tx — a concurrent admin price edit in that window produced `order.total ≠ Σ(unitPrice×qty)` plus wrong tax/shipping.
- **Fix:** move all money derivation inside `placeOrderTx`: build `orderItems` from the tx-read products first, derive `subtotal` from the snapshots, re-validate the coupon inside the tx, then `computeOrderMoney`. The pre-tx coupon check remains as a fast-fail UX path only.

### S3-3 (MEDIUM) — Cancelling an order never restored stock; cancelled was not terminal
- **Evidence:** `setOrderStatusAction` accepted any transition (including `delivered → pending`) with no restock, so cancelled orders permanently consumed inventory.
- **Fix (TDD):** new pure helpers in `src/lib/order-status.ts` — `canTransitionOrderStatus(from, to)` (cancelled is terminal; no self-transitions) and `shouldRestockOnStatusChange(from, to)` (true iff `from ≠ cancelled && to === cancelled`). The action runs inside a `$transaction`, increments each item's product stock on cancel, and records "Stock restored." in the event note. Unit tests `tests/unit/order-status.test.ts`; e2e cancels an order through the admin UI.

### S3-4 (MEDIUM) — Guest cart/wishlist never merged at login
- **Evidence:** the merge lived only inside `getOrCreateCart`/`getOrCreateWishlist`, whose callers are the cart/wishlist API routes — a guest who logged in with a full guest cart saw their old (possibly empty) cart until the next add-to-cart, violating the documented invariant "on login the guest cart merges into the user's".
- **Fix:** `loginAction` and `registerAction` call `getOrCreateCart(user.id)` + `getOrCreateWishlist(user.id)` after `createSession` (best-effort try/catch — a merge failure must never block login). E2E: guest adds to cart → login → the item is in the account cart.

### S3-5 (MEDIUM, session-2 L4) — Checkout idempotency key
- **Evidence:** the only double-submit guard was client-side state; a lost response after the atomic commit turned the retry into a 409 "Your cart is empty" with no receipt.
- **Fix (TDD):** `Order.idempotencyKey String? @unique` (+ `db:push`); `checkoutSchema.idempotencyKey` (16–64 chars, optional); the client generates `crypto.randomUUID()` once per checkout-mount and reuses it across retries; the route short-circuits replays by looking the key up and returning the same `{ orderNumber, token }`; a `P2002` on the key (race) is resolved by re-query instead of retrying the number loop (unique-violation handling now distinguishes `number` from `idempotencyKey` targets). E2E: POST `/api/checkout` twice with the same key → identical order number, single stock decrement.

### S3-6 (MEDIUM, session-2 MEDIUM-4 minimal slice) — Coupon expiry + redemption cap
- **Evidence:** `Coupon` had only `isActive` — seeded codes were immortal and unlimited; the only lever was editing the DB.
- **Fix (TDD):** `Coupon.expiresAt DateTime?`, `maxRedemptions Int?`, `timesUsed Int @default(0)` (+ `db:push`); new pure `isCouponRedeemable(coupon, now)` in `src/lib/coupons.ts` (inactive / expired / cap-reached → false); `findActiveCoupon` enforces it; `timesUsed` increments inside the checkout transaction. Admin coupon-management UI stays deferred. Unit tests in `tests/unit/coupons.test.ts`.

### S3-7 (LOW bundle)
| # | Finding | Fix |
|---|---|---|
| L-a | `/api/addresses` malformed JSON → 500 (the L3 pattern missed this route) | Split body-parse into its own try/catch returning 400 |
| L-b | Review rate-limit key was attacker-chosen (`author:productId`) | Key becomes `review:ip:product:author` with the `x-forwarded-for` IP from `headers()` |
| L-c | Cart-drawer optimistic quantity could disagree with the server clamp | `/api/cart` PATCH returns the clamped `quantity`; the drawer mirrors it |
| L-d | `/products` and `/wishlist` had no page titles | `metadata` exports (wishlist additionally `noindex`) |
| L-e | Wishlist duplicated cookie options inline twice | Export the shared `cookieOptions()` from `cart.ts` and reuse |

## Deferred again (with justification)

| # | Item | Why |
|---|---|---|
| 1 | Analytics `groupBy`/`$queryRaw` for top products | Correct at seeded volume; top-product revenue (Σ unitPrice×qty) is not expressible in Prisma `groupBy` and adding raw SQL is a perf optimization, not a correctness fix. Admin orders already paginated; revisit past ~50k order items. |
| 2 | 404-shell CSP nonce | `not-found.tsx` has no interactive islands of its own; the root-layout islands that fail to hydrate there are inert on a 404. The `(auth)` fix pattern is documented if it ever matters (a root-layout `connection()` would de-prerender everything). |
| 3 | `__Host-` cookie prefix | Requires a TLS-guaranteed deployment topology; breaks the plain-HTTP standalone deploy. Revisit at deploy-config time. |
| 4 | Shared-store rate limiter | The sync `rateLimit()` signature is the only coupling; a shared-store swap forces async at 9 call sites. Correct for the single-process standalone deploy; documented in the scale-out checklist. |
| 5 | Admin coupon-management UI | Enforcement ships (S3-6); management remains DB/seed-level until there is a merchandising need. |

## 3. Execution log (session 3)

- [x] S3-1 — `order-access.ts` + unit tests; `/api/checkout` returns `{ orderNumber, token }`; success page token gate + noindex; checkout client token deep-link; e2e pins the guess-denial
- [x] S3-2 — money derivation moved inside `placeOrderTx` (coupon re-validated in-tx, `computeOrderMoney` on tx snapshots)
- [x] S3-3 — `order-status.ts` + unit tests; cancel restocks stock in the admin transaction; cancelled is terminal; e2e cancels via the admin UI
- [x] S3-4 — guest cart + wishlist merge on login/register (best-effort); e2e pins the merge
- [x] S3-5 — `Order.idempotencyKey @unique` + schema/test/wire-up; e2e pins the replay (same order number, single stock decrement)
- [x] S3-6 — `Coupon.expiresAt/maxRedemptions/timesUsed` + `isCouponRedeemable` + in-tx `timesUsed` increment; unit tests
- [x] S3-7 — addresses 400, review limiter IP key, drawer clamp mirror, `/products` + `/wishlist` metadata, wishlist cookie options dedupe
- [x] Full gate chain re-run green; manual agent-browser verification (success-page guess-denial, token receipt, mobile menu)
- [x] Screenshots refreshed (`docs/screenshots/`, 23 shots incl. `23-checkout-success-locked.png`); docs (`AGENTS.md`, `README.md`, `CLAUDE.md`, PAD, `homenest-store-s_SKILL.md`, `worklog.md`) updated for every changed contract

**Post-remediation totals (session 3):** 115/115 unit tests, 31/31 e2e tests, lint/typecheck/build clean.
