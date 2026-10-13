# Session 29 — Run narrative (session-18 remediation execution)

> This file is the narrative log of the **19th run**: it executes the section
> numbered **"Session 18"** in `docs/REMEDIATION_PLAN.md` (findings S18-1,
> S18-2, S18-3 plus the S18-4 coverage-gap dispositions). File names increment
> by run number (the run/plan numbering drift is documented);
> `docs/session_27.md` holds the previous run's closing narrative and
> `docs/session_28.md` its raw log.

## 1. Workspace refresh & documentation review

The workspace had been reset — fresh-cloned
`https://github.com/nordeim/homenest-store-s.git` at `14d0bbb` (= `6c0d708`,
the run-18 commit, + the operator-committed `docs/session_28.md` raw log).
Reviewed in order: the operator's `coding_agent_prompt.md`, AGENTS.md,
CLAUDE.md, README.md, Project_Architecture_Document.md,
homenest-store-s_SKILL.md v1.14.0; then docs/session_27.md (run-18
narrative), docs/REMEDIATION_PLAN.md (sessions 2–17), worklog.md,
docs/session_28.md — cross-checked against the codebase: docs and code
agree; the project was in the session-17-completed state.

**Environment**: this sandbox re-exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db` on shell recycle and
**symlink creation is blocked** (prior sessions' convergence mechanism).
Converged with a **hard link** `/home/z/my-project/db/custom.db` →
`<repo>/db/custom.db` (one inode — SQLite byte-range locks apply to the
inode, so both paths stay mutually exclusive). The shadow-absent path was
verified schema-anchored via a move-the-shadow-dir probe: `db:seed`
succeeded with the shadow path relocated, proving the CLI/seed contract
holds and the early "Unable to open the database file" failures were purely
the absolute-shadow passthrough hitting a path that didn't exist yet — no
code defect. `.env` carries the `file:../db/custom.db` contract + a dev
`AUTH_SECRET`; `db/custom.db` pushed + seeded at the repo root (16 products
/ 8 categories / 3 coupons / 2 users verified); `skills/` excluded from all
checking/testing/compilation per the operator contract.

## 2. Gate re-validation

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **324/324 unit** ✓ · build ✓ ·
**63/63 e2e** ✓ — the pulled tree is exactly as documented. (One first-run
auth S14-3 flake passed on the full-suite re-run; the demo profile name was
verified unpolluted — not the known DATA mode; treated as environment
flake, no code change.)

## 3. Live-reference parity + mobile menu + SEO (agent-browser)

Reference unchanged: same nav anatomy, same hero slides ("New Arrivals" /
"Elevate Your Kitchen" / "Sale Up to 40% Off"), same 8 category tiles, same
featured set and authored order (Damascus Steel Chef Knife Set first, −29% /
(412) / $199.99), mobile panel = the 5 main links + close.

**Clone verified on the fresh production build**: mobile menu (iPhone
390×844) open → `nav[aria-label=Mobile]` with all 7 links + search box →
click Track Order → lands on `/track-order` → panel closed (nav unmounted;
button back to "Open menu") — the Tailwind v4 conditional-mount pattern
intact. `/products` renders Damascus-first. Demo login → `/account`
("Account: Jordan Rivera"). **SEO surfaces**: `sitemap.xml` = 25 public
URLs (home, products, about, contact, 5 legal, 16 products — zero private
surfaces); `robots.txt` disallows /admin, /account, /checkout, /api and
references the sitemap; home JSON-LD carries Organization + WebSite +
SearchAction + ContactPoint. Desktop visual parity re-confirmed
side-by-side (header anatomy, hero, trust badges, palette, typography).
Zero console errors on a fresh browser session.

## 4. Fresh deep audit (session 18)

A read-only subagent (19-a) executed the repo `code-review-checklist`
12-category scan (`src/`, `prisma/`, `scripts/`, `tests/`, root configs;
`skills/` excluded); every finding was personally re-verified with file:line
evidence before planning.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 2 NIT /
1 Informational / 0 doc-drift** — the sixth consecutive session without a
CRITICAL/HIGH/MEDIUM. Session-16 fixes **4/4 WIRED**; session-17 fixes
**3/3 WIRED**; older-fix spot-checks **7/7 WIRED** (incl. 14/14 Retry-After
sites and 4/4 `clampSearchTerm` consumers). Static counts re-verified:
334-before-session unit total 324 · 63 e2e · 18 models · 16 products ·
11/11 admin actions requireAdmin'd · 14 metered sites · 13 admin catch
blocks.

Findings (all evidence-confirmed): **S18-1 (LOW)** checkout's in-tx
`saveAddress` still gated the address-book cap with the PRE-create check
only — the third create path behind the S11-6/S16-1 hardening, and (unlike
S17-3) unrecorded; the block was also route-private, keeping the carried
"saveAddress at-cap skip-save integration pin" (deferred since session 7)
unclosable; **S18-2 (NIT)** the cart-page and drawer "+" steppers stayed
enabled at the 99 ceiling (stock > 99 reachable), so the click PATCHed 100
and the schema 400 surfaced Zod's default English message in the error
toast; **S18-3 (NIT)** `axe-core` + `@testing-library/user-event` declared
and installed but imported by zero files; **S18-4 (Informational)** two
carried coverage gaps — (a) the saveAddress at-cap skip-save pin (closed by
this session's S18-1 work) and (b) the `/track-order` page-level limiter
wiring pin (carried with justification: the limiter logic and the
route-level 429 contract are already pinned; an e2e pin would need 30
requests per run for a wiring fact).

## 5. Remediation plan

Appended the "Session 18" section to `docs/REMEDIATION_PLAN.md` (TDD steps
+ the S18-4 dispositions + the accepted-debt rationale), re-validated it
against the codebase, then executed.

## 6. TDD execution (RED → GREEN)

**RED confirmed exactly as designed** before any implementation:
`tests/unit/session18-hardening.test.ts` — 9 failed (the missing
`saveCheckoutAddressInTx` export; the three schemas' Zod default messages)
/ 1 passed (the boundary-values coverage pin, green by design).

**GREEN**:

- **S18-1**: `saveCheckoutAddressInTx` in `src/lib/addresses.ts` (the S11-6
  lib pattern — minimal `CheckoutAddressSavingClient` interface +
  `CheckoutAddressDraft`) returning `"saved" | "at-cap"`; the checkout tx
  consumes it (the try/catch replaced by the plain call — the
  order-still-places semantics are now structural: the helper returns the
  cap outcome instead of throwing it). The cap gate deliberately STAYS the
  PRE-create `assertAddressCap` fast-fail — the OPPOSITE of the S11-6/S16-1
  create paths: a post-create throw here would roll back the ENTIRE order
  transaction (order, stock, coupon) and Prisma interactive transactions
  have no savepoints. The residual race (two concurrent checkouts by the
  same signed-in user at exactly cap−1 land one extra row) is bounded,
  benign, self-limiting on the next save, and RECORDED as accepted debt
  (the S17-3 pattern) in AGENTS.md. The carried S18-4a skip-save pin closes
  with the same test file (no-writes-at-cap + the "saved" path pinned).
- **S18-2**: cart-page "+" disabled at `Math.min(line.stock,
  MAX_CART_QUANTITY)`; drawer "+" disabled at `MAX_CART_QUANTITY` (the
  drawer carries no stock data — the server clamp remains the stock guard);
  `cartMutateSchema` / `cartBulkSchema` per-line / `cartLinePatchSchema`
  `.max(MAX_CART_QUANTITY, "Quantity is limited to 99 per item.")` — the
  message interpolates the shared constant.
- **S18-3**: `npm uninstall axe-core @testing-library/user-event`
  (lockfile via the package manager).

Two honest type-iterations during GREEN (no behavior change): the
`create` fake-interface parameter needed the precise literal data shape
(Prisma's `AddressCreateInput` is narrower than `Record<string, unknown>`;
the repo's minimal-interface convention) and the `invocationCallOrder` pin
needed `noUncheckedIndexedAccess`-safe narrowing.

## 7. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **334/334 unit** ✓ · build ✓ · **63/63 e2e** ✓
- **Manual verification** (agent-browser, fresh production build): health
  `db:up`; mobile menu open → 7 links → navigate → auto-close/unmount;
  demo login → /account; a full signed-in checkout with "Save this address"
  checked placed **ORD-2026-013** and the address book grew 1 → 2 (the
  "saved" outcome end-to-end); zero console errors on a fresh session. (A
  transient `ChunkLoadError` seen mid-session was the stale browser buffer
  across the rebuild — gone on a fresh session, zero growth on subsequent
  navigations.)

## 8. Screenshots & documentation

23 screenshots refreshed to `docs/screenshots/`. Docs aligned: AGENTS.md
(the outcome-returning save invariant + the ceiling-UX extension to the
S17-2 invariant), CLAUDE.md (lib list + coverage lists), README.md (badge
334/63 + coverage tail), PAD (§8.1 table + known-issues #73–75 + §12
row), SKILL.md v1.15.0 (project_state + Appendix B Session-18 entry),
DEPLOYMENT.md (no drift — no new env vars, no new operational rows),
`.env.example` unchanged (no new env vars), this file, and the worklog
entries.

## 9. Final state

**334/334 unit · 63/63 e2e · all gates green**; 23 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the carried deferrals remain (login-limiter
lockout tradeoff S8-8, the checkout P2002 recovery-loop integration seam,
the review action two-tier gate pin, the `/track-order` page-limiter wiring
pin, the real payment/email epics). The admin coupon-management UI is still
the natural next feature increment.
