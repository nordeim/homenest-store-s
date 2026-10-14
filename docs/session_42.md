# Session 42 — Run narrative (run 26: the real-engine harness family + the doc-NIT sweep)

> This file is the narrative log of the **26th run**: it executes the section
> numbered **"Session 25"** in `docs/REMEDIATION_PLAN.md` (findings S25-1..
> S25-7 — three documentation NITs, one plan-bookkeeping defect, two
> promoted integration seams (the coupon-cap and saveAddress real-engine
> harnesses), and the mock-hygiene alignment). File names increment by run
> number (the run/plan numbering drift is documented); `docs/session_40.md`
> holds the previous run's narrative, `docs/session_41.md` the operator's
> raw log of it.

## 1. Workspace refresh & documentation review

The workspace survived with `node_modules` intact. `git pull` fast-forwarded
`4659776` → `496761e` (the operator's session-log commit appending
`docs/session_41.md` — the raw run-25 conversation narrative). Reviewed in
order: the operator's `coding_agent_prompt.md`, AGENTS.md, CLAUDE.md,
README.md, Project_Architecture_Document.md, homenest-store-s_SKILL.md
v1.21.0; then the review list's current narratives `docs/session_40.md` +
`docs/session_41.md`, `docs/REMEDIATION_PLAN.md` (sessions 2–24), and
`worklog.md` — cross-checked against the codebase: docs and code agree; the
project was in the session-24-completed state.

**Environment**: the sandbox's shadow `DATABASE_URL`
(`file:/home/z/my-project/db/custom.db`) was ALREADY converged (the symlink
to the repo's `db/custom.db` survived; one-inode verified). Counts through
the shadow path: 16 products / 8 categories / 3 coupons / 27 users / 3
slides / 13 settings — the 25 extra users are e2e-created test accounts
(spec residue, self-healing by design). `.env` carried the
`file:../db/custom.db` contract + the dev `AUTH_SECRET`; `skills/` excluded
from all checking/testing/compilation per the operator contract.

**Doc review surfaced S25-1 before any audit ran**: the SKILL
`project_state` line carried the ENTIRE stale session-23 value glued after
the session-24 value's closing quote — a non-idempotent doc-patch artifact
from run 25 (the exact failure class run 25's sweep had fought elsewhere;
this instance lived on in the SKILL header).

## 2. Gate re-validation — all green on the pulled tree

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **402/402 unit** ✓ · build ✓ ·
**66/66 e2e** ✓ — the documented session-24 state reproduces exactly.

## 3. Live-reference parity + mobile menu + SEO (agent-browser)

Reference unchanged (verified logged-in with the provided credentials —
login → home redirect; the login page still shows "Continue with Google";
Damascus-first in the featured section; the hero carousel + the four trust
badges with identical copy). Clone: title + Damascus-first + JSON-LD
(Organization/WebSite on the layout); **mobile menu contract intact**
(390×844: open → `nav[aria-label="Mobile"]` with exactly 7 links
(Home|Products|Track Order|About|Contact|Sign In|Wishlist) + the search box
in the panel → navigate → drawer unmounted + button collapsed); sitemap 25
URLs; robots disallows `/admin /account /checkout /api` + sitemap ref;
desktop visual parity (identical header anatomy, hero structure, trust
badges, cream/terracotta palette — the clone's wishlist heart + account
icon being the documented superset).

**Mid-session tooling episode (the documented artifact class again)**: a
ChunkLoadError appeared in the cumulative console — root cause: the
workspace's LEFTOVER `next-server` from the prior run was still listening
on :3000 (my fresh `npm run start` had failed EADDRINUSE), serving the OLD
build's chunk references. Killed by PID (the `pkill -f "next start"` miss
is documented), one fresh server started, clean repro: reload + navigate →
**zero console messages, zero page errors**. A tooling episode, not a code
defect.

## 4. Deep audit (26-a)

Read-only subagent: session-24 fixes **4/4 WIRED** with file:line evidence
(S24-1 the whitespace scan of `track-order/page.tsx` returns zero; S24-2
the real action consults BOTH tiers via the real `reviewRateLimitKeys` and
rejects when either fails; S24-3 the real page consults the limiter BEFORE
the DB read and fails CLOSED; S24-4 the temp-SQLite harness cross-checked
against `prisma-errors.ts` and the live recovery loop; the three new files
11/11 green in isolation). 13/13 defect-class sweeps CLEAN; static counts
ALL matching the live docs (402/43 unit · 66/14 e2e · 18 models · 14
requireAdmin · 14 metered · 16 catch blocks · 25 screenshots · 3 DSIH
sites). **0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT / 2 Informational
— the thirteenth consecutive session without a CRITICAL/HIGH/MEDIUM/LOW
finding.** The NITs: S25-2 the SKILL §5 structural stats frozen at the
session-6 era (101/14+9/35 vs measured 126/13+9/38 — independently
reproduced by the operator), S25-3 (operator find) the PAD ADR-003 CJK
paste artifact; Informational: the `clearAllMocks` vs `resetAllMocks`
divergence in the S24-3 test (promoted to S25-7) and the harness mkdtemp
residue (matches precedent, no action).

**Operator verification** also re-examined the carried deferrals and found
**S25-4** (plan bookkeeping): the live dispositions list still carried
"admin coupon-management UI" — resolved back in session 19 by S19-5
(`/admin/coupons` shipped, e2e-pinned by `admin-coupons.spec.ts`);
copy-forwarded through sessions 20-24 unexamined. Dropped from session 25's
list (history never rewritten). The "review two-tier budgets e2e" deferral
was DISPOSED as redundant coverage: S24-2's unit pin already exercises both
tiers through the REAL action with the REAL key derivation; an e2e would
need 20+ submissions/min and pollute limiter state across specs.

## 5. TDD execution — S25-5/S25-6/S25-7 + the doc NITs

- **New harnesses** (the S24-4 temp-SQLite pattern generalized —
  `mkdtempSync` + `prisma db push --skip-generate` + `datasourceUrl`, no
  process env, no sandbox shadow):
  - `tests/unit/coupon-cap-integration.test.ts` (S25-5) — the checkout's
    LIVE increment shape (`tx.coupon.updateMany({ where:
    couponRedemptionFilter(code, maxRedemptions), data: { timesUsed: {
    increment: 1 } } })`, `checkout/route.ts:312-313`) against a REAL db:
    at-cap → count 0 and the row untouched; one-under → count 1 and
    `timesUsed` lands; deactivated with budget → count 0 (the always-on
    `isActive` guard); unlimited (`maxRedemptions: null`) → count 1 at any
    `timesUsed`.
  - `tests/unit/save-address-integration.test.ts` (S25-6) —
    `saveCheckoutAddressInTx` inside a REAL transaction: below cap →
    "saved" with the previous default unset and the new row the single
    default; at cap → "at-cap" with the book byte-identical (no create, no
    partial unset — the order-still-places invariant); a label-less draft
    defaults to "Home".
- **RED (mutation checks)** — 3 of the 7 new pins failed exactly as
  predicted, against the REAL engine in both harnesses: stripping
  `isActive: true` from `couponRedemptionFilter` failed the deactivated pin
  (count 1 ≠ 0); stripping the `timesUsed: { lt }` cap clause failed the
  at-cap pin; the no-op `assertAddressCap` failed the save-address at-cap
  pin (21 rows + the default unset instead of "at-cap" + a frozen book).
  The other 4 stayed green under every mutation — the pins are
  mutation-sensitive, not shape-insensitive.
- **GREEN** — all mutation sites restored byte-for-byte (`git status src/`
  clean); **7/7 new pins green** (409/409 unit).
- **S25-7** — `track-order-limiter.test.ts` joins the `vi.resetAllMocks()`
  discipline (the file's 4 pins stay green; the `beforeEach` re-stubs all
  three mocks).
- **S25-1/S25-2/S25-3** — the stale `project_state` fragment dropped (the
  line now ends at the session-24 value), the §5 stats refreshed to
  126/13+9/38, the PAD ADR reads "—anyone can mint an admin".

## 6. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **409/409 unit** ✓ · build ✓ · **66/66 e2e** ✓
- **Manual verification** (agent-browser, fresh production server): home +
  products navigation with zero console messages/errors; mobile menu
  contract intact (7 links + search → navigate → auto-close/unmount);
  sitemap 25 URLs; robots; JSON-LD.

## 7. Screenshots & documentation

**25 screenshots** refreshed to `docs/screenshots/` (all ✓ on the fresh
server). Docs aligned: AGENTS.md (plan range 2..25), CLAUDE.md (the
session-25 harness-family tail), README.md (badge 409/66 + the tail), PAD
(§8.1 header 409 + the two new test rows + §12 table + the ADR-003 paste
fix), SKILL.md v1.22.0 (project_state + the §5 stats refresh + the Appendix
B session-25 entry), DEPLOYMENT.md (drift-free — no new env vars),
`.env.example` unchanged, this file, and the worklog entry.

## 8. Final state

**409/409 unit · 66/66 e2e · all gates green**; 25 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the remaining carried items are the deliberate
S8-8 login-limiter lockout tradeoff, the route-level 429 wiring pins beyond
the S14-2 representatives, the small UI/infra dispositions (404-shell CSP
nonce, `__Host-` prefix, shared-store limiter, radiogroup roving focus,
address content dedup), and the external-service epics (real email
delivery, OAuth, real payments — blocked on sandbox-external
credentials/SMTP). The temp-SQLite harness family is now three strong (P2002
recovery, coupon cap, saveAddress) — a checkout end-to-end money-path
harness (full `placeOrderTx` against a real db) is the natural next
increment, and order-status email notifications remain the natural feature
increment once a mailer lands.
