# Session 126 — Run narrative (run 68, the session-67 cycle)

> This file is the narrative log of the **68th run** — the thirty-fifth
> remediation cycle: the fresh-clone recovery after sandbox reset #17 +
> the strict-verifier hardening cycle. `docs/session_125.md` holds the
> previous run's operator raw log; the run/plan numbering drift is
> documented in `docs/session_52.md`. Zero changes in src/tests/prisma —
> the change-set is the 3 traffic-owned screenshots (the review-ID bands
> + the two UTC-day drift receipts) + the docs sweep.

## 1. The recovery and the review

The sandbox reset wiped everything (the repo clone, node_modules, db/,
the reference clone, the persisted research/ verifiers) — reset #17.
The environment was rebuilt from the documented runbook: `git clone` to
`6d69618` on main (the operator's session_125.md raw-log +
skills-curation commit — the operator-curated skills superset grew
2607 → 2757 files, with 20 shared skill files deliberately evolved and
the skills-catalog.md md5 diverging BY OPERATOR INTENT), npm install
(Next 16.4.0 / Prisma 6.19.3, 591 packages), `.env` with the
DATABASE_URL contract + a fresh AUTH_SECRET, `db:setup` with every seed
pin DB-verified (Damascus-first 19999/27999/412 reviews/24 stock; the
seed-pin verifier asserting the 0/16/2 baseline itself), and
chromium-1248 reinstalled.

The docs review covered AGENTS.md, CLAUDE.md, README.md, PAD, the SKILL
at v1.63.0, session_124.md + session_125.md, the plan's Session 66
section, and the worklog Task 67. The documented contracts were verified
in source before any work: the db-path resolution anchors, the sitemap
privacy + STATIC_ROUTES, the robots disallow set, the mobile-nav
conditional mount + zero classList repo-wide, the .env.example env
surface, the skills exclusion across all five tooling configs, and
.gitignore. The DATABASE_URL process-env shadow re-confirmed
(`file:/home/z/my-project/db/custom.db`, sourced from the sandbox
remnant `/home/z/my-project/.env`) and converged via the documented
SYMLINK disposition (`ln -sfn <repo>/db /home/z/my-project/db`).

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 24.05s**
(52 files) · **build green, zero prisma:error** (grep-verified; 22/22
static pages; the standalone server.js present) · **67/67 e2e at 2.0m**
— the run doubling as the documented traffic generator: 5 orders
(ORD-2026-001…005) / 17 reviews / Damascus 413 / FREESHIP 1, all
DB-verified, then restore-demo-stock re-topped Damascus 21→24 + French
Rolling Pin 43→44.

## 3. The verification surfaces

- **Reference repo** re-verified at `1ffda3d` — `git fetch` +
  `rev-parse`: local HEAD == origin/main (in sync, cloned OUTSIDE the
  repo tree).
- **Skills comparison**: the operator-curated superset GREW — **2757
  files = the reference's 2598 + the operator's 159** (find-based
  count); zero reference skill files missing (MISSING=0); 20 shared
  files carry operator-side content evolution (the operator's
  `6d69618` commit touched 170 skill files, +23,742 insertions) —
  including `skills-catalog.md`, so the md5 now differs BY OPERATOR
  INTENT (documented in docs/skills-inventory.md). The superset
  contract holds.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by
  source read on both sides — the reference lists login/register/
  wishlist in its sitemap and has no DB-failure guard; the clone
  excludes every private surface, adds about/contact + the 5 legal
  routes, is DB-failure-safe, and uses the cuid `/product/[id]` route.
  No adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (10709 bytes) on / — stable across immediate + delayed ~45s retries.
  The FOURTEENTH consecutive unavailable cycle (environmental); the
  documented parity baseline carried every expectation.
- **Clone parity grid**: REBUILT from scratch with STRICT
  throw-on-false visibility pins — **66/66 discrete checks PASS (44
  static + 22 mobile)**. The strictness upgrade unmasked the cycle's
  two new verifier classes in the first draft (both zero repo impact):
  1. *The bare-isVisible vacuous-pass class*: a Playwright locator's
     `isVisible()` resolves `false` WITHOUT throwing — a try/catch
     check harness records **PASS for "not visible"**. The first draft
     "passed" an entire product-detail section against a 404 page.
     Fixed with the `vis()` helper (throw on false).
  2. *The product-cuid route class*: the detail route is
     `/product/[id]` with the seeded cuid — the seed slug is a
     SEPARATE field and `/product/<slug>` returns 404. Fixed by
     resolving the cuid from the DB before building the URL.
  Plus two smaller script-side corrections (the sale-badge `-NN%` pill
  selector; the About page's "Our Story" h1 pin). The mobile grid
  encodes the full Tailwind v4 contract — conditional mount,
  toggle-closes, scroll lock, the bg-primary active pill, the panel
  search flow (the waitForURL lesson), the aria-label flip, no
  horizontal overflow at 390px.
- **agent-browser cross-check** (the operator-requested supplementary
  surface): rebuilt at **29/29** — the mobile surface with the viewport
  APPLIED and asserted (`window.innerWidth === 390`), the full panel
  anatomy (the hamburger's aria-label toggle Open → Close menu, the
  searchbox + the "Mobile" navigation landmark + the 5 nav links +
  Sign In + Wishlist, the body scroll lock engaging and releasing, the
  route-change close), the panel search flow (`q=mixer` → Professional
  Stand Mixer), the desktop search flow, the product-detail anatomy on
  the cuid route (In Stock / Add to Cart / Buy Now / Customer
  Reviews), ZERO console or page errors; supplementary rasters parked
  in git-ignored `research/agent-browser/` via absolute paths (with a
  raster-identity guard proving the panel-open shot differs from the
  desktop one). Two CLI lessons encoded: `set device "iPhone 13"`
  fails SILENTLY on 0.39.0 (supported: iPhone 15/16/16 Pro/17, iPad,
  Pixel 9, Galaxy S25 — use `set viewport 390 844`); snapshot lines
  print `[ref=eNN]` while interactions consume `@eNN`.
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks, the cuid
  detail URL, the hidden Server Action inputs excluded, decorative
  `alt=""` counted CORRECT).
- **Deep audit 68-a** (read-only subagent): **9/9 code anchors PASS,
  zero actionable findings** — the twenty-first consecutive clean
  audit, verified anchor-by-anchor with file:line evidence (the
  mobile-nav conditional mount + zero classList; the full-hsl()
  `@theme inline` + the `@custom-variant hover` + no tailwind.config;
  the sitemap/robots/noindex trifecta; the schema-anchored db-path
  resolution; the in-tx money authority with the Stripe TOCTOU
  double-check; the HMAC/DB-session auth with the production secret
  gate; the skills exclusion across all five tooling configs — live
  stress-tested by the operator's ~24k-line skills addition still
  fenced out; the Stripe retrofit's off-by-default gating). Its one
  informational note — the dev-fallback literal duplicated beside the
  exported DEV_FALLBACK_SECRET — documented as cosmetic hardening.
- **Standing conflict-marker grep gate**: CLEAN (sixth consecutive
  cycle).

## 4. The screenshots

The documented final-capture sequence on the normalized DB — fresh
reseed (the rm-before-reseed lesson: `rm db/custom.db` + db:setup
restored the documented 0/16/2 baseline with every pin DB-verified) →
ONE e2e as the traffic generator (the exact documented class; the
e2e-minted review "E2E review 1792649794285" @ 06:16:34.539Z,
DB-exact) → restore-demo-stock (Damascus 21→24 + French Rolling Pin
43→44) → the single clean capture on a COLD server after the 60s
login-limiter window (the kill-by-port-owner discipline applied
preventively at EVERY server transition — zero orphaned-server
incidents): **25/25 green, zero failures** (the single-shot S53-1
gate).

Byte-level diff vs `git show HEAD:` ground truth: **22/25
byte-identical** — every deterministic pin held (including all nine
admin shots that share the ground truth's UTC day content). The 3
changed shots, all classified with pixel-band evidence (pngjs
installed `--no-save`, the script parked in git-ignored research/ —
the manifests untouched, verified by git status):

- **03-product-detail**: 1258 px (0.0352%) in three 11-row bands
  (y1111-1121, y1168-1178, y1285-1295) — the documented traffic-owned
  review-ID neighborhood, exactly this run's e2e-minted review row
  (DB-exact).
- **12-admin-dashboard**: 9720 px (0.4518%) — the 14-day revenue
  chart's day-label bands + the recent-orders rows + one KPI line.
- **14-admin-orders**: 16326 px (0.8596%) — the 5 order rows' date
  bands.

The latter two are the **UTC-day drift receipt** (the run-62 class,
fired for the first time since): run 67's e2e traffic and capture
shared the Oct-21 UTC day with its ground truth, so its admin shots
were byte-identical; this run's e2e minted its 5 orders on Oct-22 UTC
(DB-exact: all five placedAt 2026-10-22T06:15-16Z) — every
date-rendering admin surface legitimately shifted one day. Same-UTC-day
captures restore byte-identity.

## 5. S67-1 (docs sweep)

The plan's Session 67 section; SKILL v1.63.0 → v1.64.0 (project_state
opening "sessions 2-66" → "sessions 2-67" + the Session 67 Appendix B
entry with the four lessons: the bare-isVisible vacuous-pass class;
the product-cuid route class; the agent-browser 0.39.0
device-support + ref-format classes; the UTC-day drift receipt);
AGENTS plan range 2..66 → 2..67; the CLAUDE unit-bullet session-67
tail; this file; the repo worklog Task 68. README/PAD/DEPLOYMENT
drift-checked accurate — unchanged (the 496/67/8-env-var anchors stay
accurate).

## 6. Final gates and the push

Final gates re-ran green on the final tree (lint · typecheck ·
typecheck:tests · 496/496 unit); single commit to main; SSH-wrapper
push (`docs/ssh_git_wrapper_v3.py` with the `--remote` override to
`git@github.com:nordeim/homenest-store-s.git`; the key materialized to
a 0600 tmp file outside the repo, shredded after verification).
