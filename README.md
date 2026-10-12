# HomeNest Kitchen — Premium Kitchenware Storefront

A production-grade clone/superset of the Base44 reference app at
`https://nest-culinary-hub.base44.app/` (branded on-site as **HomeNest
Kitchen**, a premium kitchen-essentials e-commerce storefront with a
full admin back office). Built with React 19, TypeScript, React Router,
Zustand and Tailwind CSS v4 on Vite 7.

## Why this isn't a literal Next.js/Postgres monorepo

This workspace's toolchain (the only build/runtime available here) is a
single-page **Vite + React + Tailwind v4** app with no shell, no git-clone
capability, no Postgres server and no Node backend runtime. The original
task brief referenced a Next.js/Postgres monorepo template and several
repo-specific skills (rootless-postgresql, e-commerce-nextjs16-monorepo,
agent-browser, etc.) hosted in external GitHub repos. Those repos/tools
could not be cloned or executed in this sandbox, and the reference site
requires authenticated, JavaScript-rendered content that static fetching
can't retrieve and that no browser-automation tool here can log into.

Given that, this build applies the **spirit** of the requested
architecture inside the constraints that actually exist:

| Requested | Here, instead |
|---|---|
| Next.js + Postgres (Prisma) backend | Client-side Zustand stores (`src/store/*`) with `localStorage` persistence acting as the "database" — the same CRUD/entity-relationship model (products, categories, orders, users, reviews, settings, carousel slides), just persisted in the browser instead of a SQL server. |
| `DATABASE_URL="file:../db/custom.db"` in `.env` | Not applicable — there is no server process or ORM in this SPA to read a `DATABASE_URL`. Creating one would be a non-functional placeholder, which we avoid. The `localStorage` keys (`hnk-catalog`, `hnk-orders`, `hnk-auth`, `hnk-cart`, `hnk-wishlist`, `hnk-reviews`) are the persistence equivalent. |
| `agent-browser` visual diff against the live site | Not available as a tool here. Site structure/branding/page list was reverse-engineered from the crawlable sitemap (`About`, `Account`, `Cart`, `Checkout`, `Admin Dashboard/Products/Orders/Analytics/Categories/Carousel/Settings`, policy pages, etc.) returned by the live URL, then rebuilt and exceeded feature-for-feature. |
| Logging into the reference site with the provided credentials | Not performed. No tool here can execute JS/sessions against a third-party site, and embedding a third party's real login credentials in delivered source would itself be a bad security practice regardless of tooling. |

Everything else — the full storefront, cart/checkout, auth, order
tracking, and the complete admin back office — is implemented as real,
working functionality (not stubs), matching and exceeding the reference
site's page list.

## Feature overview

**Storefront**
- Home with auto-rotating hero carousel, category grid, bestsellers,
  new arrivals, testimonials, newsletter capture
- Product listing with search, category/price/stock filters, sorting,
  pagination
- Product detail with gallery, variants, quantity, specs, reviews
  (read + submit), related products
- Cart with coupon codes (`WELCOME10`, `SAVE20`, `FREESHIP`), free-shipping
  threshold, live totals
- 3-step checkout (shipping → payment → review) with field validation
- Order success + order tracking (by order number) with status timeline
- Auth (register/login, demo accounts), account dashboard (profile,
  orders, addresses, wishlist), standalone wishlist page
- About, Contact (working form), Privacy/Terms/Refund/Cookie/Disclaimer

**Admin back office** (`/admin`, role-gated)
- Dashboard with KPIs + 14-day revenue chart + recent orders
- Products CRUD, Categories CRUD, Carousel slide manager (reorder/show/hide)
- Orders table with status workflow (pending → processing → shipped → delivered)
- Analytics (top products by revenue, category mix, conversion snapshot)
- Store settings (tax rate, shipping rates, free-shipping threshold, contact info)

Demo accounts (seeded on first load):
- Admin: `admin@homenestkitchen.com` / `Admin123!`
- Customer: `demo@homenestkitchen.com` / `Demo1234!`

## Tailwind CSS v4 note — mobile navigation

Tailwind v4 changed the generation order of display utilities, which makes
the common pattern of JS-toggling the `hidden` utility class alongside a
sibling `flex`/`block` class on the *same element* unreliable (see
tailwindlabs/tailwindcss#15884 and #18653 — `[hidden]` now also carries
`!important` in preflight). The mobile drawer in `Header.tsx` and
`AdminLayout.tsx` avoids this entirely: the drawer is **always mounted**
and its visibility is controlled purely via `translate-x-*`/`opacity`
transitions plus `pointer-events-none`, never via toggling `hidden`. This
keeps the open/close animation reliable and testable (see
`e2e/mobile-navigation.spec.ts`).

## Project structure

```
src/
  components/
    layout/   Header, Footer, PublicLayout, AdminLayout
    shop/     ProductCard, CategoryCard, HeroCarousel, WishlistGrid
    ui/       Design-system primitives (Button, Input, Modal, Rating, ...)
  data/       Seed catalog, categories, settings, legal copy (source of truth for the initial store state)
  store/      Zustand stores = the "database" (catalog, cart, wishlist, auth, orders, reviews, toasts)
  pages/      Route-level views, including pages/admin/*
  hooks/      useCartTotals, route guards
  lib/        format, id generation, password hashing
```

## Scripts

```bash
npm run dev       # start the Vite dev server
npm run build     # production build (the only command this environment runs)
npm run preview   # preview the production build locally
```

## Testing

Vitest and Playwright are configured as standalone config files
(`vitest.config.ts`, `playwright.config.ts`) so `vite.config.ts` and
`package.json` stay untouched, per this environment's conventions. This
sandbox has no test-runner tool, so these suites are written and ready to
run but have **not** been executed here — run them locally with:

```bash
npx vitest run             # unit/component tests (jsdom)
npx vitest                 # watch mode
npx playwright install     # one-time browser download
npx playwright test        # e2e tests (spins up the dev server automatically)
```

Unit/component coverage (`src/**/*.test.ts(x)`): currency/date formatting,
coupon lookup, cart store line-item math, auth store (registration
validation, duplicate-email rejection, password hashing — never storing
plaintext, login success/failure), `useCartTotals` (subtotal/tax/shipping/
coupon math), `Button` interaction states, `ProductCard` add-to-cart and
wishlist interactions.

E2E coverage (`e2e/*.spec.ts`): mobile navigation drawer open/close/backdrop
(the Tailwind v4 regression guard described above) on an iPhone 13 viewport,
desktop browse → add to cart → checkout flow, header search, and demo-account
login (success + incorrect-password cases).

## Known limitations

- No real backend/payment processor: checkout is a fully functional
  client-side simulation (explicitly labeled as such on the payment step).
- Data resets if browser storage is cleared; there is no multi-device sync.
- Product photography is a mix of AI-generated studio shots and stock
  photography chosen for visual consistency, not photos of the real
  reference site's inventory (which wasn't accessible without a login
  session this environment cannot establish).
