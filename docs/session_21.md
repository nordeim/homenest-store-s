# Session 21 — Run narrative (session-14 remediation execution)

> This file is the narrative log of the **15th run**: it executes the section
> numbered **"Session 14"** in `docs/REMEDIATION_PLAN.md` (findings
> S14-1…S14-4 plus five coverage pins). File names increment by run number
> (the run/plan numbering drift is documented); `docs/session_19.md` holds the
> previous run's closing narrative and `docs/session_20.md` its raw log.

## 1. Workspace refresh & documentation review

`git pull` fast-forwarded `6d53a79 → 42a188a` (= the run-14 commit + the
`docs/session_20.md` raw log). Reviewed in order: the operator's
`coding_agent_prompt.md` (modes A–D, evidence discipline internalized),
AGENTS.md, CLAUDE.md, README.md, Project_Architecture_Document.md,
homenest-store-s_SKILL.md v1.10.0; then docs/session_19.md (run-14 narrative),
docs/REMEDIATION_PLAN.md (sessions 2–13), worklog.md, docs/session_20.md —
cross-checked against the codebase: docs and code agree; the project was in
the session-13-completed state.

**Environment**: the sandbox shell exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db`; the symlink
`/home/z/my-project/db → <repo>/db` converges the shadowed path with the repo
path. `.env` carries the `file:../db/custom.db` contract + `AUTH_SECRET`;
`db/custom.db` seeded at the repo root; `skills/` excluded from all
checking/testing/compilation per the operator contract.

## 2. Gate re-validation

lint ✓ · typecheck ✓ · typecheck:tests ✓ · **277/277 unit** ✓ · build ✓ ·
**61/61 e2e** ✓ — the pulled tree is exactly as documented.

## 3. Live-reference parity + mobile menu (agent-browser, logged in)

Reference unchanged: same nav anatomy, same 3 hero slides ("Elevate Your
Kitchen" / "New Arrivals" / "Sale Up to 40% Off"), same 8 category tiles, same
featured set and authored order (Damascus Steel Chef Knife Set first on the
reference's Featured and New Arrivals rows and the clone's `/products`
"Newest"). Logged in with the operator credentials: the reference account page
(profile + expandable order history) is covered by the clone's superset.

**Mobile menu re-verified on the production build** (iPhone 390×844): open →
`expanded=true` → `navigation "Mobile"` with all 7 links → click Products →
lands on `/products` → panel closed (`expanded=false`, unmounted). The
reference's mobile panel carries the same 5 main links (the clone adds Sign
In/Wishlist — superset). Tailwind v4 conditional-mount intact.

## 4. Fresh deep audit (session 14)

A read-only subagent executed the repo `code-review-checklist` 12-category
scan (`src/`, `prisma/`, `tests/`, root configs; `skills/` excluded); every
finding was personally re-verified with file:line evidence before planning.

**Result: 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 NIT** — the cleanest
surface in the fifteen-run series. Session-13 fixes **8/8 WIRED / 0 PARTIAL /
0 MISSING** (with one count correction: S13-2 is 13 catch blocks across five
dialog/form files — product-dialog ×3 incl. the product toggle,
category-dialog ×3, slide-dialog ×4, order-manage-dialog ×2, settings-form
×1 — not "12 across five dialogs"). Clean areas: admin authorization
(`requireAdmin` on every action), PII capability gates, every race-sensitive
write, money bounds + in-tx derivation, Zod at every boundary, all 16 metered
surfaces, CSP/nonce, seed discipline, SEO, Radix dialog semantics, configs.
Static counts re-verified: 277 unit · 61 e2e = the README badge.

Findings (all evidence-confirmed): **S14-1 (NIT)** the Toaster's auto-dismiss
`setTimeout` is never cleared (orphan timers after manual close / post-unmount
`setItems`); **S14-2 (NIT, accepted as-is)** `npm run start` pipes through
`tee`; plus 5 coverage gaps (health 503, route-level 429s,
`updateProfileAction`/`logoutAction`, checkout saveAddress at-cap skip-save,
`placeOrderWithRetry` exhaustion) and 2 doc-drift items (AGENTS.md's limiter
grid; CLAUDE.md's phantom `src/components/admin/`).

## 5. Remediation plan

Appended the "Session 14" section to `docs/REMEDIATION_PLAN.md` (TDD steps +
five coverage pins + accepted deferrals), re-validated it against the
codebase, then executed.

## 6. TDD execution (RED → GREEN)

**Probe first**: route-handler import-safety in Vitest verified empirically
(health/newsletter/contact/checkout all import and answer a real 400) — the
session-12 convention, before any test was written.

**RED**: `tests/unit/toaster.test.tsx` (3 cases — the suite's FIRST component
test: `.tsx` + `@vitest-environment jsdom` docblock + fake timers) — the
unmount case failed `expected 1 to be +0` against the pre-fix component (the
orphan 4s timer was live), with the existing 277 green. The manual-close case
first exposed **S14-3**: the icon-only ToastClose had NO accessible name (a
bare `<X/>` glyph — violating the repo's own icon-only rule). Coverage pins
(green on arrival, as pins of existing correct behavior are):
`tests/unit/api-boundaries.test.ts` (8 cases — mocked `db`; health
ok/degraded-503; newsletter malformed-JSON/invalid-body/429; contact 429;
checkout 429 + `Retry-After`; per-test IP isolation via the rightmost-XFF
`clientIp` contract) and the auth e2e profile-edit/Sign Out wiring pin.

**GREEN**: the Toaster timer registry (`toast()` registers, auto-dismiss
deletes its entry, manual dismiss + unmount clear pending timers) +
`aria-label="Dismiss notification"` on ToastClose. All 10 new unit cases +
the full suite green.

## 7. S14-4 — the stock-depletion failure mode (found during the final gates)

The first post-fix e2e run failed 2 pins (storefront "In Stock", the S10-2
cart POST 409). Reproduced against the standalone server per repo discipline —
root cause NOT code: fourteen sessions of e2e checkout traffic had permanently
drained the traffic-owned demo stock (the S7-3 seed policy never refreshes it
on reseed) — `Damascus Steel Chef Knife Set` was at stock **0** (verified via
Prisma). The demo DB had exactly enough stock left for ONE green suite run at
session start, then hit 0.

Fix: **`scripts/restore-demo-stock.ts`** tops every product back to its seed
value — wired as the e2e webServer's FIRST command (a fresh server start =
deterministic demo state; a reused healthy server keeps its restored state).
`prisma/seed.ts` gained the standard direct-execution guard and exports
`PRODUCTS` so the script can import it without triggering a seed. The seed
policy itself is UNCHANGED (reseeds still never refresh stock). Both
previously-failing pins green on the re-run.

## 8. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **287/287 unit** ✓ · build ✓ · **62/62 e2e** ✓
- **Manual verification** (agent-browser, fresh standalone build): toast
  renders with the "Dismiss notification" accessible button, auto-dismisses
  at 4s, manual dismiss works, zero console errors; profile edit →
  "Profile updated" toast → seed name restored; mobile menu open → 7-link
  panel → navigate → auto-close; `/api/health` `db:up`; newsletter
  malformed-JSON → 400 live
- `npm run db:seed` re-verified after the seed guard (16 products, seed
  completes)

## 9. Screenshots & documentation

23 screenshots refreshed to `docs/screenshots/`. Docs aligned: AGENTS.md
(the limiter grid D1, the S13-2 count D3, two new invariants: toaster timer
hygiene + e2e stock restore, the data-failure triage rule), CLAUDE.md (D2
component-path description + coverage lists), README.md (badges 287/62, the
S14-2/S14-1 unit rows, the S14-3 e2e row, the stock-drain troubleshooting
row), PAD (§8.1/§8.2 tables + known issues #57–60), SKILL.md v1.11.0
(project_state + Session-14 history), DEPLOYMENT.md (the e2e restore note +
the stock-drain runbook row), `.env.example` unchanged (no new env vars),
this file, and the worklog entry.

## 10. Final state

**287/287 unit · 62/62 e2e · all gates green**; 23 screenshots refreshed;
`.env.example` matches the codebase; all docs aligned; single atomic commit on
`main` only, pushed via the SSH wrapper (dry-run → push → remote ref
verified) with the mandatory `--remote git@github.com:nordeim/homenest-store-s.git` flag.

**Suggested next steps:** the carried deferrals remain the drawer OPEN-state
focus trap (S8-7), the login-limiter lockout tradeoff (S8-8), the checkout
P2002 recovery-loop integration seam, the checkout saveAddress at-cap
skip-save integration pin (now with the S14-4 restore harness as the
foundation), and the real payment/email epics. The admin coupon-management UI
is still the natural next feature increment.
