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

---

# Session 7 — Post-push audit & data-integrity completion (2026-10-13)

> **Status:** EXECUTED (see the Session-7 Execution Log at the end)
> **Scope:** Re-validation of the session-6 deliverables on a fresh clone (`1c0b480` = `b7010e0` + docs/session_6.md), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over every `src/lib` module, all 10 API routes, all 3 action files, all storefront/admin pages, configs, seed + schema), and TDD remediation of the newly identified findings (2 MEDIUM + 8 LOW + 3 NIT).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-6 gates green on the fresh clone)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 174/174 unit ✓ · build ✓ · 39/39 e2e ✓ (webServer requires the sandbox `DATABASE_URL` shadow neutralized — the documented env-shadowing trap; the standalone server otherwise health-checks 503 and the Playwright probe times out).
`.env` recreated from `.env.example` (`DATABASE_URL="file:../db/custom.db"` + strong `AUTH_SECRET`); `db/custom.db` seeded at the repo root.
Visual parity re-verified against the LIVE reference (logged in via agent-browser): desktop home, hero carousel, trust badges, 8 categories, featured products (identical names/counts/prices), products page — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the production build** (iPhone viewport: open → `expanded=true`, push-down panel with all links; navigate → closes, `expanded=false`, lands on `/products`) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-6 fix verification (subagent + spot-checks)

**13 WIRED / 1 PARTIAL / 0 MISSING.** S6-11 is PARTIAL: the legal *footer* email now reads `settings.contactEmail`, but the policy *body copy* still hardcodes `hello@homenest.com` in 7 paragraphs — folded into S7-5 below. All other fixes verified with file:line evidence (S6-1 clientIp + 5 call sites; S6-2 transactional wishlist merge; S6-3 OG/Twitter cards; S6-4 canonicals; S6-5 carousel imageUrlSchema; S6-6 stock-aware merge; S6-7 bounded analytics; S6-8 replay ownership; S6-9 pagination; S6-10 address limiters; S6-12 docs/counts; S6-13 hamburger toggle + dots a11y; S6-14 priceValidUntil + bounds; S6-15 DEPLOYMENT.md).

## 3. Session-7 audit findings (evidence-based)

**2 MEDIUM / 8 LOW / 3 NIT.** Verified clean again: integer-cents money end-to-end, atomic stock + coupon cap, cart POST/PATCH/DELETE ownership + clamping, track-order/receipt anti-enumeration shells, admin role gates, rate limiter + spoof-resistant clientIp, Zod boundaries, CSP nonce, robots/sitemap privacy, auth (scrypt, uniform errors, dummy burn), auth-secret gate, db-path contract.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S7-1 | MED | **Guest cart/wishlist is never claimed on the first-login path** — `safeCreateCart`/`safeCreateWishlist` P2002 fallback returns the guest row (token collision) without setting `userId`; the merge branch only runs when the user *already has* a cart. Result: a guest who shops then signs in keeps an unclaimed cart row (`User.cart` relation never materializes; a second-device login silently abandons the first device's items; orphan rows accumulate). Orders are unaffected (checkout reads by token fallback), which is why the suite stayed green. | `src/lib/cart.ts:134-154`; `src/lib/wishlist.ts:60-81`; `prisma/schema.prisma:105` ("claims userId on login" — dead invariant) |
| S7-2 | LOW | **Idempotency-key P2002 recovery bypasses the S6-8 ownership gate** — the retry loop returns `winner.number` ("same client by construction") without `replayAuthorized`; the pre-tx gate blocks a leaked key, the recovery path re-opens it. | `src/app/api/checkout/route.ts:217-222` vs gate at `:124-129` |
| S7-3 | MED | **`db:seed` resets live store data** — product upsert `update: data` overwrites `stock`, `rating`, `reviewCount`, `price`, `compareAtPrice`, badge/featured flags; settings upsert resets admin edits; carousel upsert overwrites admin slides. The documented update flow (`DEPLOYMENT.md` §6) runs `db:seed`. Coupon bookkeeping alone survives (S4-8). | `prisma/seed.ts:635-639` (products), `:676` (settings), `:656-665` (carousel) |
| S7-4 | LOW | **`siteBaseUrl()` single-sourcing incomplete** — `layout.tsx` (metadataBase), `sitemap.ts`, `robots.ts`, `(storefront)/layout.tsx` still hand-roll the `NEXT_PUBLIC_SITE_URL \|\| "http://localhost:3000"` fallback. | 4 sites (grep) vs `src/lib/seo.ts:68-71` |
| S7-5 | LOW | **Legal policy body copy hardcodes `hello@homenest.com`** in 7 paragraphs while the footer reads settings — the page contradicts itself once the admin changes the email (S6-11 residual). | `legal/[slug]/content.ts:73,74,90,117,152,187,209` |
| S7-6 | LOW | **`imageUrlSchema` accepts absolute http(s) URLs the production CSP then blocks** (`img-src 'self' data:`) — a validated admin entry silently renders broken. All seed/DB images are root-relative; the permissive branch is a trap with no legitimate user. | `validation.ts:112-120` vs `csp.ts:30` |
| S7-7 | LOW | **`price`/`compareAtPrice` have no upper bound** — a typo'd price ≥ 2³¹ cents fails only as an opaque Prisma Int32 error; every other numeric admin input is bounded (stock `.max(100000)`). | `validation.ts:133-134` |
| S7-8 | LOW | **Unbounded `Address` growth + nondeterministic default** — every `saveAddress` checkout mints another `isDefault: true` row (no cap, no dedup, previous defaults left set); `findFirst({ isDefault: true })` becomes an arbitrary pick. | `api/checkout/route.ts:350-366`; `api/addresses/route.ts:41-55`; `checkout/page.tsx:29` |
| S7-9 | LOW | **JSON-LD blocks `JSON.stringify`'d without `<`-escaping** inside `dangerouslySetInnerHTML` — a `</script>` inside an admin-authored name/description terminates the `ld+json` element early (hardening: requires a rogue admin account). | `product/[id]/page.tsx:131`; `(storefront)/layout.tsx:48,52` |
| S7-10 | LOW | **`crypto.randomUUID()` at checkout mount breaks on non-secure origins** — `randomUUID` is secure-context-only; a plain-HTTP LAN/staging deploy throws at mount and the branded error boundary swallows checkout. The server treats the key as optional, so the client can degrade. | `checkout/checkout-client.tsx:153` |
| S7-11 | NIT | **`/api/search` + `/api/cart-summary` lack the try/catch `{ error }` 500 shape** every sibling route uses. | `api/search/route.ts`; `api/cart-summary/route.ts` |
| S7-12 | NIT | **Expired sessions purged only at login** — a store with registrations but no logins never prunes `Session` rows (slow unbounded growth; single-process acceptable). | `actions/auth.ts:40-46,103` |
| S7-13 | NIT | **Wishlist heart has no active state and its label omits the product name** — screen readers hear identical labels across a grid. | `add-to-cart-button.tsx:108-132` |

## 4. Remediation plan (TDD)

1. **S7-1** — guarded claim in both `safeCreate*` fallbacks: `updateMany({ where: { id: winner.id, userId: null }, data: { userId } })` (idempotent; can never steal another user's row; a lost claim race self-heals via the existing merge branch on the next request). E2E: first-login claim is visible cross-device (context A adds as guest + logs in; fresh context B logs in as the same user and sees the items).
2. **S7-2** — extract `resolveReplay(winner, callerUserId, callerCartToken)` into `src/lib/order-access.ts` (pure: returns the winner's number, null when no winner, throws `ReplayDeniedError` when ownership fails); unit-test red-first (owner match, guest-cookie match, thief denial); wire into the checkout retry loop.
3. **S7-3** — new pure `src/lib/seed-policy.ts`: `productSeedUpdate(data)` picks ONLY content fields (name, shortDescription, description, categoryId, images, tags, specs) — price/compareAtPrice/stock/rating/reviewCount/sku/badge/featured/newArrival/isActive are admin- or traffic-owned and never reset; settings + carousel slides become create-only (`update: {}`, matching the S4-8 coupon precedent). Unit-test red-first on the picked-field contract; amend the DEPLOYMENT.md seed paragraph.
4. **S7-4** — import `siteBaseUrl()` into the 4 hand-rolled sites (mechanical; seo-platform e2e pins the behavior).
5. **S7-5** — tokenize legal content: `{{contactEmail}}` in `content.ts` + pure `interpolateContactEmail(sections, email)` in the same module; unit-test red-first (replacement, no-token passthrough, multiple occurrences); render through the page (settings email).
6. **S7-6** — `imageUrlSchema` root-relative ONLY (regex `/^\/(?!\/)[^\s]*$/`); flip the http(s)-accepted unit cases to rejected; update the schema comment + product-page og comment (metadataBase already resolves root-relative og:image to absolute).
7. **S7-7** — `.max(100_000_000)` ($1M) on `price` + `compareAtPrice`; unit cases red-first.
8. **S7-8** — `MAX_ADDRESSES_PER_USER = 20` shared guard used by `/api/addresses` POST and checkout `saveAddress` (friendly 409/400); new-default writes unset previous defaults inside the same transaction (deterministic `findFirst({ isDefault: true })`); e2e pins the cap on the API path.
9. **S7-9** — pure `jsonLdScript(data)` in `src/lib/seo.ts` (`<` → `\u003c`, U+2028/2029 escaped, output re-parses to the same object); unit-test red-first; wire the 3 `dangerouslySetInnerHTML` sites.
10. **S7-10** — `newRequestId(cryptoLike?)` in `src/lib/random-id.ts`: `randomUUID` when present, else `getRandomValues` hex fallback; unit-test red-first (both shapes); checkout-client mounts through it.
11. **S7-11** — try/catch `{ error }` 500 wrap on search GET + cart-summary GET (mechanical, sibling-consistent).
12. **S7-12** — `sessionSweepDue(now, last, interval)` pure helper (unit-tested red-first) + hourly time-gated `deleteMany({ expiresAt: { lt: now } })` opportunist in `getCurrentUser` (void, non-blocking, module-level timestamp).
13. **S7-13** — wishlist heart aria-labels carry the product name (`Add {name} to wishlist` / `Remove {name} from wishlist`); the filled-heart visual state is DEFERRED (feature work — needs wishlist ids threaded through every product grid).

### Deferred (with justification)

| # | Item | Why |
|---|---|---|
| 1 | Wishlist heart filled state | Feature work (server data threaded through product grids), not a defect; labels now distinguish per-product. |
| 2 | `saveAddress` dedup by (userId, line1, postalCode) | The cap + deterministic default close the operational risk; dedup risks surprising users who intentionally save variant addresses. |
| 3 | 404-shell CSP nonce | Inert islands only (carried). |
| 4 | `__Host-` cookie prefix | Needs TLS-guaranteed topology (carried). |
| 5 | Shared-store rate limiter | Mechanical; correct for single-process standalone (carried). |
| 6 | Admin coupon-management UI | Enforcement ships; seed/DB-level management (carried). |
| 7 | Real email delivery | Provider credentials + bounce handling — an epic, not a fix (carried). |
| 8 | Review-form radiogroup roving focus | WCAG-conformant as-is (carried). |

## 5. Execution log (session 7)

- [x] S7-1 — guarded `updateMany` claim in `safeCreateCart`/`safeCreateWishlist`; e2e `auth.spec.ts` "claims the guest cart on first login (visible on a second device)" (red → green)
- [x] S7-2 — `resolveReplay()` ownership gate in order-access.ts + 4 unit cases; wired into the checkout P2002 recovery path (red → green)
- [x] S7-3 — `seed-policy.ts` content-only product update + create-only settings/carousel (+5 unit cases); seed wired; DEPLOYMENT.md seed paragraph amended (red → green)
- [x] S7-4 — `siteBaseUrl()` imported into layout.tsx / sitemap.ts / robots.ts / (storefront)/layout.tsx
- [x] S7-5 — `{{contactEmail}}` tokens + `interpolateContactEmail()` (+3 unit cases); legal page renders settings email everywhere (red → green)
- [x] S7-6 — `imageUrlSchema` root-relative only; unit cases flipped (http(s)/protocol-relative rejected); comments updated (red → green)
- [x] S7-7 — `.max(100_000_000)` on price/compareAtPrice (+2 unit cases) (red → green)
- [x] S7-8 — `MAX_ADDRESSES_PER_USER` cap (addresses POST + checkout saveAddress) + single-default tx invariant; e2e cap case (red → green)
- [x] S7-9 — `jsonLdScript()` escaper (+4 unit cases); 3 ld+json sites wired (red → green)
- [x] S7-10 — `newRequestId()` (+3 unit cases); checkout-client wired (red → green)
- [x] S7-11 — search/cart-summary `{ error }` 500 shape
- [x] S7-12 — `sessionSweepDue()` (+2 unit cases) + hourly opportunistic purge in `getCurrentUser` (red → green)
- [x] S7-13 — wishlist heart labels carry the product name
- [x] Full gate chain re-run green; manual agent-browser verification (mobile menu, checkout, legal pages, JSON-LD escape output)
- [x] Screenshots refreshed; AGENTS/CLAUDE/README/PAD/SKILL/worklog updated

**Post-remediation totals (session 7):** 197/197 unit tests, 41/41 e2e tests, lint/typecheck/typecheck:tests/build clean.

---

# Session 8 — Post-push audit & address-book/review-integrity completion (2026-10-13)

> **Status:** EXECUTED (see the Session-8 Execution Log at the end)
> **Scope:** Re-validation of the session-7 deliverables on the pulled tree (`636faa5` = `131220a` + docs/session_8.md), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over every `src/lib` module, all API routes, all actions, every storefront/admin/auth page, components, configs, seed + schema, tests + docs), and TDD remediation of the newly identified findings (2 MEDIUM + 7 LOW + 4 NIT).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-7 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 197/197 unit ✓ · build ✓ · 41/41 e2e ✓ (sandbox `DATABASE_URL` shadow converged via symlink per the documented trap; health `db:up`).
Visual parity re-verified against the LIVE reference (agent-browser): home hero ("Elevate Your Kitchen"), trust badges, 8 category tiles, featured products (identical names/prices/review counts: Damascus Steel Chef Knife Set $199.99/412, Artisan Copper Frying Pan $89.99/234) — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the production build** (iPhone 390×844: open → `expanded=true`, push-down panel with all 7 links; navigate → closes, `expanded=false`, lands on `/products`) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-7 fix verification (read-only subagent + spot-checks)

**12 WIRED / 1 PARTIAL / 0 MISSING.** S7-8 is PARTIAL: the cap is fully wired (API 409 + checkout skip-save + e2e), but the single-default invariant was only maintained on the checkout `saveAddress` path — the account-book POST never sets `isDefault` at all (folded into S8-1 below). All other fixes verified with file:line evidence (S7-1 guarded claim; S7-2 resolveReplay in the recovery path; S7-3 seed policy; S7-4 siteBaseUrl; S7-5 contactEmail tokens; S7-6 root-relative images; S7-7 price bounds; S7-9 jsonLdScript; S7-10 newRequestId; S7-11 500 shapes; S7-12 session sweep; S7-13 wishlist labels).

## 3. Session-8 audit findings (evidence-based)

**2 MEDIUM / 7 LOW / 4 NIT.** Verified clean again: integer-cents money end-to-end, atomic stock + coupon cap, ownership-bound replay, anti-enumeration shells, admin role gates, rate limiter + spoof-resistant clientIp, Zod boundaries, CSP nonce, robots/sitemap privacy, auth (scrypt, uniform errors), auth-secret gate, db-path contract, no committed secrets, no `any`, no console.log in src/.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S8-1 | MED | **Account-saved addresses are never `isDefault`, so they never prefill checkout — and there is no way to set a default or edit an address.** The account POST creates rows with the schema default (`isDefault: false`); the only writers of `isDefault: true` are the seed and checkout `saveAddress`. Checkout prefill (`findFirst({ isDefault: true })`) therefore never fires for account-created addresses, the "Default" badge can never render for them, and the empty-state copy ("check out in seconds on every future order") is false. | `api/addresses/route.ts:53-67`; `checkout/page.tsx:29`; `account/page.tsx:203,218` |
| S8-2 | MED | **Review aggregate is read-modify-write outside a transaction** — two concurrent submissions both read `reviewCount = N` and both write `N + 1` (lost update; rating drift). The one remaining non-atomic counter in the codebase. | `actions/reviews.ts:69-82` |
| S8-3 | LOW | **`uniqueTarget()` only recognizes field-shaped P2002 targets** — a constraint-name string (`"Order_idempotencyKey_key"`) silently disables the S7-2 idempotency recovery branch; the retry loop then retries 5× with the same key and 500s. Latent (SQLite returns field arrays today) and untested. | `api/checkout/route.ts:218,399-409` |
| S8-4 | LOW | **Wishlist toggle delete race surfaces as a 500** — check-then-delete; a concurrent toggle makes `delete` throw P2025 into the generic catch. The create path already handles its race (P2002 → `inWishlist: true`); delete is the asymmetric leftover. | `api/wishlist/route.ts:43-48` |
| S8-5 | LOW | **Hero carousel renders permanently blank if the slide list shrinks below the active index** — `active` is never clamped when `slides` shrinks (admin deletes the last slide while a visitor has the page open); the whole hero returns `null` until a reload. ProductGallery already uses the derived-clamp pattern. | `hero-carousel.tsx:30,56-58` |
| S8-6 | LOW | **Wishlist is unbounded; the page query is unbounded; "Add All to Cart" trips the shared 60/min cart limiter** for wishlists > ~60 items (hard failures mid-loop, misleading "out of stock" toast). Asymmetric with the bounded address book. | `lib/wishlist.ts` (no cap); `wishlist/page.tsx:25-29` (no `take`); `add-all-button.tsx:29-46` (sequential POSTs) |
| S8-7 | LOW | **Cart drawer declares `role="dialog" aria-modal="true"` but has no focus trap** — Tab/Shift+Tab walk into the page behind the backdrop. Radix dialogs trap correctly; the custom drawer is the outlier. | `store-chrome.tsx:161-169` vs `:90-98` |
| S8-8 | LOW | **Per-email login limiter key enables targeted account lockout** — `login:<email>` is attacker-chosen; 30 sustained attempts/min keep a victim permanently over budget. The per-IP budget caps amplification, not the lockout itself. Documented design tradeoff. | `actions/auth.ts:85,89` |
| S8-9 | LOW | **Private-ish pages lack `noindex`** — cart, track-order, account, checkout, login, register expose `?number=…&email=…`-style query permutations to crawlers; only wishlist/checkout-success/admin/not-found carry the flag. Docs claim canonicals/noindex are site-wide. | grep `index: false` → 4 files only |
| S8-10 | NIT | **Schema has 18 models; docs say 17** (README ×2, PAD ×3 — NewsletterSubscriber/ContactMessage era). | `rg -c "^model " prisma/schema.prisma` → 18 |
| S8-11 | NIT | **Dead code/dead deps** — `ui/sheet.tsx` never imported; `searchOpen`/`setSearchSearchOpen` context fields never consumed; `@radix-ui/react-tabs` + `@radix-ui/react-radio-group` unused. | grep verification |
| S8-12 | NIT | **Contract gaps in tests** — the checkout P2002 recovery branch has zero coverage; review submission has no e2e; account-address prefill untested; wishlist flows untested. | see S8-3/S8-1/S8-6 |
| S8-13 | NIT | **`upsertCategoryAction` maps every failure — including a P2002 slug race — to "Category not found."** (the product path distinguishes P2002). | `actions/admin.ts:184-192` |

## 4. Remediation plan (TDD)

1. **S8-1** — `/api/addresses` POST wraps count + create in ONE `$transaction`; the FIRST address a user saves becomes `isDefault: true` (count-inside-tx is race-free on SQLite; a converging `updateMany` unset pass guarantees single-default even under odd interleavings). New PATCH handler (`{ id, isDefault: true }` via `addressDefaultSchema`) sets a default in one tx (unset others + set this). Account page gains a per-card "Set as default" control (`SetDefaultAddressButton`, mirroring the delete control). E2E `addresses-default.spec.ts`: fresh account → add address → Default badge visible → checkout prefills line1; second address → set default → badge moves.
2. **S8-2** — `growReviewAggregate(client, productId, rating)` in `review-aggregate.ts` (structural client: findUnique + update); `submitReviewAction` runs read→merge→write inside `db.$transaction`. Unit-tested red-first with an in-memory fake client (baseline read, merged write).
3. **S8-3** — new `src/lib/prisma-errors.ts`: `isUniqueViolation(error)` + `uniqueTargetField(error, field)` (matches array targets by last segment, exact string fields, AND constraint-name strings containing the field). Checkout route drops its private copies and routes both checks through it. Unit fixtures: `["idempotencyKey"]`, `["Order.idempotencyKey"]`, `"idempotencyKey"`, `"Order_idempotencyKey_key"` (match), `"Order_number_key"` (no match), non-P2002 (null/false).
4. **S8-4** — wishlist delete branch → `deleteMany({ where: { id, wishlistId } })` (never throws on 0 rows), returns `{ inWishlist: false }` unconditionally.
5. **S8-5** — hero carousel derives `activeIndex = Math.min(active, count - 1)` at render (the ProductGallery pattern); dots/track/aria-current all read the derived index.
6. **S8-6** — `MAX_WISHLIST_ITEMS = 100` + `assertWishlistCap`/`WishlistCapError` in `lib/wishlist.ts` (structural count client, mirrors addresses.ts); POST checks the cap before creating (friendly 409); wishlist page query gains `take: MAX_WISHLIST_ITEMS`. New `POST /api/cart/bulk` (`cartBulkSchema`, ≤100 lines, deduped by product with summed quantities) applies the SAME per-line clamp/upsert as the single POST inside ONE `$transaction`, limiter `cart-bulk:` 10/min per IP, returns `{ itemCount, added, skipped }`; `add-all-button` sends one bulk request (no more limiter-fighting sequential loop).
7. **S8-9** — `robots: { index: false, follow: true }` on cart, track-order, account, checkout, login, register; seo-platform spec pins the header on /cart + /login.
8. **S8-13** — `upsertCategoryAction` catches P2002 → "A category with this slug already exists." before the generic fallback.
9. **S8-11** — delete `src/components/ui/sheet.tsx`; drop the `searchOpen`/`setSearchSearchOpen` context fields; remove the two unused Radix deps (`@radix-ui/react-tabs`, `@radix-ui/react-radio-group`) from package.json.
10. **S8-10 + docs sweep** — model count 17 → 18 (README, PAD); AGENTS.md (address-book invariant now covers the account path + PATCH; review-aggregate invariant notes the transaction; wishlist cap + bulk endpoint; noindex list), CLAUDE.md (module list + tests), README (counts, features), DEPLOYMENT.md (bulk limiter row), SKILL.md v1.5.0, `docs/session_8.md` gains a one-line header note (it narrates the session-7 execution), worklog entry.
11. **S8-12** — the new unit tests + `addresses-default`/`reviews`/`wishlist` e2e specs close the gaps that S8-1/S8-2/S8-3/S8-6 exposed.

### Deferred (with justification)

| # | Item | Why |
|---|---|---|
| 1 | Cart-drawer focus trap (S8-7) | The drawer is the most traffic-critical interactive island; a hand-rolled trap risks destabilizing checkout e2e late in the arc. Radix dialogs already trap; defect is a11y-enhancement grade. Documented for a dedicated pass. |
| 2 | Login limiter lockout tradeoff (S8-8) | Deliberate keying design (per-email budget + per-IP amplification cap) documented in AGENTS.md; changing it needs an abuse-model decision (delay/captcha escalation is an epic). |
| 3 | Address dedup by content | Same rationale as the S7-8 saveAddress dedup deferral (users may intentionally save variant addresses); cap + deterministic default close the operational risk. |
| 4 | 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon UI, real mailer, wishlist filled-state, radiogroup roving focus | Carried unchanged from sessions 5–7 with the same justifications. |

## 5. Execution log (session 8)

- [x] S8-1 — first-address default (tx) + PATCH set-default + account "Set as default" control; `addresses-default.spec.ts` (red → green)
- [x] S8-2 — `growReviewAggregate` + transactional aggregate update (+4 unit cases, red → green)
- [x] S8-3 — `prisma-errors.ts` tolerant `uniqueTargetField` (+6 unit cases); checkout routes through it (red → green)
- [x] S8-4 — wishlist delete race → `deleteMany`
- [x] S8-5 — carousel derived index clamp
- [x] S8-6 — wishlist cap 100 (+2 unit cases) + page `take`; `POST /api/cart/bulk` (one-tx, shared clamp, 10/min limiter) + single-request Add All; `wishlist.spec.ts` (red → green)
- [x] S8-9 — noindex on cart/track-order/account/checkout/login/register; seo-platform pins /cart + /login
- [x] S8-13 — category P2002 duplicate message
- [x] S8-11 — sheet.tsx, searchOpen context fields, 2 unused Radix deps removed
- [x] S8-10 — model count 17 → 18 (README, PAD); docs sweep (AGENTS/CLAUDE/README/DEPLOYMENT/SKILL v1.5.0, session_8.md header note)
- [x] Full gate chain re-run green; manual agent-browser verification (mobile menu, checkout prefill, wishlist add-all)
- [x] Screenshots refreshed; worklog updated

**Post-remediation totals (session 8):** 212/212 unit tests, 48/48 e2e tests, lint/typecheck/typecheck:tests/build clean. *(Session-9 correction: this line originally said 210/210 — a stale pre-written total; the executed suite finished at 212.)*

---

# Session 9 — Post-push audit & badge/order-transition completion (2026-10-13)

> **Status:** EXECUTED (see the Session-9 Execution Log at the end)
> **Scope:** Re-validation of the session-8 deliverables on the pulled tree (`401ec63` = `49af9ca` + `docs/session_10.md`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over every `src/lib` module, all API routes, all actions, every storefront/admin/auth page, components, configs, seed + schema, tests + docs), and TDD remediation of the newly identified findings (2 MEDIUM + 2 LOW + 4 NIT + 1 doc drift).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-8 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 212/212 unit ✓ · build ✓ · 48/48 e2e ✓ (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink; health `db:up`).
Visual parity re-verified against the LIVE reference (agent-browser): hero slides, trust badges, 8 category tiles, featured products identical — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the production build** (iPhone 390×844: open → `expanded=true`, push-down panel with all 7 links; navigate → closes, `expanded=false`, lands on `/products`) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-8 fix verification (read-only subagent + spot-checks)

**13/13 accounted: 11 WIRED / 2 accepted deferrals (S8-7 drawer focus trap, S8-8 limiter tradeoff) / 0 MISSING.** Every fix verified with file:line evidence (S8-1 addresses POST tx + PATCH + account control; S8-2 growReviewAggregate wired into `db.$transaction`; S8-3 prisma-errors with no private copies; S8-4 deleteMany; S8-5 carousel clamp; S8-6 cap + take + bulk endpoint + single-request Add All; S8-9 noindex ×6; S8-10 counts; S8-11 dead code/deps gone; S8-12 new specs live; S8-13 category messages).

## 3. Session-9 audit findings (evidence-based)

**2 MEDIUM / 2 LOW / 4 NIT + 1 doc drift.** Verified clean again: ownership/IDOR surfaces (all queries scoped by cartId/wishlistId/userId/session), integer-cents money end-to-end, transactional stock + coupon cap + cart adds + merges, Zod coverage on every route/action, spoof-resistant clientIp + limiter grid, timing-safe compares, scrypt auth + uniform errors, CSP nonce, jsonLdScript escaping, canonicals/noindex/sitemap/robots, pagination clamps, a11y labels, no dead code, no committed secrets, no `any`.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S9-1 | MED | **Header cart badge is always 0 on fresh page loads — the server-computed count is dead code.** `StoreProvider` initializes `cartCount` to `0` (not null), so `liveCount ?? cartCount` in StoreChrome never falls back; the storefront layout's per-request `findCartId`+`getCartSummary` result is discarded. A shopper with 3 items sees no badge on any hard load until a mutation sets it. | `store-provider.tsx:13,22`; `store-chrome.tsx:26-30`; `(storefront)/layout.tsx:20-27,57` |
| S9-2 | MED | **`setOrderStatusAction` decides from a pre-transaction read and writes unconditionally inside the tx** — two admins who both read `pending` and submit `cancelled` both pass `canTransitionOrderStatus` and BOTH restock (stock inflated 2×); or B's stale write reopens a terminal `cancelled` order. The write needs a status guard inside the tx. | `actions/admin.ts:318-358` |
| S9-3 | LOW | **PATCH/DELETE `/api/addresses` can 500 (P2025) on a concurrent delete** — the exact race S8-4 fixed for the wishlist; the account card renders both buttons side by side. PATCH's ownership `findFirst` and `tx.address.update` straddle the race window; DELETE is check-then-delete. | `api/addresses/route.ts:126-141,169-177` |
| S9-4 | LOW | **Admin dashboard 14-day revenue query is unbounded** — `order.findMany` with no `take` feeding a JS fold; row count grows linearly with volume on a `force-dynamic` admin page. The analytics page was bounded in SQL in S6-7; the dashboard is the leftover. | `admin/page.tsx:58-61,73-79` |
| S9-5 | NIT | **`Address.userId` has no index** — the only model whose per-request filtered queries (`findFirst`, `findMany`, `updateMany`, `count`) are unindexed. (Secondary: `Session.expiresAt` unindexed for the hourly sweep.) | `prisma/schema.prisma:145-160` |
| S9-6 | NIT | **GET `/api/cart-summary` is the only unauthenticated endpoint without a rate limit** — closes the last gap in the S5-8 metering grid. | `api/cart-summary/route.ts:7-18` |
| S9-7 | NIT | **`GET /api/search` `q` has no length cap** — the sibling `/products` page caps at 100 chars; the API is the inconsistent twin feeding three LIKE clauses. | `api/search/route.ts:17-18` |
| S9-8 | NIT | **Session-8 logic has schema-only/happy-path coverage in places** — the bulk route's dedupe-sum/99-cap/clamp/sold-out-skip branches are unpinned at logic level (Zod + 2-item e2e only). | `api/cart/bulk/route.ts:44-77` |
| DOC | NIT | **REMEDIATION_PLAN.md says 210/210 unit tests post-session-8; reality is 212** (stale pre-written total; README/PAD/SKILL/worklog all say 212). | `REMEDIATION_PLAN.md` session-8 totals line |

## 4. Remediation plan (TDD)

1. **S9-1** — context type becomes `cartCount: number | null`, initialized `null` (server AND client first render), so StoreChrome's `liveCount ?? cartCount` fallback actually fires and the server-computed prop becomes live. `setCartCount` stays `(count: number) => void` — only store-chrome reads the value. RED first: new e2e `cart-badge.spec.ts` (add item → full page reload → badge shows 1; currently shows nothing).
2. **S9-2** — new `applyOrderStatusTransition(client, order, target, note)` in `src/lib/order-status.ts` (structural client, `growReviewAggregate` pattern): the guarded write `order.updateMany({ where: { id, status: from }, data: { status: to } })` runs FIRST; `count === 0` → `{ applied: false }` and NO event/NO restock; the event + restock are computed from the guarded winner. The action re-reads the order INSIDE the tx, applies `canTransitionOrderStatus`/no-op checks there, throws a typed conflict error on `applied: false`, and maps it to the accurate transition error message. Unit tests red-first with a fake client: guard match (event + restock), guard miss (no event/no restock), deleted-product skip, no-restock transitions.
3. **S9-3** — new `promoteAddressInTx(client, userId, id)` in `src/lib/addresses.ts`: promote via scoped `updateMany({ where: { id, userId } })` FIRST, `count === 0` → `AddressGoneError` (tx aborts, nothing written), then unset-others `updateMany({ where: { userId, id: { not: id } } })`. The PATCH route wraps the tx and maps the error → 404. DELETE replaces `delete` with scoped `deleteMany` + `count === 0` → 404 (the S8-4 pattern). Unit tests red-first: happy promote order, gone-row abort (no unset written), user scoping.
4. **S9-4** — new pure `buildRevenueChart(rows, now)` in `src/lib/analytics.ts`: folds SQL day-bucket rows into the 14-day chart data (UTC day keys `YYYY-MM-DD`, `en-US` labels, missing days = 0). The dashboard swaps the unbounded `findMany` for a bounded `$queryRaw` `SELECT date(placedAt/1000,'unixepoch') AS day, SUM(total) … GROUP BY day` (verified live: Prisma stores SQLite DateTime as epoch-millis INTEGER, so `date(placedAt)` alone returns NULL — the `/1000,'unixepoch'` form is required). Unit tests red-first: fold, zero-fill, label format, non-cancelled filtering stays in SQL.
5. **S9-5** — `@@index([userId])` on Address + `@@index([expiresAt])` on Session; `npm run db:push` (SQLite add-index is non-destructive; no data loss).
6. **S9-6** — `rateLimit("cart-summary:" + clientIp(headers), 120, 60_000)` mirroring the search GET (the route gains its `NextRequest` param).
7. **S9-7** — clamp `q` to 100 chars after trim in `/api/search` (mirrors the `/products` page cap).
8. **S9-8** — extract `dedupeBulkWanted(items)` + `planBulkUpsertQuantity(existing, wanted, stock)` into `src/lib/cart-bulk.ts`; the bulk route uses them; unit tests red-first pin dedupe-sum, the 99 dedupe cap, the stock clamp, and the sold-out → 0 skip branch.
9. **DOC** — REMEDIATION_PLAN.md 210 → 212; AGENTS.md (transition guard + address race + dashboard bound + limiter grid + index notes), CLAUDE.md (modules + tests), README (badge counts unchanged; features/troubleshooting notes), PAD (§8 tables + known-issues ledger), DEPLOYMENT.md (limiter row), SKILL.md v1.6.0 (project_state + Appendix B), worklog entry, `docs/session_10.md` header note (it narrates the session-8 execution).

### Deferred (with justification)

| # | Item | Why |
|---|---|---|
| 1 | Cart-drawer focus trap (S8-7) | Carried — dedicated a11y pass (unchanged rationale). |
| 2 | Login limiter lockout tradeoff (S8-8) | Carried — needs an abuse-model decision. |
| 3 | Checkout P2002 recovery loop integration test | The loop's pure helpers are unit-pinned (S7-2/S8-3); a fake-db integration seam for the loop itself remains an epic-grade testing investment with the lowest marginal risk in the suite. |
| 4 | 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon UI, real mailer, wishlist filled-state, radiogroup roving focus, address content dedup | Carried unchanged from sessions 5–8 with the same justifications. |

## 5. Execution log (session 9)

- [x] S9-1 — context `cartCount: number \| null` (init null) + e2e `cart-badge.spec.ts` (2 cases, red against the old build → green)
- [x] S9-2 — `applyOrderStatusTransition` guarded write (+4 unit cases, red → green); action re-reads inside the tx, conflict → accurate error
- [x] S9-3 — `promoteAddressInTx` + scoped `deleteMany` (+2 unit cases, red → green); routes map gone-rows → 404
- [x] S9-4 — `buildRevenueChart` (+4 unit cases, red → green); dashboard bounded via `$queryRaw` unixepoch buckets (verified live against db/custom.db: Prisma stores SQLite DateTimes as epoch-millis INTEGERs)
- [x] S9-5 — `@@index([userId])` on Address + `@@index([expiresAt])` on Session; `db:push`
- [x] S9-6 — cart-summary rate limit (120/min per IP, search-mirrored)
- [x] S9-7 — search `q` clamped to 100 chars
- [x] S9-8 — `cart-bulk.ts` pure plan (+7 unit cases, red → green); bulk route wired
- [x] admin.spec toast locator `.first()` — the strict-mode race (title div + aria-live wrapper) surfaced during the post-fix e2e run; the repo's established `.first()` convention applied
- [x] DOC — REMEDIATION_PLAN 210 → 212; docs sweep (AGENTS/CLAUDE/README/PAD/DEPLOYMENT/SKILL v1.6.0, session_10.md header note, worklog)
- [x] Full gate chain re-run green; manual agent-browser verification (badge shows 2 after a full reload — was 0 pre-fix; mobile menu open/navigate/close; admin dashboard KPIs + revenue chart render from the SQL buckets)
- [x] Screenshots refreshed; worklog updated

**Post-remediation totals (session 9):** 229/229 unit tests, 50/50 e2e tests, lint/typecheck/typecheck:tests/build clean.

---

# Session 10 — Post-push audit & address-default/cart-line completion (2026-10-13)

> **Status:** EXECUTED (see the Session-10 Execution Log at the end)
> **Scope:** Re-validation of the session-9 deliverables on the pulled tree (`fc57d39`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over every `src/lib` module, all API routes, all actions, every storefront/admin/auth page, components, configs, seed + schema, tests + docs), and TDD remediation of the newly identified findings (1 MEDIUM + 3 LOW + 1 NIT).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-9 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 229/229 unit ✓ · build ✓ · 50/50 e2e ✓ (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink; health `db:up`).
Visual parity re-verified against the LIVE reference (agent-browser): hero carousel first slide ("New Arrivals" — clicked the reference's slide-1 dot to confirm), trust badges, 8 category tiles, featured products (Damascus Steel Chef Knife Set $199.99/412, Artisan Copper Frying Pan $89.99/234) identical — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the production build** (iPhone 390×844: open → `expanded=true`, push-down panel with all links incl. the signed-in admin entry; click Products → lands on `/products`, panel closed `expanded=false`) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-9 fix verification (read-only subagent + spot-checks)

**8/8 WIRED · 0 PARTIAL · 0 MISSING.** Every fix verified with file:line evidence: S9-1 context `cartCount: number | null` + layout server prop (`store-provider.tsx:19,28`, `store-chrome.tsx:32`, `cart-badge.spec.ts`); S9-2 guarded transition (`order-status.ts:82-88`, `actions/admin.ts:341-367`); S9-3 `promoteAddressInTx` + scoped deleteMany (`addresses.ts:78-94`, `api/addresses/route.ts:138-147,190-193`); S9-4 bounded dashboard chart (`admin/page.tsx:65-75`, `analytics.ts:89-105`); S9-5 indexes (`schema.prisma:41,167`); S9-6 cart-summary meter; S9-7 search clamp; S9-8 bulk plan helpers (`cart-bulk.ts:19-36`).

## 3. Session-10 audit findings (evidence-based)

**1 MEDIUM / 3 LOW / 1 NIT. 0 HIGH** — the ninth pass found no security holes or user-reachable data-corruption paths. Verified clean again: integer-cents money end-to-end, checkout critical path (in-tx snapshots + coupon re-validation + atomic stock + ownership-bound idempotency), guarded order transitions, scrypt auth + uniform errors, IDOR scoping, rate-limiter grid, Zod boundaries, CSP nonce + security headers, SQL-aggregated dashboards, type strictness, SEO/noindex privacy, seed policy, a11y.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S10-1 | MED | **Deleting the default address strands the account with zero defaults — checkout prefill silently dies and nothing re-promotes.** DELETE removes the row without checking whether it was `isDefault`; POST only defaults when `count === 0`; so after the delete the user's remaining addresses are all `isDefault: false`, `checkout/page.tsx`'s `findFirst({ isDefault: true })` returns null, and a newly saved address still gets `isDefault: false`. This is the exact "stranded zero defaults" state the S9-3 promote-first rationale exists to prevent — reintroduced through the DELETE front door. Untested: `addresses-default.spec.ts` never deletes the default. | `api/addresses/route.ts:186-193` (deleteMany, no re-promotion), `:80` (`isDefault: count === 0`); `(storefront)/checkout/page.tsx:31` |
| S10-2 | LOW | **PATCH `/api/cart` can 500 (P2025) on a concurrently deleted line** — the exact race class S8-4 fixed for the wishlist and S9-3 for addresses. The line is read once (`:103`), then bare `cartItem.delete` (`:111,118`) and `cartItem.update` (`:120`) throw P2025 into the outer catch → 500 "Something went wrong." The sibling DELETE already uses scoped `deleteMany`; the per-island pending locks don't span tabs. | `api/cart/route.ts:103,111,118,120,129-131` |
| S10-3 | LOW | **Address-book cap is enforced OUTSIDE the POST transaction.** `assertAddressCap(db, …)` runs pre-tx; the in-tx `count` only decides `isDefault: count === 0` and never re-checks the cap, so two concurrent POSTs at 19/20 both pass the pre-check and mint 21+ rows (bounded overshoot per burst — the friendly-409 contract can be exceeded under concurrency). | `api/addresses/route.ts:47-51` (pre-tx cap), `:57-86` (tx without cap re-check) |
| S10-4 | LOW | **The guest→user wishlist merge bypasses `MAX_WISHLIST_ITEMS`.** The login merge upserts every guest item unconditionally (no cap check), so a user at 100 items whose guest wishlist holds more distinct products ends over cap, and the page's `take: MAX_WISHLIST_ITEMS` makes the overflow permanently invisible in the UI. The module's own comment ("the cap is enforced on the only write path that creates items") is now false — the merge is a second create path. | `lib/wishlist.ts:67-77` (unbounded upsert loop), `:16-19` (comment), `wishlist/page.tsx:31` (`take`) |
| S10-5 | NIT | **Bulk add-all's `skipped` count misses the sold-out branch.** `skipped = wanted.size - products.length` counts only gone/inactive products; a line skipped at plan time (`clamped === 0` on an active, in-stock-check product) is `continue`d silently — a wishlist with 2 addable + 1 sold-out items returns `{added: 2, skipped: 0}` and the UI's "of 3" arithmetic explains nothing. The route docstring promises skipped lines are "reported". | `api/cart/bulk/route.ts:52` (skipped math), `:66` (silent continue), `:19-21` (docstring) |

### Deferred (with justification — carried unchanged)

| # | Item | Why |
|---|---|---|
| 1 | Cart-drawer focus trap (S8-7) | Carried — dedicated a11y pass (unchanged rationale). |
| 2 | Login limiter lockout tradeoff (S8-8) | Carried — needs an abuse-model decision. |
| 3 | Checkout P2002 recovery loop integration test | Carried — pure helpers unit-pinned (S7-2/S8-3); epic-grade testing investment with the lowest marginal risk. |
| 4 | 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon UI, real mailer, wishlist filled-state, radiogroup roving focus, address content dedup | Carried unchanged from sessions 5–9. |

## 4. Remediation plan (TDD)

1. **S10-1** — new `reassignDefaultAfterDeleteInTx(client, userId, deletedWasDefault)` in `src/lib/addresses.ts` (structural client extending `AddressPromotingClient` with a scoped `findFirst`): when the deleted row WAS the default, pick the newest remaining address (`findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })`) and promote it via the existing race-safe `promoteAddressInTx`; no remaining rows → no-op. The DELETE route selects `isDefault` in its pre-read, wraps delete + reassign in ONE `$transaction`, and keeps `count === 0` → 404 (S9-3 pattern). RED first: fake-client cases — default deleted → newest promoted (findFirst + promote order), default deleted with no remainder → no promotion call, non-default deleted → no findFirst call.
2. **S10-2** — PATCH `/api/cart` swaps the three bare single-row writes for scoped conditional writes with `count === 0` → 404 "Cart line not found." (the S9-3/S8-4 pattern applied directly at the call sites — no new pure logic beyond the existing `clampPurchaseQuantity`): explicit-0 delete → `deleteMany({ where: { id: line.id, cartId } })`, clamp-to-0 delete → same, quantity update → `updateMany({ where: { id: line.id, cartId }, data: { quantity: qty } })`. Regression coverage via the existing cart e2e specs (shopping-flow, cart-badge) + manual double-tab check.
3. **S10-3** — move the cap INSIDE the POST transaction: `assertAddressCap(tx, user.id)` as the first statement of the `$transaction` body (the structural client accepts the tx), `AddressCapError` propagates out of the tx and the route's catch maps it to the friendly 409 (replacing the pre-tx check). RED pin: `assertAddressCap` unit cases (under-cap passes, at-cap throws `AddressCapError` with the actionable message) — the route wiring is a call-site move verified by the existing `addresses-cap` e2e.
4. **S10-4** — new pure `planWishlistMerge(existingProductIds: ReadonlySet<number>, guestItems: ReadonlyArray<{ productId: number }>, cap)` in `src/lib/wishlist.ts`: keep guest order, skip products already in the user's wishlist (`update: {}` semantics), dedupe repeated guest productIds, and TRUNCATE at the remaining capacity (`cap − existingCount`) so the merge can never push the user over `MAX_WISHLIST_ITEMS`. The merge tx upserts only `plan.toAdd`. RED first: empty guest, all-new (order kept), already-owned skipped, guest-internal duplicates deduped, cap truncation (full wishlist → 0 additions; near-cap → partial additions), skipped accounting. Fix the stale `wishlist.ts` header comment (S10-4 doc drift) to name BOTH create paths.
5. **S10-5** — the bulk tx returns `{ added, soldOut }`; the route reports `skipped: goneInactive + soldOut` so the response always accounts for every requested line; docstring updated to say sold-out lines are reported too.
6. **DOC** — AGENTS.md (address-default reassignment invariant, cap-inside-tx note, wishlist merge cap, cart PATCH scoped writes), CLAUDE.md (modules + unit/e2e coverage), README (test-count badges), PAD (§8 tables + known-issues ledger), SKILL.md v1.7.0 (project_state + Appendix B session-10), `docs/session_13.md` (run-11 narrative), worklog entry.

## 5. Execution log (session 10)

- [x] RED — `tests/unit/session10-hardening.test.ts` written first (12 cases: `reassignDefaultAfterDeleteInTx` ×3, `assertAddressCap` ×2, `planWishlistMerge` ×6, bulk skipped accounting ×1 via `planBulkUpsertQuantity` composition) — collection failed on the missing module with the existing 229 green
- [x] GREEN — `addresses.ts` += `reassignDefaultAfterDeleteInTx`; DELETE route tx (delete + reassign, 404 on lost race); POST cap moved inside the tx (AddressCapError → 409 from the catch)
- [x] GREEN — `wishlist.ts` += `planWishlistMerge` (cap-truncating merge plan); merge tx upserts only the plan; stale header comment fixed
- [x] GREEN — cart PATCH scoped writes ×3 (deleteMany/updateMany + `count === 0` → 404)
- [x] GREEN — bulk route reports sold-out skips (`skipped = goneInactive + soldOut`; docstring aligned)
- [x] Full gate chain green: lint ✓ · typecheck ✓ · typecheck:tests ✓ · **241/241 unit** ✓ · build ✓ · **50/50 e2e** ✓
- [x] Manual verification (agent-browser, fresh standalone build): default-address delete → next-newest auto-promoted (account card badge + checkout prefill survive); mobile menu open/navigate/close re-verified; add-all toast arithmetic sane
- [x] Screenshots refreshed (24 shots incl. the new account address state); docs sweep; worklog updated

**Post-remediation totals (session 10):** 241/241 unit tests, 50/50 e2e tests, lint/typecheck/typecheck:tests/build clean.

---

# Session 11 — Post-push audit & limiter/heart-state completion (2026-10-13)

> **Status:** EXECUTED (see the Session-11 Execution Log at the end)
> **Scope:** Re-validation of the session-10 deliverables on the pulled tree (`98dc342` = `520c1fc` + `docs/session_14.md`), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over every `src/lib` module, all 11 API routes, all actions, every storefront/admin/auth page, components, configs, seed + schema, tests + docs), and TDD remediation of the newly identified findings (1 MEDIUM + 2 LOW + 3 NIT).
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-10 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 240/240 unit ✓ · build ✓ · e2e **49/50 with 1 flake** on the first run, **50/50** on the immediate re-run (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink; health `db:up`). The flake was root-caused (see S11-3) instead of dismissed: `wishlist.spec.ts:44` intermittently fails with a Playwright **strict-mode violation** — `getByText("Added to wishlist")` resolving to BOTH the toast title div AND Radix's `aria-live` announcement wrapper (`Notification Added to wishlist`) — the exact race the repo documented and fixed in `admin.spec.ts` (session-9) with the `.first()` convention. Reproduced 2× in full-suite/spec runs and 1× in 7 single-test runs before fixing.

Visual parity re-verified against the LIVE reference (agent-browser): same nav anatomy, same hero slides (1: New Arrivals, 2: Elevate Your Kitchen, 3: Sale Up to 40% Off), same trust badges, same 8 category tiles, same featured products (Damascus Steel Chef Knife Set $199.99/428 reviews, Artisan Copper Frying Pan, Artisan Ceramic Dinner Set…) — reference unchanged; the clone remains the superset. **Mobile menu re-verified on the production build** (iPhone 390×844: open → `expanded=true`, `navigation "Mobile"` panel with all 7 links + circular close button; click Products → lands on `/products`, panel closed `expanded=false`) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-10 fix verification (read-only subagent + spot-checks)

**5/5 WIRED · 0 PARTIAL · 0 MISSING.** Every fix verified with file:line evidence: (a) `reassignDefaultAfterDeleteInTx` (`addresses.ts:119-132`) called by DELETE `/api/addresses` inside its tx with scoped `deleteMany` + 404 on lost race; (b) `planWishlistMerge` consumed by the login merge tx (upserts only `plan.toAdd`); (c) `assertAddressCap` as the first statement of the POST tx, `AddressCapError` → friendly 409 (residual storage-model gap → S11-6); (d) cart PATCH scoped conditional writes ×3 with `count === 0` → 404; (e) bulk route reports `gone/inactive + soldOut` skips. Also re-verified drift-free: the `db-path.ts` relative-URL contract against `prisma/schema.prisma`.

## 3. Session-11 audit findings (evidence-based)

**1 MEDIUM / 2 LOW / 3 NIT. 0 HIGH** — the tenth pass found no security holes, money-integrity, IDOR, or data-corruption paths. Verified clean again: checkout critical path (in-tx snapshots + coupon re-validation + atomic stock + ownership-bound idempotency), ownership/IDOR scoping on every surface, the full rate-limiter grid + spoof-resistant clientIp, Zod boundaries incl. malformed-JSON → 400, guarded order transitions, race-safe address promote/reassign, SQL-aggregated dashboards, type strictness, SEO/noindex privacy, seed policy, React hygiene (no set-state-in-effect, useSyncExternalStore, hydration sentinel), a11y labels, no committed secrets.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S11-1 | MED | **Review rate limiter is bypassable by rotating the free-text `author` field.** The limiter key is `review:${ip}:${pid}:${author}` — every new author string mints a fresh 5/min budget and there is NO per-IP ceiling, so one client can inject unbounded Review rows (which permanently skew the monotonic `rating`/`reviewCount` aggregates, since recompute is deliberately forbidden). The code comment claims the opposite ("the client IP … pins the budget to a network origin"). Every other guest write endpoint is flat per-IP metered. | `src/lib/actions/reviews.ts:33-41` |
| S11-2 | LOW | **AGENTS.md's heart invariant is false: "every product grid heart reads the wishlist state" — no heart does.** `AddToWishlistButton` never reads/receives wishlist state: the Heart is unconditionally unfilled and the aria-label is always "Add … to wishlist" even after adding (a screen-reader user toggling twice hears "Add" both times). `getWishlistIds()` exists and is consumed only by the wishlist page. Fix (superset direction): implement the filled state — pages pass `initialInWishlist` down through `ProductCard`; the button flips label + fill from the API's `inWishlist` response. | `AGENTS.md:73`; `add-to-cart-button.tsx:124-138`; `wishlist.ts:183-204` |
| S11-3 | LOW | **`wishlist.spec.ts` toast assertions skip the documented `.first()` convention** — 3 unguarded `getByText` toast sites (strict-mode race against Radix's aria-live wrapper; observed live 3× this session) plus a misleading `.nth(1)` under duplicates. | `tests/e2e/wishlist.spec.ts:24,26,44,52` vs `admin.spec.ts:109-111` |
| S11-4 | NIT | **`setTrackingAction` can leak a raw P2025** — pre-tx read + unconditional `order.update` with no try/catch; a concurrent order delete surfaces an opaque framework digest instead of the sibling actions' friendly message. | `src/lib/actions/admin.ts:388-403` |
| S11-5 | NIT | **The login page's "Forgot password?" mailto hardcodes `hello@homenest.com`** — the only user-facing contact surface that ignores the admin-editable `settings.contactEmail` (the S7-5 sweep's leftover shadow). | `src/app/(auth)/login/login-form.tsx:73-78` |
| S11-6 | NIT | **The in-tx address cap is still check-then-create; the comment overclaims.** On SQLite's deferred-transaction model the write lock lands only at the first write, so two concurrent POSTs at cap−1 can both pass both in-tx reads and serialize their creates → 21 rows. Fix: create-then-verify — the post-create count runs under the write lock (airtight for SQLite's single-writer model), over-cap → `AddressCapError` → rollback → the friendly 409. The pre-create `assertAddressCap` stays as fast-fail UX. | `src/app/api/addresses/route.ts:44-77` |

### Deferred (with justification — carried unchanged)

| # | Item | Why |
|---|---|---|
| 1 | Cart-drawer focus trap (S8-7) | Carried — dedicated a11y pass. |
| 2 | Login limiter lockout tradeoff (S8-8) | Carried — needs an abuse-model decision. |
| 3 | Checkout P2002 recovery-loop integration test | Carried — pure helpers unit-pinned; epic-grade testing investment with the lowest marginal risk. |
| 4 | 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon UI, real mailer, radiogroup roving focus, address content dedup | Carried unchanged from sessions 5–10. |
| 5 | ~~Wishlist filled-heart state~~ | **CLOSED this session (S11-2)** — implemented, not deferred. |

## 4. Remediation plan (TDD)

1. **S11-1** — new pure `reviewRateLimitKeys(ip, productId, author)` in `src/lib/rate-limit.ts` returning `{ ipKey, authorKey }`; the action evaluates the per-IP budget FIRST (`review-ip:`, 20/min) then the per-author key (5/min). Unit tests red-first: the IP key carries no author component, the author key keeps product scoping + lowercase. Comment rewritten to describe the two-tier budget honestly.
2. **S11-2** — `AddToWishlistButton` gains `initialInWishlist?: boolean`; local `inWishlist` state initialized from the prop, flipped from the API's `inWishlist` response; label becomes `Remove ${productName} from wishlist` when filled; Heart renders `fill-primary text-primary` when filled. `ProductCard` passes it through. Pages that render grids (`/`, `/products`, `/product/[id]` related, `/wishlist`) call `getWishlistIds()` once and pass `inWishlist={ids.has(p.id)}`. E2E red-first: new wishlist case asserting the label flips to "Remove … from wishlist" after add (client flip), survives a reload (server truth), and flips back after removal.
3. **S11-3** — `wishlist.spec.ts` toast assertions get `.first()` (lines 24/26/44/52) with the admin.spec convention comment; the second-toast `.nth(1)` becomes `.first()` (the subsequent "2 saved items" page assertion carries the correctness).
4. **S11-4** — new `applyCarrierTracking(client, orderId, carrier, trackingNumber)` in `src/lib/order-tracking.ts` (structural client): interactive tx with scoped `updateMany({ where: { id } })` — `count === 0` → `OrderGoneError` → no event; the event create runs from the guarded winner. The action wraps it and maps the typed error to the friendly message. Unit tests red-first with a fake client (guard match → event; guard miss → typed error, no event).
5. **S11-5** — `(auth)/login/page.tsx` reads `getSettings().contactEmail` and passes it to `LoginForm`; the mailto href uses the prop. Wiring-verified by the auth e2e staying green.
6. **S11-6** — the POST tx gains the post-create authoritative verify (`count > MAX_ADDRESSES_PER_USER` → `AddressCapError`); comment rewritten (pre-create check = fast-fail UX; post-create count = authoritative gate under SQLite's single-writer model). Re-pinned by `addresses-cap.spec.ts`.
7. **DOC** — AGENTS.md (review limiter invariant rewritten + heart invariant now TRUE + tracking scoped write + cap gate note), CLAUDE.md (modules + coverage), README (test-count badges), PAD (§8 tables + known-issues ledger), SKILL.md v1.8.0 (project_state + Appendix B), `docs/session_15.md` (run-12 narrative), worklog entry.

## 5. Execution log (session 11)

- [x] RED — `tests/unit/session11-hardening.test.ts` written first (`reviewRateLimitKeys` ×3, `applyCarrierTracking` ×3) — failed on the missing exports with the existing 240 green
- [x] RED (e2e) — new wishlist filled-heart case failed against the current build (labels never flip)
- [x] GREEN — `rate-limit.ts` += `reviewRateLimitKeys`; `reviews.ts` two-tier budget (per-IP 20/min → per-author 5/min) + honest comment
- [x] GREEN — filled-heart state end-to-end (button + ProductCard + 4 pages via `getWishlistIds()`); wishlist.spec updated (S11-2 cases + S11-3 `.first()` convention)
- [x] GREEN — `order-tracking.ts` += `applyCarrierTracking` (scoped updateMany + OrderGoneError + event from the guarded winner); `setTrackingAction` wired with try/catch
- [x] GREEN — login page passes `settings.contactEmail` into the mailto; addresses POST create-then-verify cap gate
- [x] Full gate chain re-run green; manual agent-browser verification (heart fill/label flip on the grid + product page, mobile menu open/navigate/close, review limiter smoke)
- [x] Screenshots refreshed; docs sweep; worklog updated

**Post-remediation totals (session 11):** see the session-11 run narrative (`docs/session_15.md`) for the final counts.

# Session 12 — Post-push audit & parity-order/demo-hygiene completion (2026-10-13)

> **Status:** EXECUTED (see the Session-12 Execution Log at the end)
> **Scope:** Re-validation of the session-11 deliverables on the pulled tree (`2d3af58` = `5058902` + the run-12 session logs), a **live-reference parity re-verification** (agent-browser, logged in with the operator credentials), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over `src/`, `prisma/`, `tests/`, root configs — `skills/` excluded), and TDD remediation of the newly identified findings (2 LOW + 2 NIT) plus **one LOW visual-parity finding** discovered during the live comparison, plus five test-coverage pins.
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-11 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **246/246 unit** ✓ · build ✓ · **51/51 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink `/home/z/my-project/db → <repo>/db`; `.env` recreated from `.env.example` with a fresh `AUTH_SECRET`; `db/custom.db` seeded at the repo root; health `db:up`).

Visual parity re-verified against the LIVE reference (agent-browser, logged in): same nav anatomy, same hero slides, same trust badges, same 8 category tiles, same featured set (Damascus/Copper Pan/Ceramic Dinner Set/Dutch Oven/Mixing Bowl/Stand Mixer — 6 products exactly), same login-page copy ("Welcome to HomeNest Kitchen" / "Sign in to continue"; the reference's "Continue with Google" remains a deliberate divergence — a dead OAuth button would be fake UI, the clone ships credential auth + demo quick-fill instead), account page covered by the clone's superset. **Mobile menu re-verified** (iPhone 390×844: open → `expanded=true` → `navigation "Mobile"` with all links → navigate to `/products` → auto-close) — the Tailwind v4 conditional-mount pattern is intact.

**NEW parity finding from the live comparison (S12-5):** the reference's `/products` default "Newest" view and its home "New Arrivals" section both render its catalog in authored order — Damascus Steel Chef Knife Set first. The clone renders the REVERSE of its seed order (Dried Eucalyptus Kitchen Bundle first) on both surfaces, because the seed relies on `@default(now())` timestamps (last-inserted = newest) while the reference's observable behavior treats its authored order as newest-first. Home "Featured Products" matches (the query is `createdAt: asc`, Damascus-first), so the three surfaces disagree with each other too.

## 2. Session-11 fix verification (read-only subagent + spot-checks)

**6/6 WIRED · 0 PARTIAL · 0 MISSING.** (a) `reviewRateLimitKeys` (`rate-limit.ts:89-98`) consumed by `submitReviewAction` (`actions/reviews.ts:42-45`, per-IP 20/min first, per-author 5/min second); (b) filled hearts through `ProductCard` on home/products/product-related/wishlist (`getWishlistIds()` callers verified, `initialInWishlist` threaded, `fill-primary` + `aria-pressed` + honest label flip); (c) `applyCarrierTracking` guarded write wrapped by `setTrackingAction` (`order-tracking.ts:59-77`, `admin.ts:396-403`); (d) login mailto from `settings.contactEmail` (`(auth)/login/page.tsx:20-21` → `login-form.tsx:74`); (e) address POST create-then-verify under the write lock (`api/addresses/route.ts:79-81`); (f) `planWishlistMerge` consumed by the login merge tx (`wishlist.ts:112-129`, reached from `auth.ts:71,105,138`).

## 3. Session-12 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 3 LOW / 1 NIT (1 further reported NIT rejected on verification)** — the eleventh pass re-confirmed clean: money integrity (integer cents, in-tx re-derivation, atomic coupon redemption), checkout critical path, race/TOCTOU discipline on every guarded write, authn/authz (scrypt, HMAC sessions, admin double-gating), injection (no raw SQL with user input; the one `$queryRaw` is a parameterized template), rate-limiter grid, React hygiene, SEO/noindex/JSON-LD, a11y, typed error mapping, seed policy, configs.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S12-1 | LOW | **Checkout clears the cart by `cartId`, not by the ordered line ids — a narrow TOCTOU can silently delete an item the shopper just added but that is not being ordered.** A concurrent cart POST committing between the pre-tx summary read and the in-tx `deleteMany({ where: { cartId } })` lands a line absent from `args.lines`; the final sweep removes it — never ordered, never restocked, invisible to the receipt. Window is milliseconds on SQLite's single-writer model; the fix is one scoped filter. | `src/app/api/checkout/route.ts:134,366` |
| S12-2 | LOW | **The demo-credentials quick-fill (including the ADMIN account) ships ON by default in production builds** — `DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false"` is default-on everywhere, and the seed pins `Admin123!`; a default deploy advertises admin credentials on its login page. Fix direction: production default OFF (opt-in via `NEXT_PUBLIC_DEMO_MODE="true"`), dev behavior unchanged; document the seeded-account hygiene step in DEPLOYMENT.md. (The reference login shows no credentials — hiding the box in production also tightens visual parity.) | `src/app/(auth)/login/login-form.tsx:30`; `prisma/seed.ts:553-563`; `docs/DEPLOYMENT.md:52,103-105` |
| ~~S12-3~~ | — | **REJECTED ON VERIFICATION (false positive).** The reported "mangled class `accent-sl(24_70%_50%)]` ×3" does not exist in the file — the source carries the valid arbitrary utility `accent-[hsl(24_70%_50%)]`, and the built CSS contains the compiled rule (`accent-color:#d96e26` = the terracotta primary). The audit subagent's report (and an initial grep in this console) mangled `-[h` in transit. The admin checkboxes already render the correct accent — no change made. | `product-dialog.tsx:407,416,425` + built CSS `accent-color:#d96e26` |
| S12-4 | NIT | **The order-success page runs the (items+events-inclusive) order lookup BEFORE the token check**, so a valid order number costs a heavier query than an invalid guess — a faint timing/query-weight differential against the "existence is not observable" contract. The token is a deterministic HMAC of the claimed number (`orderAccessToken`), so the verification can run BEFORE any DB read; behavior is preserved (same shells) and the existing shopping-flow e2e pins both outcomes. | `src/app/(storefront)/checkout/success/page.tsx:88-101`; `src/lib/order-access.ts:27-32` |
| S12-5 | LOW | **The default catalog order is the REVERSE of the reference's observable order on two surfaces** — `/products` default "Newest" (`createdAt: desc` over auto-`now()` seed timestamps → last-seeded superset products first) and home "New Arrivals" (`createdAt: desc`, take 8 → Stand Mixer first, reference shows Damascus first). Home "Featured" (`asc`) matches. Fix: the seed assigns explicit, deterministic `createdAt` timestamps DESCENDING along the seed list (Damascus newest — create-only, `productSeedUpdate` untouched so reseeds never rewrite them), and the home featured query flips to `desc` so its order is preserved. After the fix all three surfaces render the reference's authored order first, admin-created products (real `now()` timestamps) correctly sort as the newest, and the superset products follow on page 2. | `prisma/seed.ts:626-648` (create without `createdAt`); `src/lib/products.ts:100`; `src/app/(storefront)/page.tsx:36,42`; live reference /products + home sections (measured this session) |

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C1 | Checkout cart-clear filter (S12-1 vehicle) | Unit: `cartClearFilter` — ordered ids only, cartId-scoped, empty-lines safe |
| C2 | Seed timestamp helper (S12-5 vehicle) | Unit: `productSeedCreatedAt` — index 0 newest, strictly descending, distinct spacing |
| C3 | `getSettings()` numeric fallback seam unextracted | Extract pure `settingNumber(raw, fallback)`; unit-pin undefined/NaN/garbage → fallback, finite passthrough |
| C4 | Cart-PATCH scoped-write 404 (S10-2) unpinned | E2E: PATCH a deleted/nonexistent line id → 404 JSON (never a 500) |
| C5 | `/api/contact` + `/api/newsletter` have zero route-level coverage | E2E: contact success + inline validation error; newsletter subscribe success |
| C6 | Guest→user wishlist merge wiring has no e2e | E2E: guest hearts two products → registers → wishlist page lists both |

### Accepted / deferred (with justification)

- **Review two-tier budgets not e2e'd** — an honest 6-submit case would permanently skew the monotonic demo rating/reviewCount aggregates (each accepted review grows them; recompute is deliberately forbidden). The key shape is unit-pinned (`reviewRateLimitKeys`); the budgets are two reviewed literals in the action. Accepted.
- **Address POST create-then-verify `>` branch** unreachable in e2e without concurrency (the pre-create fast-fail fires first) — the pre-create gate is e2e-pinned; the post-create count is defense-in-depth under SQLite's write lock. Accepted.
- **Carousel reorder tx** is a thin zod-guarded wrapper — admin-only, accepted unpinned.
- **Carried deferrals unchanged**: drawer focus trap (S8-7), login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration test, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer, radiogroup roving focus, address content dedup.

## 4. Remediation plan (TDD)

1. **S12-1** — new pure `cartClearFilter(cartId, lines)` in `src/lib/cart.ts` returning `{ cartId, id: { in: orderedIds } }`; `placeOrderTx` deletes through it. Unit tests red-first (ordered ids only / cartId scope / empty lines → `in: []`).
2. **S12-2** — `DEMO_MODE = NEXT_PUBLIC_DEMO_MODE === "true" || (NODE_ENV !== "production" && NEXT_PUBLIC_DEMO_MODE !== "false")`; `.env.example` comment rewritten (production default hidden, set `"true"` for evaluation builds); `docs/DEPLOYMENT.md` rows updated (+ keep the change-seeded-passwords advice); the stale screenshots-script comment updated. Verified by building and curling the login HTML (box absent; present with the flag) — e2e unaffected (specs fill credentials directly).
3. ~~S12-3~~ — REJECTED on verification (see the findings table): the class is valid and compiled; no change.
4. **S12-4** — success page verifies the deterministic token BEFORE the DB read (`tokenValid ? findUnique : null`); denial shell unchanged.
5. **S12-5** — new pure `productSeedCreatedAt(index, now?)` in `seed-policy.ts` (index 0 = newest, 60s spacing); seed `create` gains `createdAt: productSeedCreatedAt(index)`; home featured `orderBy` asc→desc; fresh DB (`rm db/custom.db && npm run db:setup`); live agent-browser parity verification of `/products` page 1 + home sections against the reference.
6. **C3/C4/C5/C6** — the coverage pins above (unit RED-first for C3; e2e cases red-first where the behavior is already fixed — they pin, not drive).
7. **DOC** — AGENTS.md (demo-mode invariant + seed-order invariant), CLAUDE.md (modules + coverage list), README (order-parity note + test counts), PAD (§8 tables + known-issues ledger), SKILL.md v1.9.0 (project_state + Appendix B), DEPLOYMENT.md, `docs/session_17.md` (run-13 narrative), worklog entry, screenshots refreshed.

## 5. Execution log (session 12)

- [x] RED — `tests/unit/session12-hardening.test.ts` written first (`cartClearFilter` ×3, `productSeedCreatedAt` ×4, `settingNumber` ×4) — failed on the missing exports with the existing 246 green
- [x] GREEN — `cart.ts` += `cartClearFilter`; `placeOrderTx` deletes the ordered lines only
- [x] GREEN — `seed-policy.ts` += `productSeedCreatedAt`; seed create wired; home featured `desc`; fresh DB reseeded
- [x] GREEN — demo-mode production default OFF (+ `.env.example`, DEPLOYMENT.md, screenshots comment); success page token-before-query. S12-3 REJECTED on verification (built CSS proves the arbitrary accent class compiles) — no code change.
- [x] GREEN — e2e pins: cart-PATCH 404, contact + newsletter flows, guest-wishlist → register merge
- [x] Full gate chain re-run green; manual agent-browser verification (products order + home sections vs reference, login demo box absent in production build, admin checkboxes accent, mobile menu)
- [x] Screenshots refreshed; docs sweep; worklog updated

**Post-remediation totals (session 12):** see the session-12 run narrative (`docs/session_17.md`) for the final counts.

---

# Session 13 — Post-push audit & drawer-a11y/bundle-hygiene completion (2026-10-13)

> **Status:** EXECUTED (see the Session-13 Execution Log at the end)
> **Scope:** Re-validation of the session-12 deliverables on the pulled tree (`8439105` = `15eb5f9` + `docs/session_18.md`), a **live-reference parity re-verification** (agent-browser, logged in with the operator credentials), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over `src/`, `prisma/`, `tests/`, root configs — `skills/` excluded), and TDD remediation of the newly identified findings (1 MEDIUM + 4 LOW + 2 NIT) plus test-coverage pins and three doc-drift repairs.
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-12 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **257/257 unit** ✓ · build ✓ · **59/59 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink `/home/z/my-project/db → <repo>/db`; `.env` carries the `file:../db/custom.db` contract with a fresh `AUTH_SECRET`; `db/custom.db` seeded at the repo root; health `db:up`).

Visual parity re-verified against the LIVE reference (agent-browser, logged in): reference unchanged — same nav anatomy, same hero slides, same trust badges, same 8 category tiles, same featured set and authored order (Damascus first on `/products` "Newest", home Featured and New Arrivals alike — the session-12 order fix holds on both sides), same login copy, account page covered by the clone's superset. **Mobile menu re-verified** on the clone's production build (iPhone 390×844: open → `expanded=true` → `navigation "Mobile"` with all links → navigate to `/products` → auto-close) — the Tailwind v4 conditional-mount pattern is intact.

## 2. Session-12 fix verification (read-only subagent + spot-checks)

**4/4 WIRED · 0 PARTIAL · 0 MISSING.** (a) `cartClearFilter` (`cart.ts:43-45`) consumed by the in-tx sweep (`checkout/route.ts:368`); (b) demo quick-fill OFF by default in production (`login-form.tsx:32-34`, truth table verified for all five env cells; residual → S13-1); (c) token verified BEFORE the DB read (`checkout/success/page.tsx:96` precedes the lookup at :98, timing-safe verify in `order-access.ts:35-39`); (d) seed backdating create-only via `productSeedCreatedAt` (`seed.ts:645`; `productSeedUpdate` excludes `createdAt`) with home featured `desc` (`page.tsx:39,45`).

## 3. Session-13 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 1 MEDIUM / 4 LOW / 2 NIT** — the twelfth pass re-confirmed clean: all 11 route handlers (body-parse separation, status codes, limiter keys, ownership checks), `actions/admin.ts` authorization surface, auth/session (scrypt, hashed-token sessions, HMAC cookie, sweep), money/coupon/settings edge cases, seed idempotency + policy, headers/CSP/nonce flow, SEO (sitemap/robots/JSON-LD/canonicals), validation schemas, Prisma schema indexes. Every finding below was personally re-verified with file:line evidence before planning.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S13-3 | MEDIUM | **The closed cart drawer remains keyboard-reachable and exposed to assistive tech.** The `<aside role="dialog" aria-modal="true">` is always mounted; the closed state is only `pointer-events-none translate-x-full` (a transform — which does NOT remove elements from the tab order or the accessibility tree). Its close button, per-line steppers, and Checkout/View Cart links stay focusable when closed: with items in the cart a keyboard user tabs through ~5+ invisible off-screen controls on every page, and screen readers meet an `aria-modal` dialog that is never open. Adjacent to but distinct from the deferred S8-7 (open-state focus trap). Violates the WCAG 2.2 AA claim in CLAUDE.md. | `src/components/store/store-chrome.tsx:163-171` (closed state at :169); interactive children :174-182, :219-238, :259-268 |
| S13-1 | LOW | **The seeded demo credentials ship in the production client bundle despite the hidden box.** S12-2 gated the quick-fill JSX, but `DEMO_ACCOUNTS` is module scope in a `"use client"` file, so both passwords are compiled into the shipped chunks: the built artifact contains `…{label:"Admin demo",email:"admin@homenestkitchen.com",password:"Admin123!"}…`. The "production hides the admin credentials" property is visual only — view-source reveals them. Fix: server boundary — the (server) login page computes the flag and passes `demoAccounts` as props ONLY when enabled; the client file carries no credential strings. | `src/app/(auth)/login/login-form.tsx:12-23` + built chunk `.next/static/chunks/1qoat3oyc3j12.js` |
| S13-2 | LOW | **The five admin client islands have no catch around awaited server actions — failures are silent.** All mutation handlers are `try { await action() } finally { setPending(false) }` with zero catch (grep-verified in all five files). The actions deliberately rethrow unknown errors (DB outage), so on rejection nothing renders: no toast, no inline error, dialog stays open — "nothing happened" — plus an unhandled promise rejection. The storefront islands do this correctly (profile-form, address-dialog, contact-form, add-all-button all catch) — the asymmetry contradicts CLAUDE.md's "every async action has error handling". | `product-dialog.tsx:169-200`, `category-dialog.tsx`, `slide-dialog.tsx`, `order-manage-dialog.tsx:122-163`, `settings-form.tsx:89-115` |
| S13-4 | LOW | **The review insert and the aggregate growth are two separate transactions.** S8-2 made the read-merge-write transactional, but `db.review.create` stayed OUTSIDE the `$transaction`. If the grow tx fails after the insert commits, the row persists uncounted and the broad catch returns "Could not save your review" — a retry inserts a duplicate. Fix: fold the create into the same transaction as `growReviewAggregate`. | `src/lib/actions/reviews.ts:59-69` (create) vs :76 (tx) |
| S13-7 | LOW | **`cf-connecting-ip` is trusted unconditionally by `clientIp`.** On the documented standalone direct deploy (no Cloudflare edge) that header is fully client-controlled: rotating it mints fresh `login-ip:`/`review-ip:`/`checkout:` per-IP buckets. The per-email budgets + scrypt burn still bound per-account abuse, and header-derived IPs are inherently advisory on direct deploys (a bare client can also send `x-forwarded-for`) — so the fix is an explicit **opt-out** (`TRUST_CF_CONNECTING_IP="false"`), NOT a default flip: flipping would break the documented session-6 invariant and CF-fronted deployments (whose rightmost-XFF fallback can include internal proxy hops). Default behavior unchanged; direct-deploy operators gain a one-line hardening switch. | `src/lib/rate-limit.ts:71-79` |
| S13-5 | NIT | **Three admin actions map EVERY error — including a DB outage — to "not found".** Bare `catch { return { ok:false, error: "…not found…" } }` in `toggleProductActiveAction`, `upsertSlideAction`, `reorderSlidesAction`, unlike the sibling `upsertProductAction`/`upsertCategoryAction` which narrow P2002/P2025 and rethrow unknown. A transient failure tells the admin the row doesn't exist. Fix: mirror the sibling pattern. | `admin.ts:143-145, 265-267, 299-301` vs :93-103/:191-204 |
| S13-6 | NIT | **"Revenue This Month" uses server-LOCAL month boundaries while the dashboard revenue chart buckets are UTC.** `new Date(now.getFullYear(), now.getMonth(), 1)` vs `buildRevenueChart`'s UTC day buckets (`Date.UTC(...)`): on a non-UTC host the two admin money surfaces disagree about "this month"/"today". Fix: pure `utcMonthStart(now)` helper, unit-pinned, consumed by the analytics page. | `src/app/(storefront)/admin/analytics/page.tsx:28-29` vs `src/lib/analytics.ts:95` |

### Doc drift repaired this session

| # | Drift | Repair |
|---|---|---|
| D1 | `README.md:55` tech-stack table still says "246 unit · 51 e2e" (badge + commands say 257/59) | Updated to the post-session totals |
| D2 | `CLAUDE.md:49` says the checkout client mints keys via "crypto.randomUUID()" — the code uses `newRequestId()` (`random-id.ts`, non-secure-origin fallback; AGENTS.md:68 documents it correctly) | Wording corrected |
| D3 | `CLAUDE.md:90` "every async action has error handling" — contradicted by S13-2 | Fixed the CODE (S13-2) so the doc claim becomes true; doc unchanged |

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C1 | `demoModeEnabled` (S13-1 vehicle) — the five env cells previously only hand-verified | Unit truth table: prod+unset→off, prod+"true"→on, prod+"false"→off, dev+unset→on, dev+"false"→off |
| C2 | `utcMonthStart` (S13-6 vehicle) unextracted | Unit: month-start instant, month rollover, timezone independence |
| C3 | `clientIp` opt-out (S13-7 vehicle) unpinned | Unit: default preserves cf-first precedence; `trustCf:false` ignores the header and falls through XFF/direct |
| C4 | Review create+grow atomicity (S13-4) has no DB-level pin | Integration unit (temp SQLite): a failed aggregate write inside the tx rolls back the review insert; success path grows the aggregate |
| C5 | Closed-drawer keyboard reachability (S13-3) unpinned | E2E: closed drawer carries `inert` (and drops it while open) |
| C6 | Production-bundle credential guard (S13-1) unpinned — would have caught S13-1 mechanically | E2E: the login page's HTML + every referenced script chunk contain no seeded password strings |
| C7 | Admin island silent-failure (S13-2) unpinned | E2E (representative): an aborted settings-save surfaces the destructive toast |
| C8 | `settingsPatchSchema` clamps (audit gap #1) unexported and unpinned | Export + unit: tax bounds, cents bounds, `javascript:` social URL rejection, whitespace trim |

### Accepted / deferred (with justification)

- **Audit coverage gaps #3–#5 accepted as documented debt**: `setOrderStatusAction` action-level tx wiring (the pure transition rules + guarded write are unit-pinned; a fake-tx harness would duplicate the DB integration pattern beyond this session's scope — C4 establishes the pattern), checkout coupon-cap rollback under concurrency (the guarded filter is unit-pinned; true concurrency needs the deferred integration harness), review two-tier budgets e2e (unchanged — monotonic demo aggregates, unit key shape pinned).
- **Carried deferrals unchanged**: drawer OPEN-state focus trap (S8-7 — S13-3 fixes the closed-state leak only), login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration test, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer, radiogroup roving focus, address content dedup.

## 4. Remediation plan (TDD)

1. **S13-3** — `store-chrome.tsx`: the drawer `<aside>` gains `inert={!cartDrawerOpen}` (React 19 boolean attribute; not a display utility — the Tailwind v4 no-display-toggle contract is untouched) + `aria-hidden={!cartDrawerOpen}`; transform animation preserved. E2E pin red-first in `shopping-flow.spec.ts` (closed → `inert` present; open → absent).
2. **S13-1** — new pure `demoModeEnabled(env)` in `src/lib/demo-mode.ts` (unit RED-first, five cells); `login/page.tsx` computes the flag server-side and passes `demoAccounts` ONLY when enabled; `login-form.tsx` drops the module-scope `DEMO_ACCOUNTS` + the client `DEMO_MODE` const and renders from the prop. E2E pin: login HTML + every referenced script chunk are credential-free.
3. **S13-2** — the five admin islands gain `catch` → inline `setError` where the state exists + the destructive toast ("Something went wrong…"), matching the storefront islands. E2E pin (representative): route-abort the settings action POST → destructive toast visible.
4. **S13-4** — `reviews.ts`: fold `review.create` into the same `$transaction` as `growReviewAggregate`. Integration unit RED-first (temp SQLite via `datasourceUrl`): failed aggregate write rolls back the insert; success grows the aggregate.
5. **S13-7** — `clientIp(headers, opts?)` gains an explicit `trustCf` override (default: module-level `TRUST_CF_CONNECTING_IP !== "false"` — the documented invariant unchanged); unit RED-first for both the default precedence and the opt-out; `.env.example` + DEPLOYMENT.md rows.
6. **S13-5** — the three bare catches narrow to `P2025` → "not found" and rethrow unknown errors, mirroring the sibling pattern.
7. **S13-6** — pure `utcMonthStart(now)` in `analytics.ts` (unit RED-first), consumed by the analytics page.
8. **C8** — export `settingsPatchSchema`; unit-pin the clamps.
9. **DOC** — README (counts + notes), CLAUDE.md (D2 wording, module list), AGENTS.md (three new invariants: drawer inert, credential server-boundary, clientIp opt-out), PAD (§8 tables + known-issues ledger), SKILL.md v1.10.0 (project_state + Appendix B), DEPLOYMENT.md (TRUST_CF_CONNECTING_IP row), `docs/session_19.md` (run-14 narrative), worklog entry, screenshots refreshed.

## 5. Execution log (session 13)

- [x] RED — `tests/unit/session13-hardening.test.ts` (`demoModeEnabled` ×5, `utcMonthStart` ×3, `clientIp` opt-out ×3, settings clamps ×6) + `tests/unit/review-transactional.test.ts` (integration ×3, temp SQLite via `datasourceUrl`) — failed on the missing exports/behavior with the existing 257 green
- [x] RED — e2e: closed-drawer `inert` (shopping-flow), login-bundle credential-free (auth), admin aborted-save toast (admin) — failed against the old build
- [x] GREEN — S13-3 `inert`/`aria-hidden` on the drawer; S13-1 server boundary + `demoModeEnabled`; S13-2 catches ×5 islands; S13-4 tx fold; S13-7 opt-out param; S13-5 narrowed catches ×3; S13-6 `utcMonthStart`; C8 schema export + pins
- [x] Full gate chain re-run green (277/277 unit · 61/61 e2e); manual agent-browser verification (drawer closed focus/inert live, login box absent + credentials absent from view-source, admin toast on aborted save, mobile menu re-check)
- [x] Screenshots refreshed; docs sweep; worklog updated

**Post-remediation totals (session 13):** see the session-13 run narrative (`docs/session_19.md`) for the final counts.
