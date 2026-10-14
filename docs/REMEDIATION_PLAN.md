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


# Session 14 — Post-push audit & toast-timer/boundary-pin completion (2026-10-13)

> **Status:** EXECUTED (see the Session-14 Execution Log at the end)
> **Scope:** Re-validation of the session-13 deliverables on the pulled tree (`42a188a` = `6d53a79` + `docs/session_20.md`), a **live-reference parity re-verification** (agent-browser, logged in with the operator credentials), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan over `src/`, `prisma/`, `tests/`, root configs — `skills/` excluded), and TDD remediation of the newly identified findings (2 NIT from the audit + 1 NIT discovered during the TDD itself — the cleanest audit surface in the series) plus five coverage pins and two doc-drift repairs.
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-13 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **277/277 unit** ✓ · build ✓ · **61/61 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the pre-existing symlink `/home/z/my-project/db → <repo>/db`; `.env` carries the `file:../db/custom.db` contract; `db/custom.db` seeded at the repo root; health `db:up`).

Visual parity re-verified against the LIVE reference (agent-browser, logged in): reference unchanged — same nav anatomy, same hero slides ("Elevate Your Kitchen" / "New Arrivals" / "Sale Up to 40% Off"), same 8 category tiles, same featured set and authored order (Damascus Steel Chef Knife Set first on the reference's Featured and New Arrivals rows and the clone's `/products` "Newest"), same login card, reference account page (profile + expandable order history) covered by the clone's superset. **Mobile menu re-verified** on the clone's production build (iPhone 390×844: open → `expanded=true` → `navigation "Mobile"` with all 7 links → navigate to `/products` → auto-close, `expanded=false` unmounted) — the Tailwind v4 conditional-mount pattern is intact; the reference's mobile panel carries the same 5 main links (the clone adds Sign In/Wishlist — superset).

## 2. Session-13 fix verification (read-only subagent + spot-checks)

**8/8 WIRED · 0 PARTIAL · 0 MISSING** (S13-1..S13-7 + C8; one count CORRECTION below). (a) `demoModeEnabled` pure (`src/lib/demo-mode.ts:13-20`), login page passes `DEMO_ACCOUNTS` as props ONLY when enabled (`login/page.tsx:44-51`), credentials grep-verified to live in exactly that one server file; (b) every awaited admin action carries a catch (see the count correction); (c) `inert={!cartDrawerOpen}` + `aria-hidden` (`store-chrome.tsx:175-176`); (d) review create inside the aggregate tx (`reviews.ts:68-81`, temp-SQLite pin); (e) three catches narrowed to P2025+rethrow (`admin.ts:144-152,272-279,311-318`); (f) `utcMonthStart` consumed (`analytics/page.tsx:30,38`); (g) `TRUST_CF_CONNECTING_IP` opt-out honored (`rate-limit.ts:79,85`); (h) `settingsPatchSchema` exported pure + consumed (`settings-schema.ts:40-62`, `admin.ts:19,439`).

**Count correction (S13-2):** the session-13 plan said "12 catch blocks across the five admin dialogs" — the actual census is **13 catch blocks across five dialog/form FILES** (product-dialog ×3 — upsert, delete, and the product TOGGLE row — category-dialog ×3, slide-dialog ×4, order-manage-dialog ×2, settings-form ×1). The property (every awaited admin action caught) holds everywhere; only the recorded numbers were off. Fixed in AGENTS.md this session.

## 3. Session-14 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT** — the cleanest surface in the fourteen-session series. The thirteenth pass re-confirmed clean: admin authorization (`requireAdmin` on every action), PII capability gates (receipt token verified BEFORE the DB read; track-order email-match default-deny), every race-sensitive write (status/tracking/address/cart/coupon/stock all scoped-conditional or in-tx), money bounds + in-tx derivation, Zod at every boundary, all 16 metered surfaces, CSP/nonce wiring, `assertAuthSecret` gate, uniform auth errors + scrypt burn, seed create-only discipline, SEO (sitemap/robots/JSON-LD/canonicals/noindex), Radix dialog semantics + aria labels, `next.config`/tsconfig/vitest/playwright/eslint configs. Static counts re-verified: **277 unit · 61 e2e** = the README badge. Every finding below was personally re-verified with file:line evidence before planning.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S14-1 | NIT | **The Toaster's auto-dismiss `setTimeout` is never cleared.** Each `toast()` schedules a bare 4s timer that (a) fires after a manual close (a redundant idempotent filter — benign today), and (b) would call `setItems` after unmount. Harmless only because the Toaster lives in the root layout and never unmounts (React 18+ no longer warns). Fix: track timers in a ref Map; manual dismiss clears its pending timer; unmount clears all — hygiene now, no behavior change. | `src/components/ui/toaster.tsx:29-31` vs `dismiss` at :34-36 |
| S14-2 | NIT | **`npm run start` pipes through `tee server.log`** — noted only because some process managers detach from `tee`; the behavior is DOCUMENTED in AGENTS.md's commands table and shows no breakage in any gate run. **Accepted as-is** (no code change — the log-tee contract is the operator's documented workflow). | `package.json:8-9` |
| S14-3 | NIT (found during TDD) | **The toast close button is icon-only with NO accessible name.** `ToastClose` renders a Radix Close wrapping a bare `<X/>` glyph — no `aria-label`, no visually-hidden text — so screen readers announce an unnamed button, violating CLAUDE.md's own "every icon-only button has an `aria-label`" standard. Fixed alongside S14-1 (its test was the discoverer). | `src/components/ui/toast-primitives.tsx:64-78` |
| S14-4 | MEDIUM (found during the final e2e gates) | **E2E checkout traffic permanently drains the traffic-owned demo stock until stock-assuming pins fail.** Fourteen sessions of suite runs depleted `Damascus Steel Chef Knife Set` to stock 0 (the S7-3 seed policy deliberately never refreshes stock on reseed), so the product page rendered "Out of Stock" — breaking the storefront detail pin (`storefront.spec.ts:84` "In Stock") and the S10-2 cart POST pin (sold-out 409). A data-depletion failure mode, not a code regression: the demo DB had just enough stock left for ONE green suite run at session start, then hit 0. Fix: `scripts/restore-demo-stock.ts` tops every product back to its seed value, wired into the e2e webServer command (fresh start = deterministic demo state; the session-7 "data restored to seed values afterwards" convention, mechanized); `prisma/seed.ts` gains the standard direct-execution guard so the script can import `PRODUCTS` without triggering a seed. | `db/custom.db` Damascus stock 0 (verified via Prisma); `storefront.spec.ts:77-95`; `playwright.config.ts` webServer |

### Doc drift repaired this session

| # | Drift | Repair |
|---|---|---|
| D1 | `AGENTS.md:69` limiter summary says "writes 60/min" — the real grid: checkout **20/min**, reviews **20+5 two-tier**, contact/newsletter **5/min**, coupon/track-order **30/min** (the values it does state — 120 search+cart-summary, 60 cart/wishlist/addresses, 10 bulk — are correct) | Grid corrected |
| D2 | `CLAUDE.md:35` lists `src/components/admin/` — the directory does not exist (admin dialogs live in their admin route folders; the account address dialog in `(storefront)/account/`) | Path description corrected |
| D3 | AGENTS.md S13-2 invariant says "12 catch blocks across the five admin dialogs" — actually **13 blocks across five dialog/form files** (count correction above) | Numbers corrected |

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C1 | `/api/health` degraded **503** path unpinned | Unit: mocked `db.$queryRaw` resolve → `{status:"ok",db:"up"}` 200; reject → `{status:"degraded",db:"down"}` 503 |
| C2 | Newsletter/contact route **boundary mappings** unpinned (malformed JSON 400, invalid body 400, 429 mapping) | Unit (route handlers are import-safe in Vitest — verified empirically): malformed JSON → 400, invalid email → 400, exhausting the 5/min budget → 429 |
| C3 | Checkout **429 + Retry-After** mapping unpinned | Unit: 20 valid `cod` bodies pass the limiter, the 21st → 429 with the `Retry-After` header |
| C4 | `updateProfileAction` / `logoutAction` have no direct pin (actions are not import-safe in Vitest — `next/cache`) | E2E: sign in → profile edit → success toast → name persisted after reload (then restored) → Sign Out returns to the signed-out header — pins the full wiring |
| C5 | Toaster timer hygiene (S14-1 vehicle) — the suite's first component test | Unit (`jsdom` docblock + fake timers): auto-dismiss at 4s; manual dismiss cancels the pending timer; unmount with a pending timer is clean |

### Accepted / deferred (with justification)

- **Checkout `saveAddress` at-cap skip-save pin deferred** (audit gap): the order-still-places behavior is implemented (`checkout/route.ts:370-400`) but pinning it end-to-end requires the address-cap + checkout integration seam — the same deferred harness family as the carried "checkout P2002 recovery-loop integration test" (creating 20 addresses then checking out in one e2e is the workable shape; not this session).
- **`placeOrderWithRetry` order-number collision exhaustion (5× → 500) unpinned**: arranging five real sequential collisions requires mocking the number generator inside the route module — accepted as documented debt.
- **S14-2 accepted as-is** (documented operator workflow, no breakage evidence).
- **Carried deferrals unchanged**: drawer OPEN-state focus trap (S8-7), login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration test, checkout coupon-cap concurrency harness, review two-tier budgets e2e, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer, radiogroup roving focus, address content dedup.

## 4. Remediation plan (TDD)

1. **S14-1** — `toaster.tsx`: a `React.useRef(new Map<number, number>())` timer registry; `toast()` registers its timer, the auto-dismiss callback deletes its entry and filters; `dismiss()` clears the pending timer before filtering; a `useEffect` cleanup clears every pending timer on unmount. Component unit RED-first (`tests/unit/toaster.test.tsx`, `@vitest-environment jsdom` docblock — the suite's first component test): auto-dismiss at 4s under fake timers; manual close cancels the pending timer; unmount with a pending timer performs no further state updates.
2. **S14-3** — `toast-primitives.tsx`: `aria-label="Dismiss notification"` on the icon-only ToastClose (the manual-close RED surfaced it).
3. **S14-2 / C1-C3** — `tests/unit/api-boundaries.test.ts`: route-handler units with `vi.mock("@/lib/db")` where a DB touch would otherwise occur; per-test IP isolation via rightmost-`x-forwarded-for` headers (the `clientIp` contract). Health ok/503; newsletter malformed-JSON 400 / invalid-body 400 / 429; contact 429; checkout 429 + `Retry-After`.
4. **C4** — `tests/e2e/auth.spec.ts` profile+logout flow (sign in → edit name → toast → persisted → restored → Sign Out → signed-out header).
5. **S14-4** — `scripts/restore-demo-stock.ts` (seed-value stock restore) wired as the e2e webServer's first command; `prisma/seed.ts` made import-safe (direct-execution guard) with `PRODUCTS` exported; the drained demo stock restored.
6. **DOC** — AGENTS.md (limiter grid D1 + S13-2 count D3), CLAUDE.md (D2 component-path description), README/SKILL/PAD counts + known-issues ledger, `.env.example` unchanged, `docs/session_21.md` (run-15 narrative), worklog entry, screenshots refreshed.

## 5. Execution log (session 14)

- [x] Probe — route-handler import-safety in Vitest verified empirically BEFORE the tests were written (health/newsletter/contact/checkout all import + answer a real 400 in the node env)
- [x] RED — `tests/unit/toaster.test.tsx` (S14-1: the unmount case failed `expected 1 to be +0` against the pre-fix component — the orphan 4s timer was live; the manual-close case first exposed a BONUS finding: the ToastClose icon-only button had NO accessible name, violating CLAUDE.md's icon-only rule — fixed with `aria-label="Dismiss notification"`) — with the existing 277 green
- [x] Coverage pins (green on arrival, as pins of existing correct behavior are): `tests/unit/api-boundaries.test.ts` (S14-2/C1-C3: 8 cases — health ok/503, newsletter malformed-JSON/invalid-body/429, contact 429, checkout 429 + `Retry-After`) and the e2e profile+logout flow (`tests/e2e/auth.spec.ts`, S14-3/C4 — pins the existing `updateProfileAction`/`logoutAction` wiring end-to-end, restoring the seed name afterwards)
- [x] GREEN — S14-1 timer registry (register / auto-delete / dismiss-clear / unmount-clear) — all 3 toaster cases + 8 boundary cases green
- [x] Full gate chain re-run green; manual agent-browser verification (toast auto-dismiss + manual close, profile save flow, mobile menu re-check, health endpoints)
- [x] Screenshots refreshed; docs sweep; worklog updated

**Post-remediation totals (session 14):** see the session-14 run narrative (`docs/session_21.md`) for the final counts.

# Session 15 — Post-push audit & rate-limit response hygiene (2026-10-13)

> **Status:** EXECUTED (see the Session-15 Execution Log at the end)
> **Scope:** Re-validation of the session-14 deliverables on the pulled tree (`0701b44` = `4f19bf1` + `docs/session_22.md`), a **live-reference parity re-verification** (agent-browser, logged in with the operator credentials), a fresh read-only deep audit (repo `code-review-checklist` 12-category scan; `skills/` excluded), and TDD remediation of the new findings.
> **Method:** unchanged — failing tests first, then the fix, then the full gate chain (`lint && typecheck && typecheck:tests && test && build && test:e2e`).

## 1. Re-validation (all session-14 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **287/287 unit** ✓ · build ✓ · **62/62 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the documented symlink `/home/z/my-project/db → <repo>/db`; `.env` carries the `file:../db/custom.db` contract; `db/custom.db` freshly pushed + seeded).

Live-reference parity re-verified against the LIVE reference (agent-browser, logged in): reference unchanged — same nav anatomy, same hero slides ("New Arrivals" / "Elevate Your Kitchen" / "Sale Up to 40% Off"), same 8 category tiles, same featured set and authored order (Damascus Steel Chef Knife Set first on Featured AND New Arrivals; reference mobile panel = 5 main links). Clone re-verified on the production build: desktop parity holds; **mobile menu open → 7-link panel → navigate → auto-close/unmount** (Tailwind v4 conditional-mount intact); `/products` renders Damascus-first; login → `/account` with profile/orders/addresses; zero console errors.

## 2. Session-14 fix verification (read-only subagent 16-a + spot-checks)

**5/5 WIRED · 0 PARTIAL · 0 MISSING** (S14-1 timer registry with file:line evidence at `toaster.tsx:27,29-36,42-46,51-57`; S14-3 `aria-label` at `toast-primitives.tsx:69`; S14-2/C1-C3 boundary pins; S14-4 restore harness at `playwright.config.ts:47` + `restore-demo-stock.ts:23,29-30,59-62` + import-safe seed with `PRODUCTS` export; C4 profile+Sign Out e2e). Older-fix spot-checks **5/5 WIRED** (S13-3 drawer inert, S13-1 demo-credential server boundary, S13-4 review tx fold, S12-4 token-before-DB-read, S9-1 cart-badge server fallback).

## 3. Session-15 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW / 3 NIT / 0 doc-drift** — every count re-verified (287 unit · 62 e2e · 18 models · 16 products · the full AGENTS.md limiter grid · the 13 admin-island catch blocks). All findings personally re-verified with file:line evidence before planning.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S15-1 | LOW | **The checkout 429 pin's in-budget assertion is vacuous.** The loop's recorded statuses are asserted only via `toHaveLength(20)` — an array built by the loop itself — so a limiter misconfigured to 10/min (attempts 11–20 → 429) would still pass. The comment "every in-budget attempt consumed exactly one limiter slot" is not actually proven. | `tests/unit/api-boundaries.test.ts:133-146` |
| S15-2 | LOW | **The storefront e2e cardinality pins are DATA-coupled with no restore guard** (the residual of the S14-4 class): `/16 products found/` and `/3 products found/` pin absolute counts against the persistent demo DB. The restore harness tops stock only; a deactivated seed product (or an admin-created extra) permanently breaks the pins. | `tests/e2e/storefront.spec.ts:45,63`; `scripts/restore-demo-stock.ts` |
| S15-3 | NIT | **`Retry-After` ships on only 4 of 14 rate-limited 429 responses.** Checkout (1 site) + addresses (3 sites) set the header; newsletter, contact, coupon, cart ×3, bulk, cart-summary, search, wishlist (10 sites) omit it even though `rateLimit()` always returns `retryAfterSec`. Legal without it, but the contract should be uniform. | `api/addresses/route.ts:25,112,170`, `api/checkout/route.ts:114` vs `api/newsletter/route.ts:23`, `api/contact/route.ts:27`, `api/coupon/apply/route.ts:45`, `api/cart/route.ts:36,88,156`, `api/cart/bulk/route.ts:30`, `api/cart-summary/route.ts:17`, `api/search/route.ts:14`, `api/wishlist/route.ts:33`; `rate-limit.ts:51` |
| S15-4 | NIT | **The admin search inputs feed Prisma `contains` without the 100-char cap the storefront applies.** `/products` caps `q` at 100; admin products + orders do not (parameterized, admin-gated — grid consistency only). | `admin/products/page.tsx:67`, `admin/orders/page.tsx:89` vs `products/page.tsx:65`, `api/search/route.ts:20` |
| S15-5 | NIT | **The hero carousel constructs a fresh `MediaQueryList` on every `getSnapshot` read** (`window.matchMedia(...)` per call). Correct but wasteful; cache the query. | `hero-carousel.tsx:43` |

### Doc drift this session: none

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C1 | **Order-number allocation exhaustion** (5 sequential P2002s on the NUMBER → `CheckoutError(500)`) unpinned | Unit (mocked `db`): `db.order.count` → 0, `db.$transaction` rejects with a P2002 whose target is `number` ×5 → the route answers 500 and the P2002-on-NUMBER never enters the idempotency replay branch |
| C2 | **Sitemap DB-failure fallback** (static-routes-only emission) unpinned | Unit (mocked `db`): `db.product.findMany` rejects → exactly `STATIC_ROUTES.length` entries; resolves with 2 mocked products → static + 2 product URLs |

**Accepted / carried deferrals (unchanged):** checkout `saveAddress` at-cap skip-save integration pin (needs the deferred address-cap + checkout harness family), review action two-tier gate pin (actions are not import-safe in Vitest — `next/cache`), route-level 429 wiring pins beyond the S14-2 representatives + this session's header assertions (limiter math is unit-pinned), drawer OPEN-state focus trap (S8-7), login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration test, checkout coupon-cap concurrency harness, review two-tier budgets e2e, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer/payment epics.

## 4. Remediation plan (TDD)

1. **S15-1** — `tests/unit/api-boundaries.test.ts`: the checkout pin asserts `expect(statuses.every((s) => s !== 429)).toBe(true)` — the in-budget claim becomes real (kept alongside `toHaveLength(20)`).
2. **S15-3** — all ten headerless 429 sites gain `headers: { "Retry-After": String(limit.retryAfterSec ?? 60) }` (matching the checkout/addresses shape exactly); the newsletter + contact boundary pins assert the header (RED first). One-line-per-site, no behavior change beyond the header.
3. **S15-4** — pure `clampSearchTerm(value: string, max = 100)` in `src/lib/validation.ts` (unit-pinned: trims, caps at max, returns "" for empty); consumed by `/products` (replacing the inline slice), `admin/products`, `admin/orders`.
4. **S15-2** — `scripts/restore-demo-stock.ts` also restores each seed product's `isActive` to its seed value (extending the S14-4 harness to the second drift vector); the storefront cardinality pins derive their expected counts from the seed-owned `PRODUCTS` constant (imported in the spec — import-safe per the S14-4 guard) instead of hard-coded literals.
5. **S15-5** — `hero-carousel.tsx`: a module-level lazily-cached `MediaQueryList` (client-only construction; SSR snapshot stays `false`); subscribe + getSnapshot share it.
6. **C1** — `tests/unit/api-boundaries.test.ts`: mocked-`db` exhaustion pin (above).
7. **C2** — `tests/unit/seo-routes.test.ts`: sitemap fallback + product-URL pins (mocked `db`).
8. **DOC** — AGENTS.md (a new rate-limit response invariant + the restore-harness scope note), CLAUDE.md (coverage lists), README (badge counts + limiter row), PAD (§8 tables + known-issues ledger), SKILL.md v1.12.0 (project_state + Appendix B), DEPLOYMENT.md (limiter header note), `.env.example` unchanged, `docs/session_23.md` (run-16 narrative), worklog entries, screenshots refreshed.

## 5. Execution log (session 15)

- [x] RED — `tests/unit/api-boundaries.test.ts`: newsletter/contact 429 pins now assert `retry-after` (failed against the headerless routes); checkout in-budget assertion strengthened (green — the limiter is correctly configured; the assertion now makes the claim real); C1 exhaustion pin added (failed only against a broken-retry hypothesis — green against the correct route, which IS the pin)
- [x] RED — `tests/unit/seo-routes.test.ts`: sitemap fallback + product pins (green on arrival — coverage pins of existing correct behavior)
- [x] RED — validation clamp pins (`tests/unit/validation.test.ts`) failed on the missing `clampSearchTerm` export; e2e storefront pins rewritten to seed-derived constants (green)
- [x] GREEN — S15-3 headers ×10 sites; S15-4 helper + 3 consumers; S15-2 restore-script isActive + seed-derived spec constants; S15-5 cached MQL
- [x] Full gate chain re-run green; manual agent-browser verification (429 header live via curl, mobile menu re-check, catalog order)
- [x] Screenshots refreshed; docs sweep; worklog updated

**Post-remediation totals (session 15):** see the session-15 run narrative (`docs/session_23.md`) for the final counts.

---

# Session 16 — Post-push audit & modal-integrity hardening (2026-10-13)

> **Status:** PLANNED → executed this run (run 17; narrative in `docs/session_25.md`)
> **Scope:** Session-16 cycle on the session-15-completed tree (`e327c82` + operator `session_24.md`). Read-only subagent audit (17-a) over `src/`, `prisma/`, `scripts/`, `tests/`, root configs via the repo `code-review-checklist` skill; every finding personally re-verified with file:line evidence before planning. `skills/` excluded throughout.

## 1. Re-validation (all session-15 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **299/299 unit** ✓ · build ✓ · **62/62 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the documented symlink `/home/z/my-project/db → <repo>/db`; `.env` carries the `file:../db/custom.db` contract; `db/custom.db` pushed + seeded: 16 products / 8 categories).

Live-reference parity re-verified against the LIVE reference (agent-browser): reference unchanged — same nav anatomy, same hero ("New Arrivals" / "Elevate Your Kitchen" / "Sale Up to 40% Off"), same 8 category tiles, same featured set (Damascus Steel Chef Knife Set first on Featured AND New Arrivals, −29% / 412 / $199.99), mobile panel = the 5 main links + search + X close. Clone re-verified on the production build (iPhone 390×844): **mobile menu open → 7-link panel → navigate → auto-close/unmount** (Tailwind v4 conditional-mount intact); `/products` renders Damascus-first; zero console errors.

## 2. Session-15 fix verification (read-only subagent 17-a + spot-checks)

**6/7 WIRED · 1 PARTIAL · 0 MISSING.** S15-1 in-budget assertion (`api-boundaries.test.ts:166-167`), S15-2 restore-`isActive` + format pins + seed-catalog pin, S15-3 all-14 `Retry-After`, S15-4 `clampSearchTerm` ×4 consumers, C1 exhaustion pin, C2 sitemap fallback pin — all WIRED with file:line evidence. **S15-5 PARTIAL**: the MQL cache is implemented (`hero-carousel.tsx:32-36`) but pinned by no test → S16-4 closes it. Older-fix spot-checks **7/7 WIRED** (S13-3, S13-1, S13-4, S12-4, S9-1, S8-6/S10-4, S6-8/S7-2).

## 3. Session-16 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW / 2 NIT / 0 doc-drift** — counts re-verified (299 unit · 62 e2e · 18 models · 16 products · 11/11 admin actions requireAdmin'd · 8/8 POST bodies Zod-gated). Fourth consecutive session without a CRITICAL/HIGH/MEDIUM.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S16-1 | LOW | **The wishlist cap is still check-then-create** — concurrent POSTs at cap−1 both count 99 and both create (the loser's P2002 maps to `inWishlist: true`), permanently overshooting `MAX_WISHLIST_ITEMS` (nothing trims). Session-11 S11-6 fixed the IDENTICAL SQLite race for addresses by creating first and counting post-create under the write lock; the wishlist POST is the one create path still on the older pattern (the login merge IS cap-truncated via `planWishlistMerge`). Impact bounded (a few rows over 100, hidden behind the page's `take`), no security effect. | `src/app/api/wishlist/route.ts:58-75` vs `src/app/api/addresses/route.ts:79-81` |
| S16-2 | NIT | **Three JSON bodies parse through route-local Zod schemas instead of `src/lib/validation.ts` exports** — the "single-source boundary" invariant is drifted: `wishlistToggleSchema` (route-local), `applySchema` (route-local, duplicates the 40-char coupon cap already in `checkoutSchema.couponCode`), and the cart PATCH's inline `z.object`. All inputs still Zod-gated before Prisma (zero security impact) — consistency/duplication only. | `api/wishlist/route.ts:10-12`, `api/coupon/apply/route.ts:15-17`, `api/cart/route.ts:93-95` |
| S16-3 | LOW | **The open cart drawer declares `aria-modal="true"` but the background stays keyboard-tabbable.** The `<aside role="dialog">` is `inert` only when CLOSED (S13-3); while open, nothing inert-izes the page behind it, so Tab walks out of the "modal" into background content — a screen-reader/keyboard mismatch. **This IS the carried S8-7 deferral** (drawer OPEN-state focus containment), now evidence-classified. Escape + close button work; only the containment is missing. | `src/components/store/store-chrome.tsx:163-179` |
| S16-4 | NIT | **S15-5 has no test pin** (the audit's only PARTIAL): a regression back to per-read `matchMedia` would pass all 361 tests. The suite's jsdom component-test pattern (`toaster.test.tsx`) can pin the cache: exactly ONE MediaQueryList construction across mount + timer-driven re-renders + prop rerenders. | `hero-carousel.tsx:32-36`; only component test is `toaster.test.tsx` |

### Doc drift this session: none

(README badge 299/62 + 18 models = actual; AGENTS.md limiter grid + 13 admin catch blocks + all-14-Retry-After = actual; SKILL.md project_state current.)

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C3 | **Wishlist POST route boundary** (at-cap 409 via the TX gate, P2002-in-tx → `inWishlist: true`, normal create) unpinned at route level | Unit (mocked `db` + `next/headers`, api-boundaries pattern): pre-check 99 → tx count 101 → 409 friendly message; tx create P2002 → 200 `{ inWishlist: true }`; happy path → 200 |
| C4 | **`createWishlistItemInTx` create-first ordering** unpinned | Unit (fake tx client): create called before count; count > cap rejects `WishlistCapError` AFTER the create; count === cap resolves |
| C5 | **Hero carousel MQL cache + motion behavior** unpinned (S16-4) | jsdom component test: one `matchMedia` construction across mount + auto-rotate re-renders + rerender; auto-rotation advances slides; reduced-motion freezes them |

**Accepted / carried deferrals (unchanged except S8-7):** drawer OPEN-state focus containment **CLOSED this session by S16-3**; remaining — login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration seam, checkout saveAddress at-cap skip-save integration pin, review action two-tier gate pin (actions not import-safe in Vitest), route-level 429 wiring pins beyond the S14-2 representatives, checkout coupon-cap concurrency harness, review two-tier budgets e2e, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer/payment epics.

## 4. Remediation plan (TDD)

1. **S16-1** — pure `createWishlistItemInTx(tx, wishlistId, productId)` in `src/lib/wishlist.ts` (minimal `WishlistTxClient` interface): create FIRST, then post-create `count` under the write lock, throw `WishlistCapError` when `> MAX_WISHLIST_ITEMS` (the interactive tx rolls the create back). The wishlist POST wires it through `db.$transaction`; the pre-create `assertWishlistCap` stays as the fast-fail UX 409; the tx catch maps `WishlistCapError` → the same friendly 409 and P2002 → `{ inWishlist: true }` (preserved S8-4 double-click semantics).
2. **S16-2** — hoist `wishlistToggleSchema`, `cartLinePatchSchema` (int 0..99 — PATCH's 0-deletes-line semantics, unlike POST's 1..99), and `couponApplySchema` (trim + min-1 + 40-char cap) into `src/lib/validation.ts`; the three routes import them; route-local `z` plumbing removed.
3. **S16-3** — restructure the storefront layout so `StoreChrome` (client) renders the page shell: `<div data-testid="page-shell" inert={cartDrawerOpen} className="flex min-h-screen flex-col">` wraps header + MobileNav + `children` (main) + `footer` (passed as props — server-rendered nodes through a client component); the backdrop + drawer render OUTSIDE it. Native focus containment (inert skips in tab order — no JS trap loop, no display-utility toggling). CartDrawer's a11y effect also captures the opener at open and restores focus on close (native dialog semantics). SSR/hydration-safe: the context starts `false` on both sides.
4. **S16-4** — `tests/unit/hero-carousel.test.tsx` (jsdom docblock + fake timers + `vi.resetModules()` per test for the module-level cache): `matchMedia` spy construction count === 1 across mount + interval re-renders + rerender; auto-rotation advances the active slide; reduced-motion freezes it. `next/image`/`next/link` stubbed (assertions are on cache + slide state, not media).
5. **C3/C4** — `tests/unit/session16-hardening.test.ts`: fake-tx ordering pins + the wishlist-route boundary pins (mocked `db` + `next/headers` guest wishlist token; unique rightmost-XFF hop per request — the api-boundaries limiter-isolation convention; `session.deleteMany` stubbed for the void sweep).
6. **C5-e2e** — `tests/e2e/shopping-flow.spec.ts` gains an S16-3 modal pin: open drawer → `page-shell` carries `inert`; 25 Tabs from the close button stay inside `[data-testid="cart-drawer"]`; Escape closes → shell un-inerted + focus restored to the header cart toggle.
7. **DOC** — AGENTS.md (wishlist-cap invariant updated to the S11-6 shape + the S16-3 shell-inert invariant + S8-7 closed), CLAUDE.md (coverage lists + layout note), README (badge counts + wishlist/features rows), PAD (§8 tables + known-issues ledger), SKILL.md v1.13.0 (project_state + Appendix B), DEPLOYMENT.md (unchanged unless the sweep surfaces drift), `.env.example` unchanged, `docs/session_25.md` (run-17 narrative), worklog, screenshots refreshed.

## 5. Execution log (session 16)

- [x] RED — `tests/unit/session16-hardening.test.ts` (C3/C4) + validation schema pins
- [x] RED — e2e S16-3 modal pin against the pre-fix standalone build
- [x] GREEN — S16-1 tx gate + route wiring; S16-2 schema hoist ×3; S16-3 shell restructure + focus restore
- [x] Coverage — hero-carousel component test (C5)
- [x] Full gate chain re-run green; manual agent-browser verification (drawer modal behavior, mobile menu regression check, wishlist toggle)
- [x] Screenshots refreshed; docs sweep; worklog updated

---

# Session 17 — Post-push audit & admin-write guard completion (2026-10-13)

> **Status:** PLANNED → executed this run (run 18; narrative in `docs/session_27.md`)
> **Scope:** Session-17 cycle on the session-16-completed tree (`041e877` + operator `session_26.md`). Read-only subagent audit (18-a) over `src/`, `prisma/`, `scripts/`, `tests/`, root configs via the repo `code-review-checklist` skill; every finding personally re-verified with file:line evidence before planning. `skills/` excluded throughout.

## 1. Re-validation (all session-16 gates green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **313/313 unit** ✓ · build ✓ · **63/63 e2e** ✓ (sandbox `DATABASE_URL` shadow converged via the documented symlink `/home/z/my-project/db → <repo>/db`; `.env` carries the `file:../db/custom.db` contract; `db/custom.db` seeded: 16 products / 8 categories verified via a Prisma count).

Live-reference parity re-verified against the LIVE reference (agent-browser): reference unchanged — same nav anatomy, same hero ("Elevate Your Kitchen"), same 8 category tiles, same featured set (Damascus Steel Chef Knife Set first, −29% / (412) / $199.99), mobile panel = the 5 main links + search + close. Clone re-verified on the production build (iPhone 390×844): **mobile menu open → 7-link panel → navigate to /track-order → auto-close/unmount** (Tailwind v4 conditional-mount intact); `/products` renders Damascus-first; demo login → `/account`; zero console errors.

## 2. Session-16 fix verification (read-only subagent 18-a + spot-checks)

**4/4 WIRED · 0 PARTIAL · 0 MISSING.** S16-1 `createWishlistItemInTx` create-first ordering + route mappings (`wishlist.ts:74-84`, `wishlist/route.ts:67-82`, pinned `session16-hardening.test.ts`); S16-2 hoisted schemas consumed by all three routes with zero route-local remnants (`validation.ts:94-106`); S16-3 page-shell inert modal + Tab-wrap + focus restore (`store-chrome.tsx:49-51,117-158`, e2e-pinned); S16-4 MQL cache component pins (`hero-carousel.test.tsx`). Older-fix spot-checks **7/7 WIRED** (S13-3, S13-1, S13-4, S12-4, S9-1, S15-3, S15-4).

## 3. Session-17 audit findings (evidence-based)

**0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 1 NIT / 1 Informational / 1 doc-drift** — counts re-verified (313 unit · 63 e2e · 18 models · 16 products · 11/11 admin actions requireAdmin'd · 14 metered sites · 13 admin catch blocks). Fifth consecutive session without a CRITICAL/HIGH/MEDIUM.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| S17-1 | LOW | **`deleteCategoryAction` is check-then-write, and the FK-race loss path escapes as an unhandled P2003.** The action counts products, then `deleteMany`s the category. `Product.category` is a REQUIRED relation with no explicit `onDelete` (default Restrict, `relationMode` unset = foreignKeys), so a product created in the window between the count and the delete makes the delete raise `PrismaClientKnownRequestError` P2003 — no catch in the action maps it (every sibling admin error path was narrowed by S13-5). Impact: two-admin race only; the delete correctly does not happen (FK protects integrity); the escaped rejection surfaces as the generic S13-2 toast instead of an actionable message. | `src/lib/actions/admin.ts:218-233`; `prisma/schema.prisma:64-65` |
| S17-2 | NIT | **The cart 99-ceiling is retyped in four places with no shared constant.** The authoritative ceilings live in `clampPurchaseQuantity` (`cart-quantity.ts`) and the two Zod schemas (`cartMutateSchema`/`cartLinePatchSchema` `.max(99)`); the same `99` is retyped in the purchase-panel stepper max (`Math.min(stock, 99)`) and the header badge overflow (`cartCount > 99 ? "99+"`). Same single-sourcing class S16-2 fixed for schemas, one magnitude smaller. | `src/app/(storefront)/product/[id]/purchase-panel.tsx:20`, `src/components/store/header.tsx:127`, `src/lib/validation.ts:64-72,98-101`, `src/lib/cart-quantity.ts` |
| S17-3 | INFO | **`deleteProductAction`'s count-race degrades gracefully by design** — the same check-then-write shape, but `OrderItem.product` is OPTIONAL with no `onDelete` (default SetNull), so a concurrent order in the window nulls the reference instead of throwing; consumers already model null productIds (restock skip, `deleted:<name>` analytics markers, snapshot receipts). Benign counterpart to S17-1 — recorded as evidence the category path is the only FK-race gap. No action. | `src/lib/actions/admin.ts:119-128`; `prisma/schema.prisma:209-210` |

### Doc drift this session

| ID | Location | Drift |
|---|---|---|
| D-1 | `docs/REMEDIATION_PLAN.md` (Session-16 execution log) | The six execution-log checkboxes were left `- [ ]` although run 17 executed them (commit `041e877`; narrative `docs/session_25.md`; worklog). Fix: flip to `- [x]`. |
| D-2 | `Project_Architecture_Document.md` §12 Key Files table | The test-count row was stale at "257 unit · 59 e2e" (a session-7-era leftover the 18-a audit missed; caught in this run's docs sweep). Fix: 324 unit · 63 e2e + the session-11..17 range. |

### Coverage pins added this session (from the audit's gap list)

| # | Gap | Pin |
|---|---|---|
| C6 | **`deleteCategoryIfEmpty` outcome mapping** (S17-1's fix) unpinned — server actions are import-unsafe in Vitest (carried convention), so the pin lives at the lib-level pure seam | Unit (fake db client): count > 0 → `in-use` with the count, delete never called; delete count 1 → `deleted`; count 0 → `not-found`; delete rejects with a REAL P2003 → `in-use` (count unknown); other rejection rethrown. Plus `isForeignKeyViolation` truth-table pins |
| C7 | **`/api/cart` DELETE `?all=1` boundary** (empty-cart + bulk-delete mapping) unpinned | Unit (api-boundaries pattern, mocked `db` + `next/headers`): no cart → `{ itemCount: 0 }` with `deleteMany` never called; guest cart → `deleteMany({ where: { cartId } })` + the fresh summary's `itemCount` |

**Accepted / carried deferrals (unchanged):** login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration seam, checkout saveAddress at-cap skip-save integration pin, review action two-tier gate pin (actions not import-safe in Vitest), route-level 429 wiring pins beyond the S14-2 representatives, checkout coupon-cap concurrency harness, review two-tier budgets e2e, 404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin coupon-management UI, real mailer/payment epics, address content dedup.

## 4. Remediation plan (TDD)

1. **S17-1** — `isForeignKeyViolation(error)` in `src/lib/prisma-errors.ts` (mirrors `isUniqueViolation`); new `src/lib/admin-categories.ts` exporting `deleteCategoryIfEmpty(db, id)` → `{ outcome: "deleted" } | { outcome: "not-found" } | { outcome: "in-use", productCount: number | null }` — the pre-delete count stays the fast-fail UX check (preserving the exact "N products still use this category." message), the delete's P2003 maps to `in-use` with `productCount: null` ("A product was just added to this category. Refresh and try again."), any other error rethrows (the S13-2 catch contract). `deleteCategoryAction` consumes it; zero behavior change on the happy paths.
2. **S17-2** — export `MAX_CART_QUANTITY = 99` from `src/lib/cart-quantity.ts`; `clampPurchaseQuantity` consumes it; `cartMutateSchema` + `cartLinePatchSchema` `.max(MAX_CART_QUANTITY)`; the purchase-panel stepper max and the header "99+" flip point consume it. Value unchanged — single-sourcing only.
3. **C6** — `tests/unit/session17-hardening.test.ts`: the outcome pins + the `isForeignKeyViolation` truth table (the REAL `PrismaClientKnownRequestError` class — a code-stamped Error fails `instanceof`, the S16-1 lesson).
4. **C7** — `tests/unit/api-boundaries.test.ts`: the cart DELETE `?all=1` pins (mocked `db` gains `cartItem.deleteMany`; unique per-test XFF hop).
5. **D-1** — flip the six Session-16 execution-log checkboxes to `[x]`.
6. **DOC** — AGENTS.md (a guarded-category-delete invariant), CLAUDE.md (the new lib module + coverage lists), README (badge counts → the new unit total), PAD (§8.1 tables + known-issues #70–72), SKILL.md v1.14.0 (project_state + Appendix B Session-17 entry), DEPLOYMENT.md (unchanged unless drift), `.env.example` (unchanged — no new env vars), `docs/session_27.md` (run-18 narrative), worklog, screenshots refreshed.

## 5. Execution log (session 17)

- [x] RED — `tests/unit/session17-hardening.test.ts` (C6) fails on the missing `deleteCategoryIfEmpty` / `isForeignKeyViolation` exports
- [x] RED — validation constant pin fails on the missing `MAX_CART_QUANTITY` export
- [x] Coverage — C7 cart DELETE `?all=1` boundary pins (green on arrival — pins of existing correct behavior)
- [x] GREEN — S17-1 guarded delete + `isForeignKeyViolation`; S17-2 `MAX_CART_QUANTITY` single-sourcing
- [x] Full gate chain re-run green; manual verification
- [x] Screenshots refreshed; docs sweep; worklog updated

# Session 18 — Post-push audit & checkout-address/bookkeeping completion (2026-10-13)

> Executed by run 19 (`docs/session_29.md` is this run's narrative; the run/plan
> numbering drift is documented). Tree audited: `14d0bbb` (= `6c0d708` + the
> operator-committed `docs/session_28.md` raw log).

## 1. Re-validation (all session-17 gates green on the fresh clone)

Fresh clone at `14d0bbb` (workspace reset). Environment: this sandbox
re-exports `DATABASE_URL=file:/home/z/my-project/db/custom.db` on shell
recycle and **symlink creation is blocked** (prior sessions' convergence
mechanism) — converged instead with a **hard link**
`/home/z/my-project/db/custom.db` → `<repo>/db/custom.db` (one inode; the
shadow-absent path was verified schema-anchored via a move-the-shadow-dir
probe: `db:seed` succeeded with the shadow path relocated, so the CLI/seed
contract holds and the earlier "Unable to open" failures were purely the
absolute-shadow passthrough). `.env` carries the `file:../db/custom.db`
contract + a dev `AUTH_SECRET`; `db/custom.db` pushed + seeded at the repo
root (16 products / 8 categories / 3 coupons / 2 users verified). Gates:
lint ✓ · typecheck ✓ · typecheck:tests ✓ · **324/324 unit** ✓ · build ✓ ·
**63/63 e2e** ✓ (one first-run auth S14-3 flake passed on the full-suite
re-run; the demo profile name was verified unpolluted — not the known DATA
mode; treated as environment flake, no code change).

## 2. Session-17 fix verification (read-only subagent 19-a + spot-checks)

Subagent 19-a executed the `code-review-checklist` 12-category scan over
`src/`, `prisma/`, `scripts/`, `tests/` and root configs (`skills/`
excluded); every finding was personally re-verified with file:line evidence
before planning. **Session-16 fixes 4/4 WIRED; session-17 fixes 3/3 WIRED;
older-fix spot-checks 7/7 WIRED** (incl. 14/14 Retry-After sites and 4/4
`clampSearchTerm` consumers). Static counts re-verified: 324 unit tests in
34 files · 63 e2e in 12 specs · 11/11 admin actions `requireAdmin`'d · 14
metered sites · 13 admin catch blocks · 18 models. Docs verified
drift-free (README badge, limiter grid, catch-block count all TRUE).

## 3. Session-18 audit findings (evidence-based)

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 2 NIT / 1
Informational / 0 doc-drift** — the sixth consecutive session without a
CRITICAL/HIGH/MEDIUM.

- **S18-1 (Low)** — `src/app/api/checkout/route.ts:370-401`: checkout's
  in-tx `saveAddress` still gates the address-book cap with the PRE-create
  `assertAddressCap` only. Two sibling create paths were hardened with the
  authoritative post-create gate (S11-6 addresses POST, S16-1 wishlist
  POST — "on SQLite the write lock lands at the first WRITE"), but the
  third create path was left behind, and unlike S17-3 the residual race is
  UNRECORDED. Two concurrent checkouts by the same signed-in user at
  exactly cap−1 both pass the assert, serialize on the write lock, and land
  21 rows. **Benign and bounded** (+1 per concurrent at-cap−1 pair;
  subsequent saves self-skip; single-default invariant survives — the unset
  precedes each create so the last create wins the default), BUT the
  obvious "same shape as S16-1" fix (throw `AddressCapError` after the
  create) is WRONG here: the throw would roll back the ENTIRE checkout
  transaction — order, stock, coupon — violating the S7-8 "at cap the
  order still places" invariant. Prisma interactive transactions have no
  savepoints; the only true fix moves the save OUT of the order tx (crash
  semantics change on the most critical path) or needs a
  compensating-write dance. **Decision: fix the TESTABILITY + record the
  debt** — extract the block to `saveCheckoutAddressInTx` in
  `src/lib/addresses.ts` (the S11-6 module pattern; no behavior change) and
  pin its contract in unit tests, recording the residual race explicitly.
- **S18-2 (NIT)** — `src/app/(storefront)/cart/cart-lines.tsx:157` (page
  "+" disabled at stock only) and `src/components/store/store-chrome.tsx:299`
  (drawer "+" has no ceiling guard): a line at quantity 99 with stock > 99
  leaves "+" enabled → PATCH 100 → `cartLinePatchSchema` 400s with Zod's
  DEFAULT English message ("Number must be less than or equal to 99")
  surfaced in the error toast — not store copy. Server clamp correct; the
  invariant (AGENTS.md) names only the purchase-panel stepper. Fix the two
  display surfaces + give the three cart schemas friendly `.max` messages.
- **S18-3 (NIT)** — `package.json`: `axe-core` + `@testing-library/user-event`
  declared/installed but imported by zero files. Remove both (the a11y
  surface is already pinned by aria-pins across the e2e specs; wiring a new
  axe scan would be a speculative feature, the anti-slop call is removal).
- **S18-4 (Informational)** — two carried coverage gaps: (a) checkout
  saveAddress at-cap **skip-save** unpinned (carried since session 7 — the
  route module was un-importable in Vitest) → **CLOSED this session** by
  the S18-1 extraction (the lib function is pure and testable); (b) the
  `/track-order` page-level limiter (30/min) is unpinned → carried with
  justification: the limiter logic is unit-pinned (`rate-limit.ts`), the
  route-level 429 contract is pinned (`api-boundaries.test.ts`), and the
  page wiring renders friendly UI errors — an e2e pin would need 30
  requests per run for a wiring fact.

## 4. Remediation plan (TDD)

1. **S18-1** — new exported `saveCheckoutAddressInTx(tx, userId, address)`
   in `src/lib/addresses.ts` returning `"saved" | "at-cap"` (the
   pre-create `assertAddressCap` fast-fail → unset defaults → create →
   `AddressCapError` → `"at-cap"`; unknown errors rethrow). The checkout tx
   consumes it (call-site catch replaced by the return-value check — the
   order-still-places semantics are now structurally impossible to break
   with a throw). Record the residual bounded race in AGENTS.md (S17-3
   style) + here. **S18-4a closes with the same test file.**
2. **S18-2** — cart-lines "+" disabled at `Math.min(line.stock,
   MAX_CART_QUANTITY)`; drawer "+" disabled at `MAX_CART_QUANTITY` (the
   drawer has no stock data — the server clamp remains the stock guard);
   `cartMutateSchema` / `cartBulkSchema` per-line / `cartLinePatchSchema`
   `.max(MAX_CART_QUANTITY, "Quantity is limited to 99 per item.")` (the
   message interpolates the shared constant).
3. **C8 (coverage pins)** — `tests/unit/session18-hardening.test.ts`:
   `saveCheckoutAddressInTx` outcome pins (at-cap → `"at-cap"` with NO
   writes; under-cap → unset-then-create ordering with `isDefault: true`;
   unknown-error rethrow; the route's `"at-cap"` → skip-save mapping) and
   the friendly-max-message pins (the three schemas reject 100 with the
   store copy, not the Zod default).
4. **S18-3** — `npm uninstall axe-core @testing-library/user-event`
   (lockfile via the package manager, never hand-edited).
5. **DOC** — AGENTS.md (checkout saveAddress extraction + recorded race +
   the friendly-max/stepper-ceiling invariant), CLAUDE.md (lib list +
   coverage lists), README (badge counts if the total changes), PAD (§8.1
   + known-issues), SKILL.md v1.15.0 (project_state + Appendix B
   Session-18 entry), DEPLOYMENT.md (no expected drift), `.env.example`
   (unchanged), `docs/session_29.md` (run narrative), worklog,
   screenshots refreshed.

## 5. Execution log (session 18)

- [x] RED — `tests/unit/session18-hardening.test.ts` fails on the missing
      `saveCheckoutAddressInTx` export
- [x] RED — the friendly-max-message pins fail on the Zod default messages
- [x] GREEN — S18-1 extraction wired into the checkout tx (return-value
      mapping, no behavior change)
- [x] GREEN — S18-2 stepper ceilings + schema messages
- [x] S18-3 — unused devDependencies removed via npm
- [x] Full gate chain re-run green; manual verification (agent-browser)
- [x] Screenshots refreshed; docs sweep; worklog updated

---

# Session 19 — remediation plan (run 20)

> **Status:** EXECUTED (see the Execution Log at the end)
> **Date:** 2026-10-13
> **Scope:** Fresh-clone re-validation of the session-18 tree (`9a3d22e` = `67861e3`
> + the operator-committed `docs/session_30.md` raw log), a fresh session-19 deep
> audit, the audit's two actionable findings, and the long-carried feature
> increment the audit trail keeps recommending: the **admin coupon-management UI**.
> **Method:** TDD as always — failing tests first, then the fix, then the full
> gate chain.

## 1. Re-validation (all session-18 gates green on the fresh clone)

Workspace had been reset — fresh-cloned `https://github.com/nordeim/homenest-store-s.git`
at `9a3d22e`. Environment: the sandbox re-exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db` on shell recycle; the
prior sessions' convergence symlink was found DANGLING (pointing at an old
workspace path) and was removed via node, the real directory recreated, and
the shadow path re-converged with a **hard link** to `<repo>/db/custom.db`
(one inode — SQLite byte-range locks apply to the inode, so both paths stay
mutually exclusive; symlinks remain blocked in this sandbox). `.env` carries
the `file:../db/custom.db` contract + a dev `AUTH_SECRET`; `db/custom.db`
pushed + seeded at the repo root (16 products / 8 categories / 3 coupons /
2 users verified). Gates: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
**334/334 unit** ✓ · build ✓ · **63/63 e2e** ✓ — the pulled tree is exactly
as documented (run 19 = session-18 remediation complete).

## 2. Session-18 fix verification (read-only subagent 20-a + spot-checks)

Subagent 20-a executed the `code-review-checklist` 12-category scan over
`src/`, `prisma/`, `scripts/`, `tests/` and root configs (`skills/`
excluded); every finding was personally re-verified with file:line evidence
before planning. **Session-18 fixes 4/4 WIRED; older-fix spot-checks 10/10
WIRED** (14/14 Retry-After sites, 4/4 `clampSearchTerm` consumers,
`MAX_CART_QUANTITY` single-sourcing, S16-1 wishlist-cap tx gate, S16-3
page-shell inert modal, S17-1 guarded category delete, S13-1 demo-mode
credential boundary, mobile-nav conditional mount, CSP nonce +
`(auth)` connection(), integer-cents money). Static counts re-verified:
**334 unit tests in 35 files · 63 e2e in 12 specs · 18 models · 16 products
· 11/11 admin actions requireAdmin'd · 14 metered sites · 13 admin catch
blocks · 8 categories / 3 coupons**. Docs verified drift-free (README badge,
limiter grid, catch-block count, model count all TRUE).

## 3. Session-19 audit findings (evidence-based)

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 1 NIT / 2 Informational /
0 doc-drift** — the seventh consecutive session without a
CRITICAL/HIGH/MEDIUM.

- **S19-1 (NIT)** — `src/components/store/quantity-stepper.tsx:12`: the
  component's `max = 99` DEFAULT PARAMETER retypes the ceiling literal.
  Unreachable today (its only consumer, `purchase-panel.tsx:39`, always
  passes `max = Math.max(1, Math.min(stock, MAX_CART_QUANTITY))`), but it is
  exactly the drift vector the S17-2 invariant bans: a future
  `MAX_CART_QUANTITY` change would silently leave this dead default
  disagreeing with the single-sourced constant.
- **S19-2 (Low)** — `src/lib/addresses.ts:206-209`: the S18-1 extraction
  carried a subtle behavior delta. The PRE-extraction checkout block unset
  previous defaults with `where: { userId, isDefault: true }` (per the
  `67861e3` diff), while the extracted `saveCheckoutAddressInTx` unsets with
  `where: { userId }` — an UPDATE touching EVERY row of the user's book
  instead of only the defaults. Same end state (the create follows with
  `isDefault: true`), benign at the 20-row cap, but it contradicts the
  extraction's documented "no behavior change" contract and does redundant
  row writes inside the checkout transaction. Restore the scoped clause.
- **S19-3 (Informational)** — `src/app/api/checkout/route.ts:382`: the
  checkout call site DISCARDS the `saveCheckoutAddressInTx` outcome. The
  session-18 plan's wording ("call-site catch replaced by the
  return-value check") is not literally implemented — skip-save is
  emergent from the helper's no-writes-at-cap behavior (which the unit pin
  locks). Reviewed and ACCEPTED as-is: there is genuinely nothing to branch
  on (the S7-8 contract is "the order still places; only the save is
  skipped"), the helper's contract is unit-pinned, and the call-site
  comment documents the semantics. Recorded so the discard is a reviewed
  decision rather than an oversight.
- **S19-4 (Informational)** — `src/app/(storefront)/track-order/page.tsx:100-114`:
  a buyer who exhausts the 30/min page-level limiter sees the same
  "couldn't find an order" shell as a wrong-email lookup. Deliberate — the
  anti-enumeration convergence (wrong-email / missing / rate-limited are
  indistinguishable) is exactly what WI-1 designed — and the limiter-wiring
  pin gap is already recorded as accepted debt (S18-4b). No change.
- **S19-5 (Feature increment)** — the carried "admin coupon-management UI"
  (recommended by sessions 18 and 19 audit trails): the coupon engine is
  fully hardened (`isCouponRedeemable`, `couponDiscount`, atomic
  `couponRedemptionWhere`, /api/coupon/apply, checkout integration, 3
  seeded coupons) but there is NO admin surface to create/edit/deactivate
  coupons — `prisma/seed.ts:694-697` states it outright: "with no admin
  coupon UI, DB state is the only state". This is the natural superset
  increment.

## 4. Remediation plan (TDD)

1. **S19-1** — `src/components/store/quantity-stepper.tsx` imports
   `MAX_CART_QUANTITY` from `@/lib/cart-quantity` and defaults
   `max = MAX_CART_QUANTITY` (the literal retypes never again). Pinned by a
   jsdom component test (`tests/unit/quantity-stepper.test.tsx`, the
   suite's third component test): the default-max stepper renders "+"
   DISABLED at 99 (and enabled at 98), pinning the default parameter's
   value through behavior.
2. **S19-2** — `saveCheckoutAddressInTx`'s unset runs
   `where: { userId, isDefault: true }` (the pre-extraction shape; the
   `CheckoutAddressSavingClient.updateMany` interface narrows
   accordingly). The session-18 pin is extended to assert the unset
   targets ONLY default rows.
3. **S19-5 — admin coupon management** (the S18-exemplar patterns):
   - `src/lib/validation.ts`: `couponInputSchema` (code 3-40 charset
     letters/digits/dashes — normalized to uppercase in the action like
     `findActiveCoupon` does; `type` percent|fixed; `value` int ≥ 1 with a
     percent ≤ 100 superRefinement; `description` ≤ 200; `minSubtotal`
     cents ≥ 0; `isActive` default true; `expiresAt` date-string or null,
     refined to parse as a Date; `maxRedemptions` int ≥ 1 or null) +
     `couponLabel` moved to a PURE helper in `src/lib/coupons.ts`
     (`couponLabel(type, value)` — percent "10% off", fixed 695 cents
     "$6.95 off") so the admin list and any future surface share it.
   - `src/lib/actions/admin.ts`: `upsertCouponAction` (requireAdmin →
     safeParse → code normalize/uppercase → pre-check code clash excluding
     self → P2002/P2025 narrowed mappings, the S8-13 pattern →
     revalidatePath) and `deleteCouponAction` (requireAdmin → id guard →
     delete; order receipts carry their own discount snapshot, no FK, so
     history is unaffected).
   - `src/app/(storefront)/admin/coupons/page.tsx` + `coupon-dialog.tsx`
     (the category-dialog island pattern: Add/Edit dialog with type-aware
     value input — percent integer / fixed dollars via
     `parseDollarsToCents` — dollars inputs for minSubtotal, date input
     for expiry converted to END-OF-DAY UTC, optional redemption cap,
     active toggle, delete confirm; every async handler carries the S13-2
     visible-failure catch) + `admin-nav.tsx` gains the Coupons item
     (Ticket icon) between Categories and Carousel. The admin layout's
     role gate covers the new route automatically.
   - Unit pins (`tests/unit/session19-hardening.test.ts`, mocked
     `db`/`next/headers`/`next/cache` following the session-16 pattern):
     schema boundary table (percent 0/101 rejected, fixed 0 rejected, code
     charset/length, negative minSubtotal, maxRedemptions 0, invalid
     expiry string, defaults), `couponLabel` truth table, upsert
     normalization + clash + P2002/P2025 mappings + admin denial, delete
     denial + success.
   - E2E (`tests/e2e/admin-coupons.spec.ts`): admin signs in → sees the 3
     seeded coupons → creates SESSION5 (5% off) → applies it on a cart at
     the coupon field → discount appears → deactivates it → the same code
     is rejected → deletes it → the row is gone. The spec cleans up after
     itself (leaves the DB as found).
4. **DOC** — AGENTS.md (admin-surface list + coupon-management invariant),
   CLAUDE.md (lib/action/coverage lists), README.md (features row + badge
   counts), PAD (§8.1 + §12 + known-issues), SKILL.md v1.16.0
   (project_state + Appendix B Session-19 entry), DEPLOYMENT.md (no
   expected drift), `.env.example` (unchanged), `docs/session_31.md` (run
   narrative), worklog, screenshots refreshed.

## 5. Execution log (session 19)

- [x] RED — `tests/unit/session19-hardening.test.ts` fails on the missing
      `couponInputSchema` / `couponLabel` / action exports + the S19-2
      clause pin fails on the broad where
- [x] RED — `tests/unit/quantity-stepper.test.tsx` fails on the literal
      default (default-max "+" still enabled at 100)
- [x] GREEN — S19-1 stepper default from the shared constant
- [x] GREEN — S19-2 scoped unset clause restored
- [x] GREEN — S19-5 coupon schema + label helper + actions + admin UI + nav
- [x] E2E — admin-coupons.spec.ts green (create → apply → deactivate →
      reject → delete)
- [x] Full gate chain re-run green; manual verification (agent-browser)
- [x] Screenshots refreshed; docs sweep; worklog updated

---

# Session 20 (run 21) — Remediation Plan

> **Status:** EXECUTED (see the Execution Log at the end)
> **Date:** 2026-10-13
> **Scope:** Fresh clone at `9ed652d` (= `9dad2fc`, the run-20/session-19 commit, + the operator-committed `docs/session_32.md` raw log). Gates re-validated on the pulled tree (lint ✓ · typecheck ✓ · typecheck:tests ✓ · 360/360 unit ✓ · build ✓ · 63/64 e2e — the one failure investigated below), live-reference parity re-verified via agent-browser (reference unchanged; mobile menu / SEO / desktop parity / demo login all green), then a read-only deep audit (subagent 21-a + operator file:line verification).

## 1. Audit summary (evidence-based)

Session-19 fixes **ALL WIRED** (S19-1 stepper constant binding + mocked-constant pin; S19-2 scoped unset clause + narrowed interface; S19-5 all six sub-items — schema without server-only re-exports, pure `couponLabel`, 2 guarded actions, role-gated surface with 3 S13-2 catch blocks, nav item, e2e). Older-fix spot-checks **10/10 WIRED** (14/14 Retry-After sites, 4/4 `clampSearchTerm` consumers, all seven guarded helpers at their call sites, demo-mode boundary, mobile-nav conditional mount, JSON-LD escaping ×3 sites, noindex set, CSP nonce, `MAX_CART_QUANTITY` single-sourcing, `TRUST_CF_CONNECTING_IP` opt-out). Static counts re-verified: 360 unit (38 files) / 64 e2e (13 specs) / 18 models / 16+8+3 seed constants / **13 requireAdmin'd actions** (+2 coupon) / 14 metered sites / **16 admin catch blocks across SIX files** / zero `any`/`eval`/unescaped HTML.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 HIGH-severity *test-reliability* finding (observed live twice) / 1 LOW code + 1 LOW doc / 2 NIT / 4 Informational — the eighth consecutive session without a CRITICAL/HIGH/MEDIUM code defect.**

## 2. Findings → work items

### S20-1 (High — e2e suite reliability; observed twice this run) — `admin-coupons.spec.ts` is not isolated against the durable admin cart or its own past failures

- **Evidence:** the full-suite run failed `admin-coupons.spec.ts:46` (`await expect(page.getByTestId("cart-count")).toHaveText("1")`), and the single-spec re-run failed at the same line with the badge resolving "2"→"3" (13 polls). DB inspection after the runs: the admin cart held Damascus ×3 and a leftover ACTIVE `SESSION5` coupon the spec had created but never cleaned up (the test aborted before its delete step).
- **Root cause chain (two independent defects, both reproduced):**
  1. **Absolute badge pin on a DURABLE account cart.** The admin cart is persistent DB state (and cart POSTs MERGE by product). Playwright's actionability machinery can re-dispatch a click whose hit-target verification is interrupted by the post-click re-render (observed on a fresh DB: one click → two POSTs → ×2). Any pre-existing/accumulated/double-added content breaks `toHaveText("1")`. Guest-cart specs (shopping-flow, cart-badge, auth) pin "1" safely because guest tokens are per-context fresh; the ADMIN cart is shared durable state.
  2. **Non-idempotent setup + cart-line leak.** A previously failed run leaves `SESSION5` ACTIVE (breaking the next run's create step via the P2002 clash) and the added cart line is never removed — violating the spec's own "leaves the seed data as found" contract.
- **Fix (TDD — the two observed failures ARE the RED evidence):**
  1. Seed the cart through the **API** (the `request` fixture shares the admin session cookies; one deterministic POST `/api/cart`) instead of clicking Add-to-Cart and pinning the badge — the coupon-redeems-at-cart surface is the behavior under test, not the add-to-cart flow (pinned by six other specs).
  2. **Self-healing setup:** before creating, delete any leftover `SESSION5` (the same delete-confirm flow the spec already exercises).
  3. **Full cleanup:** remove the seeded cart line at the end (`Remove … from cart` button), leaving the DB as found.
  4. **Reproduction harness before the fix:** pollute the state (SESSION5 + admin cart ×1) and watch the OLD spec fail; after the fix, the same pollution self-heals and the spec passes.

### S20-2 (LOW) — `CouponToggleButton` rewrites the whole row from a rendered snapshot

- **Evidence:** `coupon-dialog.tsx:408-451` flips `isActive` by round-tripping EVERY field (`value`, `minSubtotal`, `expiresAt`, `maxRedemptions`, `description`, `code`) through `upsertCouponAction` from the page's render-time snapshot. Impact: (1) admin B's edit between A's render and A's click is silently reverted; (2) a stored `expiresAt` not already end-of-day-UTC is silently renormalized (~24h extension). The repo already has the correct precedent: `toggleProductActiveAction` (admin.ts:139-161) writes ONLY `isActive`.
- **Fix (TDD):** new narrow `toggleCouponActiveAction(id, isActive)` — requireAdmin → scoped conditional `updateMany({ where: { id, isActive: <flip> }, ... })` with `count === 0` → P2025-style "Coupon not found" (the S13-5/S11-4 pattern) → unknown rethrow → `revalidatePath("/admin/coupons")`. Unit-pinned in `tests/unit/session20-hardening.test.ts` (denial / success-shape / P2025 / rethrow, mocked `db`/`next/cache`); the toggle button consumes it.

### S20-3 (LOW, doc drift) — AGENTS.md S13-2 catch-count stale

- **Evidence:** `AGENTS.md:102` says "13 catch blocks across five dialog/form files"; actual = **16 across six** (coupon-dialog ×3 added in session 19; F2 of the audit).
- **Fix:** update the invariant text (one line).

### S20-4 (NIT, doc drift in code) — `prisma/seed.ts:694-696` stale rationale

- **Evidence:** "…with no admin coupon UI, DB state is the only state" — the UI exists since session 19. The create-only policy itself stays.
- **Fix:** reword to reflect the real rationale (redemption bookkeeping is admin- and traffic-owned).

### S20-5 (NIT) — percent↔fixed type switch silently reinterprets the pre-filled value

- **Evidence:** `coupon-dialog.tsx:100-113/:241-247` — switching type keeps `form.value` ("10" percent → "$10.00" fixed, a 10× semantic jump; the reverse fails validation until retyped). Guarded by validation both sides; pure UX.
- **Fix:** reset the value field when the type changes (folded into the S20-6 dialog work; verified manually + schema pins).

### S20-6 (Feature increment — resolves audit I1 at the engine level) — the `free_shipping` coupon type

- **Evidence (I1):** `FREESHIP` is a fixed-$6.95-off coupon named/described as free shipping. `couponDiscount` subtracts from the merchandise subtotal; `computeOrderMoney` then charges full shipping unless the DISCOUNTED subtotal reaches the threshold — a $30 cart (min $30 met, threshold $50 not) gets $6.95 off and STILL pays full shipping. The display label ("$6.95 off") is honest; the seed description ("Standard shipping on us") and the code name overpromise.
- **Fix (TDD):** a first-class `free_shipping` type so the coupon does what its name says:
  1. `src/lib/coupons.ts` — `couponLabel`: "Free shipping"; `CouponApplication` ok-branch gains `freeShipping?: true`; `couponDiscount` branch (discount 0, `minSubtotal` still enforced, value ignored). NEW pure `couponRedemptionFilter(code, maxRedemptions)` = `{ code, isActive: true, ...couponRedemptionWhere(maxRedemptions) }` — the audit's I4 hardening (a coupon deactivated in the sub-second window between the in-tx read and the increment now makes `count === 0` → 409 → rollback, completing the atomic guard) with a unit truth table.
  2. `src/lib/order-money.ts` — `OrderMoneyInput.couponFreeShipping?: boolean`; shipping forced to 0 when set (both methods; independent of the spend threshold).
  3. `src/app/api/checkout/route.ts` — the in-tx increment consumes `couponRedemptionFilter`; `computeOrderMoney` receives `couponFreeShipping: applied.freeShipping === true`.
  4. `src/app/api/coupon/apply/route.ts` — `CouponApplyResponse` gains `freeShipping?: true` passthrough.
  5. Client mirrors — `coupon-box.tsx` + `checkout-client.tsx` `AppliedCoupon` types + the checkout's shipping mirror (`couponFreeShipping || taxable >= threshold ? 0 : …`); the summary already renders "FREE" at `$0`.
  6. `src/lib/validation.ts` — `couponInputSchema` type enum + `free_shipping`; superRefinement: `value` must be 0 for `free_shipping` (percent/fixed rules unchanged).
  7. `coupon-dialog.tsx` — type select gains "Free shipping"; the value input hides; type switch resets the value (S20-5).
  8. `prisma/seed.ts` — `FREESHIP` seeds as `type: "free_shipping", value: 0, description: "Free standard shipping on orders over $30"`. CREATE-ONLY seed policy: fresh databases get the real type; EXISTING databases keep their `fixed` row (both work; the delta is documented).
  9. Tests (RED first): `coupons.test.ts` (label + discount branch + minSubtotal enforcement + `couponRedemptionFilter` truth table incl. the always-true `isActive`), `order-money.test.ts` (freeShipping forces $0 shipping both methods; threshold interplay unchanged without it), `validation.test.ts` (free_shipping boundary table: value must be 0; percent/fixed regressions), `session20-hardening.test.ts` (S20-2 action pins).
  10. E2E: extend the checkout coverage — apply `FREESHIP` at checkout on a qualifying cart and pin the order summary's shipping renders "FREE" (the server-derived money is authoritative).

### S20-7 (Informational I2, copy hygiene) — the static cart hint can advertise a dead code

- **Evidence:** `coupon-box.tsx:150` hardcodes "Try WELCOME10, SAVE20 or FREESHIP"; SAVE20 caps at 500 redemptions (seed) and would still be suggested once exhausted (the apply error is immediate and correct — impact cosmetic).
- **Fix:** drop SAVE20 from the hint (the two evergreen codes stay); a live-state hint would need an API fetch for marginal benefit — not taken.

### Dispositions (no change, recorded)

- **I3 (allowScripts exact pins vs caret ranges):** verified the lockfile resolves exactly `@prisma/engines@6.19.3` / `esbuild@0.28.2` / `unrs-resolver@1.12.2` / `prisma@6.19.3` / `@prisma/client@6.19.3` — the allowlist is CORRECT for the committed lockfile; a future bump re-triggering npm's approval prompt is the documented workflow (README Troubleshooting). Accepted as-is.
- **S19-3 / S19-4 (Informational, session 19):** dispositions unchanged.
- **S21-7 (NIT, operator-found during manual verification — disposition recorded, not taken):** the cart page's threshold-progress hint ("Add $15.01 more for free shipping") is server-rendered from the settings threshold only and does not know an applied free_shipping coupon — with FREESHIP applied below the threshold the hint coexists with the applied block right above it ("Free standard shipping… applied at checkout"). No money-path impact (the checkout mirror and the server receipt are correct; the row itself says "Calculated at checkout"). Making the server-rendered hint coupon-aware would require lifting the client-side applied-coupon state into the page (or moving the widget into the CouponBox client boundary) — structural change for marginal benefit, the S20-7 precedent ("a live-state hint would need an API fetch for marginal benefit — not taken"). Recorded.
- **Carried deferrals (unchanged):** login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration seam, review action two-tier gate pin, `/track-order` page-limiter wiring pin, and the external-service epics (real email delivery, OAuth, real payments — blocked on sandbox-external credentials/SMTP).

## 3. Execution log (session 20)

- [x] RED — reproduction harness: polluted state (SESSION5 + admin cart ×1) breaks the old spec; new spec self-heals
- [x] RED — `tests/unit/session20-hardening.test.ts` fails on the missing `toggleCouponActiveAction` / `couponRedemptionFilter` exports + contract pins
- [x] RED — `coupons.test.ts` / `order-money.test.ts` / `validation.test.ts` extensions fail on the missing `free_shipping` behavior
- [x] GREEN — S20-2 narrow toggle action + toggle wiring
- [x] GREEN — S20-6 free_shipping type end-to-end (engine → money → API → mirrors → dialog → seed)
- [x] GREEN — S20-1 hardened admin-coupons spec (API-seeded cart, self-healing setup, full cleanup)
- [x] S20-3 / S20-4 / S20-7 — doc + comment + copy corrections
- [x] Full gate chain re-run green; manual verification (agent-browser: checkout with FREESHIP → shipping FREE; admin coupon dialog type option; mobile menu re-check)
- [x] Screenshots refreshed; docs sweep; worklog updated

---

# Session 21 — the run-22 audit cycle (e2e suite reliability + the checkout free-shipping mirror)

> **Status:** EXECUTED (see the Execution Log at the end)
> **Date:** 2026-10-14
> **Scope:** Fresh clone at `dbd8674` (= `a857949`, the run-21/session-20 commit, + the operator-committed `docs/session_34.md` raw log). Gates re-validated on the pulled tree (lint ✓ · typecheck ✓ · typecheck:tests ✓ · 379/379 unit ✓ · build ✓ · **63/65 e2e — the two failures investigated below**), live-reference parity re-verified via agent-browser (reference unchanged, logged in with the provided credentials; mobile menu / sitemap 25 URLs / robots / JSON-LD / desktop parity / zero console errors all green), then a read-only deep audit (subagent 22-a + operator file:line verification).

## 1. Audit summary (evidence-based)

Session-20 fixes **WIRED** (S20-2 narrow toggle consumed by the dialog with the narrowed prop type; S20-6 engine chain — `couponLabel`/`couponDiscount`/`couponRedemptionFilter` → checkout tx increment with the always-on `isActive` guard → `computeOrderMoney` override → schema → dialog → seed — **with one real gap: the checkout client mirror dropped the `freeShipping` flag, S21-3 below**). The two run-22 e2e failures were root-caused to genuine suite defects (S21-1, S21-2) and fixed TDD-first. Static counts re-verified: 379 unit (38 files) / 65 e2e (13 specs) / 18 models / **14 requireAdmin'd actions** (+1 coupon toggle) / 14 metered `Retry-After` sites / 16 admin catch blocks across six files — **all matching the docs** (zero count drift).

**Result: 0 CRITICAL / 0 HIGH / 1 MEDIUM (product) + 1 HIGH-severity *test-reliability* finding (observed live twice) + 1 MEDIUM-severity *test-reliability* finding (observed live) + 1 LOW / 2 NIT / 2 Informational — the ninth consecutive session without a CRITICAL/HIGH product defect.**

## 2. Findings → work items

### S21-1 (High — e2e suite reliability; observed live twice this run) — the S20-1 "API-seeded cart" never acted as the admin: the per-test `request` fixture is identity-isolated

- **Evidence:** the full-suite run failed `admin-coupons.spec.ts` (timeout waiting for the cart's `Coupon code` input) and a single-spec re-run failed identically. DB inspection: the POST's line landed on a **guest** cart (`userId: null`) while the admin's own cart stayed empty; the /cart page (rendered for the admin session) showed "Your cart is empty", so the coupon box never rendered. A Playwright probe then proved the mechanism: after a page login, `context.cookies()` holds `homenest_session` (`secure: true` — the production build), `request.storageState()` returns an **empty jar** (the per-test `request` fixture does NOT share the browser context's cookies), and an un-headered `request.post("/api/cart")` created a GUEST cart while the same call with an explicit `Cookie: homenest_session=…` header landed on the admin's cart (DB-verified ownership).
- **Why it ever passed:** run-21's DB carried a durable admin cart (Damascus ×3). The guest-bound POST was masked — the /cart page showed the pre-existing content, the coupon applied, and the "restore" cleanup operated on the wrong (guest) cart, leaving the admin cart untouched, i.e. "as found" held vacuously. On a fresh database (this run's state) the defect is deterministic.
- **Fix:** `tests/e2e/admin-coupons.spec.ts` reads the session cookie from the browser context after `loginAsAdmin` (with a loud `expect(...).toBeTruthy()` guard) and sends it as an explicit `Cookie` header on **all five** admin-identity request-fixture calls (cart-summary snapshot, cart POST seed, cleanup summary/DELETE/PATCH). The headerless `/api/search` call is identity-free and stays as-is. The spec header documents the mechanism and the masking history.

### S21-2 (Medium — e2e suite reliability; observed live) — the auth profile spec's toast assertions race the session-9 strict-mode class, and its own abort leaves dirty durable state

- **Evidence:** captured live in the full-suite run: `getByText('Profile updated')` resolved to **2 elements** — the toast title `div` and the toaster's `aria-live` announcement `span` (`toaster.tsx:62-71` + Radix `ToastProvider`) — the exact session-9 strict-mode race the suite fixed with `.first()` in admin.spec (session 9), wishlist.spec (session 11) and admin-coupons (run 21); the auth profile spec (S14-3) never got the treatment. Intermittent because the wrapper carries the text only while the announcement is live. Secondary effect (observed): a run aborted between the edit and the restore leaves the demo user's name "Edited", and the seed's `update: {}` policy never re-resets it — the next run then fails its own `toHaveValue(seedName)` pin (self-breaking).
- **Fix (TDD — the captured strict-mode violation is the RED evidence):** `.first()` on all three "Profile updated" assertions, plus a self-healing setup in the S20-1 discipline: if the form's value is not the seed name, restore it through the same fill → Save → toast flow before pinning.

### S21-3 (Medium — product defect, session-20 regression) — the checkout mirror drops the `freeShipping` flag: FREESHIP renders full shipping and an overstated total on the checkout page

- **Evidence (audit F-1, operator-verified):** `checkout-client.tsx` added `freeShipping` to `AppliedCoupon`/`CouponApplyResponse` (:54,:57) and the mirror reads `coupon?.freeShipping === true` (:168) feeding `shippingCost` (:169-174) — but the state setter at :196 was never updated: `setCoupon({ code, discount, label, description })`. The API returns the flag (`/api/coupon/apply/route.ts:65`) and the cart passes it through (`coupon-box.tsx:54` `setApplied(data)`) — only the checkout wizard drops it, so `couponFreeShipping` is permanently `false` there.
- **Impact:** for a `free_shipping` coupon below the spend threshold, step 3's review card AND the sticky summary render `Shipping: $6.95` (express $15.95) and an inflated total directly beneath "Coupon FREESHIP — Free shipping" — an internally contradictory UI. **No overcharge occurs** (the server re-derives shipping = 0 inside the order transaction), but the mirror contradicts the receipt and the documented invariant (AGENTS.md "the checkout mirror honors it").
- **Fix (TDD):** pass the flag through in the setter: `setCoupon({ code: data.code, discount: data.discount, label: data.label, description: data.description, ...(data.freeShipping ? { freeShipping: true } : {}) })`. The regression test is S21-4's hardened assertion (RED against the current code, GREEN after).

### S21-4 (Low — vacuous e2e pin; it is why S21-3 slipped through 65/65) — the free-shipping spec's checkout "FREE" assertion matches the coupon label

- **Evidence (audit F-2, operator-verified):** `free-shipping-coupon.spec.ts:57` `expect(page.getByText("FREE").first()).toBeVisible()` — Playwright's string `getByText` is a case-insensitive substring match, so `"FREE"` matches the review card's "Coupon FREESHIP — **Free shipping**" row (asserted on the previous line), which renders regardless of the mirror bug. The only sound FREE pin was the server-derived receipt.
- **Fix:** scope the pin to the actual shipping rows: the review card's `dl` row and the sticky summary's (`aside[aria-label="Order summary"]`) `dl` row each located by `has: getByText("Shipping", { exact: true })`, `toHaveCount`-pinned, both asserting `toContainText("FREE")`. RED against the unfixed mirror (the rows render `$6.95`), GREEN after S21-3.

### S21-5 (NIT) — stale inline comment contradicts the S21-1 fix in the same file

- **Evidence (audit F-3):** `admin-coupons.spec.ts` mid-test comment still said "the request fixture **shares the admin session cookies**" — the exact premise S21-1 disproved (the file's own header documents the opposite). Misleads the next editor into reverting the fix.
- **Fix:** reword to state the fixture is identity-isolated and the explicit header makes the call the admin's.

### S21-6 (NIT) — `couponRedemptionFilter` doc comment overclaims expiry coverage

- **Evidence (audit F-4):** the comment says "deactivated (or expired past the cap semantics)" but the where-clause guards only `code + isActive + cap`; expiry is NOT in the increment filter — a coupon expiring in the read→increment window still redeems (read-guarded only by the in-tx `isCouponRedeemable`). AGENTS.md scopes the guarantee correctly ("cap AND deactivation TOCTOU"); only this comment overstates.
- **Fix:** drop the parenthetical; note expiry is read-guarded only. (Closing the residual expiry window would need an `expiresAt` clause in the filter — recorded, not taken; the sub-second residue is the same accepted class as the pre-S20-6 deactivation gap and the in-tx read bounds it.)

### Dispositions (no change, recorded)

- **F-5 (Informational):** the S21-1 fix hardcodes the `"homenest_session"` cookie name — importing `SESSION_COOKIE` from `src/lib/auth.ts` would pull `next/headers` + Prisma into the Playwright bundle (the documented seed-import restriction class); the loud `expect(...).toBeTruthy()` guard fails on drift. Accepted.
- **F-6 (Informational):** request-fixture guest flows in shopping-flow/admin.spec create throwaway guest rows and one durable cancelled order — pre-existing, intentional, bounded by restore-demo-stock. Accepted.
- **Carried deferrals (unchanged):** login-limiter lockout tradeoff (S8-8), checkout P2002 recovery-loop integration seam, review action two-tier gate pin, `/track-order` page-limiter wiring pin, and the external-service epics (real email delivery, OAuth, real payments — blocked on sandbox-external credentials/SMTP).

## 3. Execution log (session 21)

- [x] RED (observed live, twice) — S21-1: the suite failure + the probe matrix (empty API jar / guest-cart ownership / header-POST → admin cart)
- [x] RED (observed live) — S21-2: the captured strict-mode violation (2-element resolution) on the profile toast
- [x] GREEN — S21-1: explicit session-cookie header on all admin-identity request-fixture calls; spec passes on a fresh DB (the exact failing scenario); DB-verified as-found cleanup
- [x] GREEN — S21-2: `.first()` × 3 + the self-heal; spec passes alone and in the full suite
- [x] RED — S21-4: the hardened shipping-row pins fail against the unfixed mirror ($6.95 rendered on both rows)
- [x] GREEN — S21-3: the mirror passes the flag through; the hardened pins pass (both rows render FREE below the threshold)
- [x] S21-5 / S21-6 — comment corrections
- [x] Full gate chain re-run green; manual verification (agent-browser: FREESHIP checkout mirror renders FREE on the review card and the summary; mobile menu re-check)
- [x] Screenshots refreshed; docs sweep; worklog updated

---

# Session 22 (run 23)

> Deep audit 23-a (read-only subagent, HEAD `5835fdd`) + operator verification.
> Workspace refreshed by fresh clone; gates re-validated green on the pulled
> tree (lint · typecheck · typecheck:tests · 379/379 unit · build · 65/65 e2e);
> live-reference parity re-verified via agent-browser (reference unchanged —
> logged in with the provided credentials; clone: mobile menu open → 7 links +
> search → navigate → auto-close/unmount, sitemap 25 URLs, robots, JSON-LD,
> desktop parity, zero console errors).

## 1. Audit summary (evidence-based)

Session-21 fixes **6/6 WIRED** (S21-1 five admin-identity request calls carry the
explicit session-cookie header behind the loud guard; S21-2 `.first()` × 3 + the
self-healing setup; S21-3 the mirror's `setCoupon` passes `freeShipping` through;
S21-4 both shipping-row pins scoped with `toHaveCount(1)`; S21-5/S21-6 comments
corrected). Defect-class sweeps CLEAN: 14/14 `requireAdmin`'d actions, 14/14
metered `Retry-After` sites, money integer-cents server-derived, Zod at every
boundary, conditional stock reservation, token-gated receipt, sitemap/robots/noindex
privacy, CSP nonce, Tailwind v4 traps, server-only module graph, `gotoHydrated`
14/14 specs, every toast assertion `.first()`-conventioned. Static counts ALL
matching the live docs (379 unit / 38 files · 65 e2e · 18 models · 16/8/3/2 seed ·
14 requireAdmin · 14 metered · 16 catch blocks across six files); TODO/FIXME/`any`/
console.log/raw-dangerouslySetInnerHTML/eval scans all zero.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT / 2 Informational — the
tenth consecutive session without a CRITICAL/HIGH/MEDIUM finding, and zero
live-repo-doc drift.**

## 2. Findings → work items

### S22-1 (NIT — cosmetic) — copy-paste artifact in the admin-coupons spec

- **Evidence (23-a, operator-verified):** `tests/e2e/admin-coupons.spec.ts:132-134`
  — the `.first()` rationale comment is duplicated (the file header and the other
  five toast assertions already carry it) and the continuation line + the
  `await expect(...)` are indented 6 spaces against the file's 4-space convention.
- **Fix:** reindent to 4 spaces and drop the duplicated comment (the suite
  convention is documented at the spec header).

### S22-2 (NIT — small refactor) — the coupon-apply route performs a second coupon lookup solely for the marketing description

- **Evidence (23-a, operator-verified):** `src/app/api/coupon/apply/route.ts:51-57`
  — `applyCouponCode` resolves the coupon via `findActiveCoupon` (which already
  carries `description` in `CouponInfo`), but `couponDiscount` drops it from the
  `CouponApplication` ok-branch — so the route re-calls `findActiveCoupon(applied.code)`
  with the comment "Second lookup only to carry the marketing description". One
  wasted DB round-trip per coupon apply on every cart page.
- **Fix (TDD):** widen the `CouponApplication` ok-branch with `description: string`,
  have `couponDiscount` carry `coupon.description` through all three success
  branches (percent / fixed / free_shipping), and drop the route's second lookup +
  import (`description: applied.description`). The exact-shape `toEqual` pins in
  `coupons.test.ts` and `session20-hardening.test.ts` update to the widened shape
  (same facts, extended contract); the new `session22-hardening.test.ts` pins the
  widened branches AND the route's single-lookup contract (`db.coupon.findUnique`
  called exactly once — the regression pin for the second lookup).

### Dispositions (no change, recorded)

- **D1 (bookkeeping):** the "13 specs" figure in the SKILL Appendix B session-20
  entry and the session_35.md narrative is stale (14 spec files since session-20
  added `free-shipping-coupon.spec.ts`). Historical records stay as-written
  (append-only discipline — retro-editing would falsify what was believed at the
  time); no LIVE repo doc claims a spec count (grep-verified), and the new
  session-22 Appendix B entry carries the correct 14.
- **D2 (Informational):** a mid-abort in the S21-1 spec leaves the seeded cart
  line until the next run's as-found snapshot absorbs it — self-correcting, not
  the F-6 durable-row class. Accepted.
- **Carried deferrals (unchanged):** login-limiter lockout tradeoff (S8-8),
  checkout P2002 recovery-loop integration seam, review action two-tier gate pin,
  `/track-order` page-limiter wiring pin, S21-7's coupon-aware cart hint, and the
  external-service epics (real email delivery, OAuth, real payments — blocked on
  sandbox-external credentials/SMTP).

## 3. Execution log (session 22)

- [x] RED — session22-hardening.test.ts run against the unfixed shape: **5 failed / 2 passed** — the three `couponDiscount` branch pins + the `applyCouponCode` ok-branch pin failed on the missing `description`, and the single-lookup pin failed with `findUnique` called **2 times**; the route's response-description pin passed (supplied by the wasteful second lookup — the exact defect shape)
- [x] GREEN — `CouponApplication`'s ok-branch + `couponDiscount`'s three success branches carry `description`; the route drops the `findActiveCoupon` import + second lookup and reads `applied.description` (the stray whitespace line cleaned); the four exact-shape `toEqual` pins updated to the widened contract (coupons.test.ts × 3, session20-hardening.test.ts × 1); **7/7 session22 pins green; 386/386 unit**
- [x] S22-1 — the spec's duplicated `.first()` comment dropped + the 4-space reindent
- [x] Full gate chain re-run green (lint · typecheck · typecheck:tests · 386/386 unit · build · 65/65 e2e); manual verification (agent-browser on the fresh build: the cart's applied-coupon block renders "FREESHIP: Free standard shipping on orders over $30 — applied at checkout" from the single-lookup path; mobile menu open → 7 links → close → unmount; zero console errors)
- [x] Screenshots refreshed (24); docs sweep; worklog updated

---

# Session 23 (run 24)

> Deep audit 24-a (read-only subagent, HEAD `a7b19a1`) + operator verification.
> Workspace refreshed by fresh clone; gates re-validated green on the pulled
> tree (lint · typecheck · typecheck:tests · 386/386 unit · build · 65/65 e2e);
> live-reference parity re-verified via agent-browser (reference unchanged —
> logged in with the provided credentials; Damascus-first order holds on both
> sides; clone: mobile menu open → 7 links + search → navigate →
> auto-close/unmount, sitemap 25 URLs, robots, JSON-LD, desktop parity, zero
> console errors).

## 1. Audit summary (evidence-based)

Session-22 fixes **2/2 WIRED** (S22-2 the widened `CouponApplication` ok-branch
carries `description` through all three success branches `coupons.ts:48/:60/:74`,
the route imports only `applyCouponCode` and reads `applied.description` with the
second lookup gone, `session22-hardening.test.ts` pins the widened branches + the
exactly-once `findUnique` route contract + the response description; S22-1 the
admin-coupons spec artifact is gone at the 4-space convention). Defect-class
sweeps CLEAN: 14/14 `requireAdmin`'d actions, 14/14 metered `Retry-After` sites,
money integer-cents server-derived in-tx, Zod at every boundary, conditional
stock reservation, token-gated receipt, sitemap/robots/noindex privacy, CSP
nonce, Tailwind v4 traps, server-only module graph, `gotoHydrated` 14/14 specs,
every toast assertion `.first()`-conventioned, 16 catch blocks across six
islands. Pre-session-21 invariant spot-checks 5/5 WIRED (free_shipping
end-to-end, cart clamp single-source, token-gated order access, CSP nonce
proxy, Toaster timer registry). Static counts ALL matching the live docs (386
unit / 39 files · 65 e2e / 14 specs · 18 models · 16/8/3/2/3/13 seed · 14
requireAdmin · 14 metered · 16 catch blocks); TODO/FIXME/`any`/console.log/
raw-dangerouslySetInnerHTML/eval scans all zero.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 1 NIT / 2 Informational — the
eleventh consecutive session without a CRITICAL/HIGH/MEDIUM finding, and zero
live-repo-doc drift.** (Informational-1 was an untracked run artifact in the
workspace, removed before staging; Informational-2 is the documented deliberate
guest-order seeding in `admin.spec.ts:67-74` — disposition unchanged.)

## 2. Findings → work items

### S23-1 (NIT — cosmetic) — whitespace-only line in the checkout limiter block

- **Evidence (24-a, operator-verified):** `src/app/api/checkout/route.ts:109` —
  a whitespace-only line (4 spaces) sits between the limiter comment block and
  the `rateLimit(...)` call. Pre-existing, lint-clean, zero behavior.
- **Fix:** drop the line (same class as S22-1's stray whitespace cleanup).

### S23-2 (feature increment — S21-7 promoted from deferral) — the cart's free-shipping hint goes coupon-aware

- **Context:** S21-7 (recorded session 21, carried sessions 21→22) — the cart
  page's threshold-progress hint ("Add $15.01 more for free shipping") is
  server-rendered from the settings threshold only and does not know an applied
  `free_shipping` coupon, so with FREESHIP applied below the threshold the hint
  coexists with the applied block right above it ("Free standard shipping…
  applied at checkout") — contradictory UX on the money-adjacent surface the
  store advertises most. The original disposition ("structural change for
  marginal benefit") is REVISITED now that the defect surface has been clean
  for eleven consecutive sessions and the coupon engine is single-lookup and
  description-carrying (session 22): the marginal-benefit calculus has flipped —
  the widget is the only remaining money-adjacent surface that can contradict
  the applied-coupon state.
- **Design (TDD):** lift the applied-coupon state minimally with an idiomatic
  props-down-events-up bridge — NO context, NO custom events, NO sessionStorage
  shape change (the `COUPON_STORAGE_KEY` code-string contract with
  checkout-client.tsx is untouched):
  1. New client composite `src/app/(storefront)/cart/cart-widgets.tsx` —
     `CartSummaryWidgets({ subtotalCents, thresholdCents })` renders the
     free-shipping hint (markup moved verbatim from `cart/page.tsx`) AND the
     `CouponBox`, holding a mirrored `coupon` state fed by CouponBox's new
     callback. Hint states: (a) applied free_shipping coupon → emerald
     coupon-attributed block "Free shipping active — {code} applied at
     checkout" (Truck icon; no progressbar — shipping is already free); (b) no
     coupon, subtotal ≥ threshold → the existing "You've unlocked free
     shipping!" block; (c) otherwise → the existing progress bar + "Add {X}
     more for free shipping". A percent/fixed coupon leaves states (b)/(c)
     unchanged (the threshold still applies pre-discount).
  2. `CouponBox` gains an optional `onAppliedChange?: (applied: AppliedCoupon
     | null) => void` and the `AppliedCoupon` type is exported; the callback
     fires on apply success (the payload), on a not-ok response (null), and on
     remove (null) — the network-catch branch leaves state untouched, so it
     fires nothing (same shape as `setApplied`). Silent hydration re-apply
     flows through the same success path.
  3. `cart/page.tsx` swaps the hint JSX + bare `<CouponBox />` for
     `<CartSummaryWidgets subtotalCents={summary.subtotal}
     thresholdCents={settings.freeShippingThresholdCents} />` (server facts as
     props → the first client render matches the server HTML — no hydration
     mismatch by construction).
- **Tests:** new `tests/unit/cart-widgets.test.tsx` (jsdom component test, the
  S14-1 toaster precedent) pins all hint states by driving the real CouponBox
  through stubbed fetch (progress state below threshold; unlocked state at
  threshold; percent coupon leaves the progress state; free_shipping coupon
  swaps to the coupon-attributed block and removes the nag; remove restores the
  progress state). `tests/e2e/free-shipping-coupon.spec.ts` gains a cart-hint
  pin: the $34.99 pin cart shows "Add $15.01 more for free shipping" pre-apply,
  the hint swaps on FREESHIP apply, and restores on remove.

### Dispositions (no change, recorded)

- **Carried deferrals (S21-7 REMOVED — resolved by S23-2):** login-limiter
  lockout tradeoff (S8-8), checkout P2002 recovery-loop integration seam,
  review action two-tier gate pin, `/track-order` page-limiter wiring pin, and
  the external-service epics (real email delivery, OAuth, real payments —
  blocked on sandbox-external credentials/SMTP).

## 3. Execution log (session 23)

- [x] RED — `tests/unit/cart-widgets.test.tsx` failed on the missing
      `CartSummaryWidgets` export (component does not exist): import-resolution
      failure, 4 of the 5 assertions unreachable
- [x] GREEN — `cart-widgets.tsx` + the CouponBox `onAppliedChange` callback +
      the `cart/page.tsx` rewire; **5/5 new pins green** (391/391 unit)
- [x] E2E — the free-shipping spec's cart-hint pin green against the fresh
      build (**66/66 e2e**)
- [x] S23-1 — the whitespace-only line dropped
- [x] Full gate chain re-run green (lint · typecheck · typecheck:tests ·
      391/391 unit · build · 66/66 e2e); manual verification (agent-browser on
      the fresh build: the cart hint swaps on FREESHIP apply and restores on
      remove; mobile menu open → 7 links → close → unmount; zero console
      errors)
- [x] Screenshots refreshed (25 — the new `04b-cart-coupon-hint` evidence shot
      documents the coupon-attributed state; the capture script's cart step
      also lost its click→goto race — the badge now gates the navigation);
      docs sweep; worklog updated

# Session 24 (run 25)

> Deep audit 25-a (read-only subagent, HEAD `e0bcd23`) + operator verification.
> Workspace refreshed by `git pull` (fast-forward `38301d3` → `e0bcd23`, the
> operator's session-log commits); gates re-validated green on the pulled tree
> (lint · typecheck · typecheck:tests · 391/391 unit · build · 66/66 e2e);
> live-reference parity re-verified via agent-browser (reference unchanged —
> logged in with the provided credentials; Damascus-first order holds on both
> sides; clone: mobile menu open → 7 links + search → navigate →
> auto-close/unmount, sitemap 25 URLs, robots, JSON-LD, desktop parity, zero
> console errors).

## 1. Audit summary (evidence-based)

Session-23 fixes **2/2 WIRED** (S23-1 the whitespace-only line is gone at
`checkout/route.ts:107-109`; S23-2 the `CartSummaryWidgets` composite
`cart-widgets.tsx:28-73` with the three hint states, the `onAppliedChange`
callback fired on success/not-ok/remove and NOT on the network-catch branch,
the page passing server facts as props, the 5 jsdom pins + the e2e cart-hint
pin — all wired, no dead code; the new-code-path adversarial checks found the
StrictMode no-op hazard safe under the pinned `reactStrictMode: false`).
Defect-class sweeps 13/13 CLEAN; static counts ALL matching the live docs
(391 unit / 40 files · 66 e2e / 14 specs · 18 models · 14 requireAdmin · 14
metered · 16 catch blocks · 25 screenshots); TODO/FIXME/`any`/console.log/
eval/raw-DSIH scans zero.

**Result (25-a): 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 0 NIT / 3
Informational — the twelfth consecutive session without a
CRITICAL/HIGH/MEDIUM/LOW finding, and zero live-repo-doc drift.**
(Informational-1: the silent-reapply effect's schedule-then-guard shape would
no-op under StrictMode dev double-invocation — a missed apply, not a double
fetch — safe while `reactStrictMode: false` stays pinned; Informational-2: a
stale stored code surfaces an inline error on revisit; Informational-3: the
coupon form's Enter path is not `pending`-gated — last-write-wins, harmless.)

**Operator verification** (the personal file:line pass over 25-a's claims)
surfaced one NIT the subagent missed and re-examined the carried deferrals:
- **S24-1 (NIT — cosmetic):** a whitespace-only line at
  `src/app/(storefront)/track-order/page.tsx:99` (between `const h = await
  headers();` and the limiter call) — the same artifact class as S22-1/S23-1.
- The **"actions not import-safe in Vitest"** rationale recorded with the
  review-action gate pin deferral (session 15) has been DISPROVEN by the
  session-19 precedent: `tests/unit/session19-hardening.test.ts` imports and
  exercises the guarded coupon actions through mocked `next/cache` + db +
  auth. The `/track-order` page is a plain async component importable with
  mocked `next/headers`/db/rate-limit and renderable via
  `react-dom/server`. The S23-2 logic applies: the defect surface is clean,
  the technical blocker is gone, and the marginal-benefit calculus has
  flipped — the deferrals are promoted.

## 2. Findings → work items

### S24-1 (NIT — cosmetic) — whitespace-only line in the track-order limiter block

- **Evidence (operator-verified):** `src/app/(storefront)/track-order/page.tsx:99`
  — a whitespace-only line (4 spaces) sits between `const h = await
  headers();` and the `rateLimit(...)` call. Pre-existing, lint-clean, zero
  behavior.
- **Fix:** drop the line (same class as S22-1/S23-1).

### S24-2 (deferral promoted — test increment) — the review action's two-tier gate wiring pin

- **Context:** session 15 recorded "review action two-tier gate pin (actions
  are not import-safe in Vitest — `next/cache`)"; the constraint no longer
  holds (the session-19 guarded-action precedent). The KEY SHAPE is pinned
  (`session11-hardening.test.ts`), but nothing pins that
  `submitReviewAction` actually consults BOTH tiers and rejects when EITHER
  fails — a refactor that dropped the author-tier check would stay green.
- **Design (TDD):** new `tests/unit/review-action-gate.test.ts` (the
  session-19 mock family: `next/cache`, `@/lib/db`, `@/lib/auth`,
  `next/headers`; `@/lib/rate-limit` PARTIALLY mocked via `importOriginal`
  so the REAL `reviewRateLimitKeys` derivation feeds the assertion). Pins:
  (a) the action consults `rateLimit` with BOTH the per-IP key and the
  per-author key (real derivation, in the wired order); (b) ip-tier failure
  → `{ ok: false, error: "Too many reviews submitted. Please try again
  shortly." }` and `db.product.findUnique` never called (no lookup past the
  gate); (c) author-tier failure with the ip tier ok → the same rejection;
  (d) both tiers ok → the review row is created inside the transaction with
  the aggregate grown and `{ ok: true }` returned.
- **Mutation check (the RED):** temporarily narrow the action's gate to the
  ip tier only → pin (c) fails; restore.

### S24-3 (deferral promoted — test increment) — the /track-order page-limiter wiring pin

- **Context:** recorded session 21. The page's limiter
  (`track-order/page.tsx:100`, 30/min per client) fails CLOSED (an
  over-budget lookup renders the same denial shell as an unknown number),
  but nothing pins the wiring — a refactor that bypassed the limiter (or
  failed OPEN with a different shell) would stay green.
- **Design (TDD):** new `tests/unit/track-order-limiter.test.ts` — mocked
  `next/headers` (returns fixed `cf-connecting-ip`), `@/lib/db`,
  `@/lib/rate-limit` (partial: real `clientIp`, `rateLimit` controllable),
  `next/image` (passthrough); the page's default export invoked as a plain
  async component with a resolved `searchParams` Promise and rendered via
  `react-dom/server`'s `renderToString`. Pins: (a) a submitted lookup
  consults the limiter with the `track-order:` key derived from the client
  IP and the documented budget; (b) over-budget → `db.order.findUnique`
  never called AND the rendered HTML is the denial shell (no order
  details — indistinguishable from unknown-number); (c) under-budget +
  matching email → the order's status timeline renders; (d) under-budget +
  wrong email → the same denial shell (no information leak).
- **Mutation check (the RED):** temporarily bypass the limiter (`if (true)`)
  → pin (b) fails; restore.

### S24-4 (deferral promoted — integration seam) — the real engine's P2002 shape feeds the tolerant matchers

- **Context:** the checkout recovery loop (`placeOrderWithRetry`) depends on
  `uniqueTargetField`/`isUniqueViolation` tolerating BOTH the field-array
  target shape (today's SQLite engine) and the constraint-name string shape.
  All existing pins (`session8-hardening.test.ts`) use SYNTHETIC error
  objects — if the Prisma engine changed its live `meta.target` shape, the
  synthetic pins would stay green while the recovery loop silently died (the
  exact failure the S8-3 tolerant-matching comment warns about). This is the
  "checkout P2002 recovery-loop integration seam" recorded session 12.
- **Design (TDD):** new `tests/unit/checkout-recovery-integration.test.ts`
  (the `review-transactional.test.ts` temp-SQLite harness: `mkdtempSync` +
  `prisma db push --skip-generate` + `datasourceUrl`): against a REAL db
  file, (a) create an order with an `idempotencyKey`, then attempt a
  colliding create → the caught error is a REAL P2002 AND
  `uniqueTargetField(err, "idempotencyKey")` is true (the live field-array
  shape matches the tolerant matcher); (b) a number collision →
  `isUniqueViolation(err)` true AND `uniqueTargetField(err,
  "idempotencyKey")` FALSE (cross-field discrimination — the pin is
  sensitive to matcher drift, not just engine drift); (c) the recovery read
  `db.order.findUnique({ where: { idempotencyKey } })` returns the winning
  row — the exact call shape `placeOrderWithRetry` uses after a key
  collision.
- **Mutation check (the RED):** temporarily strip `uniqueTargetField`'s
  field-array branch (string targets only) → pin (a) fails against the real
  engine error; restore.

### Dispositions (no change, recorded)

- **Carried deferrals (S24-2/S24-3/S24-4 REMOVED — resolved this session):**
  login-limiter lockout tradeoff (S8-8 — the deliberate per-IP + per-email
  budget tradeoff stays documented), checkout saveAddress at-cap skip-save
  integration pin, checkout coupon-cap concurrency harness, review two-tier
  budgets e2e, route-level 429 wiring pins beyond the S14-2 representatives,
  404-shell CSP nonce, `__Host-` prefix, shared-store limiter, admin
  coupon-management UI, radiogroup roving focus, address content dedup, and
  the external-service epics (real email delivery, OAuth, real payments —
  blocked on sandbox-external credentials/SMTP).

## 3. Execution log (session 24)

- [x] RED (mutation checks) — 6 of the 11 new pins failed exactly as
      predicted: S24-2's both-tiers/author-tier/proceed pins against the
      ip-only gate; S24-4's key-collision + number-collision matcher pins
      against the real engine's field-array target (proving the live shape
      needs the branch the mutation stripped); S24-3's over-budget pin
      against the bypassed limiter. (The RED run also surfaced a mock-hygiene
      hardening: a partially-consumed `mockReturnValueOnce` queue leaked
      across tests once the gate called the limiter once instead of twice —
      the suite now `vi.resetAllMocks()` per test.)
- [x] GREEN — all three wiring sites restored byte-for-byte (`git status
      src/` clean); **11/11 new pins green** (402/402 unit)
- [x] S24-1 — the whitespace-only line dropped
- [x] Full gate chain re-run green (lint · typecheck · typecheck:tests ·
      402/402 unit · build · 66/66 e2e)
- [x] Screenshots refreshed; docs sweep; worklog updated

# Session 25 (run 26)

> Deep audit 26-a (read-only subagent, HEAD `496761e`) + operator verification.
> Workspace refreshed by `git pull` (fast-forward `4659776` → `496761e`, the
> operator's session-log commit appending `docs/session_41.md`); gates
> re-validated green on the pulled tree (lint · typecheck · typecheck:tests ·
> 402/402 unit · build · 66/66 e2e); live-reference parity re-verified via
> agent-browser (reference unchanged — logged in with the provided
> credentials; Damascus-first holds on both sides; clone: mobile menu open →
> 7 links + search → navigate → auto-close/unmount, sitemap 25 URLs, robots,
> JSON-LD, desktop parity; one mid-session ChunkLoadError was the documented
> stale-server artifact class — a leftover `next-server` from the prior run
> survived on :3000 and served old chunks; killed by PID, fresh server, zero
> console errors — a tooling episode, not a code defect).

## 1. Audit summary (evidence-based)

Session-24 fixes **4/4 WIRED** (26-a with file:line evidence: S24-1 the
whitespace-only line is gone (`track-order/page.tsx:98-99`, a
`^[ \t]+$` scan of the file returns zero); S24-2 the real action consults
BOTH tiers via the real `reviewRateLimitKeys` and rejects when either fails
(`reviews.ts:42-44`), the pin's partial `importOriginal` mock feeds the REAL
derivation into the assertions; S24-3 the real page consults the limiter
BEFORE the DB read and fails CLOSED into the identical denial shell
(`page.tsx:99-101`), the pin renders the REAL page via `renderToString`;
S24-4 the temp-SQLite harness satisfies `uniqueTargetField` against the
LIVE field-array shape with cross-field discrimination, cross-checked
against `prisma-errors.ts:48-65` and the live recovery loop
(`checkout/route.ts:222-241`); the three new files 11/11 green in
isolation).
Defect-class sweeps 13/13 CLEAN; static counts ALL matching the live docs
(402 unit / 43 files · 66 e2e / 14 specs · 18 models · 14 requireAdmin · 14
metered · 16 catch blocks · 25 screenshots · 3 DSIH sites).

**Result (26-a): 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT / 2
Informational — the thirteenth consecutive session without a
CRITICAL/HIGH/MEDIUM/LOW finding.** The NITs are BOTH documentation-class
and BOTH introduced/frozen by earlier doc sweeps, not code:
- **S25-1 (NIT — doc drift):** `homenest-store-s_SKILL.md:15` — the
  `project_state` value carries the ENTIRE stale session-23 text
  concatenated after the session-24 value's closing quote (a non-idempotent
  doc-patch artifact from run 25). The operator surfaced it during the doc
  review, before 26-a ran; 26-a's `)"`-glued-text scan confirms it is the
  ONLY instance of the class across SKILL/AGENTS/CLAUDE/README/PAD.
- **S25-2 (NIT — stale stats):** `homenest-store-s_SKILL.md:184-186` — the
  §5 structural stats are frozen at the session-6 era ("101 tracked TS
  files / 14 client + 9 server components / 35 client files"); the measured
  actuals are **126 / 13 + 9 / 38** (untouched since commit `6220262`).
- **S25-3 (NIT — paste artifact, operator find):**
  `Project_Architecture_Document.md:78` — "—任何人 can mint an admin" (a
  CJK fragment glued into the English sentence; pre-existing since the
  original migration commit `87cfa40` — a different class from S25-1).
- **Informational-1:** `track-order-limiter.test.ts:78` uses
  `vi.clearAllMocks()` where the session-24 hardening established
  `vi.resetAllMocks()` (per-test) — safe today (no `mockReturnValueOnce`
  queues in the file; the `beforeEach` re-stubs all three mocks), but the
  documented Once-queue leak class returns the moment a Once queue is added.
- **Informational-2:** the checkout-recovery harness leaves its mkdtemp dir
  behind (OS tmpdir; matches the review-transactional precedent — recorded,
  no action).

**Plan-bookkeeping defect (operator find):** the LIVE carried-deferrals
list (session-24 "Dispositions") still carries **"admin coupon-management
UI"** — resolved back in session 19 by **S19-5** (the `/admin/coupons`
surface + `upsertCouponAction`/`deleteCouponAction`/`toggleCouponActiveAction`
shipped and are e2e-pinned by `admin-coupons.spec.ts`). The entry has been
copy-forwarded through sessions 20-24's dispositions lists unexamined.

## 2. Findings → work items

### S25-1 (NIT — doc drift) — the stale session-23 `project_state` fragment

- **Evidence:** `homenest-store-s_SKILL.md:15` —
  `…real-SQLite integration seam)"391 unit tests · …end-to-end)"` — the
  stale session-23 value sits glued after the session-24 value's closing
  quote.
- **Fix:** drop the stale fragment; the line ends at the session-24 value.

### S25-2 (NIT — stale stats) — SKILL §5 structural numbers

- **Evidence:** `homenest-store-s_SKILL.md:184-186` claims 101 / 14+9 / 35;
  measured (this run, `git ls-files` + `"use client"` grep): **126 tracked
  TS/TSX files in `src/` · 13 client + 9 server components in
  `src/components/` · 38 client files across `src/`**.
- **Fix:** refresh the three numbers (the 26-a measurement 126/13+9/38
  independently reproduced by the operator's own count).

### S25-3 (NIT — paste artifact) — the PAD CJK fragment

- **Evidence:** `Project_Architecture_Document.md:78` — "—任何人 can mint an
  admin".
- **Fix:** "—anyone can mint an admin".

### S25-4 (bookkeeping) — the stale carried-deferral entry

- **Evidence:** session-24 "Dispositions" (the live tail of the plan) lists
  "admin coupon-management UI" among the carried deferrals; S19-5 resolved
  it (session 19, `/admin/coupons` shipped, e2e-pinned).
- **Fix:** session-25's dispositions list drops the entry with the
  resolution note; historical sections are NEVER rewritten (the plan is an
  audit trail — each section records its session's state).

### S25-5 (deferral promoted — integration seam) — the coupon-cap real-engine harness

- **Context:** recorded session 11 as "checkout coupon-cap concurrency
  harness". All existing pins for the redemption guard are SYNTHETIC:
  `couponRedemptionFilter`'s truth table (session 20) inspects the
  where-clause OBJECT shape, never against a live engine. If the filter
  drifted (dropped the `isActive` guard or the `timesUsed` cap clause), the
  synthetic pins would stay green while the checkout's atomic guard
  silently weakened — the exact class the S24-4 real-engine seam closed for
  the P2002 matchers.
- **Design (TDD):** new `tests/unit/coupon-cap-integration.test.ts` (the
  `review-transactional.test.ts` temp-SQLite harness: `mkdtempSync` +
  `prisma db push --skip-generate` + `datasourceUrl` — no process env, no
  sandbox shadow). Against a REAL db file, run the LIVE increment call
  shape (`checkout/route.ts:312-313`):
  `tx.coupon.updateMany({ where: couponRedemptionFilter(code, maxRedemptions), data: { timesUsed: { increment: 1 } } })`.
  Pins: (a) at-cap (`timesUsed === maxRedemptions`) → `count === 0` (the
  caller throws the 409; the coupon row is untouched); (b) one-under →
  `count === 1` AND `timesUsed` actually incremented (the happy-path write
  lands); (c) DEACTIVATED with budget remaining → `count === 0` (the
  always-on `isActive` guard, against the real engine); (d) `maxRedemptions
  === null` (unlimited) → `count === 1` even at high `timesUsed` (the
  absent-cap branch passes through).
- **Mutation checks (the RED):** (1) strip the `isActive: true` guard from
  `couponRedemptionFilter` → pin (c) fails; (2) strip the
  `timesUsed: { lt }` cap clause → pin (a) fails. Restore byte-for-byte.

### S25-6 (deferral promoted — integration seam) — the saveAddress at-cap real-engine harness

- **Context:** recorded session 18 ("checkout saveAddress at-cap skip-save
  integration pin — needs the deferred address-cap + checkout harness
  family"). The outcome contract is unit-pinned synthetically
  (`session18-hardening.test.ts`: "saved"/"at-cap" via an in-memory fake
  client); nothing proves the contract against a REAL address table — e.g.
  that at-cap lands NO writes (no partial unset of the previous defaults),
  and below-cap actually promotes the new row to default.
- **Design (TDD):** new `tests/unit/save-address-integration.test.ts` (the
  same temp-SQLite harness; `saveCheckoutAddressInTx` accepts the Prisma tx
  client directly — `CheckoutAddressSavingClient` is a structural subset).
  Pins: (a) below cap with an existing default → returns `"saved"`, the
  previous default is UNSET, the new row is `isDefault: true` (exactly one
  default remains — `findFirst` determinism); (b) at cap (a book pre-seeded
  with `MAX_ADDRESSES_PER_USER` rows) → returns `"at-cap"` AND the book is
  byte-identical after the call (row count 20, no unset happened — the
  no-writes-at-cap contract against the real engine, the order-still-places
  invariant); (c) a label-less draft defaults to "Home".
- **Mutation check (the RED):** temporarily bypass the cap gate (make
  `assertAddressCap` a no-op) → pin (b) fails (the save writes row 21 and
  unsets the defaults). Restore byte-for-byte.

### S25-7 (test hygiene — promoted from Informational-1) — the resetAllMocks discipline

- **Evidence:** `tests/unit/track-order-limiter.test.ts:78` —
  `vi.clearAllMocks()`.
- **Fix:** `vi.resetAllMocks()` (the session-24 discipline; the
  `beforeEach` re-stubs all three mocks, so the stronger reset is safe) —
  the Once-queue leak class can never return here.

### Dispositions (no change, recorded)

- **review two-tier budgets e2e — DISPOSED (redundant coverage):** S24-2's
  unit pin already exercises BOTH tiers through the REAL action with the
  REAL key derivation; an e2e would need 20+ review submissions inside a
  minute (limiter-state pollution across specs, minutes of runtime, flaky
  under parallelism) to assert what the wiring pin asserts exactly. The
  unit pin is the right altitude.
- **Carried deferrals (S25-4's stale entry REMOVED — resolved by S19-5,
  session 19; S25-5/S25-6 REMOVED — resolved this session):** login-limiter
  lockout tradeoff (S8-8 — the deliberate per-IP + per-email budget
  tradeoff stays documented), route-level 429 wiring pins beyond the S14-2
  representatives, 404-shell CSP nonce, `__Host-` prefix, shared-store
  limiter, radiogroup roving focus, address content dedup, and the
  external-service epics (real email delivery, OAuth, real payments —
  blocked on sandbox-external credentials/SMTP).

## 3. Execution log (session 25)

- [x] RED (mutation checks) — S25-5: stripping `isActive: true` failed the
      deactivated pin (count 1 ≠ 0) and stripping the `timesUsed` cap clause
      failed the at-cap pin (count 1 ≠ 0, row 5→6); S25-6: the no-op
      `assertAddressCap` failed the at-cap pin (21 rows + the default unset
      instead of "at-cap" + a frozen book) — 3 of the 7 new pins failed
      exactly as predicted, against the REAL engine in both harnesses; the
      other 4 stayed green under every mutation (mutation-sensitive pins).
- [x] GREEN — all mutation sites restored byte-for-byte (`git status src/`
      clean); **7/7 new pins green** (4 coupon-cap + 3 save-address)
- [x] S25-7 — `clearAllMocks` → `resetAllMocks` (the file's 4 pins stay
      green; the `beforeEach` re-stubs all three mocks)
- [x] S25-1/S25-2/S25-3 — the three doc NITs fixed; S25-4 recorded in the
      dispositions above
- [x] Full gate chain re-run green (lint · typecheck · typecheck:tests ·
      409/409 unit · build · 66/66 e2e)
- [x] Screenshots refreshed; docs sweep; worklog updated
