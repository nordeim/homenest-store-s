# Session 94 — Run narrative (run 52: the twentieth near-fully-empty remediation cycle — the fourth on the expanded audit surface, the seventh fully-NIT-free deep audit, and the S51-1 seeded-coupon order determinism fix)

> This file is the narrative log of the **52nd run**: it executes the
> section numbered **"Session 51"** in `docs/REMEDIATION_PLAN.md` — the
> cycle after the third clean expanded-surface cycle, with both
> session-47 surfaces re-running clean again and ONE repo-side LOW
> seed-determinism finding (**S51-1**: the seeded coupons' createdAt
> timestamps could tie at SQLite's millisecond precision, flipping the
> /admin/coupons card order — and the 15b screenshot — run-to-run
> against an otherwise identical database). File names increment by
> run number (the run/plan numbering drift is documented in
> `docs/session_52.md`); `docs/session_92.md` holds the previous run's
> narrative and `docs/session_93.md` the operator's raw log of that
> run.

## 1. Workspace refresh & documentation review

The sandbox workspace **SURVIVED between runs** (no reset — the first
non-recovery cycle since run 46): `git pull` fast-forwarded
`e90352c → 4d8b096` (= `e90352c`, the pushed run-51 fix cycle, + the
operator's `docs/session_93.md` raw-log commit — **zero
src/tests/prisma deltas from the last-audited tree**, `git diff
e90352c..4d8b096` verified as session_93.md only; the working tree
clean). The environment needed no rebuild: `.env` intact with the
`DATABASE_URL="file:../db/custom.db"` contract, `node_modules`
intact (429 packages), the Playwright chromium-1248 cache paired,
paramiko 5.0.0 installed, and `db/custom.db` present at the repo
root. The documented **DATABASE_URL shadow** (the parent process env
carries `file:/home/z/my-project/db/custom.db` — nonexistent) was
confirmed and the per-command absolute-export convergence applied to
every DB-touching command, both builds, both e2e runs and all capture
runs — exactly the run-49..51 discipline.

Documentation review: `AGENTS.md`, `CLAUDE.md`, `README.md`,
`Project_Architecture_Document.md` and `homenest-store-s_SKILL.md`
(v1.47.0) read in full; the session trail
(`docs/session_92.md` narrative + `docs/session_93.md` operator raw
log + `docs/REMEDIATION_PLAN.md` Session 50 + `worklog.md` Task 51)
internalized and **validated against the codebase** before any work
began: the db-path contract (`src/lib/db-path.ts`), the sitemap
privacy contract (`src/app/sitemap.ts` — private surfaces excluded),
robots disallow set, the mobile-nav conditional-mount pattern (the
Tailwind v4 display-utility trap), the vitest/playwright configs, the
`.env.example` five-variable surface, and the package.json scripts
all verified in source against their documented contracts.

## 2. Gate chain on the pulled tree

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **438/438 unit** (48
files, 21.94s — within the documented 19.77–23.97s range) · build
(22/22 static, **zero prisma:error** lines, count-verified) ·
**67/67 e2e** (1.9m — the run's terminal log captured cleanly on a
second verification pass after the documented final-capture sequence
re-ran it). The documented session-50 state reproduces exactly on
the surviving workspace.

## 3. Reference repo & skills parity

The ecommerce-store reference repo re-verified at `1ffda3d` (git
fetch confirms in sync with its origin/main — the same commit
reviewed in runs 35–51): skills folders IDENTICAL (2598 = 2598
files, `skills-catalog.md` md5 `f69408bf…`), and the sitemap/SEO
comparison re-confirmed — the reference's own sitemap still lists
login/register/wishlist while **homenest remains the stricter
superset** (every private surface excluded + the 5 legal routes +
about + contact). **No adoption gaps.**

## 4. Live-reference parity (agent-browser, logged in)

**NO FINDING — the pinned order holds for the NINETEENTH consecutive
cycle.** `/products` renders "8 products found" in the exact
session-34-pinned Damascus-first order (Damascus → Copper Frying →
Ceramic Dinner → Dutch Oven → Walnut → Mixing Bowl → Glass Storage →
Stand Mixer) with **all 8 prices + compare-at + all 6 discount
badges + review counts verified to the cent**
(412/234/203/367/142/187/156/298); home **Featured 6** (the
featured-flag subset) + **New Arrivals 8** verified card-for-card;
the rotating hero observed mid-rotation (Sale Up to 40% Off →
Elevate Your Kitchen); the **mobile-menu contract at 390×844
verified with REAL clicks**: the 3 icon-only header buttons 36×36 at
x250/x294/x338 y14, the 5 panel links 358×44 stacked from y121
(y121/169/217/265/313), the panel search button 40×28 @16,81, and
both close behaviors — toggle-closes AND navigate-closes (the
Products link navigates to /products and the panel unmounts); login
verified (the account page renders the operator identity
`sepnetflix2023` + order history).

## 5. Clone parity grid

**16/16 PASS** — the run-52 scratch (workspace-side, outside the
repo; server + script inside ONE bash invocation per the session-44
process-lifetime discipline): health ok/db-up · sitemap 25 URLs with
every private surface excluded · robots disallow set · noindex on
all 8 probed private surfaces · `/products` "16 products found" with
the first 8 exactly the pinned order AND all 8 prices + compare-at +
badges exact (the leaf-node price walk) · home Featured 6 + New
Arrivals 8 card-for-card · the mobile-menu contract: 7 guest links,
Close-menu 44×44 @330,78, panel search INPUT 209×40 @16,80,
navigate unmounts the panel · home h1 renders · mobile /products
first 8 pinned. **The run-39..51 geometry reproducing EXACTLY.**

## 6. The expanded audit surfaces (both zero genuine findings)

- **a11y tree audit (8 pages × 8 checks): 59/64** with mains=1 on
  ALL 8 pages — the documented baseline reproducing EXACTLY; the 5
  non-passing checks all reference-matched (the products/cart/
  track-order heading skips; the login/register nav-landmark — the
  reference's own split-screen auth design). The run-50 cuid-URL
  lesson applied.
- **Lighthouse 13.5.0** (home/products/login/product-detail):
  **a11y 93/95/96/96** — the session-47..50 post-fix baselines
  reproducing EXACTLY; login seo 63 = the intentional noindex
  (is-crawlable on the S8-9 private-surface design); the failed a11y
  audits precisely the reference-matched constraints
  (color-contrast, target-size, heading-order); perf 60/51/78/69
  informational (sandbox-load variance).

## 7. Deep audit 52-a (read-only subagent)

**10/10 PASS — fully NIT-free (the SEVENTH after session-42, -44,
-45, -46, -49 and -50).** Tree identity verified; the S50-1
chart-settle waits verified standing in `scripts/
capture-screenshots.mjs`; the static 67 = 61 desktop + 6
mobile-navigation across 14 specs with zero
test.only/skip/fixme/todo; the dynamic **438/438 re-run at 22.10s**
inside the audit; count anchors consistent; `.env.example` matching
all 5 env-read sites; the security spot-checks clean (0 eval/new
Function; the 3 dangerouslySetInnerHTML sites all through
jsonLdScript; 0 @ts-ignore / `as any` / `: any` in src/; httpOnly
cookies with the shared cookieOptions; the target=_blank site
hardened; length-guarded timingSafeEqual in auth.ts AND
order-access.ts; 0 Math.random; .gitignore covering
.env/db/*.db/*.key); package.json deps matching the documented
stack; the server-only module graph clean (validation/money/format
carry no db edges). 3 Informational disposed no-change.

## 8. S51-1 — the finding and the TDD fix

**The find:** run 52's first screenshot refresh produced a
**15b-admin-coupons raster 11,876 pixels different** (0.63%) from
the committed run-51 raster — against the documented final-capture
DB state (5 orders / 17 reviews / FREESHIP 1, verified before and
after). The pixel diff localized to structured row-bands in the
card-grid region (x397..976, y207..358) — the content-level class,
NOT the ±1-LSB raster-noise class (which shows tiny scattered
glyph-AA shifts with zero structural movement). A **VLM read of
both crops** isolated the semantic delta in one step: **the SAVE20
and FREESHIP cards had swapped grid positions**; every card's
content was otherwise identical.

**The root cause:** the seed's coupon loop created its three rows
within ~1ms of each other (this run: WELCOME10 .090Z, SAVE20 .091Z,
FREESHIP .091Z — a genuine tie), and `/admin/coupons` lists coupons
`orderBy: { createdAt: "desc" }` on SQLite's millisecond-precision
DateTime strings. A same-millisecond tie has no deterministic
tie-break — the card order flipped run-to-run depending on where
the insert loop's clock ticks landed. The product catalog has been
immune to this class since session-12 (`productSeedCreatedAt`'s
60-second spacing); the coupons never got the twin.

**The fix (TDD — `tests/unit/session51-hardening.test.ts` written
RED first, 6/6 failing):**
1. `couponSeedCreatedAt(index, now)` — a new pure helper in
   `src/lib/seed-policy.ts`, the coupon twin of
   `productSeedCreatedAt`: first-listed row is the newest, each
   successor backdated a full 60 seconds (no tie possible at
   millisecond precision), with the same non-negative-integer index
   guard.
2. `prisma/seed.ts`: the COUPONS array reordered into the admin
   DISPLAY order (**FREESHIP → SAVE20 → WELCOME10** — the card
   order the page has shipped since session-19 and that the 15b
   screenshot pins) and now **exported** (the PRODUCTS precedent —
   the seed's execution guard means only the unit suite can pin the
   authored order); the coupon upsert's create branch carries
   `createdAt: couponSeedCreatedAt(index)` while `update: {}` stays
   create-only — **existing databases keep their own timestamps and
   redemption bookkeeping untouched** (the S4-8/S7-3 policy), and
   admin-created coupons still sort as the newest via their real
   `now()`.
3. Six unit pins: the helper's newest-first/strictly-descending/
   60s-gap contract, the invalid-index guard, the COUPONS array
   order, and the three seeded lifecycle shapes.

**The verification chain:** 6/6 RED → 6/6 GREEN · fresh wipe →
db:setup → the DB's `createdAt desc` order reads FREESHIP → SAVE20
→ WELCOME10 with distinct 60s-spaced timestamps (.912/.913/.913
across three different minutes) · the full gate chain on the final
tree (lint · typecheck · typecheck:tests · **444/444 unit** in 49
files at 22.42s — the 6 new pins · build 22/22 zero prisma:error ·
**67/67 e2e** at 1.9m — the run on the fresh DB doubling as the
documented traffic generator) · restore-demo-stock · the final
single clean capture: **24/25 byte-identical — 15b back at the
committed FREESHIP-first raster EXACTLY** (the S51-1 fix verified
at the byte level), the sole changed shot being 03-product-detail
(this run's `Date.now()` e2e-review rows — the documented
traffic-owned class).

**The adjacent-seed-surface audit:** every other seed-inserted row
checked for the same class — products carry the 60s
productSeedCreatedAt spacing (immune), carousel slides order by an
explicit `sortOrder` column (immune), settings are keyed rows (no
order), and categories render in natural/index order with no
createdAt-desc consumer (immune). The coupons were the only
unpinned `createdAt: desc` consumer.

## 9. The S51-1 docs sweep

The plan's Session 51 section (audit summary + the finding/root
cause/fix + the dispositions + the execution log); SKILL v1.47.0 →
**v1.48.0** (project_state sessions 2-50 → 2-51 + the 438 → 444
count + the Appendix B session-51 entry incl. the three lessons:
tie-proof seed data for every timestamp-ordered consumer, the
content-level vs LSB-noise screenshot-diff classification, and the
seed's export surface being the unit-test surface); AGENTS.md plan
range 2..50 → 2..51; CLAUDE.md session-51 tail on the unit bullet;
the README/PAD 438 → 444 count anchors (badge, stack table, testing
section, §8.1, §12); DEPLOYMENT.md's seed-behavior paragraph
extended with the deterministic coupon-createdAt precision note;
this `docs/session_94.md`; the `worklog.md` Task 52 entry.

## 10. Commit & push

Single commit to main (no new branches), pushed through the SSH
wrapper (`docs/ssh_git_wrapper_v3.py` — the key materialized to a
0600 tmp file outside the repo, shredded after verification), per
`docs/how-to-git-push-using-ssh-wrapper_SKILL.md`. Fast-forward from
`4d8b096`.

**The change-set:** `src/lib/seed-policy.ts` (the
couponSeedCreatedAt helper) · `prisma/seed.ts` (the COUPONS reorder
+ export + the deterministic create-branch createdAt) ·
`tests/unit/session51-hardening.test.ts` (the 6 pins) ·
`docs/screenshots/03-product-detail.png` (the traffic-owned
refresh) · the docs sweep (REMEDIATION_PLAN Session 51, SKILL
v1.48.0, AGENTS range, CLAUDE tail, README/PAD anchors, DEPLOYMENT
note, session_94.md, worklog Task 52).

**Suggested next steps:** you may commit this run's raw log as
`docs/session_95.md` per the established pattern. The carried
deferrals (WCAG-AA re-theming, perf budgets, external-service
epics) remain parked as operator's-call decisions — say the word if
you'd like any activated in a future cycle.
