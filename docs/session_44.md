# Session 44 — Run narrative (run 27: the money-path real-engine harness + the doc-drift sweep)

> This file is the narrative log of the **27th run**: it executes the section
> numbered **"Session 26"** in `docs/REMEDIATION_PLAN.md` (findings S26-1..
> S26-3 — two documentation NITs and the flagship promotion of the checkout
> money path into the temp-SQLite harness family). File names increment by
> run number (the run/plan numbering drift is documented); `docs/session_42.md`
> holds the previous run's narrative and `docs/session_43.md` the operator's
> raw log of it.

## 1. Workspace refresh & documentation review

`git pull` fast-forwarded `32116ee` → `2e92db8` (the operator's session-log
commit appending `docs/session_43.md` — the raw run-26 conversation
narrative). Reviewed in order: the operator's `coding_agent_prompt.md`
(byte-identical to prior runs), AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md v1.22.0; then
the review list's current narratives `docs/session_42.md` +
`docs/session_43.md`, `docs/REMEDIATION_PLAN.md` (sessions 2–25), and
`worklog.md` — cross-checked against the codebase: docs and code agree; the
project was in the session-25-completed state. This run = **Run 27
(session-26 cycle)**; the narrative numbering lands on `session_44.md`.

**Environment**: `.env` carried the `file:../db/custom.db` contract + the
dev `AUTH_SECRET`; `.env.example` matches; the sandbox's shadow
`DATABASE_URL` (`file:/home/z/my-project/db/custom.db`) was ALREADY
converged (the symlink to the repo's `db/custom.db` survived; one-inode
verified). Counts through the shadow path: 16 products / 8 categories / 3
coupons / 37 users / 3 slides / 13 settings — the extra users/orders/reviews
are documented e2e residue (self-healing by design). `skills/` excluded from
all checking/testing/compilation per the operator contract.

## 2. Gate re-validation — all green on the pulled tree

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **409/409 unit** ✓ · build ✓ ·
**66/66 e2e** ✓ — the documented session-25 state reproduces exactly.

## 3. Live-reference parity + mobile menu + SEO (agent-browser)

Reference unchanged (verified logged-in with the provided credentials —
login → home redirect; the login page still shows "Continue with Google";
Damascus-first in the featured section). Clone: title + Damascus-first +
JSON-LD; **mobile menu contract intact** (390×844: open →
`nav[aria-label="Mobile"]` with exactly 7 links
(Home|Products|Track Order|About|Contact|Sign In|Wishlist) + the search box
in the panel → navigate → drawer unmounted + toggle collapsed); sitemap 25
URLs; robots disallows `/admin /account /checkout /api` + sitemap ref;
desktop visual parity (identical header anatomy, hero carousel, four trust
badges with identical copy, cream/terracotta palette — the clone's wishlist
heart being the documented superset).

**Mid-session tooling episode (the documented artifact class again)**: the
workspace's LEFTOVER `next-server` from the prior run was still listening
on :3000 (the fresh `npm run start` failed EADDRINUSE and the health check
silently hit the OLD server). Killed by PID, one fresh server started,
clean repro: reload + navigate → **zero console messages, zero page
errors** (the one `cdn.tailwindcss.com` warning in the cumulative console
was reference-site residue — the reference serves Tailwind from its CDN).
A tooling episode, not a code defect.

## 4. Deep audit (27-a)

Read-only subagent: session-25 fixes **7/7 WIRED** with file:line evidence
(both new real-engine harnesses import the REAL lib functions and drive the
LIVE shapes against temp SQLite; the checkout route still runs the guarded
increment; `saveCheckoutAddressInTx` still gates at-cap BEFORE any write;
`track-order-limiter.test.ts` on `vi.resetAllMocks()`; the three doc NITs
hold). Defect-class sweeps **12/13 CLEAN + 1 NIT-class observation** — the
ONE raw `<img>` in `src/` is the account page's order-history snapshot
thumbnail, deliberate and inline-justified since the account surface
shipped. Static counts ALL matching the live docs (409/45 unit · 66/14 e2e
· 18 models · 14 requireAdmin · 14 metered · 16 catch blocks · 25
screenshots · 3 DSIH sites · 126 src files · the SKILL §5 split). **0
CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT / 2 Informational — the
fourteenth consecutive session without a CRITICAL/HIGH/MEDIUM/LOW
finding.** The audit's carried-deferral spot-check confirmed every carried
entry is still accurate (none silently resolved).

**Operator verification** reproduced all three audit findings at the cited
lines (the `<img>` block, the two double-blank sites, the `variantLabel`
read-without-write surface list) and confirmed the `api-boundaries` mock
shape tolerates the S26-3 extraction before any code moved.

## 5. TDD execution — S26-3 (the flagship) + S26-1/S26-2

- **The extraction** (the S18-1 precedent applied to the money authority):
  `CheckoutError`, `OrderItemCreate`, `PlaceOrderArgs`, and `placeOrderTx`
  moved VERBATIM from `src/app/api/checkout/route.ts` into the new
  `src/lib/order-placement.ts` with the db client INJECTED (`placeOrderTx(db,
  orderNumber, args)` — structural `Pick<Prisma.TransactionClient, …>` tx +
  the `$transaction` carrier, the S25-6 pattern generalized). The route
  imports the three exports and calls `placeOrderTx(db, candidate, args)`;
  behavior byte-equivalent — the C1/C3 boundary pins (mocked `@/lib/db`
  module-wide) stayed **10/10 green UNCHANGED**, and the full e2e suite
  (incl. the HTTP-level shopping flow) stayed green. S26-2's two
  double-blank sites were resolved structurally by the move (zero verified
  after).
- **The harness** — `tests/unit/place-order-integration.test.ts` (the
  S25-5 temp-SQLite pattern), 12 pins: server-derived money (the args'
  cosmetic mirrors carry GARBAGE — stale names, absurd prices — and the
  LIVE rows win: subtotal 2500/discount 250/shipping 699/tax 180/total
  3129), the receipt snapshots (in-tx product price/name, the line's
  image), the "placed" event, stock reservation, the read-side
  insufficient-stock fast-fail, the **WRITE-side atomic decrement guard**
  (a duplicate-product handoff makes the first guarded decrement the
  concurrent writer for the second — getCartSummary can never produce it,
  the tx must not over-sell regardless of the caller), the coupon burn,
  the **engine-level atomic rollback** (a mid-tx failure AFTER the burn —
  a duplicate order-number unique violation — restores `timesUsed`, stock,
  and the book; the complement of the C1 synthetic retry pin), the S12-1
  cart-clear scoping (the concurrent-tab line survives, unordered and
  unrestocked), and the S7-8 best-effort save (the ORDER STILL PLACES at
  the address cap; below cap the address saves in the SAME tx and
  auto-defaults).
- **RED (mutation checks) — the honest record**: M1 (trust the summary's
  `unitPrice`) failed the money + receipt pins exactly as predicted. **The
  first M2 run ESCAPED detection** — the insufficient-stock pin only
  exercises the READ-side guard (`product.stock < line.quantity` throws
  before any write), and a single-connection state harness cannot
  interleave a competing writer between the in-tx read and the guarded
  decrement. Rather than dispose the mutation, the pin family grew the
  missing seam: the duplicate-product write-guard pin makes the FIRST
  guarded decrement the concurrent writer for the SECOND (stock 3 passes
  both reads; decrement one lands 3→1; the second's `stock: { gte: 2 }`
  guard matches nothing → count 0 → 409 → the full rollback). With that
  pin in place M2 went RED exactly as predicted (the order places and
  stock goes negative without the guard). M3 (blanket cart clear) failed
  the concurrent-tab pin exactly as predicted. **4 of the 12 pins failed
  exactly as predicted; the other 8 stayed green under every mutation.**
- **GREEN** — all mutation sites restored byte-for-byte (`git status src/`
  shows exactly the extraction: the modified route + the new lib file);
  **12/12 harness pins green (421/421 unit)**; the temp-SQLite family
  intact (coupon-cap + save-address + recovery 10/10).
- **S26-1** — CLAUDE.md now documents the order-history snapshot thumbnail
  as the one deliberate `next/image` exception (the code's inline
  justification IS the boundary).

## 6. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **421/421 unit** ✓ · build ✓ · **66/66 e2e** ✓
- **Manual verification** (agent-browser, fresh production server): home +
  products navigation with zero console messages/errors; mobile menu
  contract intact (7 links + search → navigate → auto-close/unmount);
  sitemap 25 URLs; robots; JSON-LD.

## 7. Screenshots & documentation

**25 screenshots** refreshed to `docs/screenshots/` (all ✓ on the fresh
server running the remediated codebase). Docs aligned: AGENTS.md (plan
range 2..26), CLAUDE.md (the session-26 money-path tail + the documented
`<img>` exception), README.md (badge 421/66 + the tail), PAD (§8.1 header
421 + the new harness row + §12 table), SKILL.md v1.23.0 (project_state +
the §5 count 127 + the Appendix B session-26 entry), DEPLOYMENT.md
(drift-free — no new env vars), `.env.example` unchanged, this file, and
the worklog entry.

## 8. Final state

**421/421 unit · 66/66 e2e · all gates green**; 25 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the remaining carried items are the deliberate
S8-8 login-limiter lockout tradeoff, the route-level 429 wiring pins beyond
the S14-2 representatives, the small UI/infra dispositions (404-shell CSP
nonce, `__Host-` prefix, shared-store limiter, radiogroup roving focus,
address content dedup), and the external-service epics (real email
delivery, OAuth, real payments — blocked on sandbox-external
credentials/SMTP). The temp-SQLite harness family is now four strong (P2002
recovery, coupon cap, saveAddress, and the full money path) — the natural
next increments are wiring the remaining route-level 429 surfaces into the
established boundary-pin pattern, and order-status email notifications once
a mailer lands.
