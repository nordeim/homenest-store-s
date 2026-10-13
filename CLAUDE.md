---
IMPORTANT: File is read fresh for every conversation. Be brief and practical.
---

# CLAUDE.md — HomeNest Kitchen

Guidance for Claude Code working in this repository. Complements `AGENTS.md` (commands + traps) and `Project_Architecture_Document.md` (deep architecture).

## Core Identity & Purpose

HomeNest Kitchen is a production-grade e-commerce storefront + admin back office — a visual-and-functional superset of the Base44 reference app at `https://nest-culinary-hub.base44.app/`. Stack: **Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 (CSS-first) · Prisma 6 + SQLite · Radix/shadcn-style UI · Vitest + Playwright**.

Every change must preserve two properties:

1. **Visual parity with the reference** — warm cream background, terracotta-orange primary (`hsl(24 70% 50%)`), serif display headings (Playfair via `.font-display`), the exact header/mobile-menu/footer anatomy captured in `docs/screenshots/`.
2. **Superset functionality** — the reference's full feature set plus wishlist, coupons, order tracking, reviews, legal pages, and a complete admin back office. Never remove a working feature to simplify a change.

## Foundational Principles

1. **Server-first.** React Server Components by default; `"use client"` only for interactive islands (drawers, steppers, forms with live state). Data fetching happens in Server Components via Prisma directly — no client-side data fetching for initial renders.
2. **The server owns the money.** All monetary math is integer cents and re-derived server-side (`computeOrderMoney`) at the only place that matters: `/api/checkout`. Client-side totals are cosmetic mirrors. Never trust prices, discounts, or shipping from the client.
3. **Zod at every boundary.** Every FormData body and JSON payload passes through `src/lib/validation.ts` before touching Prisma. SQLite has no enums — string vocabularies (order status, roles, payment methods) are validated there and nowhere else.
4. **Progressive enhancement for auth forms.** Login/register use `useActionState` + server actions so they degrade to native POSTs; errors render inline from action state; redirects happen inside the action. Credential failures are uniformly "Invalid email or password." — never distinguish unknown-email from wrong-password, and the rate limiter (`src/lib/rate-limit.ts`) stays wired into every unauthenticated write.
5. **The checkout transaction is the money authority.** `placeOrderTx` (`src/app/api/checkout/route.ts`) re-reads products, re-validates the coupon (`isCouponRedeemable`), derives all money (`computeOrderMoney`), reserves stock with conditional decrements, and burns the coupon's `timesUsed` through an atomic guarded `updateMany` (`couponRedemptionWhere`) — all inside one transaction. Pre-transaction reads are fast-fail UX only.
6. **PII surfaces are capability-gated.** The `/checkout/success` receipt renders only for a valid `order`+`token` pair (`src/lib/order-access.ts`); `/track-order` needs number + purchase email. Both render identical denial shells so order existence is not enumerable.
7. **Evidence over assertion.** A change is done when `lint && typecheck && typecheck:tests && test && build` is green and affected e2e specs pass — not when it looks right.

## Implementation Standards

### File Organization
- `src/app/(storefront)/` — public site (layout provides header/footer chrome; `force-dynamic`)
- `src/app/(auth)/` — login/register (layout awaits `connection()` — see CSP trap)
- `src/app/(storefront)/admin/` — role-gated back office
- `src/app/api/` — REST route handlers (cart, cart/bulk, wishlist, checkout, coupon/apply, cart-summary, addresses, contact, newsletter, search, health)
- `src/components/store/` — storefront UI (header, mobile-nav, drawers, product cards); `StoreChrome` renders the WHOLE page shell (`page-shell` div wrapping header + mobile nav + main + footer) so the open cart drawer can inert the background (S16-3) — the layout passes main/footer through as props; `src/components/ui/` — shadcn-style primitives (incl. `toaster.tsx` — the S14-1 timer-registry Toaster — and `toast-primitives.tsx`, whose close button carries `aria-label="Dismiss notification"`, S14-3). The admin dialogs/forms live in their admin route folders (`src/app/(storefront)/admin/**`) and the account address dialog in `(storefront)/account/` — there is no `src/components/admin/` directory (session-14 D2 correction).
- `src/lib/` — db, auth, cart (incl. `cartClearFilter`), cart-merge, cart-bulk (bulk plan), wishlist (cap + `planWishlistMerge` + `getWishlistIds`), money, coupons, order-money, settings (incl. pure `settingNumber`), settings-schema (pure exported `settingsPatchSchema` + clamps), demo-mode (pure `demoModeEnabled` — the server-side demo-box flag), products, seo (JSON-LD builders + jsonLdScript + siteBaseUrl), analytics (top-product folds + dashboard `buildRevenueChart` + `utcMonthStart`), addresses (cap + race-safe promote + `reassignDefaultAfterDeleteInTx` + the checkout save `saveCheckoutAddressInTx` — the S18-1 outcome-returning extraction), admin-categories (the S17-1 guarded category delete `deleteCategoryIfEmpty`), cart-quantity (`MAX_CART_QUANTITY` — the single-sourced 99 ceiling, S17-2), order-access, order-status (transitions + guarded `applyOrderStatusTransition`), order-tracking (access control + guarded `applyCarrierTracking`), review-aggregate (merge + transactional growth), seed-policy (incl. `productSeedCreatedAt` — the backdated catalog order), random-id, prisma-errors (P2002 introspection), rate-limit (incl. two-tier `reviewRateLimitKeys` + the `clientIp` `TRUST_CF_CONNECTING_IP` opt-out), validation, csp, db-path, format
- `src/lib/actions/` — Server Actions (auth, admin, reviews)
- `prisma/` — schema.prisma + seed.ts; `tests/unit/` — Vitest; `tests/e2e/` — Playwright; `db/` — SQLite file (git-ignored)

### Naming Conventions
- Components: PascalCase files (`ProductCard.tsx`); hooks/utilities: camelCase (`useCartTotals` would live in `src/lib` or `src/hooks` if added); tests: `*.test.ts` / `*.spec.ts`.
- Route folders lowercase-kebab; dynamic segments `[id]`, `[slug]`.
- Prisma models PascalCase singular; fields camelCase.

### State Management
- **No global client state library is used.** Shared UI state (mobile nav, cart drawer, cart badge) lives in `StoreProvider` (`src/components/store/store-provider.tsx`). Durable state (cart, wishlist, sessions, catalog, orders) lives in SQLite, read through Server Components.
- Cart count syncs client→server via `setCartCount` after cart mutations and `router.refresh()` for server truth. Optimistic islands (drawer) mirror the server's clamped `quantity` from the PATCH response so local state can never disagree with the cart.
- Coupon codes hand off cart→checkout through `sessionStorage["homenest_coupon"]`.
- The checkout client holds ONE `idempotencyKeyRef` (`newRequestId()` — `crypto.randomUUID` with a non-secure-origin fallback, `src/lib/random-id.ts`) per visit; every order-placement attempt reuses it, and the success redirect carries `order` + `token`.

### API Patterns
- REST handlers return JSON `{ error }` with proper status codes (400 invalid, 404 missing, 409 conflict/stock, 500 unexpected). Malformed JSON is ALWAYS a 400 — split the body-parse into its own try/catch (cart, checkout, wishlist, contact, newsletter, addresses all follow this).
- Client islands `fetch("/api/...")` then `router.refresh()` so server-rendered data stays honest.
- Server Actions return `{ ok: true } | { ok: false, error }` (or `AuthFormState` for useActionState forms) and `revalidatePath` the pages they mutate. Order status changes run through the workflow rules in `src/lib/order-status.ts` (cancelled/delivered are terminal; cancel restocks).

### Next.js Specifics
- App Router with route groups; `generateMetadata` on public pages; `robots.ts` + `sitemap.ts` at the root. JSON-LD structured data comes ONLY from `src/lib/seo.ts` builders (Product on detail pages; Organization + WebSite in the storefront layout) — data blocks, not scripts, so CSP nonces don't apply.
- `next/image` everywhere; images are self-hosted under `public/images/` (optimization disabled in `next.config.ts` so the standalone server needs no sharp). Product image URLs are scheme-validated (`imageUrlSchema`) — external hosts need a CSP widening decision first.
- Output is `standalone`; `npm run build` copies `.next/static` and `public` into the standalone folder; `npm run start` runs `node .next/standalone/server.js`.
- Branded error boundaries ship: `(storefront)/error.tsx` + `global-error.tsx`; `poweredByHeader: false`; HSTS includes subdomains; `Permissions-Policy` disables camera/mic/geo/payment. App icon (`src/app/icon.svg`) + web manifest (`src/app/manifest.ts`) — keep `tests/e2e/seo-platform.spec.ts` green.

## Development Workflow

1. Read the relevant section of `AGENTS.md` first — it lists the traps that have actually bitten (env shadowing, Tailwind v4 display utilities, CSP nonces, process-name pkill).
2. Before writing: read the complete target file(s), the Prisma schema, and one exemplar page (`src/app/(storefront)/page.tsx` is the canonical style).
3. Implement the smallest change that satisfies the request without weakening security or tests.
4. Verify: `npm run lint && npm run typecheck && npm run test` for logic changes; add `npm run build && npx playwright test <relevant spec>` for UI changes.
5. Commit atomically with a Conventional-Commits message explaining **why**.

### Tailwind v4 rules (non-negotiable)
- Theme lives in `src/app/globals.css` under `@theme inline` with FULL `hsl()` values. No `tailwind.config.js`.
- Never JS-toggle `hidden` (or any display utility) — mount conditionally or animate transform/opacity. The mobile menu is the reference implementation.
- Hover variants are un-gated via `@custom-variant hover (&:hover)` — do not remove.
- `--shadow-sm`, blur, and radius pins exist to match the reference; leave them.

### CSP rules (non-negotiable)
- `src/proxy.ts` issues a per-request nonce. Any page that must hydrate must render per-request: dynamic pages do automatically; any route that prerenders needs `await connection()` in its layout (see `(auth)/layout.tsx`).
- New script sources are prohibited; new image sources go in `next.config.ts` `images.remotePatterns` and CSP `img-src` together if ever needed.

## Testing Strategy

- **Unit (Vitest, node env)**: `tests/unit/*.test.ts` + the suite's first component test `tests/unit/toaster.test.tsx` (`.tsx` with a `@vitest-environment jsdom` docblock — fake-timer auto-dismiss, manual-close timer cancel, unmount cleanup; S14-1) — money, db-path contract, coupons (math + lifecycle + the atomic redemption-cap filter), password hashing, validation schemas (root-relative image URLs, price bounds, bulk cart, address default), product projection, order money math, CSP builder, formatting, rate limiter + spoof-resistant `clientIp(Headers)` (CF-Connecting-IP → rightmost XFF → direct) + the two-tier review budget keys (`reviewRateLimitKeys`), auth-secret gate, tracking access + the guarded `applyCarrierTracking`, cart quantity clamp, cart-merge planner (incl. the stock clamp), the checkout cart-clear filter (`cartClearFilter` — S12-1), order-access tokens + replay ownership + `resolveReplay`, order-status transitions + the guarded `applyOrderStatusTransition`, review-aggregate growth (+ the transactional `growReviewAggregate`), analytics folds + the dashboard `buildRevenueChart`, the cart-bulk plan (`dedupeBulkWanted`/`planBulkUpsertQuantity`), the race-safe `promoteAddressInTx` + the delete-default reassignment (`reassignDefaultAfterDeleteInTx`) + the cap gate (`assertAddressCap`), the cap-truncating wishlist merge plan (`planWishlistMerge`), sitemap/robots privacy, SEO JSON-LD builders (incl. priceValidUntil) + `jsonLdScript` escaping, seed policy (`productSeedUpdate` + `productSeedCreatedAt` — the backdated reference order, S12-5), the numeric settings fallback (`settingNumber`), the server-side demo flag (`demoModeEnabled`, five-cell truth table), the UTC month start (`utcMonthStart`), the store-settings boundary schema (`settingsPatchSchema` clamps, C8), the S13-4 single-transaction review insert+growth semantics (temp-SQLite integration pin), the `clientIp` `TRUST_CF_CONNECTING_IP` opt-out (S13-7), the S14-2 route-handler boundary pins (`tests/unit/api-boundaries.test.ts` — health ok/degraded-503 with a mocked `db`, newsletter malformed-JSON/invalid-body/429 + `Retry-After`, contact 429 + `Retry-After`, checkout 429 + `Retry-After` + the strengthened in-budget assertion (S15-1), the order-number allocation-exhaustion pin (C1: five P2002s on the NUMBER → 500, replay branch never consulted — mocked `next/headers` cookies)), the seed-catalog constants pin (`tests/unit/seed-catalog.test.ts` — 16 products / Damascus-first / 3 cookware / 8 categories, the values the storefront e2e pins assume; Playwright cannot import the seed), the search-term clamp (`clampSearchTerm`), `interpolateContactEmail`, `newRequestId`, `sessionSweepDue`, P2002 target matching (`uniqueTargetField`), wishlist cap, the S16-1 authoritative wishlist-cap tx gate (`createWishlistItemInTx` create-first ordering + the overflow throw + the route's 409/P2002-in-tx mappings — `tests/unit/session16-hardening.test.ts`, mocked `db` + `next/headers`), the S16-2 hoisted boundary schemas (`wishlistToggleSchema` / `cartLinePatchSchema` with its PATCH 0-deletes-line floor / `couponApplySchema`), and the S16-4 hero-carousel pins (ONE MediaQueryList construction across re-renders, auto-rotation, reduced-motion freeze — jsdom + fake timers + per-test `vi.resetModules()` for the module-level cache), plus the session-17 additions (`tests/unit/session17-hardening.test.ts`): the guarded category delete (`deleteCategoryIfEmpty` outcome mapping incl. the P2003→in-use race branch + the `isForeignKeyViolation` duck-type truth table), the `MAX_CART_QUANTITY` single-sourcing pin (schemas interpolate the shared constant), and the cart DELETE `?all=1` boundary pins (api-boundaries.test.ts: no-cart → `{itemCount:0}` + no write; guest cart → cartId-scoped `deleteMany` + fresh summary), plus the session-18 additions (`tests/unit/session18-hardening.test.ts`): the checkout saveAddress extraction (`saveCheckoutAddressInTx` — the "saved"/"at-cap" outcome contract, the unset-before-create order pin, no-writes-at-cap, the unknown-error rethrow — closing the carried S18-4a skip-save pin), and the friendly cart-ceiling messages (the three cart schemas reject over-ceiling quantities with the interpolated store copy, not the Zod default). Run: `npm run test`. New pure logic gets a unit test (red → green). Tests + seed + configs are type-checked separately: `npm run typecheck:tests` (`tsconfig.tests.json`) — keep it green too.
- **E2E (Playwright)**: `tests/e2e/*.spec.ts` — `mobile-navigation` (the Tailwind v4 regression guard, iPhone-13 emulation on Chromium), `storefront` (the cardinality pins assert the count FORMAT + seeded slugs — not absolute DB row counts, S15-2), `shopping-flow` (guest checkout places a real order, pins the token-gated receipt + idempotent replay + its ownership denial for a fresh context + the no-email-promise copy + the S10-2 cart-PATCH-404 pin), `auth` (incl. the guest-cart merge at login, the first-login CLAIM visible cross-device, AND the S10-4 guest-wishlist merge at registration, plus the S14-3 profile-edit + Sign Out wiring pin — the name persists server-side, the seed name is restored, sign-out returns the signed-out header), `admin` (incl. cancel-restocks-stock), `seo-platform` (JSON-LD blocks, robots/sitemap, manifest/icon, security headers + no X-Powered-By, site-wide OG/Twitter share cards + canonicals, noindex on private surfaces), `addresses-cap` (the 20-address cap returns a friendly 409), `addresses-default` (first address auto-defaults, checkout prefills, promote moves the badge), `reviews` (submit → published; server-side boundary error), `wishlist` (hearts toggle with the S11-2 filled-state label flip, page lists, one-request Add All), `cart-badge` (the badge shows the server-rendered count after a full reload and survives client navigation — the S9-1 regression guard), `contact-newsletter` (the support/marketing capture surfaces: UI success states + the 400 boundary incl. malformed JSON), the S13-1 production-bundle credential guard (the login page's HTML + every referenced script chunk contain no seeded password strings), the S13-3 closed-drawer inert guard (the invisible drawer is keyboard/AT-unreachable and drops `inert` while open), and the S13-2 aborted-save toast (an aborted admin action surfaces a visible destructive error, never silence), plus the S16-3 open-drawer modal pin (the `page-shell` inerts while the drawer is open, 25 Tabs stay inside the drawer, Escape closes and restores focus to the header cart toggle). Run: `npm run build && npm run test:e2e` (the config starts the standalone server on :3100 itself; it reuses an existing healthy server).
- **E2E conventions**: always `gotoHydrated(page, url)` before interacting (hydration race = native GET fallback); assert async cart effects via the `data-testid="cart-count"` badge before navigating; off-canvas drawers assert `not.toBeInViewport()` + `pointer-events-none`, not `toBeHidden()`.
- Bug fixes require a regression test that fails before the fix. The three production bugs this suite caught (Toaster nesting, CSP hydration, cart-badge races) each have a pinned test.

## Code Quality Standards

- TypeScript `strict` + `noUncheckedIndexedAccess`; `any` is banned (ESLint errors on it). Use `unknown` + narrowing.
- Every list renders an empty state; every async action has error handling and disabled-while-pending buttons; every icon-only button has an `aria-label`; every input has a label.
- WCAG 2.2 AA: focus-visible rings, semantic landmarks, `aria-current` on nav, labeled dialogs (`role="dialog"` + `aria-modal`).
- No secrets in the repo; `.env` is git-ignored; logging never includes credentials or PII.
- Comments explain why (trap IDs, invariants), never what.

## Git & Version Control

- `main` only; Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`); atomic commits; never commit `.env`, keys, or `db/*.db` (`.gitignore` enforces).
- Pushes go through `docs/ssh_git_wrapper_v3.py` per `docs/how-to-git-push-using-ssh-wrapper_SKILL.md` — the local clean-check gate is the only CI.
- Remote: clone `https://github.com/nordeim/homenest-store-s.git`; push target `git@github.com:nordeim/homenest-store-s.git`.

## Error Handling & Debugging

- Reproduce before fixing; classify the gate (install / typecheck / lint / test / build / runtime) before touching code.
- Server actions never throw raw errors to users — they return typed results; route handlers map failures to status codes; pages render error/empty states.
- Debugging a "page renders but nothing works" issue: check hydration (`html[data-hydrated]`) then CSP nonce match (`curl -sI <url>` vs script tags in HTML) before suspecting React code.
- After fixing, verify against the original failure and look for the same pattern elsewhere; document non-obvious root causes in code comments (trap-log style) and `docs/`.

## Communication & Documentation

- Keep `AGENTS.md`, `CLAUDE.md`, `README.md`, and `Project_Architecture_Document.md` in sync with behavior changes. Update the trap logs when a new class of failure is discovered.
- Commit messages and PR-style summaries state what changed, why, and what was verified.

## Project-Specific Standards

- **Reference parity**: when touching header, footer, mobile menu, product cards, or home sections, compare against `docs/screenshots/` (and the live reference) before and after.
- **Seeds are idempotent** (`prisma/seed.ts` upserts by natural keys); demo accounts and the 16-product catalog must survive a re-seed.
- **The admin surface is a superset requirement** — dashboard KPIs + revenue chart, products/categories/carousel CRUD, order status workflow + tracking, analytics, settings. Keep them functional end-to-end, not stubs.
- The storefront checkout is an explicitly-labeled demo payment (no processor); do not remove the "no real charge" notices.

## Anti-Patterns to Avoid

- Adding a `tailwind.config.js`, bare HSL triplets in `@theme`, or `@apply`-heavy styling.
- Toggling display utilities from JS; `document.querySelector`-style DOM access instead of React state.
- Client-side money math treated as authoritative; trusting `FormData` without Zod; catching errors silently.
- Rendering client components where Server Components suffice; fetching in `useEffect` what Prisma can render server-side.
- Weakening a gate (deleting tests, loosening types, disabling lint rules) to make a build pass — fix the underlying issue or flag the debt explicitly.
