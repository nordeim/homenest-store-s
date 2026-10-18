# Session 92 — Run narrative (run 51: the nineteenth near-fully-empty remediation cycle — the third on the expanded audit surface, the sixth fully-NIT-free deep audit, and the S50-1 chart-settle capture fix)

> This file is the narrative log of the **51st run**: it executes the
> section numbered **"Session 50"** in `docs/REMEDIATION_PLAN.md` — the
> cycle after the second fully-empty expanded-surface cycle, with both
> session-47 surfaces re-running clean again and ONE repo-side LOW
> docs-tooling finding (**S50-1**: the two chart-bearing screenshots
> were run-to-run byte-non-deterministic against an unchanged
> database — the S37-2/S42-2 animation-frame class on the recharts
> surface). File names increment by run number (the run/plan numbering
> drift is documented in `docs/session_52.md`); `docs/session_90.md`
> holds the previous run's narrative and `docs/session_91.md` the
> operator's raw log of that run.

## 1. Workspace refresh & documentation review

The sandbox workspace was **RESET between runs for the FIFTH time** —
the documented fresh-clone recovery pattern applied in full: `git
clone` of the HTTPS remote advancing to `36f1128` (= `2bdc9f5`, the
pushed run-50 docs cycle, + the operator's `docs/session_91.md`
raw-log commit — **zero src/tests/prisma deltas from the last-audited
tree**, `git diff 2bdc9f5..36f1128` verified as session_91.md only).
The recovery: `.env` rewritten from `.env.example` with the
`DATABASE_URL="file:../db/custom.db"` contract + a strong random
`AUTH_SECRET`; `npm install` green; `npm run db:setup` re-seeded the
catalog (16 products / 8 categories / 3 carousel slides / 13 settings
/ 3 coupons — the fresh seed's Damascus-first pinned order verified
newest-first with the authored review counts
412/234/203/367/142/187/156/298 and Damascus stock 24); the Playwright
chromium-1248 cache re-paired (only chromium-1200 survived the reset);
and paramiko 5.0.0 installed for the SSH-wrapper push. Reviewed in
order: the operator's brief, AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md
(v1.46.0 → the plan's Session 49 section → worklog Task 50 →
docs/session_90.md + session_91.md). The DATABASE_URL shadow confirmed
present (`file:/home/z/my-project/db/custom.db` — nonexistent) → the
per-command absolute-export convergence applied to every DB-touching
command including all server starts, both `next build`s, all e2e runs
and the capture runs.

## 2. Gate chain on the pulled tree

`npm run lint` ✓ · `npm run typecheck` ✓ · `npm run typecheck:tests` ✓
· **438/438 unit** ✓ (48 files, 21.94s — within the documented
19.77–23.97s range) · `npm run build` ✓ (standalone, 22/22 static
pages, **zero `prisma:error` lines**, count-verified) · **67/67 e2e**
✓ (1.9m) — the documented session-49 state reproduces exactly on the
fresh clone. `skills/` excluded from all checking, testing and
compilation per the operator contract.

## 3. Reference tech-stack verification

The `ecommerce-store` repo re-cloned and re-verified at `1ffda3d`
(git-fetch confirms still up to date with its origin/main — the same
commit reviewed in runs 35–50). Its `skills/` folder re-verified
IDENTICAL to homenest-store-s's: file-list diff = 0 lines, 2598 =
2598 files, skills-catalog.md md5 `f69408bf…`. Sitemap/SEO
re-compared: the reference's own sitemap still lists
login/register/wishlist (noindex-adjacent surfaces) while the clone
excludes every private surface AND adds the 5 legal routes + about +
contact — homenest's remains the stricter superset. **No adoption
gaps.**

## 4. Live-reference parity (agent-browser, logged in)

**NO FINDING — the pinned order holds for the EIGHTEENTH consecutive
cycle.** /products "Newest" (count "8 products found") renders the
session-34-pinned Damascus-first order; all 8 prices + compare-at
re-verified to the cent (199.99/279.99 · 89.99/129.99 · 119.99/159.99
· 149.99/199.99 · 79.99 · 54.99/69.99 · 42.99 · 349.99/429.99), all 6
discount badges exact (−29% · −31% · −25% · −25% · −21% · −19%), and
review counts matching the seed's authored display counts exactly
(412/234/203/367/142/187/156/298). Home Featured (6 cards, the
featured-flag subset [0,1,2,3,5,7]) + New Arrivals (8 cards)
card-for-card pinned. The rotating hero observed mid-rotation (Sale
Up to 40% Off at t0 → Elevate Your Kitchen at t+6.5s — matching the
clone's seeded 3-slide set). Login verified (the account page renders
the operator identity `sepnetflix2023` + order history).

The mobile-menu contract at 390×844 verified on the reference: the
three icon-only header buttons each 36×36 at x250/x294/x338, y14; the
hamburger (rightmost) opens the push-down panel with the 5 nav links
(Home / Products / Track Order / About / Contact, each 358×44 stacked
from y121 at y121/169/217/265/313) + the icon-only search button
(40×28 at x16,y81); **toggle-closes verified** (clicking the hamburger
again — the 5 wide links go to 0) **AND navigate-closes verified with
a REAL click** on the panel's Products link (URL → /products; the
panel unmounted, re-checked defensively).

## 5. Clone parity grid

**16/16 PASS (zero parity gaps).** The run-50 grid reproduced as the
run-51 scratch `parity-check-run51.mjs` (workspace-side, outside the
repo — the documented scratch class; server + script inside ONE bash
invocation per the session-44 process-lifetime discipline): health
`{"status":"ok","db":"up"}` · sitemap.xml 25 URLs with private
surfaces excluded · robots disallow set · `noindex` on all 8 probed
private surfaces · /products count "16 products found" with the first
8 exactly the pinned order AND all 8 prices + compare-at + discount
badges exact (the run-50 leaf-node price-walk methodology) · home
Featured (6 cards, card-for-card) + New Arrivals (8 cards) · the
mobile-menu contract: 7 guest links, Close-menu 44×44 @330,78, panel
search INPUT 209×40 @16,80, navigate unmounts · home h1 renders ·
mobile /products first 8 pinned. **The run-39..50 geometry reproduces
EXACTLY.**

## 6. The expanded audit surfaces

**a11y tree audit (8 guest-reachable pages × 8 checks): 59/64 with
mains=1 on ALL 8 pages** — the documented baseline reproduces exactly;
the S47-1 fix verified standing. The 5 non-passing checks all
reference-matched: the heading skips on products/cart/track-order
(the reference's own h1→h3 skips are identical — the documented
session-47 parity constraints) and the nav-landmark check on
login/register (the reference's own login AND register pages render
navs=0 — the standalone split-screen auth design on both sides,
verified live in sessions 48–50; the clone's register main=1 vs the
reference's mains=0 is the clone-better axis). The run-50 lesson
applied: the product-detail probe used the **cuid** URL resolved from
the products page's card links, so no 404-page false alarm this
cycle.

**Lighthouse 13.5.0** on the clone's home/products/login/
product-detail: a11y **93/95/96/96 — reproducing the session-47..50
post-fix baselines EXACTLY** — with the remaining failures precisely
the documented reference-matched constraints (color-contrast,
target-size, heading-order). The login seo score 63 is `is-crawlable`
failing on the intentional `noindex` (the deliberate S8-9
private-surface design, the stricter-superset SEO posture). The perf
scores (50/51/91/67) are informational baselines only (no budgets
set; the reference is a client-rendered SPA; run-to-run sandbox-load
variance vs the 69/65/98/70 of run 50). **Zero genuine findings on
either surface.**

## 7. Deep audit 51-a (read-only subagent)

**9/9 PASS — fully NIT-free (the SIXTH fully-NIT-free audit after
session-42, -44, -45, -46 and -49).** Tree identity verified
(`git diff 2bdc9f5..36f1128` = docs/session_91.md only; porcelain
clean); the three session-47 fixes verified standing in source; the
static e2e count verified **67 = 61 desktop + 6 mobile-navigation
across 14 specs** with zero test.only/skip/fixme/todo; the dynamic
unit re-run **438/438 across 48 test files at 22.80s** inside the
audit; the newest unit test files verified (typed, cleanup'd, mocked
at the right boundaries); the count anchors consistent (zero stale
current-state anchors); `.env.example` verified against the 5
app-config read sites; the security spot-checks clean; the auth e2e
pin verified in source; and package.json deps matching the documented
stack. 4 Informational disposed no-change (the gitignored `server.log`
e2e-webServer leftover; the pre-flagged `db.ts` singleton cast; the
unit duration in range; the gitignored run artifacts).

## 8. S50-1 — the chart-settle capture fix (LOW, docs-tooling)

**Finding:** during the screenshots refresh, the two chart-bearing
shots proved run-to-run byte-non-deterministic against an UNCHANGED
database — 12-admin-dashboard rendered THREE distinct md5s
(`d65af93b` committed · `571775dc` capture-run A · `6c6963b1`
capture-run B) and 17-admin-analytics flipped (byte-identical in run
A, changed in run B), with the DB verified unchanged across both runs
(5 orders / 17 reviews / FREESHIP 1 before and after).

**Root cause:** both pages render recharts charts (the dashboard's
`RevenueChart` AreaChart; the analytics page's TopProducts/CategoryMix
Bar+Pie charts) with recharts' default ~1500ms mount animations
running on local timers — `waitForLoadState("networkidle")` fires
while the animation is still drawing, so the screenshot catches a
variable animation frame. The S37-2 (coupon-toast) / S42-2
(panel-mount) documented class, on the chart surface.

**Fix + verification (TDD-style per the precedent):** the capture
script now waits 2000ms past `networkidle` for the two chart-bearing
shots (`scripts/capture-screenshots.mjs`, the race documented in the
comment). Verified deterministic: **two consecutive full capture runs
produced 25/25 byte-identical shots**, and the settled 12/17 rasters
reproduced the same md5s again on the final clean run after a DB wipe
+ reseed + e2e cycle — four capture runs, one raster state.

**One adjacent observation disposed no-change:** a transient
05-login raster variant (`c1d75e8e…` — 45 pixels, every delta a ±1
RGB-unit shift inside text anti-aliasing bands, zero structural
movement) appeared exactly once in the first capture of the run and
never reproduced in 9 subsequent attempts (6/6 in a dedicated
bistability probe + capture-run B + the final clean run all reproduce
the committed `75de876a…` exactly). Classified environmental
first-render raster noise of the fresh sandbox generation; the
content contract is e2e-pinned. Lesson recorded in SKILL Appendix B.

## 9. S50-1 docs sweep + screenshots

Docs: the plan's Session 50 section written (audit summary + S50-1 +
the dispositions + the execution log); SKILL v1.46.0 → **v1.47.0**
(project_state sessions 2-49 → 2-50 + the Appendix B session-50 entry
incl. the chart-settle lesson + the ±1-LSB login-raster noise
classification recipe + the seed traffic-ownership capture-planning
lesson); AGENTS.md plan range 2..49 → 2..50 + the S50-1 capture-gate
note appended to the capture-script documentation chain;
CLAUDE.md session-50 tail on the unit bullet; README/PAD/DEPLOYMENT
drift-checked (all verified accurate — unchanged; the 438/67 anchors
stay accurate); this narrative; worklog Task 51.

Screenshots: the final DB state reproduced the documented
fresh-clone class exactly (fresh `db/custom.db` after a wipe →
db:setup → ONE e2e run → restore-demo-stock re-topping Damascus
21→24 and French Rolling Pin 43→44 → 5 orders / 17 reviews with
Damascus at 413 / FREESHIP 1). **25 shots captured on the final
single clean run — all 25 green on the first pass, all 25 valid
PNG.** **21 byte-identical** including the deterministic pins
04b-cart-coupon-hint (`6ed62e85…` reproduced EXACTLY for the
**FOURTEENTH consecutive byte-identical cycle**), 11-checkout
(`b71a8e74…`), 21-mobile-menu-open (`5e59d090…`), 05-login
(`75de876a…`) and 10-register. **4 changed**: 03-product-detail
(this run's Date.now() e2e-review rows), 14-admin-orders (the
fresh-DB 5-order rows), and 12-admin-dashboard +
17-admin-analytics in their new S50-1 animation-SETTLED rasters
(`99dc1d33`/`e45615d6` — the determinism fix changing the shipped
raster from "a random animation frame" to "the settled chart state").

## 10. Code changes

One repo file changed outside src/tests/prisma:
`scripts/capture-screenshots.mjs` (the S50-1 chart-settle waits +
comments). **No changes in src/tests/prisma.** The full gate chain
re-ran green on the FINAL tree: lint · typecheck · typecheck:tests
(covers `scripts/**/*.mjs`) · **438/438 unit** (22.09s) · build
(22/22 static, zero prisma:error) · **67/67 e2e** (2.0m) — plus a
post-fix 67/67 e2e re-run (1.9m) after the DB wipe/reseed. The
carried deferrals all verified standing (S8-8 login-limiter lockout
tradeoff; 404-shell CSP nonce; `__Host-` prefix; shared-store
limiter; radiogroup roving focus; address content dedup; the
external-service epics; the WCAG-AA re-theming / perf-budget
options — deliberate parity-breaking decisions, the operator's
call). The route-level 429 grid stays complete (14/14).

## 11. Commit + push

Single commit to **main** (no new branches), pushed through the SSH
wrapper (`docs/ssh_git_wrapper_v3.py` per
`docs/how-to-git-push-using-ssh-wrapper_SKILL.md` — the key
materialized to a 0600 tmp file, shredded after verification).
Fast-forward from `36f1128`.
