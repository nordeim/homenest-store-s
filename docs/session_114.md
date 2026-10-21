# Session 114 (run 62) — the Stripe payments retrofit (a FEATURE cycle)

> This file is the narrative log of the **62nd run** — a FEATURE cycle, not
> a remediation pass: the operator commissioned the retrofit of **proper
> Stripe Payment functionality** into this codebase using the
> `nordeim/ecommerce-store` implementation as the reference and sample
> template (that repo's sessions 22/23/25/30/32 — PAY-STRIPE-1/2,
> PAY-OPS-2, REASON-TRAIL-1, REFUND-ACTION-1). **52 new unit tests (444 →
> 496), zero regressions in the existing 444 + 67 e2e** (the
> unconfigured demo path is byte-identical by construction — the OFF
> default), zero findings carried in. File names increment by run number
> (the run/plan numbering drift is documented in `docs/session_52.md`);
> `docs/session_112.md` holds the previous run's narrative.

## 1. The design contract (inherited from the reference, adapted here)

The reference implementation's Stripe integration is a mature,
battle-tested design (it went through five hardening sessions of its own).
The retrofit ports its **invariants** and adapts them to THIS repo's richer
money model (coupons, tax, shipping methods, the idempotency-key replay,
the placeOrderTx transactional money authority):

1. **OFF by default, byte-identical unconfigured.** No
   `STRIPE_SECRET_KEY` → the demo card wizard, PayPal, and COD render
   exactly as before; the CSP string keeps its 9-directive pin; the e2e
   suite (which runs unconfigured) passed 67/67 untouched. Stripe is a
   **superset activation**, never a replacement.
2. **Money is server truth (the ADR-011 transplant).** The PaymentIntent
   amount is minted server-side from the live cart + coupon + settings
   through `computeOrderMoney`; nothing the client sends can move it.
   Placement re-verifies the intent amount pre-tx against the SAME
   estimate, and `placeOrderTx` (the in-tx money authority) re-derives the
   total and rejects a drift with `StripeAmountMismatchError` — the
   residual TOCTOU guard the reference doesn't need (its placement derives
   money pre-tx) but THIS repo's in-tx authority demands.
3. **Idempotency everywhere.** Deterministic Stripe intent keys
   (`sha256(cartId:total:snapshotHash)` — the snapshot covers address,
   email, name, shipping method, coupon), the
   `Order.stripePaymentIntentId` UNIQUE anchor, and the
   `StripeEvent.eventId` dedup row committed **WITH** the placement side
   effects (the H4d/L9 rule: a transient failure rolls the dedup row back
   with the order, so Stripe's retry re-attempts the full placement — a
   row committed before a failed placement would orphan the delivery).
4. **The webhook failure policy** (the
   `classifyWebhookPlacementError` seam): **duplicate** (P2002 on
   eventId / stripePaymentIntentId / idempotencyKey — this repo's webhook
   carries the client's checkout key in the intent metadata, so its
   collision is also a duplicate, never a retry loop) → 200 with the
   winner's order; **permanent** (a CheckoutError 4xx — stock short,
   coupon cap — or the amount guard: deterministic, retry cannot succeed)
   → record + the canonical failure-reason code + 200 + the ops refund
   trail; **transient** (everything else, incl. a `number` P2002) → 500,
   Stripe retries with backoff for up to 3 days.
5. **PCI SAQ-A.** The Payment Element iframe owns card data; the only
   values that cross are the clientSecret (mount) and the confirmed
   PaymentIntent id (placement). The `@stripe/stripe-js/pure` lazy loader
   entry keeps even stripe.js itself from loading unless the path is live.
6. **The sentinel mirror.** `src/lib/stripe-config.ts` is the ONE truth
   table both sides derive "configured" from — a client that thinks
   Stripe is on while the server doesn't (or vice-versa) is
   structurally impossible. Placeholder ("set-me") values are
   documentation, not configuration.
7. **The refund loop's single-writer rule.** `refundOrderAction` (admin)
   only FIRES the refund (idempotent by `refund:<intentId>`); the
   webhook's `charge.refunded` reflection is the ONLY writer of
   `paymentStatus "refunded"` — the same shared `refundEligibility` seam
   gates both the dialog's button and the action.

## 2. The change-set (src/tests/prisma)

**New modules (the seams — all SDK-free, unit-pinned):**

- `src/lib/stripe-config.ts` — the client-safe sentinel mirror (zero
  runtime imports; bundleable into client components and the proxy).
- `src/lib/stripe-payment.ts` — the server-only pure seams: the
  idempotency-key family, `buildPaymentIntentParams` (metadata = the
  webhook's rebuild contract), `verifyPaymentIntentForPlacement`
  (status/amount/currency with customer-safe copy),
  `StripeAmountMismatchError`, `classifyStripeEvent`,
  `classifyWebhookPlacementError`, `STRIPE_FAILURE_REASON`,
  `parseStripeWebhookEvent`, `stripeEventIntentId`,
  `chargeRefundedReflection`, `paymentIntentLast4`.
- `src/lib/stripe.ts` — the lazy server client (the ONLY SDK import in
  server code; unconfigured boots construct nothing).
- `src/lib/admin-payments.ts` — `refundEligibility` (the shared gate),
  `paymentOutcomeView` (the ledger's honest refund-needed derivation),
  `paymentFailureReasonView` (the reason vocabulary's read side).

**New routes:**

- `POST /api/stripe/payment-intent` — the mint: re-derives the cart +
  coupon + settings server-side, creates (or idempotently reuses) the
  intent, returns the clientSecret. Rate-limited 10/10min per user/IP.
  Never writes orders.
- `POST /api/stripe/webhook` — the backstop: raw-body signature
  verification (300s tolerance) → structural parse → the failed /
  charge.refunded-reflection / ignored / succeeded-backstop branches. The
  orphaned-payment rebuild reads the intent's own metadata (the address
  snapshot parses through the SAME `addressSchema` — single source) and
  places through the SAME `placeOrderTx` with the dedup row in-tx.
- `/admin/payments` — the operator's StripeEvent ledger (outcome chips:
  Placed / **Refund needed** / Failed / Refund / Recorded; the
  failure-reason enrichment; q-search over intent + event ids; guarded by
  the admin layout like every admin surface; robots-disallowed +
  sitemap-excluded by the existing `/admin` prefix rules).

**Extended modules:**

- `prisma/schema.prisma` — `Order.stripePaymentIntentId String? @unique`
  (the placement anchor) + `Order.paymentStatus String?` (null = demo /
  "paid" = captured / "refunded" = reflected) + the `StripeEvent` model
  (eventId UNIQUE, type, the honest paymentIntentId, amount,
  failureReason). Additive columns + one new table — zero data motion.
- `src/lib/order-placement.ts` — `PlaceOrderArgs` gains
  `stripePaymentIntentId` / `paidTotalCents` / the optional in-tx
  `stripeEvent` dedup row; the in-tx amount guard throws
  `StripeAmountMismatchError` on drift; the order create writes the paid
  columns + the "Order placed via card (Stripe)" note.
- `src/app/api/checkout/route.ts` — the body may carry a
  `stripePaymentIntentId`; the server retrieves + verifies the intent
  OUTSIDE the tx (no external call holds the SQLite write lock), the
  cardLast4 requirement yields to the verified intent, and the retry
  loop's intent-anchor P2002 resolves to the already-placed order's
  receipt.
- `src/components/checkout/stripe-pay.tsx` — the combined Payment &
  Review island (the element must stay mounted with its confirm button):
  fetch-based mint, `elements.submit()` + `confirmPayment({
  redirect: "if_required" })`, the confirmed intent id handed to the
  parent's existing `/api/checkout` submit; the re-mint pattern (a
  "cart changed" rejection or any snapshot change clears the session and
  mints fresh); the Element appearance mapped from THIS repo's theme
  tokens (primary #d96e26, Inter, the 12px radius pin).
- `src/app/(storefront)/checkout/checkout-client.tsx` — the island mounts
  when configured + card; the demo card form stays the unconfigured
  default; the review anatomy extracted to one `reviewDetails` block
  shared by step 3 and the island; the idempotency key moved from a ref
  to lazily-initialized state (the snapshot reads it during render —
  write-once, so behavior-identical and lint-legal).
- `src/lib/actions/admin.ts` — `refundOrderAction` (admin-gated,
  eligibility-seamed, idempotent refund; never writes refund state).
- `src/app/(storefront)/admin/orders/page.tsx` +
  `order-manage-dialog.tsx` — the payment-status chips (Paid / Refunded)
  + the Refund control (rendered from the same `refundEligibility` the
  action guards with); the payment_refunded timeline event.
- `src/app/(storefront)/checkout/success/page.tsx` — the paid/refunded
  payment labels.
- `src/lib/csp.ts` + `src/proxy.ts` — the optional `stripeConfigured`
  gate: script-src gains js.stripe.com, connect-src gains api.stripe.com,
  frame-src (js.stripe.com + hooks.stripe.com) appends — and the
  unconfigured string stays byte-identical to the pre-retrofit pin.
- `.env.example` — the three Stripe vars, documented.

**Tests (52 new):**

- `tests/unit/stripe-config.test.ts` (6) — the sentinel mirror's truth
  table incl. the placeholder rule and the never-client-only-on pin.
- `tests/unit/stripe-payment.test.ts` (26) — the idempotency family, the
  intent params/metadata contract, the verification gate's three
  customer-safe failures, the failure policy across every anchor
  (field-array + constraint-name shapes), the reason vocabulary, the
  envelope parse, the honest intent id, the refund reflection
  (full/partial/non-paid), the last4 extraction.
- `tests/unit/admin-payments.test.ts` (9) — the eligibility gate's four
  cells, the outcome derivation, the reason-view mapping.
- `tests/unit/csp.test.ts` (+4) — the unconfigured byte-identity pin +
  the configured directive set + the dev composition.
- `tests/unit/place-order-integration.test.ts` (+5, real-engine) — the
  paid placement + the anchor's P2002, the amount-drift rollback (order,
  stock, coupon burn ALL restored), the dedup-row commits-with-placement,
  and the dedup-row rolls-back-with-a-failed-placement (the H4d/L9 rule
  at engine level).
- `tests/unit/track-order-limiter.test.ts` — the order mock gained the
  two new columns (a type-level fixture update, zero behavior change).

## 3. The gates

On the final tree: **lint ✓ · typecheck ✓ · typecheck:tests ✓ · 496/496
unit at 22.4s · build 22/22 static, zero prisma:error · 67/67 e2e at
1.8m** (the fresh-seed traffic run — the e2e checkout pins prove the
unconfigured demo path byte-identical). A configured-mode smoke (dummy
keys, standalone server): the CSP header carries the full Stripe family;
`POST /api/stripe/webhook` answers 400 Missing/Invalid signature (the
raw-body HMAC path exercised); `POST /api/stripe/payment-intent` answers
400 on malformed bodies and 409 on an empty cart; `/admin/payments`
renders the admin access-required shell for anonymous visitors (the
layout guard, verified in the served HTML).

## 4. Operator setup (the activation path)

Unconfigured → configured is THREE env vars (see `.env.example` +
`docs/DEPLOYMENT.md`): `STRIPE_SECRET_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` (the
endpoint is `POST /api/stripe/webhook`). Test cards: 4242 4242 4242
4242 (succeeds), 4000 0000 0000 0002 (declines — the failed-event
recording path). Local webhook listener: `stripe listen --forward-to
localhost:3000/api/stripe/webhook`. The refund loop: the order dialog's
"Refund via Stripe" (paid orders only) or the Stripe dashboard — the
order's payment state updates when the `charge.refunded` delivery
arrives.

## 5. Deviations from the reference (and why)

- **The mint is an API route, not a server action** — this repo's
  checkout is fetch-based against `/api/checkout`; the island follows the
  same architecture.
- **The in-tx amount guard (`StripeAmountMismatchError`)** — the
  reference's placement derives money pre-tx; this repo's `placeOrderTx`
  is the in-tx authority, so the guard closes the sub-second drift window
  the reference doesn't have.
- **The idempotencyKey duplicate anchor** — this repo's webhook placement
  carries the client's checkout key (intent metadata) so replay
  ownership stays bound; its P2002 therefore classifies duplicate (the
  reference has no such column).
- **`checkout-rejected` joins the failure vocabulary** — the reference's
  `stock-short` is one cell of this repo's broader CheckoutError 4xx
  family (stock, coupon cap, price drift); the generic code covers the
  family, the log line carries the specifics.
- **The admin payments surface is compact** — a q-searchable ledger with
  the outcome + reason derivations; the reference's date-range filters
  and family deep-links were not ported (add them when an operator asks).
- **The webhook does not save the address book** — the recovery path
  places with `saveAddress: false` (the address rides on the order's
  shipping snapshot; the bookkeeping save is a live-checkout concern).
