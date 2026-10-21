# Session 120 — Run narrative (run 65, the session-64 cycle)

> This file is the narrative log of the **65th run** — the thirty-second
> remediation cycle: the fresh-clone recovery after sandbox reset #14 + the
> orphaned-server hardening cycle. `docs/session_119.md` holds the previous
> run's operator raw log; the run/plan numbering drift is documented in
> `docs/session_52.md`. Zero changes in src/tests/prisma — the change-set is
> the 2 traffic-owned screenshots (03's irreducible review-ID band +
> 10-register's raster-noise micro-class) + the docs sweep (including the
> CLAUDE.md duplicated-unit-bullet fix, S64-2).

## 1. The recovery and the review

The sandbox reset wiped everything (the repo clone, node_modules, db/, the
ssh shim, the reference clone, the persisted research/ verifiers) — reset
#14. The environment was rebuilt from the documented runbook: `git clone`
to `2f0a19f` on main (the operator's session_119.md raw-log commit over
run-64's `40886ef`, 1 file/66 insertions, verified by git show --stat),
npm install (Next 16.4.0 / Prisma 6.19.3), `.env` with the DATABASE_URL
contract + a fresh AUTH_SECRET, `db:setup` with every seed pin DB-verified
(Damascus-first 19999/27999/412 reviews/24 stock in the rendered
newest-first order; coupons WELCOME10→SAVE20→FREESHIP; the 0 orders / 16
template reviews / 2 users baseline), and chromium-1248 reinstalled for
Playwright.

The docs review covered AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, the SKILL at v1.60.0, session_116.md +
session_118.md + session_119.md, the plan's Session 63 section, and the
worklog Tasks 63/64. The documented contracts were verified in source
before any work: the db-path resolution anchors, the sitemap privacy +
STATIC_ROUTES, the robots disallow set, the mobile-nav conditional mount,
the .env.example env surface (8 vars incl. the Stripe trio), the skills
exclusion from every gate's scope, and .gitignore.

The DATABASE_URL process-env shadow re-confirmed
(`file:/home/z/my-project/db/custom.db`, sourced from the sandbox-remnant
`/home/z/my-project/.env`) and converged via the documented SYMLINK
disposition (`ln -sfn <repo>/db /home/z/my-project/db`): one setup, and
both env winners open the same file across every later command, subshell,
and backgrounded server.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 23.66s**
(52 files) · **build 22/22 static, zero prisma:error** (grep-verified) ·
**67/67 e2e at 2.0m** — the run doubling as the documented traffic
generator: 5 orders (ORD-2026-001…005) / 17 reviews / Damascus 413 /
FREESHIP 1 / latest ORD-2026-005, all DB-verified, then restore-demo-stock
re-topped Damascus 21→24 + French Rolling Pin 43→44.

## 3. The verification surfaces

- **Reference repo** re-verified at `1ffda3d` — `git fetch` + `rev-parse`:
  local HEAD == origin/main (in sync, cloned OUTSIDE the repo tree).
- **Skills comparison**: the operator-curated superset re-confirmed — 2607
  files = the reference's 2598 + the operator's 9; the shared
  skills-catalog.md md5 IDENTICAL (f69408bf…); zero reference skill files
  missing from homenest.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by source
  read — the reference lists login/register/wishlist in its sitemap and
  has no DB-failure guard; the clone excludes every private surface, adds
  about/contact + the 5 legal routes, is DB-failure-safe, and uses the cuid
  /product/[id] route. No adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (10723 bytes) on /, /products, /login — stable across immediate +
  delayed ~45s retries. The ELEVENTH consecutive unavailable cycle
  (environmental); the run-53 live baseline + the seed-embodied pins
  carried every expectation.
- **Clone parity grid**: REBUILT from scratch (the git-ignored research/
  verifiers died with the reset) — **57/57 discrete checks PASS (39 static
  + 18 mobile)** with ONE script-side correction en route (the cart-badge
  expectation: the `cart-count` span renders only when `cartCount > 0`, so
  the guest-anatomy pin is the Cart BUTTON — the badge itself is
  e2e-pinned after an add). The mobile grid 18/18 untouched — the Tailwind
  v4 mobile-nav contract (conditional mount, toggle-closes, scroll lock,
  the bg-primary active pill) holds.
- **agent-browser cross-check** (the operator-requested supplementary
  surface): the mobile menu open/close cycle verified through the
  interactive a11y tree (the hamburger toggles its own aria-label Open →
  Close menu; the panel mounts with search + 5 nav links + Sign In +
  Wishlist; the close button unmounts; route change closes the panel);
  the desktop search flow (mixer → Professional Stand Mixer); the product
  detail anatomy (In Stock / Add to Cart / Buy Now / Customer Reviews);
  ZERO console or page errors; supplementary rasters parked in
  git-ignored research/agent-browser/ (the daemon-cwd relocation lesson).
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks, the hidden Server
  Action inputs excluded).
- **Deep audit 65-a** (read-only subagent): **9/9 code anchors PASS, zero
  actionable findings** — two informational notes, both documented
  intentional behavior (the e2e spec-file count nuance 14+helpers, and
  the production-gated demo/dev constants).
- **Standing conflict-marker grep gate**: CLEAN (third consecutive cycle).

## 4. The orphaned-server incident

The first capture-sequence e2e run dropped to **37/67** with login-flow
`toHaveURL` failures. Root cause (reproduced and verified): the
parity-grid server started earlier in the session SURVIVED its
`pkill -f "node .next/standalone/server.js"` — Next.js renames the
standalone server process to `next-server (v16.4.0)`, so the pattern
never matched (the session-43 environmental-note class, resurfacing with
NEW poisoning properties). The orphan (parented to init, 23 minutes old)
then served TWO poisoned properties to the e2e webServer's
`reuseExistingServer` path: (1) its SQLite connection still held the
DELETED pre-reseed DB inode — the fresh reseed's `rm db/custom.db` created
a new file, but the orphan kept reading the old one, so the suite tested
against the STALE traffic state (order-number pins broke at
ORD-2026-006+); and (2) its in-memory rate limiter accumulated login
budgets, so the diagnostic re-run's login-dependent specs got
429-rejected. The fix: kill by PORT OWNER (`ss -tlnp` → the listening
pid), verify the port free, fresh reseed — after which the single e2e run
returned to exactly **67/67 at 1.9m** with the exact documented traffic
class, zero code changes. The signature for this class: a gate that drops
from 67 to ~37 with login `toHaveURL` failures while guest-only specs
stay green.

## 5. The screenshots

The documented final-capture sequence on the normalized DB — fresh reseed
(every pin DB-verified) → ONE e2e as the traffic generator (the exact
class above) → restore-demo-stock → the single clean capture on a cold
server: **25/25 green, zero failures** (the single-shot S53-1 gate).

Byte-level diff vs `git show HEAD:` ground truth: **23/25 byte-identical**
— every deterministic pin held (04b-cart-coupon-hint, 21-mobile-menu-open,
all nine admin shots, 05-login, 15b-admin-coupons, 02-products, 01-home,
04-cart, 06–09, 11-checkout, 13, 15–20, 22, 23). The two changed shots:

- **03-product-detail**: 664 px (0.0186%) confined to the single
  documented 11-row band y1168-1178, col extent 236-312 — the irreducible
  review-ID band, exactly this run's e2e-minted row (DB-exact:
  `E2E review 1792563806200` @ 06:23:26.520Z on the fresh-seed DB).
- **10-register**: 51 px (0.0039%) across four micro-bands
  (y176-178, y191-199, y700-708, y721-723) — VLM-classified on both band
  crops as anti-aliasing/pixel noise with ZERO content delta; a new
  raster-noise micro-class (chromium font rasterization variance), no
  repo action, raster refreshed as the receipt.

The band-localization scratch (pngjs installed `--no-save`; the diff +
crop scripts parked in git-ignored `research/`) left the package
manifests untouched — verified by git status.

## 6. S64-1/S64-2 (docs sweep)

The plan's Session 64 section; SKILL v1.60.0 → v1.61.0 (project_state
opening "sessions 2-63" → "sessions 2-64" + the Session 64 Appendix B
entry with the four lessons: the kill-by-port-owner rule; the
stale-server 37/67 signature; the raster-noise micro-class; the
agent-browser daemon-cwd trap); AGENTS plan range 2..63 → 2..64; the
CLAUDE unit-bullet **duplicated-line fix (S64-2)** — the file carried TWO
divergent "Unit (Vitest, node env)" bullets (the parity-cycle lineage
with sessions 60/62/63 tails, and a stale session-61 FEATURE-cycle
duplicate); resolved content-preservingly (the unique session-61 Stripe
enumeration transplanted into the current bullet, the duplicate deleted,
the session-64 tail appended — all four session tails now on ONE bullet);
this file; the repo worklog Task 65. README/PAD/DEPLOYMENT drift-checked
accurate — unchanged (the 496/67/8-env-var anchors stay accurate).

## 7. Final gates and the push

Final gates re-ran green on the final tree (lint · typecheck ·
typecheck:tests · 496/496 unit); single commit to main; SSH-wrapper push
(`docs/ssh_git_wrapper_v3.py` with the `--remote` override to
`git@github.com:nordeim/homenest-store-s.git`; the key materialized to a
0600 tmp file outside the repo, shredded after verification).
