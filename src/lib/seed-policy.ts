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

/** Settings rows are admin-owned: reseed creates missing keys only. */
export const SETTINGS_CREATE_ONLY = true;

/** Carousel slides are admin-managed (CRUD + reorder): create-only on reseed. */
export const SLIDES_CREATE_ONLY = true;
