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
 * Seed creation timestamps (session-12 S12-5, re-aligned session-33 S33-1) — the
 * reference site's observable "Newest" order is its authored catalog order
 * (first-listed product first). Backdating each seed row one minute older
 * than its predecessor makes the seed list order AND the `createdAt: desc`
 * consumers agree, so `/products` default sort and the home "New Arrivals" /
 * "Featured" grids render the reference's order (session-33: the reference
 * re-ordered its live catalog — Enameled Cast Iron Dutch Oven first now;
 * the seed list was re-aligned to it) while admin-created products (real
 * `now()` timestamps) correctly sort as the newest. Create-only: the upsert
 * update branch (`productSeedUpdate`) never touches `createdAt`, so reseeds
 * cannot rewrite the order of existing rows. Pure and unit-pinned in
 * tests/unit/session12-hardening.test.ts.
 */
export function productSeedCreatedAt(index: number, now: Date = new Date()): Date {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`productSeedCreatedAt: index must be a non-negative integer, got ${index}`);
  }
  return new Date(now.getTime() - index * 60_000);
}

/** Settings rows are admin-owned: reseed creates missing keys only. */
export const SETTINGS_CREATE_ONLY = true;

/** Carousel slides are admin-managed (CRUD + reorder): create-only on reseed. */
export const SLIDES_CREATE_ONLY = true;
