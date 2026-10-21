# Session 124 — Run narrative (run 67, the session-66 cycle)

> This file is the narrative log of the **67th run** — the thirty-fourth
> remediation cycle: the fresh-clone recovery after sandbox reset #16 +
> the rebuilt-grid verifier-hardening cycle. `docs/session_123.md` holds
> the previous run's operator raw log; the run/plan numbering drift is
> documented in `docs/session_52.md`. Zero changes in src/tests/prisma —
> the change-set is the 1 traffic-owned screenshot (03's irreducible
> review-ID band) + the docs sweep.

## 1. The recovery and the review

The sandbox reset wiped everything (the repo clone, node_modules, db/,
the reference clone, the persisted research/ verifiers) — reset #16.
The environment was rebuilt from the documented runbook: `git clone` to
`38bccea` on main (the operator's session_123.md raw-log commit over
run-66's `a997080`), npm install (Next 16.4.0 / Prisma 6.19.3, 591
packages), `.env` with the DATABASE_URL contract + a fresh AUTH_SECRET,
`db:setup` with every seed pin DB-verified (Damascus-first
19999/27999/412 reviews/24 stock in the rendered newest-first order;
coupons FREESHIP→SAVE20→WELCOME10 all 0-used; the 0 orders / 16 template
reviews / 2 users baseline), and chromium-1248 reinstalled for
Playwright.

The docs review covered AGENTS.md, CLAUDE.md, README.md, PAD, the SKILL
at v1.62.0, session_122.md + session_123.md, the plan's Session 65
section, and the worklog Task 66. The documented contracts were verified
in source before any work: the db-path resolution anchors, the sitemap
privacy + STATIC_ROUTES, the robots disallow set, the mobile-nav
conditional mount + zero classList matches repo-wide, the .env.example
env surface, the skills exclusion from every gate's scope (vitest
include / playwright testDir / eslint global-ignores / both tsconfigs),
and .gitignore.

The DATABASE_URL process-env shadow re-confirmed
(`file:/home/z/my-project/db/custom.db`, sourced from the sandbox-remnant
`/home/z/my-project/.env`) and converged via the documented SYMLINK
disposition (`ln -sfn <repo>/db /home/z/my-project/db`): one setup, and
both env winners open the same file across every later command, subshell,
and backgrounded server.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 22.88s**
(52 files) · **build green, zero prisma:error** (grep-verified; 22/22
static pages; the standalone server.js present) · **67/67 e2e at 1.9m**
— the run doubling as the documented traffic generator: 5 orders
(ORD-2026-001…005) / 17 reviews / Damascus 413 / FREESHIP 1, all
DB-verified, then restore-demo-stock re-topped Damascus 21→24 + French
Rolling Pin 43→44.

## 3. The verification surfaces

- **Reference repo** re-verified at `1ffda3d` — `git fetch` +
  `rev-parse`: local HEAD == origin/main (in sync, cloned OUTSIDE the
  repo tree).
- **Skills comparison**: the operator-curated superset re-confirmed —
  **2607 files = the reference's 2598 + the operator's 9** (find-based;
  rg's ignore-file filtering undercounts both sides by exactly 39 — the
  counting-method gloss: verify superset arithmetic with `find`, never
  `rg --files`); the shared skills-catalog.md md5 IDENTICAL
  (f69408bf…); zero reference skill files missing from homenest.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by
  source read on both sides — the reference lists login/register/wishlist
  in its sitemap and has no DB-failure guard; the clone excludes every
  private surface, adds about/contact + the 5 legal routes, is
  DB-failure-safe (try/catch around the product query), and uses the
  cuid `/product/[id]` route. No adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (10709 bytes) on / and /products — stable across immediate + delayed
  ~45s retries. The THIRTEENTH consecutive unavailable cycle
  (environmental); the documented parity baseline carried every
  expectation.
- **Clone parity grid**: REBUILT from scratch (the git-ignored
  research/ verifiers died with the reset) — **64/64 discrete checks
  PASS (43 static + 21 mobile)** with FOUR script-side corrections en
  route (all zero repo impact — the cycle's lessons):
  1. *The strict-mode multi-match phantom-fail class*: "New Arrivals"
     names BOTH the rotating hero-slide h1 AND the grid-section h2 — the
     locator threw a strict-mode violation that `.catch(() => false)`
     reported as a content failure. Fixed with `.last()`.
  2. *The rotating-hero-h1 brand-anchor class*: the home h1 IS the hero
     slide title (it rotates: New Arrivals / Elevate Your Kitchen /
     Sale); the brand lives in the header link ("HomeNest home").
     Fixed by pinning the header brand link.
  3. *The implicit-region CSS-attribute trap*: an aria-labelled
     `<section>` carries the implicit region role in the a11y tree but
     never a literal `role="region"` attribute — `[role="region"]` as a
     CSS selector matches nothing. Fixed with
     `getByRole("region", { name: "Featured collections" })`.
  4. *The flat /images/ product path*: the gallery pins by
     `img[alt="<product name>"]` (the main gallery image carries
     alt=name; thumbnails alt="" decorative-correct).
  The mobile grid encodes the full Tailwind v4 contract — conditional
  mount, toggle-closes, scroll lock, the bg-primary active pill, the
  panel search flow (the waitForURL lesson re-encoded), no horizontal
  overflow at 390px — 21/21.
- **agent-browser cross-check** (the operator-requested supplementary
  surface): the mobile-nav open/close cycle via the interactive a11y
  tree (the hamburger toggles its own aria-label Open → Close menu; the
  panel mounts with the searchbox + the "Mobile" navigation landmark +
  the 5 nav links + Sign In + Wishlist; the body scroll lock engages;
  the route change closes the panel); the panel search flow
  (`q=mixer` → Professional Stand Mixer); the desktop search flow; the
  product-detail anatomy (In Stock / Add to Cart / Buy Now / Customer
  Reviews); ZERO console or page errors; supplementary rasters parked
  in git-ignored `research/agent-browser/` via absolute paths. One CLI
  lesson: `find role searchbox fill "A" "B"` concatenates the
  positional args into the fill value — use snapshot refs for
  multi-arg actions.
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks, the hidden
  Server Action inputs excluded, decorative `alt=""` counted CORRECT).
- **Deep audit 67-a** (read-only subagent): **9/9 code anchors PASS,
  zero actionable findings** — the twentieth consecutive clean audit,
  verified anchor-by-anchor with file:line evidence (the mobile-nav
  conditional mount + ZERO classList matches; the full-hsl() `@theme
  inline` + the `@custom-variant hover` + no tailwind.config.*; the
  sitemap/robots/noindex trifecta; the schema-anchored db-path
  resolution; the in-tx money authority with the Stripe TOCTOU
  double-check; the HMAC/DB-session auth with the production secret
  gate; the skills/ exclusion across all five tooling configs; the
  Stripe retrofit's off-by-default gating with its byte-identity pins).
  Its one informational note — the untracked
  `scripts/verify-seed-pins.ts` scratch — disposed by the documented
  scratch-class move to git-ignored `research/`.
- **Standing conflict-marker grep gate**: CLEAN (fifth consecutive
  cycle — zero matches repo-wide in the audit's ripgrep sweep).

## 4. The screenshots

The documented final-capture sequence on the normalized DB — the
**rm-before-reseed lesson** (db:setup alone NEVER resets live data: the
first "reseed" still carried 5 orders / 17 reviews / 7 users / FREESHIP
1 — the S7-3 seed policy is content-only; only `rm db/custom.db` +
db:setup restored the documented 0/16/2 baseline with every pin
DB-verified: Damascus-first 19999/27999/412/24, coupons 0-used) → ONE
e2e as the traffic generator (the exact class above; the e2e-minted
review "E2E review 1792623854083" @ 23:04:14.597Z, DB-exact) →
restore-demo-stock (Damascus 21→24 + French Rolling Pin 43→44) → the
single clean capture on a COLD server after the 60s login-limiter
window (the kill-by-port-owner discipline applied preventively at EVERY
server transition — zero orphaned-server incidents): **25/25 green,
zero failures** (the single-shot S53-1 gate).

Byte-level diff vs `git show HEAD:` ground truth: **24/25
byte-identical** — every deterministic pin held (04b-cart-coupon-hint,
21-mobile-menu-open, 10-register, all nine admin shots, 05-login,
15b-admin-coupons, 02-products, 01-home, 04-cart, 06–09, 11-checkout,
13, 15–20, 22, 23). The single changed shot, the documented class:

- **03-product-detail**: 550 px (0.0154%) confined to the single
  documented 11-row band y1168-1178 — the irreducible review-ID band,
  exactly this run's e2e-minted row (DB-exact). 10-register stayed
  byte-identical this cycle (the raster-noise class did not fire).

The pixel-band classifier (pngjs installed `--no-save`, the script
parked in git-ignored `research/`) left the package manifests untouched
— verified by git status.

## 5. S66-1 (docs sweep)

The plan's Session 66 section; SKILL v1.62.0 → v1.63.0 (project_state
opening "sessions 2-65" → "sessions 2-66" + the Session 66 Appendix B
entry with the four lessons: the strict-mode multi-match phantom-fail
class; the rotating-hero-h1 brand-anchor + implicit-region
CSS-attribute trap; the db:setup never-resets-baseline class; the
thirteenth consecutive dark-cycle disposition); AGENTS plan range
2..65 → 2..66; the CLAUDE unit-bullet session-66 tail; this file; the
repo worklog Task 67. README/PAD/DEPLOYMENT drift-checked accurate —
unchanged (the 496/67/8-env-var anchors stay accurate).

## 6. Final gates and the push

Final gates re-ran green on the final tree (lint · typecheck ·
typecheck:tests · 496/496 unit); single commit to main; SSH-wrapper
push (`docs/ssh_git_wrapper_v3.py` with the `--remote` override to
`git@github.com:nordeim/homenest-store-s.git`; the key materialized to a
0600 tmp file outside the repo, shredded after verification).
