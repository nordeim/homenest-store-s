# AGENTS.md — HomeNest Kitchen

Production e-commerce storefront + admin console: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 (CSS-first) · Prisma 6 + SQLite · Radix/shadcn-style UI · Vitest + Playwright. A visual-and-functional superset clone of `https://nest-culinary-hub.base44.app/`.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` (approve `@prisma/engines`, `esbuild`, `unrs-resolver` postinstall scripts if npm asks) |
| Dev server | `npm run dev` (port 3000; logs tee'd to `dev.log`) |
| DB setup (push + seed, idempotent) | `npm run db:setup` |
| DB push only | `npm run db:push` |
| Seed only | `npm run db:seed` |
| Lint | `npm run lint` (ESLint 9 flat config — must exit 0) |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` (Vitest, node env, `tests/unit/*`) |
| Production build | `npm run build` (standalone output + copies static/public) |
| Production start | `npm run start` (standalone server on :3000; logs tee'd to `server.log`) |
| E2E (needs `npm run build` first) | `npm run test:e2e` (spins the standalone server on :3100 itself) |
| Single E2E spec | `npx playwright test tests/e2e/mobile-navigation.spec.ts` |
| Clean check order | `npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e` |

Use `npm` (no bun lockfile is committed). Playwright's mobile project emulates iPhone 13 on **Chromium** (WebKit is not installable in the target sandbox).

## Environment shadowing (sandbox trap)

Any `DATABASE_URL` already present in the process environment (shell export, CI inject, parent `.env`) **wins over the repo `.env`** — Prisma never overrides existing process env. Symptom: `db/custom.db` never appears at the repo root, or rows survive "fresh" reseeds (the file being written is elsewhere). Diagnose with `node -e "console.log(process.env.DATABASE_URL)"` from the repo root. If the shadowed path differs, converge them (symlink) or unset before running DB commands.

## DATABASE_URL contract (pinned by tests/unit/db-path.test.ts)

`.env` carries `DATABASE_URL="file:../db/custom.db"`; `db/` lives at the repo root (git-ignored). A **relative** `file:` URL resolves against `prisma/schema.prisma` — for the CLI AND at runtime via `src/lib/db-path.ts` — so `db:push`, `db:seed`, `next dev`, `next build` and the standalone server all open ONE file at `<repo>/db/custom.db` regardless of CWD. Absolute `file:` URLs and non-SQLite URLs pass through untouched. If you move the schema or the db folder, update that test first.

## Tailwind v4 trap log (violating these breaks production renders)

1. **Never JS-toggle a display utility.** v4 changed display-utility generation order, so toggling the `hidden` class on an element that also carries `flex`/`block` is unreliable (tailwindlabs/tailwindcss#15884, #18653; preflight's `[hidden]` is `!important`). Overlays/menus mount conditionally via React state or use transform/opacity. Pinned by `tests/e2e/mobile-navigation.spec.ts`.
2. **Theme colors are FULL `hsl()` values** in `@theme inline` — bare `H S% L%` triplets silently resolve to transparent.
3. **`hover:` is un-gated**: `@custom-variant hover (&:hover)` in `globals.css` restores v3 semantics so touch devices still render hover styles.
4. **`--shadow-sm` is pinned to v3 geometry**; the radius scale is pinned to the reference's measured px. Don't "upgrade" these pins.
5. Config is CSS-first (`@theme` in `src/app/globals.css`) — there is no `tailwind.config.js` and none should be added.

## CSP nonce trap (Next 16 + `src/proxy.ts`)

The proxy stamps a **per-request nonce** CSP on every response; Next applies the request-header nonce to the scripts it renders. A **prerendered/static page bakes no (or build-time) nonces** → the browser silently refuses its scripts → hydration never happens, with zero console errors. Symptom: a page that loads, paints, but never hydrates. Fix: make the route render per-request (`await connection()` in the layout — `force-dynamic` alone did NOT de-prerender in Next 16.4). The `(auth)` layout carries this fix with a comment; don't remove it. Pinned by the auth e2e specs.

## Architecture invariants

- **RSC by default**; `"use client"` only for interactive islands. Server Actions (`src/lib/actions/*.ts`) for form mutations; REST route handlers (`src/app/api/*`) for client-island fetches (cart, wishlist, checkout, coupon, contact, addresses, search, newsletter, health).
- **Money is INTEGER CENTS everywhere.** Format with `formatMoney` (`src/lib/money.ts`), parse input with `parseDollarsToCents`. Checkout totals are re-derived server-side via `computeOrderMoney` (`src/lib/order-money.ts`) — client totals are display mirrors only. `tests/unit/order-money.test.ts` pins the math.
- **Zod at the boundary**: every external input (FormData, JSON body) is parsed by `src/lib/validation.ts` schemas before it touches Prisma. SQLite has no enums; status/role vocabularies live there.
- **Cart/wishlist are DB-backed with guest token cookies** (`homenest_cart`, `homenest_wishlist`); on login the guest cart merges into the user's. Sessions are DB rows with HMAC-signed `homenest_session` cookie (`src/lib/auth.ts`); passwords are scrypt (`src/lib/password.ts`).
- **Admin surface is role-gated server-side**: layouts/actions check `getCurrentUser().role === "admin"`; client checks are UX only, never the gate.
- **Toast context wraps children** in the root layout (`<Toaster>{children}</Toaster>`) — it must be an ancestor of every page, not a sibling.
- Mobile menu contract: push-down panel (reference-matched), conditionally mounted, never `hidden`-toggled; green circular close button; active link = `bg-primary` pill.
- **Order tracking is access-controlled**: `/track-order` requires the order number **plus the purchase email** (`trackOrderSchema` + `emailsMatch` in `src/lib/order-tracking.ts`); wrong-email/missing-email/unknown-number render the same alert. Pinned by the shopping-flow e2e spec. Never loosen this back to number-only.
- **The checkout receipt is token-gated**: `/api/checkout` returns `{ orderNumber, token }` (`src/lib/order-access.ts`, HMAC of the number keyed by `AUTH_SECRET`); `/checkout/success` renders the full receipt **only** for a valid `order`+`token` pair — anything else renders the same "couldn't find that order" shell (sequential numbers reveal nothing, not even existence). The page is `noindex`. Never render PII from a bare `?order=` param again.
- **Checkout is idempotent**: the client generates `crypto.randomUUID()` once per checkout visit and sends it as `idempotencyKey`; a replay (same key) returns the already-placed order's receipt instead of double-ordering. `Order.idempotencyKey` is a nullable unique column; a `P2002` on it resolves to the winning order (the retry loop only retries `number` collisions).
- **Money is derived inside the checkout transaction**: subtotal comes from the in-tx product snapshots (never the pre-tx cart summary), the coupon is re-validated and its `timesUsed` incremented inside the tx, and `computeOrderMoney` runs there. The pre-tx coupon check is a fast-fail UX path only.
- **Cancelled orders restock exactly once**: `setOrderStatusAction` uses `canTransitionOrderStatus`/`shouldRestockOnStatusChange` (`src/lib/order-status.ts`) — cancelled and delivered are terminal; transitioning a live order to `cancelled` increments each item's product stock in the same transaction.
- **Login merges the guest cart + wishlist**: `loginAction`/`registerAction` call `getOrCreateCart`/`getOrCreateWishlist` after `createSession` (best-effort). Don't remove — without it a guest with a full cart sees a stale cart after signing in.
- **Coupons have a lifecycle**: `isCouponRedeemable` (`src/lib/coupons.ts`) gates on `isActive`, `expiresAt`, and `maxRedemptions`/`timesUsed` at lookup AND inside the checkout tx. `WELCOME10`/`FREESHIP` are evergreen; `SAVE20` caps at 500.
- **`AUTH_SECRET` is enforced in production**: `assertAuthSecret` (`src/lib/auth-secret.ts`) throws at module load when `NODE_ENV=production` and the secret is missing or equals the dev constant. The build copies `.env` into `standalone/` — env changes need a rebuild.
- **Rate limiting**: in-memory fixed-window limiter (`src/lib/rate-limit.ts`) guards login/register/reviews/contact/newsletter/coupon/checkout/tracking. Keys are per-email or per-`x-forwarded-for` IP; limits are generous (humans and e2e pass). Swap internals for a shared store if you scale out.
- **Stock is reserved atomically**: checkout decrements via conditional `updateMany({ where: { id, stock: { gte: qty } } })` and rolls back on `count === 0` — never reintroduce check-then-decrement.
- **Zero-quantity cart lines cannot exist**: the cart PATCH deletes a line whose clamped quantity is 0 (`clampPurchaseQuantity`); checkout 409s on `quantity <= 0` lines as a backstop.
- **Uniform auth errors**: login failures return exactly "Invalid email or password." (with a dummy scrypt burn for unknown accounts) — do not "helpfully" distinguish unknown-email from wrong-password.

## Demo accounts (seeded by `npm run db:seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@homenestkitchen.com` | `Admin123!` |
| Customer | `demo@homenestkitchen.com` | `Demo1234!` |

## Process discipline

- Git: `main` only, Conventional Commits, atomic commits, never commit secrets (`.gitignore` rejects `.env`, `*.key`, `ssh-key.txt`, `db/*.db`).
- Pushes use `docs/ssh_git_wrapper_v3.py` — see `docs/how-to-git-push-using-ssh-wrapper_SKILL.md`. The verification gate above is the only gate; it must be green first.
- `homenest-store-s_SKILL.md` is the full engineering reference (20 sections + trap logs + playbooks); `docs/REMEDIATION_PLAN.md` records the session-2 security audit and its fixes; `scripts/capture-screenshots.mjs` regenerates `docs/screenshots/`.
- E2E ordering: `npm run build` before `npm run test:e2e` (the suite starts the standalone server). Tests wait for hydration via `gotoHydrated()` (`tests/e2e/helpers.ts`) — keep using it for any new spec; clicks before hydration fall back to native form GET.
- When a test fails, reproduce against the standalone server before touching code — the suite caught three real production bugs (Toaster nesting, CSP nonce hydration, toast/action races) exactly this way.
