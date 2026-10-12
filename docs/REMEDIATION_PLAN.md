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

---

# Session 4 — Post-push audit & production hygiene (2026-10-12)

> **Status:** EXECUTED (see the Session-4 Execution Log at the end)
> **Scope:** Re-validation of the session-3 deliverables on the pulled tree (`c5c021d` + `docs/session_3.md`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan + re-validation of the session-3 deferred items), and TDD remediation of the newly identified findings (1 MEDIUM + LOW bundle).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation of session-3 claims (all green)

- `lint` ✓ · `typecheck` ✓ · **115/115 unit** ✓ · `build` ✓ · **31/31 e2e** ✓
- `.env` contract intact (`DATABASE_URL="file:../db/custom.db"`, real `AUTH_SECRET`); env-shadowing convergence (hardlink) re-confirmed
- Visual parity re-verified with agent-browser against the LIVE reference (`nest-culinary-hub.base44.app`, logged in): desktop home (header anatomy, hero carousel, trust badges) and the **mobile menu** (push-down panel, orange active pill, green circular close button, open→navigate→close, `aria-expanded` bound) — the reference is unchanged and the clone remains a functional superset
- Tailwind v4 pattern compliance re-audited: zero display-utility JS toggling in `src/`, no `tailwind.config.js`, full `hsl()` values in `@theme inline`

## 2. Deep-audit verdicts on the session-3 deferred items (all re-validated as DEFER)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Analytics `groupBy`/`$queryRaw` | DEFER | `admin/analytics/page.tsx` orderItem.findMany still unbounded, but the seed creates ZERO orders and traffic adds tens of rows; admin-only + force-dynamic. Revisit past ~50k items. |
| 2 | 404-shell CSP nonce | DEFER | `not-found.tsx` is pure static markup; root-layout islands fail to hydrate there but are inert (no StoreChrome, no toast sources, Links degrade to native anchors). |
| 3 | `__Host-` cookie prefix | DEFER | `cookieOptions()` (path=/, no Domain, secure=NODE_ENV) satisfies every `__Host-` requirement except Secure-on-plain-HTTP. Caveat recorded: non-localhost plain-HTTP hostnames already break cookies today — deploy-topology constraint. |
| 4 | Shared-store rate limiter | DEFER | 8 call sites (re-counted), all async contexts, sync-signature coupling only. Mechanical swap when scaling out. |
| 5 | Admin coupon-management UI | DEFER | Enforcement complete server-side; zero admin coupon mutations exist. Management stays DB/seed-level (see S4-8 which makes reseeds non-destructive). |

## 3. Fresh audit findings → work items (S4-*)

### S4-1 (MEDIUM, F-1) — Login/register limiter keyed only by attacker-chosen email
- **Evidence:** `src/lib/actions/auth.ts:72` (`login:${email}`) and `:102` (`register:${email}`) — rotating emails bypasses the budget entirely, and every attempt forces a real scrypt burn (uniform-error dummy hash), making login an ~50–100ms-CPU-per-request amplification vector. Every other guest surface is per-IP.
- **Fix (TDD):** extract `clientIp(headerValue)` into `src/lib/rate-limit.ts` (null/empty → "direct", comma list → first hop, trimmed — the pattern currently copy-pasted in 3 call sites) with unit tests; wire a SECOND per-IP check (`login-ip:` / `register-ip:`, 30/min) next to the per-email checks in both actions.

### S4-2 (LOW, F-2) — `/api/coupon/apply`: malformed JSON → HTTP 200, server errors → HTTP 200
- **Evidence:** `src/app/api/coupon/apply/route.ts:27` has no body-parse split; the generic catch at `:63-67` returns `NextResponse.json` without a status → 200 for both bad JSON and real 500s. The L3/L-a pattern missed this route.
- **Fix:** split body-parse into its own try/catch → 400 `"Invalid JSON body."`; add `{ status: 500 }` to the generic catch. E2E pins the contract (raw non-JSON POST → 400).

### S4-3 (LOW, F-3) — Coupon redemption cap has a small TOCTOU window inside the checkout tx
- **Evidence:** `src/app/api/checkout/route.ts:275-278` — `isCouponRedeemable` reads `timesUsed`, then `update` increments unconditionally; two concurrent checkouts can both pass a `maxRedemptions` boundary.
- **Fix (TDD):** new pure helper `couponRedemptionWhere(maxRedemptions)` in `src/lib/coupons.ts` returning the Prisma filter (`timesUsed < max` when capped, no-op when null) with unit tests; the checkout increment becomes `updateMany` + `count === 0` → 409 "just reached its redemption limit".

### S4-4 (LOW, F-4) — Cart POST: lost-update race + 99-cap inconsistency with PATCH
- **Evidence:** `src/app/api/cart/route.ts:41-49` — read-then-upsert outside a transaction (two concurrent add-to-carts lose one increment) and POST can push a line above 99 while PATCH caps at `clampPurchaseQuantity` (99).
- **Fix:** read+upsert inside `db.$transaction`; `nextQty = clampPurchaseQuantity(existing + quantity, product.stock)` so POST and PATCH share one clamp contract.

### S4-5 (LOW, F-5) — Guest cart/wishlist creation is unmetered (DB-growth spam)
- **Evidence:** `/api/cart` POST and `/api/wishlist` POST are not in the WI-4 limiter set; a scripted client that ignores cookies mints a Cart/Wishlist row per request.
- **Fix:** per-IP limiter on both POSTs (`cart:ip` / `wishlist:ip`, 60/min), matching the checkout pattern.

### S4-6 (LOW, F-6) — Missing FK/hot-path indexes in the Prisma schema
- **Evidence:** no `@@index` on `Review.productId`, `OrderItem.orderId`, `OrderItem.productId`, `OrderEvent.orderId`, `Order.userId`, `Product.categoryId` — all hot query paths (product reviews, receipt/timeline joins, account orders, related products, admin order-item counts). Prisma does not auto-index FKs on SQLite.
- **Fix:** add the six `@@index` entries + `db:push` (additive, no data loss). Cosmetic at seeded volume; standard hygiene.

### S4-7 (LOW, F-8) — First real review collapses the seeded parity counts
- **Evidence:** `prisma/seed.ts:626-627` seeds `reviewCount` 41–412 (reference parity) but creates one Review row per product; `submitReviewAction` (`reviews.ts:66-78`) recomputes the aggregate from real rows, so the first genuine review drops a product from 412 → 2 displayed.
- **Fix (TDD):** new pure `mergeReviewAggregate(current, newRating)` in `src/lib/review-aggregate.ts` — reviewCount increments and rating becomes a rounded weighted average (seeded baseline grows organically instead of collapsing); unit tests pin the math (rounding, count growth, zero-baseline); `submitReviewAction` uses it.

### S4-8 (LOW, F-9) — Reseeding silently resets coupon bookkeeping
- **Evidence:** `prisma/seed.ts:681-687` — coupon upsert `update: coupon` zeroes `timesUsed` and overwrites `expiresAt`/`maxRedemptions` on every `db:setup`; with no admin coupon UI, DB state is the only state.
- **Fix:** `update: {}` (create-only seeding — codes/descriptions stay, lifecycle bookkeeping survives reseeds).

### S4-9 (LOW, F-10) — SEO: sitemap lists noindex/private routes; robots allows admin
- **Evidence:** `src/app/sitemap.ts:14-20` includes `/track-order`, `/login`, `/register`, `/cart`, `/wishlist` (wishlist is explicitly `noindex`; the rest are per-visitor) — a Search-Console warning; `src/app/robots.ts:10` allows everything including `/admin`.
- **Fix (TDD):** drop the five private routes from `STATIC_ROUTES` (exported for testing); robots gains `disallow: ["/admin", "/account", "/checkout", "/api"]`; new `tests/unit/seo-routes.test.ts` pins both.

### S4-10 (LOW, F-11) — Dead npm scripts `db:migrate` / `db:reset`
- **Evidence:** `package.json:14-15` reference Prisma migrations; there is no `prisma/migrations/` directory (the project uses `db push`). Both scripts fail if invoked.
- **Fix:** remove them.

### S4-11 (LOW, F-12) — Tests + seed are never type-checked
- **Evidence:** `tsconfig.json:39-45` excludes `tests` and `playwright.config.ts`; eslint ignores `prisma/seed.ts`; vitest/tsx execute without type checking — the "typecheck ✓" gate covers none of the ~20 test files or the seed.
- **Fix:** new `tsconfig.tests.json` (extends the base config; includes `tests/**`, `prisma/**`, `playwright.config.ts`, `vitest.config.ts`) + `npm run typecheck:tests`; the gate order in AGENTS.md gains the step. Any surfaced pre-existing type drift is fixed in this session.

### S4-12 (nits bundle, each small)
| # | Finding | Fix |
|---|---|---|
| N-1 | Wishlist toggle double-click race → occasional P2002 → 500 toast | Catch P2002 on the create → treat as "already in wishlist" (`inWishlist: true`) |
| N-2 | `upsertProductAction` unique-clash race returns the misleading "Product not found. Refresh…" | Distinguish P2002 → "A product with this slug or SKU already exists."; P2025 → the refresh message |
| N-3 | `src/lib/db.ts:7` comment cites `tests/db-path.test.ts` (file lives at `tests/unit/`) | Fix the comment |
| N-4 | Cart drawer: no Escape-to-close, no initial focus (a11y) | `keydown` listener closes on Escape; close button receives focus on open |
| N-5 | Hero carousel auto-rotates with no pause control (WCAG 2.2.2) | Pause on hover/focus + respect `prefers-reduced-motion` |
| N-6 | Header cart button lacks `aria-expanded` | Bind to `cartDrawerOpen` |
| N-7 | `cart-lines.tsx` ignores the server-clamped `quantity` the PATCH returns (the drawer mirrors it since S3-7) | Mirror `data.quantity` like the drawer |
| N-8 | `storefront/layout.tsx` runs `getCurrentUser()` and `getSettings()` sequentially | `Promise.all` (the cart-count chain still depends on `user`) |
| N-9 | `reactStrictMode: false` in `next.config.ts` is undocumented | Record it in the AGENTS.md trap log with the rationale |

### Deferred again (with justification)
| # | Item | Why |
|---|---|---|
| 1 | Analytics `groupBy`/`$queryRaw` | Correct at seeded volume (seed creates zero orders); raw-SQL design is a perf optimization. Revisit past ~50k order items. |
| 2 | 404-shell CSP nonce | Inert islands only; the `(auth)` `connection()` pattern is documented if an island is ever added. |
| 3 | `__Host-` cookie prefix | Requires a TLS-guaranteed topology; breaks the plain-HTTP standalone deploy. |
| 4 | Shared-store rate limiter | Mechanical (8 sites); correct for single-process standalone. |
| 5 | Admin coupon-management UI | Enforcement ships (S3-6); management is seed/DB-level and reseeds are now non-destructive (S4-8). |
| 6 | Account-orders & product-reviews pagination (F-7) | Correct at seeded volume; a silent `take` cap would HIDE data without a pagination UI — proper pagination is the only honest fix. |

## 4. Execution order & gates

1. **Foundation tests first** (red): `rate-limit.clientIp`, `coupons.couponRedemptionWhere`, `review-aggregate.mergeReviewAggregate`, `seo-routes` (sitemap/robots).
2. **Implement** the pure helpers + export `STATIC_ROUTES` (green).
3. **S4-1** per-IP limiter wiring in `actions/auth.ts`; **S4-5** cart/wishlist POST limiters.
4. **S4-2** coupon/apply JSON 400 + 500; **S4-3** conditional coupon increment in checkout; **S4-4** cart POST transaction + clamp.
5. **S4-6** schema indexes + `db:push`; **S4-7** reviews wiring; **S4-8** seed; **S4-9** sitemap/robots; **S4-10** scripts; **S4-11** tsconfig.tests.
6. **S4-12** nit bundle.
7. **Full gate chain:** `npm run lint && npm run typecheck && npm run typecheck:tests && npm run test && npm run build && npm run test:e2e`.
8. **Manual verification:** production server + agent-browser (home, mobile menu, drawer Escape, coupon 400).
9. **Screenshots** refreshed into `docs/screenshots/`; docs (`AGENTS.md`, `README.md`, `CLAUDE.md`, PAD, `homenest-store-s_SKILL.md`, `worklog.md`) updated for every changed contract.

## 5. Execution log (session 4)

- [x] S4-1 — `clientIp()` helper + unit tests; per-IP `login-ip:`/`register-ip:` budgets wired into both auth actions
- [x] S4-2 — coupon/apply body-parse split (400) + `{ status: 500 }` generic catch; e2e pins the malformed-JSON contract
- [x] S4-3 — `couponRedemptionWhere()` + unit tests; checkout increment is a guarded `updateMany` (count 0 → 409)
- [x] S4-4 — cart POST inside `db.$transaction` with the shared `clampPurchaseQuantity` cap
- [x] S4-5 — per-IP limiters on `/api/cart` POST + `/api/wishlist` POST (60/min)
- [x] S4-6 — six `@@index` entries added (`Review.productId`, `OrderItem.orderId`, `OrderItem.productId`, `OrderEvent.orderId`, `Order.userId`, `Product.categoryId`) + `db:push`
- [x] S4-7 — `mergeReviewAggregate()` + unit tests; `submitReviewAction` grows the seeded baseline instead of collapsing it
- [x] S4-8 — coupon seeding is create-only (`update: {}`) — reseeds preserve lifecycle bookkeeping
- [x] S4-9 — sitemap drops the 5 private/noindex routes; robots disallows `/admin`, `/account`, `/checkout`, `/api`; unit-pinned
- [x] S4-10 — dead `db:migrate`/`db:reset` scripts removed
- [x] S4-11 — `tsconfig.tests.json` + `typecheck:tests` script wired into the gate; surfaced test-type drift fixed
- [x] S4-12 — N-1…N-9 nit bundle
- [x] Full gate chain re-run green; manual agent-browser verification (mobile menu, drawer Escape, coupon 400)
- [x] Screenshots refreshed; docs (`AGENTS.md`, `README.md`, `CLAUDE.md`, PAD, `homenest-store-s_SKILL.md`, `worklog.md`) updated

**Post-remediation totals (session 4):** 138/138 unit tests, 32/32 e2e tests, lint/typecheck/typecheck:tests/build clean.

---

# Session 5 — Post-push audit & e-commerce SEO/UX completion (2026-10-12)

> **Status:** EXECUTED (see the Session-5 Execution Log at the end)
> **Scope:** Re-validation of the session-4 deliverables on the pulled tree (`1b3b312` = `7769a01` + `docs/session_4.md`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan + new surface scan: SEO/JSON-LD, error boundaries, platform headers, CSRF posture, admin CRUD, search, session security), and TDD remediation of the newly identified findings (3 MEDIUM + 6 LOW + nit bundle).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-4 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 131/131 unit ✓ · build ✓ · 32/32 e2e ✓.
Env shadowing converged (hardlink, same inode); `DATABASE_URL="file:../db/custom.db"` contract intact.
Visual parity re-verified against the LIVE reference (logged in via agent-browser): desktop home, hero carousel, trust badges, category grid, featured products (identical names/counts/prices), footer structure — reference unchanged. **Mobile menu re-verified** (open → `expanded=true`, push-down panel, green circular close; navigate → closes, `expanded=false`, lands on `/products`) — the Tailwind v4 conditional-mount pattern is intact; no display-utility toggling.

## 2. Session-5 audit findings (evidence-based)

**0 HIGH / 3 MEDIUM / 6 LOW / 4 NIT.** CSRF posture verdict: ADEQUATE (all mutations POST/PATCH/DELETE + durable cookies `SameSite=Lax`; GET routes read-only; Server Actions get Next's origin checks). Verified clean: XSS (zero `dangerouslySetInnerHTML`), SQL injection (Prisma-only, bound params), admin gating (11/11 actions `requireAdmin()` + layout gate), checkout e2e, session security (hashed tokens, timing-safe compare, 30-day expiry + purge), money integer-cents invariant, a11y coverage.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S5-1 | MED | **No JSON-LD structured data anywhere** — no `ld+json`/schema.org in `src/`; no Product/Organization/WebSite markup; no canonical URLs. The one SEO surface with real work left (sitemap/robots/metadata all shipped in S4-9). | `grep -r "ld+json" src/` → 0 hits; `product/[id]/page.tsx` generateMetadata has no `alternates` |
| S5-2 | MED | **Receipt copy promises an email that never ships** — success page says "A confirmation email is on its way to {email}" and the locked shell says "Double-check the link in your confirmation email", but there is no mailer (no nodemailer/resend/SMTP anywhere). The token-gated URL + Track Order are the only receipts. | `checkout/success/page.tsx:110,139`; grep mailer deps → none |
| S5-3 | MED | **No error boundaries** — no `error.tsx`/`global-error.tsx` anywhere; a server-side throw renders Next's unbranded default error screen (inconsistent with the production-superset claim). | glob `src/**/{error,global-error}.tsx` → none |
| S5-4 | LOW | **Zero favicon/manifest/icons** — no `icon.*`/`favicon.ico`/`apple-icon`/`manifest.*`; browser 404s `/favicon.ico` (CSP matcher even special-cases it). | `src/app` icon glob → none |
| S5-5 | LOW | **`X-Powered-By: Next.js` emitted** — `poweredByHeader` unset; Next defaults it to `true` (verified in installed `config-shared.js`). | `next.config.ts` |
| S5-6 | LOW | **`bun.lock` is git-tracked**, contradicting AGENTS.md ("Use npm (no bun lockfile is committed)"). | `git ls-files` → `bun.lock` |
| S5-7 | LOW | **Guest→user cart merge has no unit seam** (documented invariant, e2e-only) **and runs as a non-atomic upsert loop** — a failure mid-loop leaves a half-merged guest cart. | `cart.ts:49-96` |
| S5-8 | LOW | **Unmetered endpoints** — `GET /api/search` (per-keystroke typeahead, unbounded rate) and `/api/cart` PATCH/DELETE carry no limiter while POST does. | `api/search/route.ts`, `api/cart/route.ts:83,129` |
| S5-9 | LOW | **Product image input not scheme-validated** — `images: z.array(z.string().min(1))` accepts `javascript:`/any string; production CSP is `img-src 'self' data:`, so an admin-entered external URL silently fails to render. | `validation.ts:123`, `csp.ts:30` |
| S5-10 | NIT | (a) Dead `?next=/account` emission (login ignores it; targets are constants); (b) social settings validated/seeded/admin-editable but never rendered anywhere; (c) no `Permissions-Policy` header; HSTS lacks `includeSubDomains`. | `account/page.tsx:84`, `footer.tsx`, `next.config.ts` |

## 3. Remediation plan (TDD)

1. **S5-1** — `src/lib/seo.ts`: pure `buildProductJsonLd()`, `buildOrganizationJsonLd()`, `buildWebsiteJsonLd()` + unit tests (`tests/unit/seo-ld.test.ts`); product page renders Product JSON-LD + `alternates.canonical`; root layout renders Organization + WebSite (SearchAction → `/products?q={query_string}`).
2. **S5-2** — reword both success-page strings (no email promise; direct to Track Order + save-the-link); shopping-flow e2e asserts the false promise is gone.
3. **S5-3** — `src/app/(storefront)/error.tsx` + `src/app/global-error.tsx` branded client boundaries (reset + back-to-products).
4. **S5-4** — `src/app/icon.svg` + `src/app/manifest.ts`; e2e asserts 200s.
5. **S5-5** — `poweredByHeader: false`; e2e asserts header absent.
6. **S5-6** — `git rm bun.lock` + `.gitignore` entry.
7. **S5-7** — pure `computeMergedQuantities()` (own+guest → final per-product quantities) + unit tests; merge loop + guest-cart delete wrapped in one `db.$transaction` (idempotent `update: {quantity}` instead of `increment` — double-merge safe).
8. **S5-8** — per-IP limiters: `search:` 120/min on GET /api/search; `cart:` 60/min on PATCH + DELETE.
9. **S5-9** — `imageUrlSchema` refinement on `productInputSchema.images` (root-relative or http(s) only) + validation unit cases.
10. **S5-10** — drop the dead `?next=` emission; footer renders the admin-editable social links (superset nicety, lucide + inline SVGs, `noopener noreferrer`); `Permissions-Policy` header + HSTS `includeSubDomains`.
11. Full gate chain; agent-browser manual verification (JSON-LD in DOM, mobile menu, robots/sitemap/manifest live); screenshots refreshed; docs updated.

### Deferred again (with justification — unchanged from session 4)

| # | Item | Why |
|---|---|---|
| 1 | Analytics `groupBy`/`$queryRaw` | Correct at seeded volume; perf-only. Revisit past ~50k order items. |
| 2 | 404-shell CSP nonce | Inert islands only. |
| 3 | `__Host-` cookie prefix | Needs TLS-guaranteed topology; breaks plain-HTTP standalone deploy. |
| 4 | Shared-store rate limiter | Mechanical; correct for single-process standalone. |
| 5 | Admin coupon-management UI | Enforcement ships; management is seed/DB-level and reseeds are non-destructive. |
| 6 | Account-orders & product-reviews pagination | Correct at seeded volume; a silent `take` cap would HIDE data — proper pagination is the only honest fix. |
| 7 | Real email delivery (post-S5-2) | Copy is now honest; a mailer needs provider credentials + bounce handling — an epic, not a fix. The idempotent receipt URL + Track Order cover recovery. |

## 4. Execution log (session 5)

- [x] S5-1 — `src/lib/seo.ts` (3 pure builders) + `tests/unit/seo-ld.test.ts` (14 cases); Product JSON-LD + canonical on the product page; Organization + WebSite JSON-LD in the root layout; new `tests/e2e/seo-platform.spec.ts` pins the rendered ld+json, robots, sitemap, manifest, icon, and the missing X-Powered-By
- [x] S5-2 — success-page copy reworded (both the locked shell and the receipt); e2e asserts "on its way" is gone
- [x] S5-3 — branded `(storefront)/error.tsx` + `global-error.tsx`
- [x] S5-4 — `src/app/icon.svg` + `src/app/manifest.ts` (e2e 200-pinned)
- [x] S5-5 — `poweredByHeader: false` (e2e-pinned)
- [x] S5-6 — `bun.lock` untracked + ignored
- [x] S5-7 — `computeMergedQuantities()` + `tests/unit/cart-merge.test.ts` (8 cases); merge wrapped in a single transaction with idempotent final-quantity upserts
- [x] S5-8 — search GET limiter (120/min per-IP) + cart PATCH/DELETE limiters (60/min per-IP)
- [x] S5-9 — `imageUrlSchema` on product images + validation unit cases (javascript:/data: rejected; root-relative and http(s) accepted)
- [x] S5-10 — dead `?next=` dropped; footer social icons from settings; `Permissions-Policy` + HSTS `includeSubDomains`
- [x] Full gate chain re-run green; manual agent-browser verification
- [x] Screenshots refreshed (`docs/screenshots/`); docs (`AGENTS.md`, `CLAUDE.md`, `README.md`, PAD, `homenest-store-s_SKILL.md`, `worklog.md`) updated

**Post-remediation totals (session 5):** 153/153 unit tests, 40/40 e2e tests, lint/typecheck/typecheck:tests/build clean.

---

# Session 6 — Post-push audit & production-hardening completion (2026-10-13)

> **Status:** EXECUTED (see the Session-6 Execution Log at the end)
> **Scope:** Re-validation of the session-5 deliverables on the pulled tree (`5f3776a` = `bf8b521` + `docs/session_5.md`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan + focused surfaces: client-IP trust, OG/Twitter cards, canonicals, analytics bounds, idempotency replay binding, pagination honesty, docs alignment), and TDD remediation of the newly identified findings (1 HIGH + 6 MEDIUM + 8 LOW + 5 NIT + a stale `docs/DEPLOYMENT.md`).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-5 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 149/149 unit ✓ · build ✓ · 38/38 e2e ✓.
`DATABASE_URL="file:../db/custom.db"` contract intact (`db/custom.db` at the repo root; sandbox `DATABASE_URL` shadow neutralized by explicit per-command override).
Visual parity re-verified against the LIVE reference (logged in via agent-browser): desktop home, hero carousel ("Elevate Your Kitchen" / "New Arrivals" / "Sale Up to 40% Off"), trust badges, 8 category tiles, featured products (Damascus Steel Chef Knife Set $199.99/412, Artisan Copper Frying Pan $89.99/234) — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the fresh build** (open → `expanded=true`, push-down panel with all 7 links; navigate → closes, `expanded=false`, lands on `/products`) — the Tailwind v4 conditional-mount pattern is intact; zero `classList`/display-utility toggling in `src/`.

## 2. Session-6 audit findings (evidence-based)

**1 HIGH / 6 MEDIUM / 8 LOW / 5 NIT.** Session-5 fix verification: 11/11 wired (subagent table + spot-checks). Verified clean: Tailwind v4 display toggling (zero hits), money/cart math (integer cents end-to-end, in-tx derivation, atomic stock + coupon cap), cookies (httpOnly/SameSite/secure-in-prod), CSP (per-request nonce + strict-dynamic, unit-pinned), anti-enumeration shells, no committed secrets.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S6-1 | HIGH | **Per-IP rate limiters bypassable via a spoofed first XFF hop** — `clientIp()` takes the LEFTMOST `x-forwarded-for` entry; behind an appending proxy (the documented Cloudflare-tunnel topology) a client-supplied `X-Forwarded-For: 1.2.3.4` stays first, minting attacker-chosen buckets per request. Five call sites (coupon, checkout, newsletter, contact, track-order) also inline-duplicate the same broken split instead of using the helper. | `rate-limit.ts:67-72`; `api/checkout/route.ts:105`; `api/coupon/apply/route.ts:40`; `api/newsletter/route.ts:20`; `api/contact/route.ts:24`; `track-order/page.tsx:96` |
| S6-2 | MED | **Guest→user wishlist merge is non-transactional** — bare upsert loop + delete with no `$transaction` and no token rotation; the exact class S5-7 fixed in the cart. Plus cart/wishlist `create` can 500 on a token `@unique` P2002 race (no catch-and-re-read). | `wishlist.ts:20-39`; `cart.ts:103-107` |
| S6-3 | MED | **No OpenGraph image, no Twitter card anywhere** — zero `og:image`/`twitter:*` tags; product shares (the money pages) render text-only previews. | `src/app/layout.tsx:28-34` (grep: no `twitter` in src/) |
| S6-4 | MED | **Canonical URLs missing on `/`, `/products`, `/about`, `/contact`, `/legal/[slug]`** — only product pages set `alternates.canonical`; `/products?q=&category=&sort=&page=` is the highest duplicate-content risk. | grep `alternates` → product page only |
| S6-5 | MED | **Carousel slide `image` bypasses `imageUrlSchema`** — plain `z.string().min(1)` while products/ctaLink are schema-gated; a `data:`/foreign URL is storable and silently fails under `img-src 'self' data:`. | `validation.ts:178` |
| S6-6 | MED | **Merge planner clamps to 99 but not to stock** — a guest+user sum past stock persists, only to 409 at checkout; the POST/PATCH clamp contract has a third (merge) path that doesn't agree. | `cart-merge.ts:22-47`; `cart.ts:76-98` |
| S6-7 | MED | **Admin analytics loads every order item ever** (with product+category joins) into JS per view — unbounded, grows linearly with order history. | `admin/analytics/page.tsx:37-43` |
| S6-8 | LOW | **Idempotent-checkout replay is not ownership-bound** — presenting a valid `idempotencyKey` returns `{orderNumber, token}` (full receipt) to anyone; keys can leak via request logging. | `api/checkout/route.ts:116-118` |
| S6-9 | LOW | **Unbounded list queries**: product-page reviews (`findMany` no `take`) and account orders+items — page weight grows forever; per the session-4/5 deferral, a silent cap is dishonest — proper pagination is the fix. | `product/[id]/page.tsx:61`; `account/page.tsx:89-94` |
| S6-10 | LOW | **`/api/addresses` POST/DELETE unmetered** — the only mutation endpoints without a limiter. | `api/addresses/route.ts` |
| S6-11 | LOW | **Legal pages hardcode `hello@homenest.com`** — ignores `settings.contactEmail` every other surface uses. | `legal/[slug]/page.tsx:78` |
| S6-12 | LOW | **README contradicts itself** (`:55` "131 unit · 32 e2e" vs actual 149/38); stray Vite-scaffold `index.html` at the repo root references a non-existent `/src/main.tsx`; `COUPON_STORAGE_KEY` declared twice. | `README.md:55`; `index.html`; `cart/coupon-box.tsx:15` vs `checkout-client.tsx:26` |
| S6-13 | NIT | Header hamburger reads "Close menu" when open but `onClick` only ever opens; carousel dots misuse `role="tab"` with no tabpanel/arrow-keys. | `header.tsx:46-50`; `hero-carousel.tsx:109-122` |
| S6-14 | NIT | Product JSON-LD lacks `priceValidUntil` (Google recommendation); `label`/`value`/tag inputs unbounded in length. | `seo.ts:67`; `validation.ts:140-141` |
| S6-15 | DOCS | **`docs/DEPLOYMENT.md` is a stale template** — "ORBITAL" name, `bun` commands (repo is npm-only), nonexistent `scripts/smoke-test.sh`, wrong limiter numbers (10/15min vs actual 10/min email + 30/min IP), missing `typecheck:tests`, missing `NEXT_PUBLIC_DEMO_MODE`, `tests/db-path.test.ts` path drift, seed-admin credential risk undocumented. | 12 stale refs enumerated by the audit |

## 3. Remediation plan (TDD)

1. **S6-1** — `clientIp(headers)` hardening: `cf-connecting-ip` (authoritative edge header) → rightmost XFF entry (the value the nearest trusted proxy appended) → `"direct"`; unit tests pin CF precedence, rightmost-vs-leftmost spoofing, multi-hop chains, and the direct fallback; the five inline duplicates route through the helper.
2. **S6-2** — wishlist merge wrapped in one `$transaction` with token rotation (mirrors `cart.ts`); P2002 on cart/wishlist create caught → re-read (race-safe).
3. **S6-3** — branded static OG image (`public/images/og-default.png`, 1200×630, generated from the design tokens) + `openGraph.images` + `twitter.summary_large_image` site-wide; product pages emit the first product image as og:image; `seo-platform.spec.ts` pins the tags.
4. **S6-4** — `alternates.canonical` on `/`, `/products` (params stripped), `/about`, `/contact`, `/legal/[slug]`; e2e pins.
5. **S6-5** — `imageUrlSchema` on `carouselSlideInputSchema.image` (+ unit cases).
6. **S6-6** — `computeMergedQuantities(own, guest, stockById?)` optional stock clamp (min(99, stock)); cart.ts fetches stock inside the tx; unit tests extended.
7. **S6-7** — analytics aggregation bounded in SQL: `orderItem.groupBy({ by: [productId, unitPrice], _sum: { quantity } })` + pure `foldItemAggregates()` (unit-pinned) + one bounded product fetch for names/categories.
8. **S6-8** — `Order.cartToken` (nullable) records the placing cart's token; replay honored only for the same session user (user orders) or the same cart cookie (guest orders); `db:push`; the shopping-flow replay e2e must stay green (same browser context).
9. **S6-9** — honest server-rendered pagination: product reviews `?reviews=N` (5/page, prev/next), account orders `?page=N` (5/page, prev/next); no silent caps.
10. **S6-10** — addresses POST/DELETE per-IP limiter (60/min).
11. **S6-11** — legal footer email from `settings.contactEmail`.
12. **S6-12** — README counts fixed; stray `index.html` removed; `COUPON_STORAGE_KEY` single-sourced.
13. **S6-13** — header hamburger toggles (`setMobileNavOpen(!mobileNavOpen)`); carousel dots → honest buttons (`aria-label="Go to slide N"` + `aria-current`), review rating radiogroup keeps its pattern.
14. **S6-14** — `priceValidUntil` (+1y, builder-pure, unit-pinned); `.max()` on label/value/tag strings.
15. **S6-15** — `docs/DEPLOYMENT.md` rewritten for this codebase (npm scripts, real limiter numbers, env table incl. `NEXT_PUBLIC_DEMO_MODE`, DB contract, standalone runbook, admin-credential note); AGENTS/CLAUDE/README/PAD/SKILL/worklog updated; screenshots refreshed.

### Deferred (with justification — carried from session 5, unchanged)

| # | Item | Why |
|---|---|---|
| 1 | 404-shell CSP nonce | Inert islands only. |
| 2 | `__Host-` cookie prefix | Needs TLS-guaranteed topology; breaks plain-HTTP standalone deploy. |
| 3 | Shared-store rate limiter | Mechanical; correct for single-process standalone. |
| 4 | Admin coupon-management UI | Enforcement ships; management is seed/DB-level and reseeds are non-destructive. |
| 5 | Real email delivery | Copy is honest; a mailer needs provider credentials + bounce handling — an epic, not a fix. |
| 6 | Review-form radiogroup arrow-key roving focus | Buttons remain individually focusable/operable (WCAG-conformant pattern); roving tabindex is an enhancement. |

## 4. Execution log (session 6)

- [x] S6-1 — `clientIp(headers)` CF-Connecting-IP → rightmost-XFF → "direct"; 5 inline duplicates routed through the helper; 5 new clientIp unit cases
- [x] S6-2 — wishlist merge in one `$transaction` + token rotation; P2002 race-safe cart/wishlist create
- [x] S6-3 — `public/images/og-default.png` + site-wide OG/Twitter cards + product og:image; e2e-pinned
- [x] S6-4 — canonicals on /, /products, /about, /contact, /legal/[slug]; e2e-pinned
- [x] S6-5 — `imageUrlSchema` on carousel slide images (+ unit)
- [x] S6-6 — stock-aware merge planner (+ 6 unit cases); stock fetched inside the merge tx
- [x] S6-7 — analytics groupBy + pure `foldItemAggregates` (7 unit cases); unbounded findMany removed
- [x] S6-8 — `Order.cartToken` + ownership-bound replay (user: session match; guest: cart-cookie match)
- [x] S6-9 — server-rendered pagination for product reviews + account orders
- [x] S6-10 — addresses POST/DELETE limiter (60/min per-IP)
- [x] S6-11 — legal footer email from settings
- [x] S6-12 — README counts; `index.html` removed; `COUPON_STORAGE_KEY` single-sourced
- [x] S6-13 — header hamburger toggles; carousel dots honest-buttons a11y
- [x] S6-14 — `priceValidUntil` + validation `.max()` bounds
- [x] S6-15 — DEPLOYMENT.md rewritten; all docs aligned; screenshots refreshed
- [x] Full gate chain re-run green; manual agent-browser verification (mobile menu incl. toggle-close, OG tags in DOM, canonicals, pagination controls)

**Post-remediation totals (session 6):** 174/174 unit tests, 39/39 e2e tests, lint/typecheck/typecheck:tests/build clean.
