# Session 130 — Run narrative (run 70, the session-69 cycle)

> This file is the narrative log of the **70th run** — the thirty-seventh
> remediation cycle: the fresh-clone recovery + the **404-hydration fix
> cycle** (the first findings-bearing src cycle in thirty-five
> sessions). `docs/session_129.md` holds the previous run's operator
> raw log. The change-set: S69-2 (`not-found.tsx` + its RED → GREEN
> e2e pin, the suite 67 → 68) + S69-1 (a comment-only docstring fix) +
> the 1 traffic-owned screenshot + the docs sweep.

## 1. The recovery and the review

The sandbox started clean — no local clone survived. The repo was
cloned to `7d5c83a` on main: run 69's `3fdf441` plus the operator's
session_129.md raw-log + skills-curation commit
(`skills/pdf-old-20260806/**`, 39 files — markdown + `.py`/`.sh`/`.js`/
`.tex` scripts, zero TypeScript, fully fenced by the five-gate
exclusion; `src/tests/prisma` byte-identical, verified by
`git diff 3fdf441..7d5c83a -- src tests prisma` → EMPTY). The
environment was rebuilt from the documented runbook: npm install
(Next 16.4.0 / Prisma 6.19.3), `.env` with the DATABASE_URL contract +
a fresh AUTH_SECRET, the SYMLINK convergence for the re-confirmed
process-env shadow, `db:setup` with every seed pin DB-verified
(Damascus-first 19999/27999/412/24; coupons 0-used; the 0/16/2
baseline asserted by the verifier itself; the authored first-8 order
matching the session-34 pinning), and chromium-1248 reinstalled — in
the foreground this time (the backgrounded install died with the
tool-call shell, the documented session-44 class).

The docs review covered AGENTS.md, CLAUDE.md, README.md, PAD, the
SKILL at v1.65.0, session_128.md + session_129.md, the plan's Session
68 section, and the worklog Tasks 69-a + 69. The documented contracts
were verified in source before any work: the db-path resolution
anchors, the sitemap privacy + STATIC_ROUTES, the robots disallow set,
the mobile-nav conditional mount + zero classList repo-wide, the
.env.example surface, the skills exclusion across all five tooling
configs, and .gitignore.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 22.32s**
(52 files) · **build green, zero prisma:error** (grep-verified; 22/22
static pages; the standalone server.js present) · **67/67 e2e at 1.9m**
— the run doubling as the documented traffic generator: 5 orders
(ORD-2026-001…005) / 17 reviews / Damascus 413 / FREESHIP 1, all
DB-verified, then restore-demo-stock re-topped Damascus 21→24 + French
Rolling Pin 43→44. Post-fix the suite re-ran at **68/68** on the final
tree.

## 3. The verification surfaces

- **Reference repo** re-verified at `bb2dc8e` — the operator moved it
  from `1ffda3d` ("update skills", 193 files): `git fetch` +
  `rev-parse`, local HEAD == origin/main (in sync, cloned OUTSIDE the
  repo tree).
- **Skills comparison**: the operator curated BOTH sides — the clone's
  superset is **2809 = the reference's 2770 + 39 operator-owned**
  (find-based); MISSING=0; the previously-diverged 20 shared files are
  now **byte-identical** (the operator's reference sync) and the two
  skills-catalog md5s **MATCH** for the first time since the
  divergence was recorded.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by
  source read on both sides (the reference lists wishlist/login/
  register with no DB-failure guard; the clone excludes every private
  surface, adds the legal routes, is DB-failure-safe). No adoption
  gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (10339 bytes on / and /login), stable across immediate + delayed
  ~45s retries — the **SIXTEENTH consecutive dark cycle**
  (environmental). The documented parity baseline carried every
  expectation.
- **Clone parity grid**: REBUILT from scratch at **67/67 (45 static +
  22 mobile)** — now including the NEW branded-404 surface no prior
  grid ever visited. The first run localized **16 CSP violations to
  `/no-such-route-xyz`** and unmasked the genuine S69-2 defect. Six
  verifier-side selector bugs were fixed en route (all script-side,
  zero repo impact): the `#new-arrivals` h2-id vs the aria-labelledby
  section wrapper, the footer-vs-home newsletter form location, the
  register heading's "Create Your Account" text, the panel search
  placeholder's ellipsis, the detail "Add to Cart" multi-match, and
  the browser's own document-404 status log exemption. The mobile
  grid encodes the full Tailwind v4 contract (conditional mount,
  toggle-closes, scroll lock cycle, the bg-primary active pill, the
  aria-label flip, the panel search flow, the route-change close from
  a different route, no horizontal overflow at 390px, and the exact
  44×44 @330,78 / 209×40 @16,80 geometry pins).
- **agent-browser cross-check**: rebuilt at **55/55** — the mobile
  surface (viewport APPLIED and asserted), the full panel anatomy via
  scoped snapshots, the scroll lock cycle, the route-change close,
  the panel + desktop search flows, the product-detail anatomy on the
  cuid route, the 404 hydration (S69-2 verified here too), ZERO
  console/page errors, supplementary rasters under git-ignored
  `research/agent-browser/` via absolute paths. New CLI lesson: refs
  are re-minted on every re-render — toggles use `find role --name`,
  panel members come from scoped snapshots, re-snapshot after every
  state change.
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks on the cuid
  detail URL).
- **Deep audit 70-a** (read-only subagent): **9/9 code anchors PASS,
  zero actionable findings** — the twenty-third consecutive clean
  audit; one comment-only NIT (→ fixed as S69-1) + three informational
  notes. The standing conflict-marker grep gate CLEAN (eighth
  consecutive cycle).

## 4. S69-2 (the 404-hydration fix — TDD)

The rebuilt grid's branded-404 check caught what twenty-two
consecutive clean audits could not — a route no verification surface
had ever loaded. The prerendered `not-found.tsx` shell baked no
per-request CSP nonce into its script tags, so every hard 404 logged
~16 CSP violations and never hydrated (the (auth)-layout class on a
new surface). Fixed the documented way — `await connection()` in
`not-found.tsx` (`ƒ /_not-found` in the route table; the 22 static
shells unchanged) — pinned TDD-first: the new seo-platform e2e test
timed out **RED** on the pre-fix build, **GREEN** post-fix. **The
e2e suite grew 67 → 68.** S69-1: the audit's one NIT — the
`StripeAmountMismatchError` docstring claimed the in-tx throw maps to
the "cart changed" copy; only the PRE-TX drift does — corrected
(comment-only).

## 5. The screenshots

The documented final-capture sequence on the normalized DB — fresh
reseed (rm-before-reseed; 0/16/2 baseline, every pin DB-verified) →
ONE e2e as the traffic generator (the e2e-minted review by "E2E
Reviewer" @ 2026-10-23T03:29:29Z, DB-exact) → restore-demo-stock → the
single clean capture on a COLD server after the 60s login-limiter
window (kill-by-port-owner at every transition — zero orphaned-server
incidents): **25/25 green, zero failures**. Byte-level diff vs
`git show HEAD:` ground truth: **24/25 byte-identical** — the highest
since the drift class was identified (this run's e2e minted its orders
on the SAME UTC day as the committed ground truth, so the UTC-day
drift class did NOT fire; 12 and 14 back at byte-identity). The sole
delta: **03-product-detail, 527 px (0.0148%) in the single documented
11-row review-ID band y1168-1178**, DB-exact. The pngjs install stayed
`--no-save` (package manifests untouched).

## 6. S69-3 (the docs sweep)

The plan's Session 69 section; SKILL v1.65.0 → v1.66.0 (project_state
opening "sessions 2-68" → "sessions 2-69" + the Session 69 Appendix B
entry with the four lessons); AGENTS plan range 2..68 → 2..69; the
CLAUDE unit-bullet session-69 tail; the README/PAD e2e count bumps
(67 → 68 tests, 61 → 62 desktop, the badge and the §8.2 seo-platform
row carrying the S69-2 pin); docs/session_130.md (this file); the repo
worklog Tasks 70-a + 70. DEPLOYMENT.md drift-checked accurate —
unchanged. Final gates re-ran green on the final tree; a single commit
to main; SSH-wrapper push via `docs/ssh_git_wrapper_v3.py`
(fast-forward, no new branches, remote verified).
