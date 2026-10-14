# Session 46 — Run narrative (run 28: the 429 wiring-pin grid completed)

> This file is the narrative log of the **28th run**: it executes the section
> numbered **"Session 27"** in `docs/REMEDIATION_PLAN.md` (findings S27-1..
> S27-3 — the flagship completion of the route-level 429 wiring-pin grid,
> two whitespace NITs, and the count/split docs alignment). File names
> increment by run number (the run/plan numbering drift is documented);
> `docs/session_44.md` holds the previous run's narrative and
> `docs/session_45.md` the operator's raw log of it.

## 1. Workspace refresh & documentation review

The sandbox was RESET between runs — the workspace held no clone, so the
repo was re-cloned per the operator's standing instruction. Fresh clone at
`8059a67` (= the pushed main tip: `920f3bc`, the session-26 remediation,
plus the operator's session-log commit appending `docs/session_45.md`).
Reviewed in order: the operator's `coding_agent_prompt.md`, AGENTS.md,
CLAUDE.md, README.md, Project_Architecture_Document.md,
homenest-store-s_SKILL.md v1.23.0; then the review list's current
narratives `docs/session_44.md` + `docs/session_45.md`,
`docs/REMEDIATION_PLAN.md` (sessions 2–26), and `worklog.md` —
cross-checked against the codebase: docs and code agree; the project was
in the session-26-completed state (421/421 unit · 66/66 e2e). This run =
**Run 28 (session-27 cycle)**; the narrative numbering lands on
`session_46.md`, the worklog entry on Task 28.

**Environment**: `.env` recreated from the `file:../db/custom.db` contract
+ the dev `AUTH_SECRET`; the sandbox's shadow `DATABASE_URL`
(`file:/home/z/my-project/db/custom.db`) converged to the repo's
`db/custom.db` (**one inode verified**). Seed counts through the shadow
path 16/8/3/3/13. `skills/` excluded from all checking/testing/compilation
per the operator contract.

## 2. Gate re-validation — all green on the pulled tree

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **421/421 unit** ✓ · build ✓ ·
**66/66 e2e** ✓ — the documented session-26 state reproduces exactly.

## 3. Live-reference parity + mobile menu + SEO (agent-browser)

Reference verified logged-in with the provided credentials (login → home
redirect; the login page still shows "Continue with Google"; Damascus-first
in the featured section). Clone: title + Damascus-first + JSON-LD
(Organization); **mobile menu contract intact** (390×844: open →
`nav[aria-label="Mobile"]` with exactly 7 links
(Home|Products|Track Order|About|Contact|Sign In|Wishlist) + the search box
in the panel → navigate → drawer unmounted + toggle collapsed); sitemap 25
URLs; robots disallows `/admin /account /checkout /api` + sitemap ref;
desktop visual parity (identical header anatomy, hero carousel, the four
trust badges with identical copy, cream/terracotta palette — the clone's
wishlist heart and the reference's base44 chat bubble remain the documented
deltas). Zero console messages, zero page errors.

## 4. Deep audit (28-a)

Read-only subagent: session-26 fixes **4/4 WIRED** with file:line evidence
(the `order-placement.ts` extraction with the injected client, the 12-pin
money-path harness on the temp-SQLite pattern, the CLAUDE.md `<img>`
exception wording, zero route double-blanks). Defect-class sweeps
effectively CLEAN (10 fully clean, 2 documented-pattern-only, 2 NIT
whitespace hits). Static counts **11/11 MATCH** the live docs (46/421 unit
· 14/66 e2e · 18 models · 14 requireAdmin · 14 metered · 16 catch blocks ·
127 tracked TS files · 25 screenshots · 3 DSIH). All 8 carried deferrals
spot-checked — none silently resolved. New findings **0 CRITICAL / 0 HIGH /
0 MEDIUM / 0 LOW / 2 NIT / 1 Informational — the fifteenth consecutive
session without a CRITICAL/HIGH/MEDIUM/LOW finding.**

**Operator verification** reproduced every finding at the cited lines: the
two space-only lines (`newsletter/route.ts:20`, `contact/route.ts:24`), the
tests/ triple-blank run (`seo-ld.test.ts:121-123`), the 5-model
`OrderTxClient` Pick (the 5th, `"address"`, REQUIRED by
`saveCheckoutAddressInTx`), and the metered-surface pin split (3/14
route-level 429 pins; the exact 11-surface list).

## 5. TDD execution — S27-1 (the flagship) + S27-2

- **The grid completion**: 11 new describe blocks appended to
  `tests/unit/api-boundaries.test.ts` — cart POST/PATCH/DELETE (60/min
  shared `cart:` prefix), cart/bulk POST (10/min), cart-summary GET
  (120/min), coupon/apply POST (30/min), search GET (120/min), wishlist
  POST (60/min), and the three addresses handlers (60/min BEHIND
  `getCurrentUser`). Each pin exhausts the route's REAL budget through the
  REAL limiter and asserts the full 429 contract: status, `Retry-After`,
  and the EXACT body — the coupon route's body is the `CouponApplyResponse`
  shape `{ ok: false, error: "Too many attempts. Please try again
  shortly." }`, NOT the generic `{ error }` sibling copy. Every pin carries
  the S15-1 slot-accounting assertion (the recorded in-budget statuses are
  exactly the expected later-outcome — 404/400/200 — never 429).
- **Key mechanics**: the file's `post()` helper appends a constant proxy
  hop (`, 198.51.100.1`) which BECOMES the rightmost `x-forwarded-for` hop
  — so every helper request shares one bucket per key prefix. The three
  `cart:` and three `addresses:` describes would exhaust EACH OTHER's
  budgets; every new pin therefore uses the `nextReq()` SINGLE-HOP helper
  with a UNIQUE per-test IP (the C1 pin's isolation convention) and a real
  `NextRequest` (the DELETE/search handlers read `request.nextUrl`). The
  module-wide `@/lib/auth` mock (safe — no `src/lib/**` module imports
  `@/lib/auth`; only `src/lib/actions/*` do, and no API route imports
  those) is reset to null in the file-level `beforeEach` so the existing
  guest-path pins (C3/C1/C7) run byte-identical; the addresses describes
  override it to a signed-in user.
- **RED (mutation checks)**: M1 — coupon budget 30→29 → EXACTLY the coupon
  pin fails (1). M2 — cart budget 60→59 → EXACTLY the three cart pins fail
  (3) — which is also the ISOLATION PROOF: each describe exhausted its OWN
  bucket; no other pin moved. All mutation sites restored byte-for-byte
  (`git diff src/` shows only the two S27-2 whitespace strips).
- **GREEN**: **21/21 boundary pins green on the FIRST run** (11 new + the
  10 existing unchanged — the isolation conventions were pre-applied from
  the documented lessons); the full unit suite **432/432** (421 + 11).
- **S27-2**: the two space-only lines stripped; the tests/ triple blank
  collapsed to one. Verified afterward: zero whitespace-only lines and
  zero double-blank sites in `src/` and the touched test file.

## 6. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **432/432 unit** ✓ · build ✓ · **66/66 e2e** ✓
- **Manual verification** (agent-browser, fresh production server): home +
  products navigation with zero console messages/errors; mobile menu
  contract intact (open → links + search → navigate → drawer unmounted +
  toggle collapsed); sitemap 25 URLs; JSON-LD.

## 7. Screenshots & documentation

**25 screenshots** refreshed to `docs/screenshots/` (all ✓ on the fresh
server running the remediated codebase). Docs aligned: README (badge
432/66 + the stack table + the script comment), PAD (§8.1 header 432 + the
api-boundaries row + the §12 table), SKILL v1.24.0 (project_state + the
Appendix B session-27 entry), AGENTS.md (plan range 2..27), CLAUDE.md (the
session-27 grid-completion tail), DEPLOYMENT.md (drift-free — no new env
vars), `.env.example` unchanged, this file, and the worklog entry.

## 8. Final state

**432/432 unit · 66/66 e2e · all gates green**; 25 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the route-level 429 wiring-pin debt is now FULLY
retired — every metered HTTP surface carries a route-level boundary pin.
The remaining carried items are the deliberate S8-8 login-limiter lockout
tradeoff, the small UI/infra dispositions (404-shell CSP nonce, `__Host-`
prefix, shared-store limiter, radiogroup roving focus, address content
dedup), and the external-service epics (real email delivery, OAuth, real
payments — blocked on sandbox-external credentials/SMTP). The natural next
increments are order-status email notifications once a mailer lands, and
the login/register action-level limiter pins at the route boundary if a
route-level surface ever wraps them.
