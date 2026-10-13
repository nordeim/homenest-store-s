# Session 15 — Run narrative (session-11 remediation execution)

> This file is the narrative log of the **12th run**: it executes the section
> numbered **"Session 11"** in `docs/REMEDIATION_PLAN.md` (findings
> S11-1…S11-6). File names increment by run number (the run/plan numbering
> drift is documented); `docs/session_14.md` holds the previous run's closing
> summary and `docs/session_13.md` its narrative.

## 1. Workspace refresh & documentation review

`git pull` fast-forwarded `520c1fc → 98dc342` (fetching `docs/session_14.md`,
the previous run's closing summary). Reviewed in order: the operator's
`coding_agent_prompt.md` (operating modes + evidence discipline
internalized), AGENTS.md, CLAUDE.md, README.md,
Project_Architecture_Document.md, homenest-store-s_SKILL.md v1.7.0; then
docs/session_13.md (run-11 narrative), docs/REMEDIATION_PLAN.md (sessions
2–10), worklog.md, and docs/session_14.md — cross-checked against the
codebase: docs and code agree; the project was in the session-10-completed
state.

**Environment shadowing trap neutralized again**: the sandbox shell exports
`DATABASE_URL=file:/home/z/my-project/db/custom.db`; the pre-existing symlink
`/home/z/my-project/db → <repo>/db` converges the shadowed path with the repo
path. `.env` intact (`file:../db/custom.db` contract + strong `AUTH_SECRET`);
`db/custom.db` seeded at the repo root; `skills/` excluded from all
checking/testing/compilation per the operator contract.

## 2. Gate re-validation (with one flake root-caused, not dismissed)

lint ✓ · typecheck ✓ · typecheck:tests ✓ · 240/240 unit ✓ · build ✓ · e2e
**49/50** on the first run — the failing test
(`wishlist.spec.ts:39` "removing a heart takes the item back out of the
wishlist") **passed in isolation and on the immediate full re-run (50/50)**,
but failed again in a later spec-level loop: a genuine flake. Root cause
captured live: a Playwright **strict-mode violation** —
`getByText("Added to wishlist")` resolved to BOTH the toast title div AND
Radix's `aria-live` announcement wrapper (`Notification Added to wishlist`).
This is the exact race the repo documented and fixed in `admin.spec.ts`
(session 9) with the `.first()` convention — the wishlist spec's toast
assertions predate that convention. Reproduced 3× total before fixing
(became finding S11-3).

## 3. Visual parity + mobile menu (against the LIVE reference)

agent-browser compared the LIVE reference (https://nest-culinary-hub.base44.app/)
with the local production build: identical nav anatomy, identical hero
carousel slides (1: "New Arrivals", 2: "Elevate Your Kitchen",
3: "Sale Up to 40% Off"), identical trust badges (Free Shipping /
Secure Payment / Easy Returns / 24/7 Support), 8 category tiles, featured
products (Damascus Steel Chef Knife Set $199.99/428, Artisan Copper Frying
Pan, Artisan Ceramic Dinner Set…) — the reference is unchanged; the clone
remains the superset.

**Mobile menu re-verified on the production build** (iPhone 390×844): open →
`expanded=true` with the push-down panel (`navigation "Mobile"`, all 7 links
incl. the close button); click Products → lands on `/products`, panel closed
(`expanded=false`). The Tailwind v4 conditional-mount pattern is intact
(`mobile-navigation.spec.ts` green).

## 4. Fresh deep audit (session 11)

A read-only subagent executed the repo `code-review-checklist` 12-category
scan (every `src/lib` module, 11 API routes, 3 action files, all
storefront/admin/auth pages, components, configs, seed + schema, tests and
docs, excluding `skills/`); every key finding was personally re-verified by
this agent with file:line evidence before planning.

**Result: 0 HIGH / 1 MEDIUM / 2 LOW / 3 NIT.** Session-10 fix verification:
**5/5 WIRED / 0 PARTIAL / 0 MISSING** (no bypass or drift at any call site;
the `db-path.ts` relative-URL contract re-verified drift-free). Re-confirmed
clean: integer-cents money end-to-end, the checkout critical path (in-tx
snapshots + coupon re-validation + atomic stock + ownership-bound
idempotency), guarded order transitions, scrypt auth + uniform errors, IDOR
scoping, the rate-limiter grid + spoof-resistant clientIp, Zod boundaries
incl. malformed-JSON → 400, CSP nonce + security headers, SQL-aggregated
dashboards, type strictness, SEO/noindex privacy, seed policy, React
hygiene, a11y.

New findings (all evidence-confirmed):
- **S11-1 (MED)** the review rate limiter was bypassable by rotating the
  free-text `author` field — the key embedded the author string and there
  was no per-IP ceiling, so rotation minted fresh budgets while the comment
  claimed the opposite; unbounded Review rows would permanently skew the
  monotonic rating/reviewCount aggregates (`src/lib/actions/reviews.ts:33-41`)
- S11-2 (LOW) AGENTS.md's heart invariant was false — "every product grid
  heart reads the wishlist state" but no heart did (always unfilled, label
  always "Add …"; `getWishlistIds()` had exactly one consumer)
- S11-3 (LOW) wishlist.spec toast assertions skipped the documented
  `.first()` convention (the flake from §2) + a misleading `.nth(1)`
- S11-4 (NIT) `setTrackingAction` could leak a raw P2025 on a concurrently
  deleted order (pre-tx read + unconditional update, no catch)
- S11-5 (NIT) the login page's "Forgot password?" mailto hardcoded
  `hello@homenest.com` — the S7-5 sweep's last hardcoded contactEmail shadow
- S11-6 (NIT) the in-tx address cap was still check-then-create — on SQLite
  the write lock lands at the first WRITE, so concurrent POSTs at cap−1
  could serialize their creates past their reads (21 rows); the S10-3
  comment overclaimed

## 5. Remediation plan

Appended the "Session 11" section to `docs/REMEDIATION_PLAN.md` (S11-1…S11-6
TDD steps + carried deferrals; the "wishlist filled-heart state" DEFERRAL is
CLOSED by S11-2), re-validated it against the codebase, then executed.

## 6. TDD execution (RED → GREEN)

**RED**: `tests/unit/session11-hardening.test.ts` (6 cases:
`reviewRateLimitKeys` ×3, `applyCarrierTracking` ×3) — all 6 failed on the
missing exports with the existing 240 green. E2E RED: the two
feature-dependent wishlist cases (the rewritten remove flow + the new S11-2
filled-state case) failed against the old build while the `.first()`-fixed
first case passed.

**GREEN — pure modules first**:
- `src/lib/rate-limit.ts` += `reviewRateLimitKeys(ip, productId, author)`:
  the per-IP `review-ip:` key carries NO author/product component; the
  per-author key stays product-scoped + case-normalized
- `src/lib/order-tracking.ts` += `OrderGoneError` +
  `applyCarrierTracking(client, orderId, carrier, trackingNumber)`: scoped
  conditional `updateMany` FIRST, `count === 0` → typed error → NO event;
  the event is created from the guarded winner

246/246 unit green. **Wiring**:
- **S11-1**: `submitReviewAction` evaluates `rateLimit(ipKey, 20, 60_000)`
  then `rateLimit(authorKey, 5, 60_000)`; comment rewritten honestly
- **S11-2**: `AddToWishlistButton` gains `initialInWishlist` (+ local state
  flipped from the API's `inWishlist`, `aria-pressed`, `fill-primary`
  heart, honest Add/Remove label); `ProductCard` passes it through; home,
  products, product-detail (related), wishlist pages call `getWishlistIds()`
  once and pass membership per card
- **S11-3**: `.first()` + the admin.spec convention comment at all toast
  sites; the second-toast `.nth(1)` replaced (the "2 saved items" page
  assertion carries the correctness)
- **S11-4**: `setTrackingAction` wraps `db.$transaction((tx) =>
  applyCarrierTracking(tx, …))` and maps `OrderGoneError` to the friendly
  message
- **S11-5**: `(auth)/login/page.tsx` passes `getSettings().contactEmail`
  into `LoginForm` (seed fallback)
- **S11-6**: the POST tx creates first (taking SQLite's write lock), counts
  under the lock, throws `AddressCapError` over cap (create rolls back,
  friendly 409 survives); the pre-create `assertAddressCap` is fast-fail UX

## 7. Gates & manual verification

- **Full gate chain**: lint ✓ · typecheck ✓ · typecheck:tests ✓ ·
  **246/246 unit** ✓ · build ✓ · **51/51 e2e** ✓
- **Flake stability**: wishlist spec re-run 10× post-fix — all green
- **Manual verification** (agent-browser, fresh standalone build): added
  "Dried Eucalyptus Kitchen Bundle" from `/products` → the heart flipped to
  `Remove … from wishlist` + `aria-pressed=true` + terracotta
  `fill-primary` immediately (client flip) → after a full reload the filled
  state persisted (server truth) → toggled back → "Add …" restored and the
  wishlist left empty; login page mailto renders
  `mailto:hello@homenest.com?…` from settings (seed value — the wiring is
  live); mobile menu re-verified (open → expanded=true → links)
- `curl /api/health` → `db:up`

## 8. Screenshots & documentation

23 screenshots refreshed to `docs/screenshots/`. Docs aligned:
- **AGENTS.md**: review limiter invariant (two-tier), heart invariant now
  TRUE, carrier-tracking guarded write, address-cap post-create gate
- **CLAUDE.md**: module list (`reviewRateLimitKeys`, `applyCarrierTracking`,
  `getWishlistIds`), unit coverage list, wishlist e2e description
- **README.md**: badges 246/51; Commerce row (server-rendered filled
  hearts); unit/e2e test chapters (the new pins)
- **PAD**: §8.1 table (246 + session11 row), known issues #41–46 (Fixed),
  Key Files counts
- **SKILL.md** v1.8.0: project_state 246/51 (sessions 2–11); Appendix B
  session-11 history section
- **DEPLOYMENT.md**: review two-tier limiter row in the troubleshooting table
- This file `docs/session_15.md`; worklog.md Task ID 12 entry

## 9. Final state

**246/246 unit · 51/51 e2e · all gates green**; 23 screenshots refreshed;
all docs aligned; single atomic commit on `main` only, pushed via the SSH
wrapper (dry-run → push → remote ref verified) with the mandatory
`--remote git@github.com:nordeim/homenest-store-s.git` flag (the wrapper's
default remote is stale — documented trap from session 9).

**Suggested next steps:** the carried deferrals remain the drawer focus
trap (S8-7), the login-limiter lockout tradeoff (S8-8), and the checkout
P2002 recovery-loop integration seam; real payment/email are still the
major epics. Feature-wise, the admin coupon-management UI is the next
natural increment (the wishlist filled-heart state shipped this session).
