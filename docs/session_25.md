# Session 25 — Run narrative (session-16 remediation execution)

> This file is the narrative log of the **17th run**: it executes the section
> numbered **"Session 16"** in `docs/REMEDIATION_PLAN.md` (findings
> S16-1…S16-4 plus the C3/C4/C5 coverage pins). File names increment by run
> number (the run/plan numbering drift is documented); `docs/session_23.md`
> holds the previous run's closing narrative and `docs/session_24.md` its raw
> log.

## 1. Workspace refresh & documentation review

`git pull` fast-forwarded `e327c82` → `d534e96` (the operator-committed
`docs/session_24.md` raw log). Reviewed in order: the operator's
`coding_agent_prompt.md`, AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md v1.12.0; then
docs/session_23.md (run-16 narrative), docs/REMEDIATION_PLAN.md (sessions
2–15), worklog.md, docs/session_24.md — cross-checked against the codebase:
docs and code agree; the project was in the session-15-completed state.

**Environment**: the sandbox shell exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db`; the symlink
`/home/z/my-project/db → <repo>/db` converges the shadowed path with the repo
path. `.env` carries the `file:../db/custom.db` contract + `AUTH_SECRET`;
`db/custom.db` pushed + seeded at the repo root (16 products / 8 categories
verified via a Prisma count); `skills/` excluded from all
checking/testing/compilation per the operator contract.

## 2. Gate re-validation

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **299/299 unit** ✓ · build ✓ ·
**62/62 e2e** ✓ — the pulled tree is exactly as documented.

## 3. Live-reference parity + mobile menu (agent-browser)

Reference unchanged: same nav anatomy, same 3 hero slides ("New Arrivals" /
"Elevate Your Kitchen" / "Sale Up to 40% Off"), same 8 category tiles, same
featured set and authored order (Damascus Steel Chef Knife Set first on
Featured AND New Arrivals, −29% / (412) / $199.99). The reference's mobile
panel re-verified on a 390×844 viewport: 5 main links (Home active as the
orange pill), search field, X close.

**Mobile menu re-verified on the production build** (iPhone 390×844): open →
`nav[aria-label=Mobile]` with all 7 links → click Track Order → lands on
`/track-order` → panel closed (nav unmounted). Tailwind v4
conditional-mount intact. `/products` renders Damascus-first. Zero console
errors.

## 4. Fresh deep audit (session 16)

A read-only subagent (17-a) executed the repo `code-review-checklist`
12-category scan (`src/`, `prisma/`, `scripts/`, `tests/`, root configs;
`skills/` excluded); every finding was personally re-verified with file:line
evidence before planning.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW / 2 NIT / 0 doc-drift** —
the fourth consecutive session without a CRITICAL/HIGH/MEDIUM. Session-15
fixes **6/7 WIRED, 1 PARTIAL, 0 MISSING** (S15-5's MQL cache is implemented
but had no pin → S16-4); older-fix spot-checks (S13-3, S13-1, S13-4, S12-4,
S9-1, S8-6/S10-4, S6-8/S7-2) **7/7 WIRED**. Static counts re-verified:
313→299 unit · 62 e2e · 18 models · 16 products · 11/11 admin actions
requireAdmin'd · 8/8 POST bodies Zod-gated — every README claim held.

Findings (all evidence-confirmed): **S16-1 (LOW)** the wishlist cap was
check-then-create — concurrent POSTs at cap − 1 both count 99 and both
create (the loser's P2002 maps to `inWishlist: true`), permanently
overshooting `MAX_WISHLIST_ITEMS`; session-11 S11-6 had fixed the IDENTICAL
race for addresses, making the wishlist POST the one remaining create path
on the older pattern; **S16-2 (NIT)** three JSON bodies parsed through
route-local Zod schemas instead of validation.ts exports (wishlist toggle,
coupon apply, cart PATCH); **S16-3 (LOW)** the open cart drawer declared
`aria-modal="true"` but background content stayed keyboard-tabbable — this
IS the carried S8-7 deferral, now evidence-classified; **S16-4 (NIT)** the
S15-5 MQL cache had no test pin.

## 5. Remediation plan

Appended the "Session 16" section to `docs/REMEDIATION_PLAN.md` (TDD steps
+ the C3/C4/C5 coverage pins + accepted deferrals, with S8-7 closed by
S16-3), re-validated it against the codebase, then executed.

## 6. TDD execution (RED → GREEN)

**RED confirmed exactly as designed** before any implementation:

- `createWishlistItemInTx` pins → failed on the missing export (×3)
- the wishlist route's at-cap-overflow pin → failed **500→...→ expected 409,
  received 200** against the check-then-create route (the 101st row would
  have landed silently); the happy-path and P2002-in-tx pins were green on
  arrival (coverage pins of preserved semantics)
- the hoisted-schema pins → failed on the missing exports (×5)
- the e2e S16-3 modal pin → failed at `page-shell` not found against the
  pre-fix standalone build
- the hero-carousel pins were green on arrival (coverage pins — S15-5 was
  already implemented correctly; C5 now guards it)

**GREEN**:

- **S16-1**: `createWishlistItemInTx(tx, wishlistId, productId)` in
  `src/lib/wishlist.ts` (minimal `WishlistTxClient` interface) — create
  FIRST (taking SQLite's write lock), post-create count under the lock,
  `WishlistCapError` when over (the interactive tx rolls the create back).
  The route wires it through `db.$transaction`; the pre-create
  `assertWishlistCap` stays as the fast-fail UX 409; the tx catch maps
  `WishlistCapError` → the same friendly 409 and P2002 → `{ inWishlist:
  true }` (S8-4 double-click semantics preserved; the mock needed the REAL
  `PrismaClientKnownRequestError` class — a code-stamped Error fails the
  `instanceof` gate)
- **S16-2**: `wishlistToggleSchema` / `cartLinePatchSchema` (keeping the
  PATCH-specific 0-deletes-line floor the POST schema forbids) /
  `couponApplySchema` (the 40-char cap) hoisted into `validation.ts`; the
  three routes import them; route-local `z` plumbing removed
- **S16-3**: the storefront layout passes `main` (children) and `footer`
  (prop) through the client `StoreChrome`, which renders ONE
  `<div data-testid="page-shell" inert={cartDrawerOpen}>` around header +
  mobile nav + main + footer; the backdrop + drawer render outside it.
  Native focus containment via inert, PLUS a Tab-wrap handler in the
  drawer's open effect — live e2e runs revealed Chromium drops focus to
  browser chrome at the drawer's last control instead of wrapping, so the
  handler wraps Tab/Shift+Tab at the drawer's first/last focusable. The
  open effect also captures the opener and restores focus on close. (One
  honest iteration: the pure-inert version passed shell-inert assertions
  but failed the 25-Tab containment pin — the wrap handler closes that
  gap.)
- **S16-4**: `tests/unit/hero-carousel.test.tsx` — the suite's second
  component test (jsdom docblock + fake timers + per-test
  `vi.resetModules()` for the module-level cache; `next/image`/`next/link`
  stubbed): exactly ONE MediaQueryList construction across mount +
  auto-rotate re-renders + prop rerender; auto-rotation advances the
  active slide; reduced-motion freezes it

One DATA incident during the e2e gates (not a code failure): the auth
S14-3 spec failed at its FIRST assertion — a previously crashed run had
left the demo profile name as "Jordan Rivera Edited" (the spec restores it
only on success). Restored the seed name directly in SQLite and recorded
the failure mode as a DEPLOYMENT.md troubleshooting row; the spec passed
on re-run and stayed green through the full suite.

## 7. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **313/313 unit** ✓ · build ✓ · **63/63 e2e** ✓
- **Manual verification** (agent-browser + curl, fresh standalone build):
  add to cart → open drawer → `page-shell` inert + drawer NOT inert +
  focus inside the drawer; Escape → shell un-inerts, background links
  clickable again (focus restore itself is exercised by the e2e's real
  input; a programmatic `.click()` capture is best-effort by design);
  mobile menu open → 7-link panel → navigate → auto-close/unmount; health
  `db:up`; zero console errors
- 23 screenshots refreshed

## 8. Screenshots & documentation

23 screenshots refreshed to `docs/screenshots/`. Docs aligned: AGENTS.md
(the wishlist-cap invariant updated to the S11-6 shape + the closed/open
drawer modal invariant + the S8-7 closure), CLAUDE.md (shell note + unit
and e2e coverage lists), README.md (badge 313/63 + wishlist feature row +
testing bullets), PAD (§8.1/8.2 tables + known-issues #67–69), SKILL.md
v1.13.0 (project_state + Appendix B Session-16 entry), DEPLOYMENT.md (the
demo-name-pollution troubleshooting row), `.env.example` unchanged (no new
env vars), this file, and the worklog entries.

## 9. Final state

**313/313 unit · 63/63 e2e · all gates green**; 23 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit
on `main` only, pushed via the SSH wrapper with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the carried deferrals remain (login-limiter
lockout tradeoff S8-8, the checkout P2002 recovery-loop integration seam,
the checkout saveAddress at-cap skip-save integration pin, the review
action two-tier gate pin, the real payment/email epics). The admin
coupon-management UI is still the natural next feature increment.
