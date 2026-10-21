# Session 118 — Run narrative (run 64, the session-63 cycle)

> This file is the narrative log of the **64th run** — the thirty-first
> remediation cycle: the second SURVIVING-workspace continuation (no sandbox
> reset) + the traffic-owned-pin hardening cycle. `docs/session_117.md` holds
> the previous run's operator raw log; the run/plan numbering drift is
> documented in `docs/session_52.md`. Zero changes in src/tests/prisma — the
> change-set is the 1 traffic-owned screenshot (03's irreducible review-ID
> band) + the docs sweep.

## 1. The pull and the review

The pull was a fast-forward of exactly one file — the operator's
`docs/session_117.md` (87 insertions, the raw log of run 63) over run-63's
`f6e5498`, landing at `5655cbf`. The docs review covered AGENTS.md,
CLAUDE.md, README.md, Project_Architecture_Document.md, the SKILL at
v1.59.0, session_114.md (the Stripe retrofit narrative) + session_116.md
(run 63's narrative) + session_117.md (the raw log), the plan's Session 62
section, and the worklog Tasks 62/63 — the documented contracts were
re-verified in source before any work: the db-path resolution anchors, the
sitemap privacy + STATIC_ROUTES, the robots disallow set, the mobile-nav
conditional mount, the .env.example env surface (8 vars incl. the Stripe
trio), the skills exclusion from every gate's scope, and .gitignore.

The workspace survived for the second consecutive cycle: node_modules, the
db/ folder, .env, the reference clone, AND the persisted `research/`
verifiers were all present — the first cycle where the parity grid did not
need rebuilding. The DATABASE_URL process-env shadow re-confirmed
(`file:/home/z/my-project/db/custom.db` — nonexistent) and was converged
via the SYMLINK disposition (`ln -sfn <repo>/db /home/z/my-project/db`):
one setup, and both env winners (the shadow and the repo `.env`) open the
same file across every later command, subshell, and backgrounded server —
strictly more durable than the per-command absolute-export of runs 61–63.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 23.48s** (52
files) · **build 22/22 static, zero prisma:error** · **67/67 e2e at 2.0m**.

## 3. The verification surfaces

- **Reference repo** re-verified at `1ffda3d` — `git fetch` + `rev-parse`:
  local HEAD == origin/main (in sync, cloned OUTSIDE the repo tree).
- **Skills comparison**: the operator-curated superset re-confirmed — 2607
  files = the reference's 2598 + the operator's 9; the shared
  skills-catalog.md md5 IDENTICAL (f69408bf…); zero reference skill files
  missing from homenest.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by source
  read — the reference lists login/register/wishlist in its sitemap and has
  no DB-failure guard; the clone excludes every private surface, adds
  about/contact + the 5 legal routes, is DB-failure-safe, and uses the cuid
  /product/[id] route. No adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell (10723
  bytes) on /, /products, /login — stable across immediate + delayed ~45s
  retries. The TENTH consecutive unavailable cycle (environmental); the
  run-53 live baseline + the seed-embodied pins carried every expectation.
- **Clone parity grid**: 53/53 discrete checks PASS (35 static + 18 mobile)
  — the PERSISTED run-63 verifiers ran with exactly ONE script-side
  correction: the static grid's Damascus-card review pin `\(41[23]\)`
  failed at 414 (each e2e run adds exactly +1 Damascus review — the
  documented traffic-owned growth class; the pin was widened to the
  traffic-tolerant `\(41[2-9]\)` range, encoded IN the script). The mobile
  grid 18/18 untouched — the Tailwind v4 mobile-nav contract (conditional
  mount, toggle-closes, scroll lock, the bg-primary active pill) holds.
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks).
- **Deep audit 64-a** (read-only subagent): **9/9 code anchors PASS, zero
  actionable findings** — mobile nav conditional mount with ZERO
  `classList` matches repo-wide; full-hsl() @theme tokens + the hover
  custom-variant + no tailwind.config.*; the sitemap/robots/noindex
  privacy contract; the db-path resolution; the Stripe seams (sentinel
  mirror, pure seams, lazy client, raw-body webhook verification, the
  intent UNIQUE anchor + dedup model); test integrity with ZERO
  .only/.skip/fixme/todo; security greps clean; the client-island boundary
  clean. Fresh-eyes: zero console.log, zero `any`, zero TODO/FIXME, zero
  dead code. Three informational NITs recorded (all documented intentional
  behavior: the demo-credential opt-in surface on `NEXT_PUBLIC_DEMO_MODE`
  eval deploys, the local `.env` hygiene note, and `Product.rating Float`
  being the one non-integer numeric column — a 0–5 aggregate, not money).
- **Standing conflict-marker grep gate**: CLEAN (its second consecutive
  cycle).

## 4. The screenshots

The documented final-capture sequence on the normalized DB — fresh reseed
(every pin DB-verified: Damascus-first 19999/27999/412 reviews/24 stock;
coupons WELCOME10→SAVE20→FREESHIP; 0 orders / 16 template reviews / 2
users) → ONE e2e as the traffic generator (5 orders / 17 reviews / Damascus
413 / FREESHIP 1 / latest ORD-2026-005, all DB-exact) → restore-demo-stock
(Damascus 21→24, French Rolling Pin 43→44) → the single clean capture on a
cold server: **25/25 green, zero failures**.

The capture discipline gained a lesson this run: repeated capture passes
on a WARM server flaked `page.waitForURL` on admin routes (14/16 across
second/third passes while the cold first pass was fully green) — and every
extra pass overwrites the rasters, so a trailing flake leaves the worse
set on disk. The capture is a single-shot gate: one cold start, one pass.

Byte-level diff vs `git show HEAD:` ground truth: **24/25 byte-identical**
— every deterministic pin held (04b-cart-coupon-hint, 21-mobile-menu-open,
all nine admin shots incl. the run-63 Payments-nav refresh, 05-login,
10-register, 15b-admin-coupons, 02-products, 01-home, 04-cart, 06–09,
11-checkout, 13, 15–20, 22, 23). The sole changed shot
**03-product-detail**: 617 px (0.0173%) confined to the single documented
11-row band y1168-1178, col extent 245-310 — the irreducible review-ID band
"Review 1792551229009" → "Review 1792558432284", exactly this run's
e2e-minted row (DB-exact: `E2E review 1792558432284` @ 04:53:52.531Z on
the fresh-seed DB). The band-localization scratch (pngjs installed
`--no-save`; the diff script parked in git-ignored `research/`) left the
package manifests untouched — verified by git status.

## 5. S63-1 (docs sweep)

The plan's Session 63 section; SKILL v1.59.0 → v1.60.0 (project_state
opening "sessions 2-62" → "sessions 2-63" + the Session 63 Appendix B
entry with the four lessons: the traffic-owned-pin class — pin the class,
never the instant; the warm-server capture flake class — the capture is a
single-shot gate; the symlink env-shadow convergence outliving the
per-command export; the byte-identical admin set as the raster-debt
receipt); AGENTS plan range 2..62 → 2..63; the CLAUDE unit-bullet
session-63 tail; this file; the repo worklog Task 64. README/PAD/
DEPLOYMENT drift-checked accurate — unchanged (the 496/67/8-env-var
anchors stay accurate).

## 6. Final gates and the push

Final gates re-ran green on the final tree (lint · typecheck ·
typecheck:tests · 496/496 unit); single commit to main; SSH-wrapper push
(`docs/ssh_git_wrapper_v3.py` with the `--remote` override to
`git@github.com:nordeim/homenest-store-s.git`; the key materialized to a
0600 tmp file outside the repo, shredded after verification).
