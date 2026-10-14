# HomeNest Kitchen

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149ECA) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4_CSS--first-38BDF8) ![Prisma](https://img.shields.io/badge/Prisma-6_+_SQLite-2D3748) ![Tests](https://img.shields.io/badge/tests-386_unit_·_65_e2e-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

A production-grade e-commerce storefront + admin back office — a visual-and-functional **superset** of the Base44 reference app at [`nest-culinary-hub.base44.app`](https://nest-culinary-hub.base44.app/). Premium kitchenware catalog, guest carts, coupons, order tracking, reviews, legal pages, and a full admin console, on Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · Prisma 6 + SQLite.

## Quick Start

```bash
# 1. Install (Node ≥ 20; npm ≥ 10)
npm install

# 2. Create .env (or copy from the example)
cp .env.example .env      # DATABASE_URL="file:../db/custom.db" is the documented default

# 3. Create the schema + seed the catalog (idempotent)
npm run db:setup

# 4. Run
npm run dev               # http://localhost:3000
```

**Verify setup:** `curl localhost:3000/api/health` → `{"status":"ok","db":"up",...}`, and the home page renders the hero carousel with the seeded catalog.

Demo accounts (seeded):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@homenestkitchen.com` | `Admin123!` |
| Customer | `demo@homenestkitchen.com` | `Demo1234!` |

## Features

| Area | Highlights |
|---|---|
| **Storefront** | Auto-rotating hero carousel · 8 category tiles · featured & new-arrival grids (**default catalog order matches the reference's authored order** — Damascus-first on /products "Newest", Featured and New Arrivals alike) · search + category/sort filters + pagination · product detail with gallery, specs, reviews (read + submit) and related products · trust badges · newsletter capture |
| **Commerce** | Guest carts (token-cookie, merged on login **and at sign-in**) · mini cart drawer + cart page · **server-computed cart badge survives full reloads** · coupons (`WELCOME10`, `SAVE20`, `FREESHIP`) with expiry + **atomic redemption caps** (the checkout increment carries an always-on `isActive` guard — a coupon deactivated mid-checkout rolls the order back, session-20) · **first-class `free_shipping` coupon type** (zeroes shipping outright, independent of the spend threshold — pinned through the server-derived receipt) · free-shipping threshold · 3-step checkout (shipping → payment → review) with inline validation · **idempotent order placement** (retries reuse the same key — no double orders) · demo payment (clearly labeled, no real charges) · server-side total re-derivation **inside the order transaction** + atomic stock checks · transactional cart adds (no lost increments, shared 99/stock clamp, **scoped race-safe line writes**) · **bounded wishlist** (100-item cap enforced transactionally on the API — create-first, post-create count under the write lock, session-16 — AND cap-truncating on the login merge, friendly 409) with **one-request Add All to Cart** (both skip reasons reported) and **server-rendered filled hearts** (heart state + honest Add/Remove labels on every grid, session-11) |
| **Orders** | `ORD-YYYY-NNN` order numbers · **token-gated order-success receipt** (sequential numbers alone reveal nothing) · order tracking gated by **number + purchase email** (anti-enumeration, rate-limited) with a 4-step status timeline · per-order event history · admin cancellation restores stock |
| **Accounts** | Register/login (scrypt hashes, DB-backed sessions, HMAC-signed cookie) · profile editing · address book (bounded at 20, **first address auto-defaults + per-card Set-as-default + deleting the default auto-promotes the newest remaining address**, friendly 409 at the cap enforced inside the write transaction, checkout prefill) · order history (paginated) |
| **Admin** (`/admin`, role-gated) | Dashboard (KPIs + 14-day revenue chart folded from bounded SQL day buckets + recent orders + low stock) · products CRUD · categories CRUD · **coupons CRUD (session-19 — create/edit/deactivate/delete discount codes with percent/fixed values, minimums, expiry and redemption caps; codes normalize to the same uppercase vocabulary the storefront redemption lookup uses)** · carousel slide manager with reorder · orders manager (status workflow with **guarded transactional transitions** + carrier tracking) · analytics (top products, category mix) · store settings |
| **Content** | About, Contact (working form), 5 legal pages, 404 · SEO metadata, `sitemap.xml` (public routes only), `robots.txt` (admin/account/checkout/api disallowed) · **noindex on every private surface** (cart/account/checkout/track-order/auth/wishlist/admin) · **schema.org JSON-LD** (Product rich-result blocks with price/stock/rating/priceValidUntil, Organization + WebSite with SearchAction) · canonical URLs on every public page · **OpenGraph + Twitter share cards** (branded og-default.png, product-image share cards) · web manifest + SVG favicon · branded error boundaries |

## Architecture

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router, standalone) | ^16.1 | RSC rendering, Server Actions, route handlers |
| UI runtime | React | ^19 | Server Components + client islands |
| Language | TypeScript (strict) | ^5 | `noUncheckedIndexedAccess`, no `any` |
| Styling | Tailwind CSS (CSS-first `@theme`) | ^4 | Design tokens pinned to the reference |
| Data | Prisma + SQLite | ^6.11 | 18 models; integer-cent money |
| UI primitives | Radix UI + CVA + lucide-react | latest | Accessible dialogs, selects, sheets, toasts |
| Charts | Recharts | ^3 | Admin revenue/analytics |
| Validation | Zod | ^3.25 | Every external input boundary |
| Tests | Vitest · Playwright | ^3.2 · ^1.64 | 386 unit · 65 e2e |

```mermaid
flowchart TB
    subgraph Client
        B[Browser - RSC payload + client islands]
    end
    subgraph "Next.js 16 (standalone)"
        P[proxy.ts - per-request CSP nonce]
        RSC[Server Components - Prisma reads]
        SA[Server Actions - auth, admin, reviews]
        API[Route Handlers - cart, wishlist, checkout, coupon, search...]
    end
    subgraph Data
        DB[("SQLite - db/custom.db")]
    end
    B --> P --> RSC --> DB
    B --> SA --> DB
    B --> API --> DB
```

### DATABASE_URL contract

`.env` carries `DATABASE_URL="file:../db/custom.db"` with `db/` at the repo root (git-ignored). Relative `file:` URLs resolve against `prisma/schema.prisma` — for the CLI **and** at runtime via `src/lib/db-path.ts` — so push, seed, dev, build and the standalone server all open the same file regardless of working directory. Pinned by `tests/unit/db-path.test.ts`.

## File Hierarchy

```
📂 src/
├── 📂 app/
│   ├── 📂 (storefront)/        # public site + admin (layout = header/footer chrome)
│   │   ├── page.tsx            # home: carousel, categories, featured, new arrivals
│   │   ├── 📂 products/ 📂 product/[id]/   # listing + detail (+ gallery, reviews)
│   │   ├── 📂 cart/ 📂 checkout/ 📂 track-order/ 📂 wishlist/ 📂 account/
│   │   ├── 📂 about/ 📂 contact/ 📂 legal/[slug]/
│   │   └── 📂 admin/           # dashboard, products, orders, categories,
│   │                           # carousel, analytics, settings (role-gated)
│   ├── 📂 (auth)/              # login, register (per-request render for CSP nonces)
│   ├── 📂 api/                 # cart, wishlist, checkout, coupon/apply, cart-summary,
│   │                           # addresses, contact, newsletter, search, health
│   ├── layout.tsx              # fonts, StoreProvider + Toaster (wraps children)
│   ├── globals.css             # Tailwind v4 @theme tokens pinned to the reference
│   └── not-found.tsx / robots.ts / sitemap.ts
├── 📂 components/ (store/, ui/) # header, mobile-nav, footer, product-card, drawer...
├── 📂 lib/                      # db, db-path, auth, cart, wishlist, money, coupons,
│   │                            # order-money, settings, products, validation, csp
│   └── 📂 actions/              # server actions: auth, admin, reviews
└── proxy.ts                     # per-request CSP nonce (Next 16 proxy convention)
📂 prisma/                       # schema.prisma (18 models) + seed.ts (idempotent)
📂 tests/                        # unit/ (Vitest) · e2e/ (Playwright)
📂 db/                           # custom.db (created by db:push, git-ignored)
📂 docs/                         # SSH push skill + screenshots/
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:../db/custom.db` | SQLite file; relative URLs resolve against `prisma/schema.prisma` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical origin for metadata/sitemap/robots |
| `AUTH_SECRET` | dev-only fallback | **Set in production** — HMAC key for session cookies (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_DEMO_MODE` | production: hidden · dev: shown | The login page's demo-credentials quick-fill; production builds hide it by default **and ship no credential strings at all** (server-side prop boundary, session-13), opt in with `"true"` for evaluation deploys |
| `TRUST_CF_CONNECTING_IP` | `"true"` (trust) | Session-13 S13-7: set `"false"` on direct deployments (no Cloudflare edge) so the client-forgeable `cf-connecting-ip` header can't rotate per-IP rate-limit buckets |

## Testing

```bash
npm run test            # 386 unit tests (Vitest, node env; toaster/hero-carousel/quantity-stepper.test.tsx are the component tests, jsdom)
npm run typecheck:tests # the unit/e2e/seed sources are type-checked too
npm run build           # required before e2e (suite starts the standalone server)
npm run test:e2e        # 65 e2e tests (Playwright; server auto-started on :3100)
npx playwright test tests/e2e/mobile-navigation.spec.ts   # single spec
```

- **Unit** covers the money math, the `DATABASE_URL` resolution contract, coupon rules **and lifecycle gates** (incl. the atomic redemption-cap filter), scrypt hashing, Zod schemas (root-relative image URLs, price bounds, bulk cart, address default), order-total derivation, the CSP builder, the route-boundary mappings (health 503 / newsletter+contact+checkout 429s **all carrying `Retry-After`**, the checkout order-number exhaustion), the seed-catalog constants (16 products / Damascus-first / 3 cookware), the `clampSearchTerm` cap, rate limiting **and `clientIp` derivation plus the two-tier review budget** (`reviewRateLimitKeys` — the per-IP ceiling bounds author rotation; `TRUST_CF_CONNECTING_IP="false"` opt-out for direct deploys), the auth-secret gate, order-access tokens **and the `resolveReplay` ownership gate**, order-status transitions **and the guarded `applyOrderStatusTransition`** **plus the guarded carrier-tracking write** (`applyCarrierTracking`), the review-aggregate growth rule **and its transactional `growReviewAggregate`** **plus the S13-4 single-transaction insert+growth semantics (temp-SQLite integration pin)**, the sitemap/robots privacy contract, the cart quantity clamp, the **cart-merge planner**, the **cart-bulk plan** (`dedupeBulkWanted`/`planBulkUpsertQuantity`), the **checkout cart-clear filter** (`cartClearFilter` — checkout deletes only the ordered lines), the **SEO JSON-LD builders + `jsonLdScript` escaping**, the **seed policy** (reseeds never reset live data) **and the backdated catalog order** (`productSeedCreatedAt` — the reference's authored order is the newest-first order), the **numeric settings fallback** (`settingNumber`), the **server-side demo flag** (`demoModeEnabled` — five-cell truth table), the **store-settings boundary schema** (`settingsPatchSchema` clamps), the **UTC month start** (`utcMonthStart`), the **S14-2 API boundary pins** (`api-boundaries.test.ts` — health ok/degraded-503, newsletter/contact malformed-JSON + invalid-body + 429 mappings, checkout 429 + `Retry-After`), the **S14-1 Toaster timer hygiene** (`toaster.test.tsx` — the suite's first component test: auto-dismiss, manual-close timer cancel, unmount cleanup), `interpolateContactEmail`, `newRequestId`, `sessionSweepDue`, the **P2002 target matcher** (`uniqueTargetField` — field arrays, bare strings, and constraint-name strings), the **wishlist cap and its cap-truncating merge plan** (`planWishlistMerge`), the **race-safe `promoteAddressInTx`**, the **default-delete reassignment** (`reassignDefaultAfterDeleteInTx`), and the **address-cap gate** (`assertAddressCap`), plus the **session-16 additions**: the **authoritative wishlist-cap tx gate** (`createWishlistItemInTx` — create-first ordering, the overflow throw, and the wishlist route's 409 / P2002-in-tx boundary mappings, mocked `db` + `next/headers`), the **hoisted boundary schemas** (`wishlistToggleSchema`, `cartLinePatchSchema` with the PATCH 0-deletes-line floor, `couponApplySchema` with the 40-char cap), and the **hero-carousel component pins** (exactly ONE MediaQueryList construction across mount + auto-rotate re-renders + rerender — the S15-5 regression guard — plus auto-rotation and the reduced-motion freeze, jsdom + fake timers + per-test `vi.resetModules()`), plus the **session-17 additions**: the **guarded category delete** (`deleteCategoryIfEmpty` outcomes incl. the P2003 race branch + `isForeignKeyViolation`), the **`MAX_CART_QUANTITY` single-sourcing pin**, and the **cart DELETE `?all=1` boundary pins**, plus the **session-18 additions**: the **checkout saveAddress extraction** (`saveCheckoutAddressInTx` — the "saved"/"at-cap" contract, the unset-before-create order pin, no-writes-at-cap, and the unknown-error rethrow), and the **friendly cart-quantity ceiling messages** (the three cart schemas reject over-ceiling quantities with store copy, not the Zod default), plus the **session-19 additions**: the **S19-2 scoped unset pin** (the checkout save unsets only `isDefault: true` rows), the **`couponInputSchema` boundary table**, the **pure `couponLabel` truth table**, the **guarded coupon actions** (denial / normalization / clash / P2002 / P2025 / rethrow), and the **S19-1 stepper-default pin** (`quantity-stepper.test.tsx` — a mocked ceiling proves the default `max` binds the shared constant), plus the **session-20 additions**: the **narrow `toggleCouponActiveAction`** (writes ONLY `isActive` — the lost-update contract — P2025 narrowed, unknown rethrown), the **`couponRedemptionFilter` truth table** (the checkout increment's always-on `isActive` guard beside the cap clause), the **free_shipping engine/money/schema pins** (label "Free shipping", discount 0 + `freeShipping: true`, minSubtotal enforced; `couponFreeShipping` forces $0 shipping for both methods independent of the threshold; the schema pins value at 0), plus the **session-22 additions**: the **widened coupon engine** (`couponDiscount` carries the marketing `description` through all three success branches; `applyCouponCode` passes it through) and the **single-lookup route contract** (`POST /api/coupon/apply` resolves a coupon with exactly ONE `db.coupon.findUnique` call — `tests/unit/session22-hardening.test.ts`).
- **E2E** covers the reference anatomy (home/products/detail/footer), the full guest checkout → `ORD-YYYY-NNN` → tracking loop **including the token-gated receipt and its guess-denial**, an idempotent checkout replay, the guest-cart merge at login **and the first-login claim (visible cross-device)**, the **guest-wishlist merge at registration**, the admin cancel-restocks-stock flow **and the S13-2 aborted-save toast** (an aborted action surfaces a visible error, never silence), auth success/failure, admin gating, the **S14-3 profile-edit + Sign Out wiring** (the name persists server-side, the seed name is restored, sign-out returns the signed-out header), the **address-book cap** (`addresses-cap.spec.ts`) **and the default-address lifecycle** (`addresses-default.spec.ts`: first address auto-defaults → checkout prefills → promote moves the badge), the **review submission flow** (`reviews.spec.ts`), the **wishlist flows** (`wishlist.spec.ts`: hearts toggle with the **filled-state label flip**, page list, one-request Add All), the **cart badge freshness** (`cart-badge.spec.ts`: the server-rendered count survives a full reload and client navigation), the **cart-API lost-line boundary** (PATCH/DELETE on a gone line → friendly 404/200, never a 500), the **contact + newsletter surfaces** (`contact-newsletter.spec.ts`: UI success states + the 400 boundary incl. malformed JSON), the **SEO/platform contracts** (`seo-platform.spec.ts`: JSON-LD on home + product pages, robots/sitemap, manifest + icon, security headers, no `X-Powered-By`, noindex on private surfaces), the **S13-1 production-bundle credential guard** (the login page's HTML + script chunks contain no seeded passwords) **the S13-3 closed-drawer inert guard** (the invisible drawer is unreachable to keyboard and assistive tech) **and the S16-3 open-drawer modal pin** (the `page-shell` carries `inert` while the drawer is open, 25 Tab presses stay inside the dialog, Escape closes and focus returns to the header cart toggle), and — most importantly — `mobile-navigation.spec.ts`, the **Tailwind v4 regression guard** for the mobile menu (open/navigate/close/active-pill/scroll-lock on an iPhone-13 viewport), plus the **admin-coupons spec** (the session-19 CRUD loop: seeded list → create → apply at the cart → deactivate → reject → delete — **S20-1 hardened**: the cart is seeded through the API with a snapshot-restore cleanup instead of an absolute badge pin on the durable admin cart, and the setup self-heals a leftover code from an aborted run; **S21-1 cookie-corrected**: every admin-identity API call sends the session cookie explicitly — the per-test `request` fixture is identity-isolated), and the **free-shipping spec** (`free-shipping-coupon.spec.ts` — FREESHIP zeroes shipping below the spend threshold through the full money path: cart label → checkout mirror → the SERVER-derived receipt's "FREE", with the mirror pins scoped to the actual Shipping rows, **S21-4**).
- E2E specs wait for hydration (`gotoHydrated`) before interacting; clicking before hydration falls back to native form GET, which is exactly the class of bug the guard exists for.

## Design System

| Token | Value | Usage |
|---|---|---|
| `background` | `hsl(30 20% 98%)` | Warm cream page background |
| `primary` | `hsl(24 70% 50%)` | Terracotta orange — buttons, active nav pill, badges |
| `foreground` | `hsl(20 14% 12%)` | Body text |
| `badge-sale` | `hsl(0 72% 61%)` | Red "−N%" discount pill |
| `badge-featured` | `hsl(24 70% 60%)` | Orange Featured/Best Seller pill |
| `border` | `hsl(33 15% 90%)` | Card borders |

Typography: **Playfair Display** for display headings (`.font-display`), **Inter** for body — both via `next/font`. Radius: `xl` cards (12px), `3xl` heroes (24px). Tailwind v4 CSS-first config in `src/app/globals.css` (`@theme inline`; no `tailwind.config.js`).

## Screenshots

Captured from the running production build — see `docs/screenshots/`:

`01-home` … `11-checkout` · `12-admin-dashboard` … `18-admin-settings` (incl. `15b-admin-coupons`) · `19-account` · `20-mobile-home` · `21-mobile-menu-open` · `22-tracking-locked` · `23-checkout-success-locked` — regenerate with `node scripts/capture-screenshots.mjs` (server on :3000)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `db/custom.db` appears elsewhere / stale rows survive reseed | `DATABASE_URL` shadowed by the process env | Check `node -e "console.log(process.env.DATABASE_URL)"`; converge or unset |
| Page paints but never hydrates (no console errors) | Static prerender + per-request CSP nonce mismatch | Make the route render per-request (`await connection()` — see `(auth)/layout.tsx`) |
| Mobile menu broken after a refactor | Tailwind v4 display-utility toggling | Restore the mount/transform pattern; run the mobile-navigation e2e spec |
| `EADDRINUSE :3100` during e2e | A previous standalone server is alive (process renames to `next-server`) | `pkill -f next-server` |
| Stock-assuming e2e pins fail after many sessions ("In Stock" gone, sold-out 409s) | E2E checkouts permanently drain the traffic-owned demo stock (S14-4) | `npx tsx scripts/restore-demo-stock.ts` (also runs automatically on a fresh e2e server start) |
| npm blocks install scripts | npm's script-approval gate | `npm install-scripts approve @prisma/engines esbuild unrs-resolver` |

## License

MIT — see the repository settings. Reference app © its respective owners; this implementation shares no code with it.
