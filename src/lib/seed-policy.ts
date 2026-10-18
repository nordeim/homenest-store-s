/**
 * Seed upsert policy (session-7 S7-3) — what a reseed may and may not write.
 *
 * The seed runs on every deploy (docs/DEPLOYMENT.md §6). A reseed must
 * refresh the CATALOG CONTENT a deployment ships (copy, imagery, category
 * wiring) but must never reset state that accumulates in production:
 *
 *   - price / compareAtPrice / badge / isFeatured / isNewArrival / isActive /
 *     sku — admin-owned via the product dialog; a reseed reverting them
 *     silently discards merchandising decisions.
 *   - stock — the live ledger checkout decrements and cancel-restock
 *     increments; resetting it corrupts the operational invariant.
 *   - rating / reviewCount — customer-grown aggregates (the S4-7 class of
 *     bug: seeded baselines must grow, never collapse).
 *
 * Settings and carousel slides are admin-edited through their own UIs and
 * therefore seed CREATE-ONLY — exactly the coupon-bookkeeping precedent
 * from session-4 (S4-8): DB state is the only state for those rows.
 *
 * Pure and unit-pinned in tests/unit/session7-hardening.test.ts.
 */

/** Fields the seed may refresh on an EXISTING product row (content only). */
const PRODUCT_UPDATE_FIELDS = [
  "name",
  "shortDescription",
  "description",
  "categoryId",
  "images",
  "tags",
  "specs",
] as const;

export type ProductSeedData = Record<string, unknown> & { slug: string };

export function productSeedUpdate(data: ProductSeedData): Partial<ProductSeedData> {
  const update: Record<string, unknown> = {};
  for (const field of PRODUCT_UPDATE_FIELDS) {
    update[field] = data[field];
  }
  return update;
}

/**
 * Seed creation timestamps (session-12 S12-5, re-aligned session-33 S33-1
 * and session-34 S34-1) — the reference site's observable "Newest" order
 * is its authored catalog order (first-listed product first). Backdating
 * each seed row one minute older than its predecessor makes the seed list
 * order AND the `createdAt: desc` consumers agree, so `/products` default
 * sort and the home "New Arrivals" / "Featured" grids render the
 * reference's order (the live reference re-ordered its catalog twice since
 * the original pinning — session-33 and again in session-34, currently
 * Damascus-first; the seed list was re-aligned to the current live order
 * each time) while admin-created products (real `now()` timestamps)
 * correctly sort as the newest. Create-only: the upsert update branch
 * (`productSeedUpdate`) never touches `createdAt`, so reseeds cannot
 * rewrite the order of existing rows — re-ordering requires a fresh DB.
 * Pure and unit-pinned in tests/unit/session12-hardening.test.ts.
 */
export function productSeedCreatedAt(index: number, now: Date = new Date()): Date {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`productSeedCreatedAt: index must be a non-negative integer, got ${index}`);
  }
  return new Date(now.getTime() - index * 60_000);
}

/**
 * Seed creation timestamps for the demo coupons (session-51 S51-1) — the
 * coupon twin of productSeedCreatedAt. The seed loop created its three
 * coupon rows within ~1ms of each other, and /admin/coupons lists them
 * `orderBy: { createdAt: "desc" }` on SQLite's millisecond-precision
 * DateTime strings — a same-millisecond tie has no deterministic
 * tie-break, so the admin card grid flipped order run-to-run against an
 * otherwise identical database (run 52's 15b screenshot caught it live:
 * SAVE20-first vs the committed FREESHIP-first raster).
 *
 * The COUPONS array is authored in the DISPLAY order the admin surface has
 * shipped since session-19 (FREESHIP → SAVE20 → WELCOME10); this helper
 * makes the first-listed row the newest and backdates each successor a
 * full minute, so the `createdAt: desc` consumer renders exactly that
 * order on every fresh seed regardless of machine speed. Create-only: the
 * coupon upsert's update branch never touches `createdAt`, so reseeds
 * cannot rewrite the order of existing rows (the S4-8/S7-3 policy).
 * Pure and unit-pinned in tests/unit/session51-hardening.test.ts.
 */
export function couponSeedCreatedAt(index: number, now: Date = new Date()): Date {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`couponSeedCreatedAt: index must be a non-negative integer, got ${index}`);
  }
  return new Date(now.getTime() - index * 60_000);
}

/** Settings rows are admin-owned: reseed creates missing keys only. */
export const SETTINGS_CREATE_ONLY = true;

/** Carousel slides are admin-managed (CRUD + reorder): create-only on reseed. */
export const SLIDES_CREATE_ONLY = true;
