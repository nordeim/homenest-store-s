# Session 17 — Run narrative (session-12 remediation execution)

> This file is the narrative log of the **13th run**: it executes the section
> numbered **"Session 12"** in `docs/REMEDIATION_PLAN.md` (findings
> S12-1…S12-5, one of which was rejected on verification, plus five coverage
> pins). File names increment by run number (the run/plan numbering drift is
> documented); `docs/session_15.md` holds the previous run's closing narrative
> and `docs/session_16.md` its raw log.

## 1. Workspace refresh & documentation review

Fresh clone at `2d3af58` (`5058902` + the run-12 session logs). Reviewed in
order: the operator's `coding_agent_prompt.md` (modes A–D, evidence
discipline internalized), AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md v1.8.0; then
docs/session_15.md (run-12 narrative), docs/session_16.md (run-12 raw log),
docs/REMEDIATION_PLAN.md (sessions 2–11), worklog.md — cross-checked against
the codebase: docs and code agree; the project was in the session-11-completed
state.

**Environment shadowing trap neutralized**: the sandbox shell exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db`; the symlink
`/home/z/my-project/db → <repo>/db` converges the shadowed path with the repo
path. `.env` recreated from `.env.example` (`file:../db/custom.db` contract +
fresh `AUTH_SECRET`); `db/custom.db` seeded at the repo root; `skills/`
excluded from all checking/testing/compilation per the operator contract.

## 2. Gate re-validation

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **246/246 unit** ✓ · build ✓ ·
**51/51 e2e** ✓ — the pulled tree is exactly as documented.

## 3. Live-reference parity + mobile menu (agent-browser, logged in)

Reference unchanged: same nav anatomy, same 3 hero slides, same trust badges,
same 8 category tiles, same login copy ("Welcome to HomeNest Kitchen" / "Sign
in to continue" — the reference's "Continue with Google" stays a deliberate
divergence: a dead OAuth button would be fake UI). Logged in with the operator
credentials: the account page (profile + expandable order history) is covered
by the clone's superset (profile editing, address book, paginated orders).

**NEW parity finding**: measuring the reference's `/products` default "Newest"
view and its home sections directly (DOM extraction) showed its catalog in
authored order — Damascus Steel Chef Knife Set first — on ALL THREE surfaces
(Featured = 6 products, New Arrivals = all 8, products page = all 8). The
clone rendered the REVERSE of its seed order on two of the three (auto-`now()`
seed timestamps + `createdAt: desc`), while home Featured (`createdAt: asc`)
matched — the surfaces disagreed with each other. Became finding S12-5.

**Mobile menu re-verified on the production build** (iPhone 390×844): open →
`expanded=true` → `navigation "Mobile"` with all 7 links → click Products →
lands on `/products` → panel closed. Tailwind v4 conditional-mount intact.

## 4. Fresh deep audit (session 12)

A read-only subagent executed the repo `code-review-checklist` 12-category
scan (`src/`, `prisma/`, `tests/`, root configs; `skills/` excluded); every
finding was personally re-verified with file:line evidence before planning.

**Result: 0 CRITICAL / 0 HIGH / 3 LOW / 1 NIT** — session-11 fixes **6/6
WIRED / 0 PARTIAL / 0 MISSING**. One additional reported NIT ("mangled
`accent-sl(24_70%_50%)]` class ×3") was **REJECTED on verification**: the
source actually carries the valid arbitrary utility
`accent-[hsl(24_70%_50%)]` and the built CSS contains the compiled rule
(`accent-color:#d96e26`) — a text-mangling artifact in the audit pipeline,
not a code defect. Lesson recorded in SKILL.md Appendix B: verify "dead
utility" claims against build output.

New findings (all evidence-confirmed):
- **S12-1 (LOW)** checkout cleared the cart by bare `cartId` — a concurrent
  add committing between the pre-tx summary read and the in-tx sweep would be
  silently deleted (unordered, unrestocked, off the receipt)
- **S12-2 (LOW)** the demo-credentials quick-fill (naming the seeded ADMIN
  account) shipped ON by default in production builds
- **S12-4 (NIT)** `/checkout/success` ran the items+events-inclusive lookup
  before the token check (query-weight probe signal)
- **S12-5 (LOW)** the catalog order parity gap from §3

## 5. Remediation plan

Appended the "Session 12" section to `docs/REMEDIATION_PLAN.md` (TDD steps +
five coverage pins + accepted deferrals), re-validated it against the
codebase, then executed.

## 6. TDD execution (RED → GREEN)

**RED**: `tests/unit/session12-hardening.test.ts` (11 cases:
`cartClearFilter` ×3, `productSeedCreatedAt` ×4, `settingNumber` ×4) — all 11
failed on the missing exports with the existing 246 green. (One test-side bug
— a stale index into a shortened array — was itself fixed before GREEN.)

**GREEN — pure modules first**: `cart.ts` += `cartClearFilter`;
`seed-policy.ts` += `productSeedCreatedAt` (60-second spacing, negative-index
guard); `settings.ts` += `settingNumber` (empty/garbage → fallback, wired into
`getSettings`). **Wiring**: `placeOrderTx` deletes through the filter; seed
`create` gains `createdAt: productSeedCreatedAt(index)` (create-only —
`productSeedUpdate` untouched so reseeds never rewrite the order); home
featured `asc` → `desc`; fresh DB reseeded and the new order verified in SQL
(Damascus first, reference 8 first, superset tail after). **S12-2**: the
`DEMO_MODE` expression inverted for production (opt-in `"true"`), verified
LIVE both ways on the built server (box absent by default, present with the
flag) — `.env.example`, DEPLOYMENT.md and the screenshots-script comment
rewritten. **S12-4**: token verified before the DB read. E2E additions: the
S10-2 lost-line pin (PATCH 404 / idempotent DELETE 200), the new
`contact-newsletter.spec.ts` (6 cases), the guest-wishlist → registration
merge case in `auth.spec.ts`, and the storefront page-split assertions
rewritten (they had institutionalized the reversed order — a test pinning the
bug). Two strict-mode locator fixes in the new spec (the documented
`.first()`/filter convention; the contact section's aria-label shadows
`getByLabel("Message")`).

## 7. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **257/257 unit** ✓ · build ✓ · **59/59 e2e** ✓
- **Manual verification** (agent-browser, fresh standalone build):
  `/products` page 1 = Damascus, Copper Pan, Ceramic Dinner Set, Dutch Oven,
  Walnut, Mixing Bowl, Glass Storage, Stand Mixer + 4 superset items (the
  reference's exact first-8); home Featured and New Arrivals match the
  reference exactly; login demo box hidden in the default production build
  and restored with `NEXT_PUBLIC_DEMO_MODE="true"`; mobile menu open →
  navigate → auto-close re-verified
- `curl /api/health` → `db:up`

## 8. Screenshots & documentation

23 screenshots refreshed to `docs/screenshots/`. Docs aligned: AGENTS.md (4
new invariants: demo-mode default, catalog order, cart-clear filter,
token-before-query), CLAUDE.md (module list + coverage), README.md (badges
257/59, order-parity highlight, demo-mode env row), PAD (§8.1/§8.2 tables +
known issues #47–50), SKILL.md v1.9.0 (project_state + Appendix B session-12),
DEPLOYMENT.md (demo-mode default + seeded-credentials advice), this file, and
the worklog entry.

## 9. Final state

**257/257 unit · 59/59 e2e · all gates green**; 23 screenshots refreshed;
`.env.example` matches the codebase (demo-mode semantics updated); all docs
aligned; single atomic commit on `main` only, pushed via the SSH wrapper
(dry-run → push → remote ref verified) with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the carried deferrals remain the drawer focus-trap
(S8-7), the login-limiter lockout tradeoff (S8-8), the checkout P2002
recovery-loop integration seam, and the real payment/email epics. The admin
coupon-management UI is still the natural next feature increment.
