# Worklog — HomeNest Kitchen

> Shared, append-only log of agent sessions working on this codebase.
> Newest entries at the bottom. Session 1's full narrative lives in `docs/session_1.md`.

---

Task ID: 1 (session 1)
Agent: full-stack remediation agent
Task: Audit the legacy Vite SPA, rebuild as a Next.js 16 + Prisma/SQLite visual-and-functional superset of nest-culinary-hub.base44.app, add vitest + playwright, write docs, push.

Work Log:
- Audited the legacy client-only SPA (localStorage persistence, client-side SHA-256 "auth") and classified findings by severity.
- Logged into the reference site with the provided credentials, captured 13 reference screenshots, scraped the full 8-product catalog and downloaded all reference imagery for self-hosting.
- Migrated the codebase to Next.js 16 App Router / React 19 / TS strict / Tailwind v4 (CSS-first) / Prisma 6 + SQLite following the ecommerce-store repo's patterns; 17→18-model schema, idempotent seed with the reference catalog + superset extras.
- Implemented `DATABASE_URL="file:../db/custom.db"` with the `src/lib/db-path.ts` resolution contract (CLI + runtime + standalone converge on one file) and the `db/` folder at repo root (git-ignored).
- Built the full storefront + admin console pinned to the reference's sampled tokens; mobile menu uses the Tailwind-v4-safe conditional-mount pattern.
- Added Vitest (69 unit) + Playwright (28 e2e) suites; the e2e run caught and fixed three real production bugs (Toaster context nesting, CSP-nonce-vs-prerender hydration on /login, cart-badge races).
- Wrote AGENTS.md, CLAUDE.md, README.md, Project_Architecture_Document.md, 20 screenshots in docs/screenshots/, .env.example.
- Committed 87cfa40 to main and pushed via docs/ssh_git_wrapper_v3.py (dry-run → push → remote-ref verified → key shredded).

Stage Summary:
- Repo fully migrated and verified: lint/typecheck/build clean, 69 unit + 28 e2e green, health db:up.

---

Task ID: 2 (session 2)
Agent: audit + remediation agent
Task: Re-validate the pushed codebase against the docs, re-audit with the repo skills, produce a remediation plan, execute it TDD-first, refresh screenshots/docs, create the project SKILL + worklog, commit and push.

Work Log:
- `git pull` refreshed the workspace (docs/session_1.md landed); verified all session-1 gates still green: lint ✓, typecheck ✓, 69/69 unit ✓, build ✓, 28/28 e2e ✓, health db:up ✓.
- Re-verified visual parity + the mobile menu against the reference captures with agent-browser (push-down panel, orange active pill, green close circle — exact match).
- Ran a read-only security/quality audit over every critical path using the repo's code-review checklist (0 critical / 1 high / 6 medium / 14 low); all five documented architecture invariants verified PASS (money integer-cents, Zod boundaries, admin role gates, v4 mobile-nav pattern, server-derived checkout).
- Wrote the remediation plan to docs/REMEDIATION_PLAN.md and validated every finding against the code before executing.
- Executed TDD-first (tests written red, then fixed green):
  - WI-1 (HIGH): /track-order now requires order number + purchase email (trackOrderSchema, order-tracking.ts, rate-limited, uniform not-found alert, success-page deep link, e2e contract).
  - WI-2: assertAuthSecret enforces AUTH_SECRET in production (module-load throw, unit-tested); strong secret generated in .env; documented in .env.example.
  - WI-3: uniform "Invalid email or password." + dummy scrypt burn (anti-enumeration/anti-timing); e2e updated.
  - WI-4: src/lib/rate-limit.ts (fixed-window, unit-tested) wired into login/register/reviews/contact/newsletter/coupon/checkout/tracking.
  - WI-5: clampPurchaseQuantity + zero-qty line deletion + checkout 409 backstop (unit-tested).
  - WI-6: atomic conditional stock reservation (updateMany guard) inside the checkout transaction.
  - WI-7: register P2002 race mapped to a friendly duplicate-email error.
  - WI-8: wishlist cookie/Zod alignment, expired-session purge, malformed-JSON 400s, carousel ctaLink scheme guard, settings $transaction, home queries take:8, aria-expanded bound to state, NEXT_PUBLIC_DEMO_MODE gate for the login demo box, drawer per-line pending lock + rollback, CART_COOKIE constant reuse.
- Re-ran all gates green: lint ✓, typecheck ✓, 94/94 unit ✓, build ✓, 28/28 e2e ✓ (track-order spec now pins the number+email contract end-to-end).
- Added scripts/capture-screenshots.mjs and refreshed docs/screenshots/ (22 shots incl. 22-tracking-locked.png); verified the tracking denial + happy path manually via agent-browser.
- Updated AGENTS.md / CLAUDE.md / README.md / Project_Architecture_Document.md for the new contracts (test counts, security invariants, known-issues ledger).
- Created homenest-store-s_SKILL.md (20 sections + appendices, all file references verified) using the skills/distill-codebase-skill + skills/to-distill-project-into-skill templates; created this worklog.md.

Stage Summary:
- Codebase is security-hardened and fully documented; 94 unit + 28 e2e green; all session-2 deliverables in place (REMEDIATION_PLAN.md, SKILL.md, worklog.md, refreshed screenshots, updated docs).
- Deferred (documented in the plan + PAD): checkout idempotency key, analytics groupBy/pagination, 404-shell nonce (cosmetic), shared-store rate limiter for horizontal scale.

---

Task ID: 3 (session 3)
Agent: audit + remediation agent (Super Z)
Task: Re-validate session-2 deliverables, run a fresh deep audit (incl. the deferred items), remediate the new findings TDD-first, refresh screenshots/docs/worklog, commit and push.

Work Log:
- Pulled 86bf17f (docs/session_2.md); re-ran every gate on the pulled tree: lint ✓, typecheck ✓, 94/94 unit ✓, build ✓, 28/28 e2e ✓; env-shadowing convergence (hardlink) re-confirmed; .env contract intact.
- Re-verified visual parity with agent-browser: desktop home, mobile menu open/navigate/close (push-down panel, orange active pill, green close circle), aria-expanded binding.
- Launched a read-only deep-audit pass (repo code-review-checklist scan + targeted validation of the session-2 deferred items): 1 HIGH / 4 MEDIUM / 4 LOW new findings; deferred items re-assessed with remediation sketches (analytics groupBy, 404 nonce, __Host- cookies, shared-store limiter — all deferred again with justification).
- Confirmed the HIGH finding live: /checkout/success?order=ORD-2026-001 rendered buyer PII unauthenticated (number-only lookup, same class as session-2 WI-1 but on a different page).
- Wrote the session-3 remediation plan (docs/REMEDIATION_PLAN.md) and executed it TDD-first (red → green for every fix):
  - S3-1 (HIGH): /checkout/success receipt is token-gated (order-access.ts HMAC token from /api/checkout; sequential numbers alone render the same not-found shell; page noindex).
  - S3-2: all money derivation moved inside the checkout transaction (subtotal from in-tx product snapshots; coupon re-validated in-tx).
  - S3-3: order-status.ts workflow rules (cancelled/delivered terminal); admin cancellation restocks stock inside the same transaction.
  - S3-4: guest cart + wishlist merge at login/register (mergeGuestCarts, best-effort).
  - S3-5: checkout idempotency (Order.idempotencyKey @unique; client crypto.randomUUID per visit; replay returns the original receipt; P2002-on-key resolves to the winner).
  - S3-6: coupon lifecycle (expiresAt / maxRedemptions / timesUsed; isCouponRedeemable gates lookup + checkout tx; SAVE20 seeded with a 500-use cap).
  - S3-7: addresses JSON 400, review limiter IP-pinned key, drawer mirrors the server clamp, /products + /wishlist metadata (wishlist noindex), shared cookieOptions export.
- Gates after: lint ✓, typecheck ✓, 115/115 unit ✓, build ✓, 31/31 e2e ✓ (new: token-gated receipt + guess-denial, idempotent replay, guest-cart merge at login, cancel-restocks-stock).
- Manual verification via agent-browser + curl: guess and wrong-token render the locked shell with zero PII; health db:up.
- Refreshed docs/screenshots/ (23 shots incl. new 23-checkout-success-locked.png); updated AGENTS.md / CLAUDE.md / README.md / Project_Architecture_Document.md / homenest-store-s_SKILL.md for every changed contract.

Stage Summary:
- Codebase now closes the last HIGH-severity PII surface and adds the production-grade commerce contracts: idempotent checkout, in-transaction money derivation, coupon lifecycle, cancel-restock, login merge.
- 115 unit + 31 e2e green; all docs aligned; deferred items re-documented with justification (analytics groupBy, 404 nonce, __Host- prefix, shared-store limiter, admin coupon UI).

---

Task ID: 4 (session 4)
Agent: audit + remediation agent (Super Z)
Task: Re-validate session-3 deliverables, run a fresh deep audit (incl. the deferred items), remediate the new findings TDD-first, refresh screenshots/docs/worklog, commit and push.

Work Log:
- Pulled c5c021d + docs/session_3.md; re-ran every gate on the pulled tree: lint ✓, typecheck ✓, 115/115 unit ✓, build ✓, 31/31 e2e ✓; env-shadowing convergence (hardlink) re-confirmed; .env contract intact.
- Re-verified visual parity against the LIVE reference (logged in via agent-browser): desktop home, mobile menu open/navigate/close (push-down panel, orange active pill, green close circle, aria-expanded bound) — reference unchanged, clone remains the superset.
- Deep-audit pass (Task 4-a read-only subagent + own verification): 0 HIGH / 1 MEDIUM (F-1 login/register limiter keyed only by attacker-chosen email) / 12 LOW (coupon/apply JSON 200s, coupon-cap TOCTOU, cart POST lost-update + >99 cap, unmetered guest cart/wishlist rows, missing FK indexes, unbounded account/review lists, seed reviewCount collapse, seed resets coupon bookkeeping, sitemap private routes, dead db:migrate scripts, tests+seed untyped, reactStrictMode undocumented) + nits (drawer Escape/focus, carousel pause, header aria-expanded, cart-lines clamp mirror, wishlist P2002, admin P2002 message, db.ts comment, sequential layout reads). All 5 session-3 deferrals re-validated as DEFER with evidence.
- Wrote the session-4 remediation plan (docs/REMEDIATION_PLAN.md) and executed it TDD-first (red → green for every fix):
  - S4-1 (MEDIUM): shared clientIp() in rate-limit.ts (unit-tested); per-IP login-ip:/register-ip: budgets beside the per-email budgets.
  - S4-2: /api/coupon/apply body-parse split (400) + {status:500} generic catch; e2e pins the malformed-JSON contract (Buffer data — Playwright JSON-encodes string data, found live).
  - S4-3: couponRedemptionWhere() + unit tests; checkout increments timesUsed via guarded updateMany (count 0 → 409 rollback).
  - S4-4: cart POST inside db.$transaction with the shared clampPurchaseQuantity (stock ceiling + 99 cap; no lost increments).
  - S4-5: per-IP limiters on /api/cart POST + /api/wishlist POST (60/min).
  - S4-6: six @@index entries (Review.productId, OrderItem.orderId/productId, OrderEvent.orderId, Order.userId, Product.categoryId) + db:push.
  - S4-7: mergeReviewAggregate() + unit tests; submitReviewAction grows the seeded baseline (weighted average) instead of collapsing it.
  - S4-8: coupon seeding is create-only (update: {}) — reseeds preserve redemption bookkeeping.
  - S4-9: sitemap drops the 5 private/noindex routes; robots disallows /admin, /account, /checkout, /api; unit-pinned (seo-routes.test.ts).
  - S4-10: dead db:migrate/db:reset scripts removed.
  - S4-11: tsconfig.tests.json + typecheck:tests script wired into the gate; surfaced two pre-existing noUncheckedIndexedAccess drifts in e2e specs (fixed).
  - S4-12: wishlist P2002 no-op, admin P2002/P2025 message split, db.ts comment fix, cart-drawer Escape-close + close-button focus, hero-carousel pause-on-hover/focus + prefers-reduced-motion (useSyncExternalStore), header cart aria-expanded, cart-lines mirrors the server clamp, storefront layout Promise.all.
- Gates after: lint ✓, typecheck ✓, typecheck:tests ✓, 131/131 unit ✓, build ✓, 32/32 e2e ✓ (new: malformed-JSON 400 contract).
- Manual verification via agent-browser + curl: robots.txt Disallow rules live; sitemap reduced to public routes; drawer aria-expanded + Escape-close; mobile menu unchanged (Tailwind v4 conditional-mount); coupon route 400 on raw invalid JSON.
- Refreshed docs/screenshots/ (23 shots from the remediated build); updated AGENTS.md / CLAUDE.md / README.md / Project_Architecture_Document.md / homenest-store-s_SKILL.md for every changed contract.

Stage Summary:
- Codebase closes the last DoS-class limiter gap (per-IP auth budgets), makes the coupon cap race-free, aligns cart POST with the clamp contract, adds the FK/hot-path indexes, and fixes the review-count collapse — with the tests/seed/configs now inside the typecheck gate.
- 131 unit + 32 e2e green; all docs aligned; deferred items re-documented with justification (analytics groupBy, 404 nonce, __Host- prefix, shared-store limiter, admin coupon UI, account/review pagination).

---

Task ID: 5 (session 5)
Agent: audit + remediation agent (Super Z)
Task: Re-validate session-4 deliverables, run a fresh deep audit (SEO/UX/error-surface focus), remediate the new findings TDD-first, refresh screenshots/docs/worklog, commit and push.

Work Log:
- Pulled 7769a01 + docs/session_4.md (repo at 1b3b312); re-ran every session-4 gate on the pulled tree: lint ✓, typecheck ✓, typecheck:tests ✓, 131/131 unit ✓, build ✓, 32/32 e2e ✓; env-shadowing convergence (hardlink, same inode) re-confirmed; .env contract intact.
- Re-verified visual parity against the LIVE reference (logged in via agent-browser): desktop home, hero carousel, trust badges, category grid, featured products (identical names/counts/prices), footer structure — reference unchanged; mobile menu re-verified (open/navigate/close, expanded binding, push-down panel).
- Fresh deep audit (Task 5-a read-only subagent + own verification): 0 HIGH / 3 MEDIUM (no JSON-LD anywhere; receipt copy promises an email that never ships; no error boundaries) / 6 LOW (no favicon/manifest, X-Powered-By emitted, bun.lock tracked, cart-merge un-unit-tested + non-atomic, unmetered search/cart-PATCH/DELETE, unvalidated image URLs vs CSP) / 4 NIT; CSRF posture verdict ADEQUATE (SameSite=Lax + POST/PATCH/DELETE-only mutations); all 6 session-3/4 deferrals re-validated as DEFER.
- Wrote the session-5 remediation plan (docs/REMEDIATION_PLAN.md) and executed it TDD-first (red → green for every fix):
  - S5-1 (MEDIUM): src/lib/seo.ts — pure buildProductJsonLd/buildOrganizationJsonLd/buildWebsiteJsonLd + 13 unit cases; Product JSON-LD + alternates.canonical on product pages; Organization + WebSite (SearchAction → /products?q=) on every storefront page; ld+json data blocks are CSP-safe (script-src does not apply).
  - S5-2 (MEDIUM): success-page copy reworded — no email promise; points at the token-gated receipt link + Track Order; shopping-flow e2e pins "on its way"/"confirmation email" absence.
  - S5-3 (MEDIUM): branded (storefront)/error.tsx + dependency-free global-error.tsx.
  - S5-4 (LOW): src/app/icon.svg + src/app/manifest.ts (e2e 200-pinned).
  - S5-5 (LOW): poweredByHeader: false (e2e-pinned absent).
  - S5-6 (LOW): bun.lock untracked + .gitignore entry (AGENTS.md already said npm-only).
  - S5-7 (LOW): pure computeMergedQuantities planner + 8 unit cases; guest→user cart merge + guest-cart delete + token rotation now ONE db.$transaction with idempotent final-quantity upserts (retries cannot double-count).
  - S5-8 (LOW): per-IP limiters — /api/search GET 120/min, /api/cart PATCH + DELETE 60/min.
  - S5-9 (LOW): imageUrlSchema (root-relative or http(s) only) on productInputSchema.images + unit cases (javascript:/data:/protocol-relative rejected).
  - S5-10 (NIT): dead ?next=/account emission dropped; footer renders the admin-editable social links (lucide + inline Pinterest/TikTok SVGs, rel=noopener noreferrer, sr-only labels); HSTS includeSubDomains + Permissions-Policy (camera/mic/geo/payment) headers.
- New tests/e2e/seo-platform.spec.ts pins the SEO/platform contracts (JSON-LD on home + product, canonical, robots/sitemap, manifest + icon, security headers, no X-Powered-By). Playwright quirk re-learned: script elements have no rendered text — hasText locators never match; read textContent instead.
- Gates after: lint ✓, typecheck ✓, typecheck:tests ✓, 149/149 unit ✓, build ✓, 38/38 e2e ✓.
- Manual verification via agent-browser + curl on the fresh standalone build: 3 ld+json blocks on product page (Organization/WebSite/Product with price 21.99 USD, InStock, aggregateRating), canonical link live, footer social links with aria-labels, reworded receipt shell, no x-powered-by, manifest 200 + icon 200 (after killing stale next-server processes — stale builds 404 the new routes), mobile menu open→navigate→close.
- Refreshed docs/screenshots/ (23 shots from the remediated build); updated AGENTS.md (6 new invariants), CLAUDE.md, README.md (149/38 counts + SEO features), PAD (testing tables + security table + known-issue #4→Fixed, new #20), homenest-store-s_SKILL.md v1.2.0 (session-5 history + security model + state line).

Stage Summary:
- Codebase closes the last SEO gap (JSON-LD rich results + canonicals + manifest/favicon), stops promising an email that never ships, ships branded error boundaries, and hardens the remaining metering/merge surfaces — with the e2e suite now also pinning the SEO/platform contracts.
- 149 unit + 38 e2e green; all docs aligned; deferred items re-documented with justification (analytics groupBy, 404 nonce, __Host- prefix, shared-store limiter, admin coupon UI, pagination, real mailer).

---

Task ID: 6 (session 6)
Agent: audit + remediation agent (Super Z)
Task: Re-validate session-5 deliverables, run a fresh deep audit (client-IP trust, SEO share surfaces, unbounded queries, docs alignment), remediate the new findings TDD-first, rewrite docs/DEPLOYMENT.md, refresh screenshots/docs/worklog, commit and push.

Work Log:
- Cloned the repo fresh (workspace had been reset); repo at 5f3776a = bf8b521 + docs/session_5.md; re-ran every session-5 gate on the pulled tree: lint ✓, typecheck ✓, typecheck:tests ✓, 149/149 unit ✓, build ✓, 38/38 e2e ✓; DATABASE_URL="file:../db/custom.db" contract intact (sandbox DATABASE_URL shadow neutralized by explicit per-command override; db/custom.db at the repo root).
- Re-verified visual parity against the LIVE reference (logged in via agent-browser): desktop home, hero carousel, trust badges, 8 categories, featured products (identical names/counts/prices) — reference unchanged; mobile menu re-verified (open → expanded=true, push-down panel; navigate → closes, lands on /products).
- Fresh deep audit (Task 6-a read-only subagent + own verification): 1 HIGH / 6 MEDIUM / 8 LOW / 5 NIT; session-5 fix verification 11/11 wired; verified clean: Tailwind v4 display toggling, money/cart math, cookies, CSP, anti-enumeration shells, no committed secrets.
- Wrote the session-6 remediation plan (docs/REMEDIATION_PLAN.md) and executed it TDD-first (red → green for every fix):
  - S6-1 (HIGH): spoof-resistant clientIp(Headers) — cf-connecting-ip first, rightmost XFF hop, "direct" fallback; the 5 inline split(",")[0] copies (coupon/checkout/newsletter/contact/track-order) route through the helper; 5 new unit cases.
  - S6-2: wishlist merge in ONE $transaction with token rotation (mirrors cart.ts); P2002-race-safe cart/wishlist creates (catch + re-read winner).
  - S6-3: branded public/images/og-default.png (1200×630, generated from the design tokens via scripts/gen_og_image.py); site-wide openGraph.images + twitter summary_large_image; product pages share the first product image; e2e-pinned.
  - S6-4: alternates.canonical on /, /products (facet params stripped), /about, /contact, /legal/[slug] via shared siteBaseUrl(); e2e-pinned.
  - S6-5: carouselSlideInputSchema.image → imageUrlSchema (+ 5 unit cases).
  - S6-6: computeMergedQuantities(own, guest, stockById?) third clamp dimension (stock; zero-stock lines dropped); cart.ts fetches stock in the merge tx (+6 unit cases).
  - S6-7: bounded analytics — orderItem.groupBy on (productId, nameSnapshot, unitPrice) + pure foldItemAggregates/topProducts in src/lib/analytics.ts (+6 unit cases); unbounded findMany removed.
  - S6-8: Order.cartToken column (db:push) + replayAuthorized() ownership gate (user: session match; guest: cart-cookie match; legacy rows deny) + shopping-flow e2e thief-context case (+4 unit cases).
  - S6-9: honest server-rendered pagination — product reviews ?reviews=N (5/page), account orders ?page=N (5/page); real totals, prev/next, out-of-range snap-back.
  - S6-10: addresses POST/DELETE per-IP limiters (60/min). S6-11: legal footer email from settings.contactEmail.
  - S6-12: README counts fixed (131/32 → actual), stray Vite index.html removed (git rm), COUPON_STORAGE_KEY single-sourced from cart/coupon-box.tsx.
  - S6-13: header hamburger toggles (setMobileNavOpen(!open)); carousel dots → plain buttons with aria-current (tab/tablist misuse removed).
  - S6-14: priceValidUntil in the Product offer (pure builder, unit-pinned); spec label/value ≤80 + tags ≤40 validation bounds.
  - S6-15: docs/DEPLOYMENT.md fully rewritten for this codebase (npm scripts, real limiter numbers, env table incl. NEXT_PUBLIC_DEMO_MODE, DB contract, standalone runbook, seed-credential note, updated troubleshooting).
- Gates after: lint ✓, typecheck ✓, typecheck:tests ✓, 174/174 unit ✓, build ✓, 39/39 e2e ✓ (new: site-wide OG/canonical spec; replay thief-context denial).
- Manual verification via agent-browser + curl on the fresh standalone build: OG image/twitter card/canonical in served HTML; product og:image + priceValidUntil 2027-10-12; admin analytics renders charts from the bounded groupBy with zero console errors; hamburger now toggles open AND close; legal pages render settings email; screenshots refreshed (23 shots).
- Updated AGENTS.md (7 new/extended invariants), CLAUDE.md, README.md (174/39 counts + share-card features), PAD (known-issues 12/13/18/19 updated + 21/22/23 added), homenest-store-s_SKILL.md v1.3.0 (session-6 history + state line), worklog.md.

Stage Summary:
- Codebase closes the last HIGH-severity finding (limiter-bypass via spoofed XFF), makes the wishlist merge atomic (cart-merge parity), ships site-wide share cards + canonicals (SEO superset completion), bounds the analytics query, binds idempotent replays to their owner, paginates the two unbounded list surfaces honestly, and rewrites the stale DEPLOYMENT.md.
- 174 unit + 39 e2e green; all docs aligned; deferred items re-documented with justification (404 nonce, __Host- prefix, shared-store limiter, admin coupon UI, review radiogroup roving focus, real mailer).

---

Task ID: 7 (session 7)
Agent: audit + remediation agent (Super Z)
Task: Re-validate session-6 deliverables, run a fresh deep audit (data-integrity, ownership gates, seed policy, docs alignment), remediate the new findings TDD-first, refresh screenshots/docs/worklog, commit and push.

Work Log:
- Cloned the repo fresh (workspace had been reset); repo at 1c0b480 = b7010e0 + docs/session_6.md; re-ran every session-6 gate on the pulled tree: lint ✓, typecheck ✓, typecheck:tests ✓, 174/174 unit ✓, build ✓, 39/39 e2e ✓; .env recreated from .env.example (DATABASE_URL contract intact, strong AUTH_SECRET); db/custom.db seeded at the repo root (sandbox DATABASE_URL shadow neutralized per-command — the standalone health probe 503s otherwise).
- Re-verified visual parity against the LIVE reference (logged in via agent-browser): desktop home, hero carousel, trust badges, 8 categories, featured products (identical names/counts/prices), products page — reference unchanged; mobile menu re-verified on the production build (open → expanded=true push-down panel, navigate → closes on /products) — Tailwind v4 conditional-mount intact.
- Fresh deep audit (read-only subagent on the repo code-review-checklist + own evidence verification): session-6 fixes 13 WIRED / 1 PARTIAL (S6-11 legal body copy residual) / 0 MISSING; new findings 2 MEDIUM / 8 LOW / 3 NIT; verified clean again: money math, atomic stock/coupon, anti-enumeration shells, admin gates, CSP, cookies, no committed secrets.
- Wrote the session-7 remediation plan (docs/REMEDIATION_PLAN.md) and executed it TDD-first (red → green for every fix):
  - S7-1 (MED): guarded claim in safeCreateCart/safeCreateWishlist — the token-P2002 winner (the guest row on the first-login path) is claimed via updateMany({ where: { id, userId: null } }), never stealing a claimed row; new cross-device e2e (fresh registered account, second context sees the claimed cart).
  - S7-2: resolveReplay() + ReplayDeniedError in order-access.ts; the checkout P2002 recovery path is now ownership-bound (genuine double-submit passes; a leaked key 409s); 4 unit cases.
  - S7-3 (MED): src/lib/seed-policy.ts — productSeedUpdate refreshes CONTENT fields only (price/compareAtPrice/stock/rating/reviewCount/sku/badge/featured/newArrival/isActive are admin- or traffic-owned); settings + carousel slides create-only (S4-8 precedent); seed wired; LIVE-VERIFIED (mutated stock/price/rating/setting survive db:seed; catalog content still refreshes); DEPLOYMENT.md seed paragraph rewritten.
  - S7-4: siteBaseUrl() imported into layout.tsx (metadataBase), sitemap.ts, robots.ts, (storefront)/layout.tsx — the fallback now exists in exactly one place.
  - S7-5: legal body copy tokenized ({{contactEmail}} ×7) + interpolateContactEmail(); rendered through the settings email; LIVE-VERIFIED (a settings change re-renders all 14 paragraphs).
  - S7-6: imageUrlSchema root-relative ONLY (http(s)/protocol-relative/data rejected) — validation now agrees exactly with img-src 'self' data:; unit cases flipped.
  - S7-7: price/compareAtPrice .max(100_000_000) — typos fail as validation errors, not opaque Int32 Prisma errors.
  - S7-8: MAX_ADDRESSES_PER_USER=20 (src/lib/addresses.ts) on /api/addresses POST (friendly 409) and checkout saveAddress (skip-save, order still places); default-making saves unset previous defaults in-tx (deterministic findFirst); new addresses-cap e2e (20 OK → 21st 409).
  - S7-9: jsonLdScript() escaper (< → \u003c, U+2028/2029) on all three ld+json blocks — admin-authored strings can no longer terminate the element; 4 unit cases.
  - S7-10: newRequestId() (src/lib/random-id.ts) with getRandomValues hex fallback — checkout no longer crashes at mount on non-secure origins; 3 unit cases.
  - S7-11: /api/search + /api/cart-summary wrapped in the sibling { error } 500 shape.
  - S7-12: sessionSweepDue() pure helper + hourly time-gated opportunistic purge in getCurrentUser (void, non-blocking); 3 unit cases.
  - S7-13: wishlist heart aria-labels carry the product name (Add {name} to wishlist); filled-state feature DEFERRED (needs wishlist ids threaded through every grid).
- Gates after: lint ✓, typecheck ✓, typecheck:tests ✓, 197/197 unit ✓, build ✓, 41/41 e2e ✓ (new: cross-device claim; address cap).
- Manual verification via agent-browser + curl on the fresh standalone build: ld+json blocks escape-serialized and JSON-parseable (Product price 21.99, priceValidUntil 2027-10-12, absolute image); canonical/robots/sitemap rendered from siteBaseUrl; legal page email follows settings live; mobile menu open→navigate→close; wishlist labels product-named; zero console errors on cart.
- Refreshed docs/screenshots/ (23 shots); updated AGENTS.md (7 new/extended invariants + restored the review-aggregates invariant accidentally clobbered mid-edit), CLAUDE.md, README.md (197/41 counts, address book row, coverage bullets), PAD (§4.3 seed policy, 8.1/8.2 counts, known issues #24–26, key-files counts), docs/DEPLOYMENT.md (create-or-refresh seed paragraph), homenest-store-s_SKILL.md v1.4.0, docs/session_7.md, worklog.md.

Stage Summary:
- Codebase closes the two MEDIUM data-integrity gaps (unclaimed guest carts; live-data-resetting reseeds), binds the last unguarded idempotency path, single-sources the base URL, aligns image validation with the CSP, bounds the address book and prices, escapes JSON-LD, and survives non-secure-origin checkouts — with the test suite now pinning every one of those contracts.
- 197 unit + 41 e2e green; all docs aligned; deferred items re-documented with justification (404 nonce, __Host- prefix, shared-store limiter, admin coupon UI, radiogroup roving focus, real mailer, wishlist filled-state, saveAddress dedup).
