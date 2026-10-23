# Session 128 — Run narrative (run 69, the session-68 cycle)

> This file is the narrative log of the **69th run** — the thirty-sixth
> remediation cycle: the fresh-clone recovery + the timing-tolerant-verifier
> cycle. `docs/session_127.md` holds the previous run's operator raw log; the
> run/plan numbering drift is documented in `docs/session_52.md`. Zero
> changes in src/tests/prisma — the change-set is the 3 traffic-owned
> screenshots (the review-ID bands + the two UTC-day drift receipts) + the
> docs sweep.

## 1. The recovery and the review

The sandbox started clean — no local clone survived. The repo was
cloned to `a0deef7` on main: run 68's `a0a03fc` plus the operator's
session_127.md raw-log + skills-curation commit (13 more operator-owned
skill files — ExtractWisdom + stock-analysis-skill — the superset now
**2770 = 2598 reference + 172 operator-owned, MISSING=0**). The
environment was rebuilt from the documented runbook: npm install
(Next 16.4.0 / Prisma 6.19.3), `.env` with the DATABASE_URL contract +
a fresh AUTH_SECRET, the SYMLINK convergence for the re-confirmed
process-env shadow (`/home/z/my-project/.env` →
`file:/home/z/my-project/db/custom.db`), `db:setup` with every seed
pin DB-verified (Damascus-first 19999/27999/412/24; coupons 0-used;
the 0/16/2 baseline asserted by the verifier itself), and
chromium-1248 reinstalled.

The docs review covered AGENTS.md, CLAUDE.md, README.md, PAD, the SKILL
at v1.64.0, session_126.md + session_127.md, the plan's Session 67
section, and the worklog Tasks 68-a + 68. The documented contracts were
verified in source before any work: the db-path resolution anchors, the
sitemap privacy + STATIC_ROUTES, the robots disallow set, the mobile-nav
conditional mount + zero classList repo-wide, the .env.example surface,
the skills exclusion across all five tooling configs, and .gitignore.

## 2. The gate chain (all green on the pulled tree)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **496/496 unit at 23.25s**
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
- **Skills comparison**: the operator-curated superset grew 2757 →
  **2770 files** (13 more operator-owned this cycle); MISSING=0; 20
  shared files deliberately evolved (unchanged); catalog md5
  divergence operator-intentional.
- **Sitemap/SEO comparison**: the stricter superset re-confirmed by
  source read on both sides (the reference lists wishlist/login/register
  in its sitemap with no DB-failure guard; the clone excludes every
  private surface, adds the legal routes, is DB-failure-safe). No
  adoption gaps.
- **Live reference**: HTTP 503 with the Base44 publish-the-app shell
  (10339 bytes), stable across immediate + delayed ~45s retries — the
  **FIFTEENTH consecutive dark cycle** (environmental). The documented
  parity baseline carried every expectation.
- **Clone parity grid**: REBUILT from scratch at **73/73 (51 static +
  22 mobile)**. The strict throw-on-false `vis()` helper upgraded to
  **timing-tolerant polling** (`locator.waitFor({ state: "visible",
  timeout: 8000 })`) after the RSC DOM-swap race class — a single-shot
  `isVisible()` fired immediately after `waitForURL()` raced the
  client-side-router payload swap (URL changed, old DOM still mounted,
  a healthy heading matched zero elements); the e2e layer never sees
  this because `expect().toBeVisible()` retries. Strictness preserved —
  the helper still THROWS on timeout. Two more script-side sequencing
  lessons en route, zero repo impact: the seed-pin sort-direction class
  ("Damascus-first" = createdAt DESC — the /products "Newest" sort; an
  asc-ordered verifier put Damascus LAST of 16) and the same-route
  panel-open class (clicking "Products" while already on /products
  changes no pathname, so the route-change close correctly does NOT
  fire — the check must be sequenced from a different route, like the
  e2e spec). The mobile grid encodes the full Tailwind v4 contract:
  conditional mount, toggle-closes, scroll lock engaging/releasing, the
  bg-primary active pill, the aria-label flip, the panel search flow,
  route-change close, no horizontal overflow at 390px.
- **agent-browser cross-check**: rebuilt at **28/28** — the mobile
  surface (viewport 390×844 applied AND asserted via innerWidth) with
  the full panel anatomy, the scroll lock cycle, the route-change
  close, the panel search flow (`q=mixer` → Professional Stand Mixer),
  the desktop search flow (viewport asserted at 1280), the
  product-detail anatomy on the cuid route, ZERO console/page errors,
  supplementary rasters under git-ignored `research/agent-browser/`.
  The run-68 CLI lessons (set viewport over set device; `[ref=eNN]` →
  `@eNN`) encoded in the persisted script.
- **a11y tree audit**: 48/48 CLEAN (8 pages × 6 checks on the cuid
  detail URL).
- **Deep audit 69-a** (read-only subagent): **9/9 code anchors PASS,
  zero actionable findings** — the twenty-second consecutive clean
  audit; the operator's `a0deef7` delta confirmed docs/skills-only
  (src/tests/prisma untouched); the stock-analysis-skill TypeScript
  payload fenced out of all five gates. One informational note carried
  (the dev-fallback literal duplication — cosmetic). One methodology
  lesson: `rg` with NO path argument blocks indefinitely on this
  sandbox's non-TTY stdin — always pass the explicit `.` path.
- **Standing conflict-marker grep gate**: CLEAN (seventh consecutive
  cycle).

## 4. The screenshots

The documented final-capture sequence on the normalized DB — fresh
reseed (rm-before-reseed; 0/16/2 baseline, every pin DB-verified) → ONE
e2e as the traffic generator (the exact documented class; the
e2e-minted review "E2E review 1792714509797" @ 2026-10-23T00:15:10Z,
DB-exact) → restore-demo-stock → the single clean capture on a COLD
server after the 60s login-limiter window: **25/25 green, zero
failures**. Byte-level diff vs `git show HEAD:` ground truth: **22/25
byte-identical** — the 3 changed shots all pixel-band-classified
(pngjs) + DB-cross-checked: 03-product-detail (1266 px in three 11-row
review-ID bands — traffic-owned), 12-admin-dashboard (1669 px — the
revenue-chart day-label axis + recent-orders rows + one KPI line) and
14-admin-orders (300 px — the 5 order rows' date bands): the UTC-day
drift class firing its second consecutive cycle (orders minted Oct-23
UTC vs the ground truth's Oct-22, DB-exact).

## 5. S68-1 (the docs sweep)

The plan's Session 68 section; SKILL v1.64.0 → v1.65.0 (project_state
opening "sessions 2-67" → "sessions 2-68" + the Session 68 Appendix B
entry with the four lessons); AGENTS plan range 2..67 → 2..68; the
CLAUDE unit-bullet session-68 tail; docs/session_128.md (this file);
the repo worklog Tasks 69-a + 69. README/PAD/DEPLOYMENT drift-checked
accurate — unchanged. Final gates re-run green on the final tree; a
single commit to main; SSH-wrapper push via `docs/ssh_git_wrapper_v3.py`
(fast-forward, no new branches, remote verified).
