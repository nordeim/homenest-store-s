# Session 122 — Run narrative (run 66, the session-65 cycle)

> This file is the narrative log of the **66th run** — the thirty-third
> remediation cycle: the fresh-clone recovery after sandbox reset #15 +
> the verifier-expectation hardening cycle. `docs/session_121.md` holds
> the previous run's operator raw log; the run/plan numbering drift is
> documented in `docs/session_52.md`. Zero changes in src/tests/prisma —
> the change-set is the 2 traffic-owned screenshots (03's irreducible
> review-ID band + 10-register's raster-noise micro-class at the
> identical band positions as run-65's receipt) + the docs sweep.

## 1. The recovery and the review

The sandbox reset wiped everything (the repo clone, node_modules, db/,
the reference clone, the persisted research/ verifiers) — reset #15. The
environment was rebuilt from the documented runbook: `git clone` to
`7b93264` on main (the operator's session_121.md raw-log commit over
run-65's `819ce14`, 1 file / 107 insertions, verified by `git show
--stat`), npm install (Next 16.4.0 / Prisma 6.19.3), `.env` with the
DATABASE_URL contract + a fresh AUTH_SECRET, `db:setup` with every seed
pin DB-verified (Damascus-first 19999/27999/412 reviews/24 stock in the
rendered newest-first order; coupons FREESHIP→SAVE20→WELCOME10 all
0-used; the 0 orders / 16 template reviews / 2 users baseline), and
chromium-1248 reinstalled for Playwright.

The docs review covered AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, the SKILL at v1.61.0, session_120.md +
session_121.md, the plan's Session 64 section, and the worklog Task 65.
The documented contracts were verified in source before any work: the
db-path resolution anchors, the sitemap privacy + STATIC_ROUTES, the
robots disallow set, the mobile-nav conditional mount, the .env.example
env surface (8 vars incl. the Stripe trio), the skills exclusion from
every gate's scope (vitest include / playwright testDir / eslint global-
ignores / both tsconfigs), and .gitignore.

The DATABASE_URL process-env shadow re-confirmed
(`file:/home/z/my-project/db/custom.db`, sourced from the sandbox-remnant
`/home/z/my-project/.env`) and converged via the documented SYMLINK
disposition (`ln -sfn <repo>/db /home/z/my-project/db`): one setup, and
both env winners open the same file across every later command, subshell,
and backgrounded server.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 24.55s**
(52 files) · **build green, zero prisma:error** (grep-verified; the
standalone server.js present) · **67/67 e2e at 1.9m** — the run doubling
as the documented traffic generator: 5 orders (ORD-2026-001…005) / 17
reviews / Damascus 413 / FREESHIP 1 / latest ORD-2026-005, all
DB-verified, then restore-demo-stock re-topped Damascus 21→24 + French
Rolling Pin 43→44.

## 3. The verification surfaces

- **Reference repo** re-verified at `1ffda3d` — `git fetch` +
  `rev-parse`: local HEAD == origin/main (in sync, cloned OUTSIDE the
  repo tree).
- **Skills comparison**: the operator-curated superset re-confirmed —
  2607 files = the reference's 2598 + the operator's 9; the shared
  skills-catalog.md md5 IDENTICAL (f69408bf…); zero reference skill
  files missing from homenest.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by
  source read — the reference lists login/register/wishlist in its
  sitemap and has no DB-failure guard; the clone excludes every private
  surface, adds about/contact + the 5 legal routes, is DB-failure-safe,
  and uses the cuid `/product/[id]` route. No adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (~10632 bytes) on /, /products, /login — stable across immediate +
  delayed ~45s retries. The TWELFTH consecutive unavailable cycle
  (environmental); the documented parity baseline carried every
  expectation.
- **Clone parity grid**: REBUILT from scratch (the git-ignored
  research/ verifiers died with the reset) — **61/61 discrete checks
  PASS (43 static + 18 mobile)** with TWO script-side corrections en
  route (both zero repo impact — the cycle's lessons):
  1. *The verifier-nav waitForURL class*: the first run reported four
     phantom static failures (In Stock / Buy Now / Customer Reviews /
     the login heading) — three of them the destination-surface checks
     running against the still-rendered `/products` grid because a
     `next/link` click schedules an async client-side navigation and
     `waitForLoadState("networkidle")` was already resolved; the fourth
     a stale heading-string guess (the login page's h1 is "Welcome to
     HomeNest Kitchen"). Fixed in the verifier with
     `page.waitForURL(/\/product\//)` + the correct heading pattern.
  2. *The empty-alt vs missing-alt a11y distinction*: the first a11y
     run reported six phantom img failures across home + product-detail
     — every one of them the CORRECT decorative pattern (`alt=""` on
     the hero-carousel slides, aria-hidden'd when inactive, and on the
     gallery thumbnails whose buttons carry their own accessible
     names). The img check must use `hasAttribute("alt")`, never
     truthiness of `getAttribute`.
  The mobile grid passed 18/18 on the FIRST run, untouched — the
  Tailwind v4 mobile-nav contract (conditional mount, toggle-closes,
  scroll lock, the bg-primary active pill, the panel search flow) holds.
- **agent-browser cross-check** (the operator-requested supplementary
  surface): the mobile-nav open/close cycle via the interactive a11y
  tree (the hamburger toggles its own aria-label Open → Close menu; the
  panel mounts with the searchbox + the "Mobile" navigation landmark +
  the 5 nav links + Sign In + Wishlist; the route change closes the
  panel); the desktop search flow (mixer → Professional Stand Mixer at
  `/products?q=mixer`); the product-detail anatomy (In Stock / Add to
  Cart / Buy Now / Customer Reviews); ZERO console or page errors;
  supplementary rasters parked in git-ignored `research/agent-browser/`
  via absolute paths (the run-65 daemon-cwd relocation lesson
  re-confirmed — the daemon resolves relative screenshot paths against
  its own cwd, not the caller's).
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks, the hidden
  Server Action inputs excluded, decorative `alt=""` counted CORRECT
  after the script-side fix).
- **Deep audit 66-a** (read-only subagent): **9/9 code anchors PASS,
  zero actionable findings** — the nineteenth consecutive clean audit,
  this cycle verified anchor-by-anchor with file:line evidence: the
  mobile-nav conditional mount (`if (!mobileNavOpen) return null;`) +
  ZERO `classList` matches repo-wide; the full-`hsl()` `@theme inline` +
  the `@custom-variant hover` + no `tailwind.config.*`; the
  sitemap/robots/noindex trifecta (all 8 private surfaces covered); the
  schema-anchored db-path resolution; the in-transaction money authority
  (`placeOrderTx` re-derives everything inside `db.$transaction` with
  the `StripeAmountMismatchError` TOCTOU guard); the HMAC/DB-session
  auth with the production secret gate at module load; the skills/
  exclusion across all five tooling configs; the Stripe retrofit's
  off-by-default gating (`isRealSecret` rejects empty + placeholder
  values; the unconfigured demo path is byte-identity-pinned). The two
  `as unknown as` casts remain the previously documented accepted NIT.
- **Standing conflict-marker grep gate**: CLEAN (fourth consecutive
  cycle — all 14 repo-wide matches are inside the excluded skills/
  folder; zero outside it).

## 4. The screenshots

The documented final-capture sequence on the normalized DB — fresh
reseed (every pin DB-verified: Damascus-first 19999/27999/412/24,
coupons 0-used, 0/16/2 baseline) → ONE e2e as the traffic generator (the
exact class above; the e2e-minted review "E2E review 1792583457693" @
11:50:57.984Z, DB-exact) → restore-demo-stock → the single clean capture
on a COLD server: **25/25 green, zero failures** (the single-shot S53-1
gate). The kill-by-port-owner discipline was applied preventively at
EVERY server transition this cycle — zero orphaned-server incidents.

Byte-level diff vs `git show HEAD:` ground truth: **23/25
byte-identical** — every deterministic pin held (04b-cart-coupon-hint,
21-mobile-menu-open, all nine admin shots, 05-login, 15b-admin-coupons,
02-products, 01-home, 04-cart, 06–09, 11-checkout, 13, 15–20, 22, 23).
The two changed shots, both the documented classes:

- **03-product-detail**: 586 px (0.0164%) confined to the single
  documented 11-row band y1168-1178 — the irreducible review-ID band,
  exactly this run's e2e-minted row (DB-exact).
- **10-register**: 51 px (0.0039%) across the micro-bands y176-178,
  y191-199, y700-708, y721-723 — the IDENTICAL band positions as
  run-65's VLM-classified raster-noise receipt (chromromium font
  rasterization variance, zero content delta); the reproducible
  band-position signature is itself the classification evidence this
  cycle (same byte count 51 px, same band extents), no repo action,
  raster refreshed as the receipt.

The pixel-diff scratch (pngjs installed `--no-save`; the diff script
parked in git-ignored `research/`) left the package manifests untouched
— verified by git status.

## 5. S65-1 (docs sweep)

The plan's Session 65 section; SKILL v1.61.0 → v1.62.0 (project_state
opening "sessions 2-64" → "sessions 2-65" + the Session 65 Appendix B
entry with the four lessons: the verifier-nav waitForURL class; the
empty-alt vs missing-alt a11y distinction; the raster-noise
band-position signature receipt; the twelfth consecutive dark-cycle
disposition); AGENTS plan range 2..64 → 2..65; the CLAUDE unit-bullet
session-65 tail; this file; the repo worklog Task 66. README/PAD/
DEPLOYMENT drift-checked accurate — unchanged (the 496/67/8-env-var
anchors stay accurate).

## 6. Final gates and the push

Final gates re-ran green on the final tree (lint · typecheck ·
typecheck:tests · 496/496 unit); single commit to main; SSH-wrapper push
(`docs/ssh_git_wrapper_v3.py` with the `--remote` override to
`git@github.com:nordeim/homenest-store-s.git`; the key materialized to a
0600 tmp file outside the repo, shredded after verification).
