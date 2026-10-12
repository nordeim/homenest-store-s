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
version: 1.5.0
last_updated: 2026-10-14
project_state: "212 unit tests · 48 e2e tests · lint/typecheck/typecheck:tests/build green · security-hardened (post-remediation sessions 2-8)"
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

101 tracked TS files. Component split in `src/components/`:
**14 client** (`"use client"`) and **9 server** components; 35 client files
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

Key files: `src/lib/db-path.ts` · `src/lib/money.ts` ·
`src/lib/order-money.ts` · `src/lib/rate-limit.ts` (incl. `clientIp`) ·
`src/lib/order-tracking.ts` · `src/lib/order-access.ts` ·
`src/lib/order-status.ts` · `src/lib/coupons.ts` (incl.
`couponRedemptionWhere`) · `src/lib/review-aggregate.ts` ·
`src/lib/auth-secret.ts` ·
`src/app/api/checkout/route.ts` · `src/components/store/mobile-nav.tsx` ·
`src/app/globals.css` · `prisma/seed.ts` · `tests/e2e/helpers.ts`
