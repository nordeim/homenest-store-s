# Deployment Guide — HomeNest Kitchen

HomeNest Kitchen ships as a single Next.js **standalone** build with a SQLite
file database — one Node process, zero external services. This guide covers
the supported production paths and the environment contract. (Rewritten in
session 6 to match the actual codebase — the previous revision was a template
from another project.)

## 1. Prerequisites

- Node ≥ 20, npm ≥ 10 (npm is the package manager — there is no committed
  `bun.lock`; `bun.lock` is git-ignored by policy).
- No database server: SQLite ships as a file.

## 2. Build

```bash
npm install            # approve @prisma/engines, esbuild, unrs-resolver postinstall scripts if npm asks
npm run db:setup       # prisma db push + idempotent seed (safe to re-run)
npm run build          # next build + standalone assembly (.next/standalone)
```

The build compiles the storefront, admin console, and the REST route handlers
(`src/app/api/*`), then copies `.next/static` and `public/` into
`.next/standalone/` (see the `build` script in `package.json`).
`next.config.ts` pins `outputFileTracingRoot` to the repo root — keep it; the
standalone trace depends on it. The build also copies `.env` into
`standalone/`, so environment changes need a rebuild.

## 3. Run

```bash
npm run start          # NODE_ENV=production node .next/standalone/server.js
```

The server listens on port 3000 by default (`PORT` overrides) and logs are
tee'd to `server.log`. Always start it from the repo root via the npm script —
the script guarantees the working directory that the SQLite path resolution
and the standalone trace rely on. Behind a reverse proxy, forward
`X-Forwarded-For` (appending — do not pass the client's value through
untouched) and `X-Forwarded-Proto` so rate-limit keys and cookie attributes
derive correctly. Behind Cloudflare, `CF-Connecting-IP` is picked up
automatically by the limiter (`src/lib/rate-limit.ts`).

## 4. Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite connection string. See §5. |
| `AUTH_SECRET` | **Yes in production** | HMAC secret for session cookies and receipt/order-access tokens. Generate with `openssl rand -base64 32`. The server **refuses to start** in production without a strong value (`src/lib/auth-secret.ts` throws at module load). |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical public origin, used for metadata URLs, `sitemap.xml`, `robots.txt`, and JSON-LD (e.g. `https://shop.example.com`). |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | The login page's demo-credentials quick-fill box. **Production builds hide it by default** (it names the seeded admin account); set `true` to opt in for an evaluation deploy. In development the box is shown unless explicitly `false`. Since session-13 (S13-1) the credentials are passed server-side as props only when enabled — a default production build ships **no credential strings** in the client bundle at all. |
| `TRUST_CF_CONNECTING_IP` | Optional (default: trust) | Session-13 (S13-7): set `"false"` on **direct deployments** (no Cloudflare edge) so the client-forgeable `cf-connecting-ip` header cannot rotate per-IP rate-limit buckets. Keep the default (or unset) behind Cloudflare. |
| `STRIPE_SECRET_KEY` | Optional | Session-61 (the Stripe retrofit): the secret key (`sk_live_…`/`sk_test_…`). **Empty = the demo checkout** (clearly labeled, no charges). Set together with the publishable key to activate the real card path: the Payment Element island (PCI SAQ-A — card data never touches this app), a server-minted PaymentIntent (the amount is re-derived server-side from the live cart + coupon + settings), and webhook-driven order placement for interrupted checkouts. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | The publishable key (`pk_live_…`/`pk_test_…`) for the client island. Must be set for the element to mount; the server/client "configured" checks share one truth table (`src/lib/stripe-config.ts`). |
| `STRIPE_WEBHOOK_SECRET` | Optional | The signing secret (`whsec_…`) for `POST /api/stripe/webhook` — from the Stripe dashboard's webhook endpoint (add the events `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`) or `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally. The backstop for interrupted checkouts (payment captured, browser died before placement) — the dedup row commits WITH the placement; a transient failure answers 500 so Stripe retries. |

Start from `.env.example` (`cp .env.example .env`) — it documents every
variable above.

**Stripe activation checklist (the three vars set):** the checkout's card
method renders the Payment Element (test cards: `4242 4242 4242 4242`
succeeds, `4000 0000 0000 0002` declines); the CSP header gains the
`js.stripe.com` / `api.stripe.com` / `frame-src` family automatically; the
admin console gains the Payments ledger (`/admin/payments` — a succeeded
event with no linked order is the **Refund needed** signal); refunds fire
from the order dialog's "Refund via Stripe" (one idempotent full refund per
payment) and the order's payment state updates when Stripe delivers
`charge.refunded`. Keep the webhook secret in sync whenever you rotate the
endpoint — a mismatched secret answers 400 `Invalid signature.` and Stripe
retries with backoff.

## 5. Database location

`DATABASE_URL` accepts three forms:

1. **Relative `file:` URL (the default, zero-config local story).**
   ```
   DATABASE_URL="file:../db/custom.db"
   ```
   Relative URLs resolve against the **`prisma/` directory that owns
   `schema.prisma`** — exactly like the Prisma CLI — so this string points
   at `<repo>/db/custom.db` for `prisma db push`, `prisma/seed.ts`,
   `next build` and the running server alike, regardless of the process
   working directory. The resolution rule lives in
   `src/lib/db-path.ts` and is pinned by `tests/unit/db-path.test.ts`.
   `db/` sits at the repo root and is git-ignored.

2. **Absolute `file:` URL (recommended for production).**
   ```
   DATABASE_URL="file:/var/lib/homenest/custom.db"
   ```
   Absolute paths pass through untouched — immune to any working-directory
   ambiguity across service managers, containers, or cron wrappers. Point
   them at a persisted volume and back the file up.

3. **PostgreSQL.** Switch `provider = "postgresql"` in
   `prisma/schema.prisma`, set a `postgresql://` URL, then
   `npm run db:push && npm run db:seed`.

Initialize (or reset) the database with:

```bash
npm run db:push        # apply schema (db push — no migrations folder)
npm run db:seed        # idempotent seed: catalog, settings, coupons, demo users
```

The seed is **create-or-refresh by design** (scoped in session 7, `src/lib/seed-policy.ts`):
product upserts refresh CATALOG CONTENT only (name, copy, category, images, tags,
specs) — price, compare-at price, stock, rating, reviewCount, sku, badge,
featured/new-arrival flags and active state are admin- or traffic-owned and a
reseed never resets them; settings and carousel slides are create-only (missing
keys/slides are created, existing values survive), exactly like the coupon
bookkeeping (fresh databases additionally get deterministic, minute-spaced
coupon `createdAt` values — session-51 S51-1 — so the admin coupons grid's
newest-first order is stable; existing rows keep their own timestamps). Re-running the seed after real traffic is therefore safe — it
cannot corrupt the stock ledger, collapse customer-grown review aggregates, or
revert admin edits.

> **Demo credentials:** the seed creates `admin@homenestkitchen.com` /
> `Admin123!` and `demo@homenestkitchen.com` / `Demo1234!`. Production builds
> hide the login page's quick-fill box by default (session-12 S12-2) — for a
> real store, still change the admin password (or reseed with your own
> credentials) before going live, and leave `NEXT_PUBLIC_DEMO_MODE` unset
> (set `true` only for evaluation deploys that want the box back).

## 6. Updating

```bash
git pull
npm install
npm run db:generate    # after schema changes
npm run db:push
npm run build
# restart the server process
```

## 7. Verification checklist

```bash
curl -s localhost:3000/api/health            # {"status":"ok","db":"up",...}
npm run lint
npm run typecheck && npm run typecheck:tests
npm run test                                 # Vitest unit suite
npm run build
npm run test:e2e                             # Playwright suite (starts the standalone server on :3100 itself; a fresh start first restores the demo stock — scripts/restore-demo-stock.ts, S14-4)
```

The clean-check order in `AGENTS.md` is the deploy gate: every step must exit
0. Regenerate the documentation screenshots with
`node scripts/capture-screenshots.mjs` (server on :3000).

## 8. Common production issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error code 14: Unable to open the database file` | Server started from a directory that has no `prisma/schema.prisma` and no absolute `DATABASE_URL` | Start via `npm run start`, or set an absolute `file:` URL (§5) |
| `db/custom.db` appears elsewhere / rows survive a "fresh" reseed | `DATABASE_URL` shadowed by the process env (Prisma never overrides existing env) | `node -e "console.log(process.env.DATABASE_URL)"` — converge or unset |
| Page paints but never hydrates, zero console errors | Static prerender baked without the per-request CSP nonce | Make the route render per-request (`await connection()` — see `(auth)/layout.tsx`) |
| Logins loop back to `/login` | `AUTH_SECRET` changed between restarts | Keep the secret stable across restarts |
| 429s on login/checkout | Per-email (10/min) + per-IP (30/min) fixed-window limiter | Wait for `Retry-After` — **every metered route carries it** (session-15 S15-3); in-memory buckets reset on restart (single-node) |
| 429s on "Add All to Cart" with a huge wishlist | The bulk endpoint is limiter-budgeted at 10 requests/min (up to 100 lines each) | Wait for `Retry-After`; split unusually large operations |
| 429s on the cart drawer loading behind a shared IP | `GET /api/cart-summary` is metered at 120 requests/min per IP (session-9 — the last unmetered public route) | Wait for `Retry-After`; raise the budget only alongside the limiter's other read budgets |
| 429s on review submissions from one network | Reviews are two-tier metered (session-11): 20/min per IP (authoritative anti-spam ceiling) + 5/min per author per product | Wait for `Retry-After`; raise the per-IP ceiling only with a shared-store limiter decision |
| `noindex` on pages you expected indexed | Session-8: cart/account/checkout/track-order/auth/wishlist/admin ship `robots: noindex` by design | Public catalog surfaces (`/`, `/products`, `/product/*`, `/about`, `/contact`, `/legal/*`) stay indexable |
| `EADDRINUSE :3100` during e2e | A previous standalone server is alive (process renames to `next-server`) | `pkill -f next-server` |
| Stock-assuming e2e pins fail after many suite runs ("In Stock" gone, sold-out 409s on seeded products) | E2E checkouts are traffic that permanently drains the demo DB's traffic-owned stock (the seed policy never refreshes it — S14-4) | `npx tsx scripts/restore-demo-stock.ts` (the e2e webServer runs it automatically on a fresh server start); run it BEFORE suspecting code |
| The auth e2e fails at its FIRST assertion (profile name `expected "Jordan Rivera"`) | A previously crashed/killed e2e run died mid-flow and left the demo profile name edited — the test restores it only on success (the seed's `update: {}` policy never re-resets the name) | One-line SQLite fix: `UPDATE User SET name = 'Jordan Rivera' WHERE email = 'demo@homenestkitchen.com'` — then re-run; run BEFORE suspecting code |
