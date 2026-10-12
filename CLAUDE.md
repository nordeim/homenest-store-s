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
5. **The checkout transaction is the money authority.** `placeOrderTx` (`src/app/api/checkout/route.ts`) re-reads products, re-validates the coupon (`isCouponRedeemable`), derives all money (`computeOrderMoney`), reserves stock with conditional decrements, and burns an `idempotencyKey` — all inside one transaction. Pre-transaction reads are fast-fail UX only.
6. **PII surfaces are capability-gated.** The `/checkout/success` receipt renders only for a valid `order`+`token` pair (`src/lib/order-access.ts`); `/track-order` needs number + purchase email. Both render identical denial shells so order existence is not enumerable.
7. **Evidence over assertion.** A change is done when `lint && typecheck && test && build` is green and affected e2e specs pass — not when it looks right.

## Implementation Standards

### File Organization
- `src/app/(storefront)/` — public site (layout provides header/footer chrome; `force-dynamic`)
- `src/app/(auth)/` — login/register (layout awaits `connection()` — see CSP trap)
- `src/app/(storefront)/admin/` — role-gated back office
- `src/app/api/` — REST route handlers (cart, wishlist, checkout, coupon/apply, cart-summary, addresses, contact, newsletter, search, health)
- `src/components/store/` — storefront UI; `src/components/ui/` — shadcn-style primitives; `src/components/admin/` — reserved for admin-only shared components
- `src/lib/` — db, auth, cart, wishlist, money, coupons, order-money, settings, products, validation, csp, db-path, format
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
- The checkout client holds ONE `idempotencyKeyRef` (`crypto.randomUUID()`) per visit; every order-placement attempt reuses it, and the success redirect carries `order` + `token`.

### API Patterns
- REST handlers return JSON `{ error }` with proper status codes (400 invalid, 404 missing, 409 conflict/stock, 500 unexpected). Malformed JSON is ALWAYS a 400 — split the body-parse into its own try/catch (cart, checkout, wishlist, contact, newsletter, addresses all follow this).
- Client islands `fetch("/api/...")` then `router.refresh()` so server-rendered data stays honest.
- Server Actions return `{ ok: true } | { ok: false, error }` (or `AuthFormState` for useActionState forms) and `revalidatePath` the pages they mutate. Order status changes run through the workflow rules in `src/lib/order-status.ts` (cancelled/delivered are terminal; cancel restocks).

### Next.js Specifics
- App Router with route groups; `generateMetadata` on public pages; `robots.ts` + `sitemap.ts` at the root.
- `next/image` everywhere; images are self-hosted under `public/images/` (optimization disabled in `next.config.ts` so the standalone server needs no sharp).
- Output is `standalone`; `npm run build` copies `.next/static` and `public` into the standalone folder; `npm run start` runs `node .next/standalone/server.js`.

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

- **Unit (Vitest, node env)**: `tests/unit/*.test.ts` — money, db-path contract, coupons (math + lifecycle), password hashing, validation schemas, product projection, order money math, CSP builder, formatting, rate limiter, auth-secret gate, tracking access, cart quantity clamp, order-access tokens, order-status transitions. Run: `npm run test`. New pure logic gets a unit test (red → green).
- **E2E (Playwright)**: `tests/e2e/*.spec.ts` — `mobile-navigation` (the Tailwind v4 regression guard, iPhone-13 emulation on Chromium), `storefront`, `shopping-flow` (guest checkout places a real order, pins the token-gated receipt + idempotent replay), `auth` (incl. the guest-cart merge at login), `admin` (incl. cancel-restocks-stock). Run: `npm run build && npm run test:e2e` (the config starts the standalone server on :3100 itself; it reuses an existing healthy server).
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
