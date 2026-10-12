// ---------------------------------------------------------------------------
// Admin analytics aggregation (session-6 audit S6-7). The analytics page used
// to load EVERY order item ever (with product + category joins) into JS —
// unbounded, growing linearly with order history. Now the page groups in SQL
// (orderItem.groupBy on productId/nameSnapshot/unitPrice) and the fold below
// shapes the bounded result set (≤ products × distinct prices). Pure, so the
// money math is unit-pinned in tests/unit/analytics.test.ts.
// ---------------------------------------------------------------------------

/** One `orderItem.groupBy` row: units sold at a given (product, price) point. */
export type ItemAggregate = {
  productId: string | null;
  nameSnapshot: string;
  unitPrice: number;
  units: number;
};

export type ProductRollup = {
  /** Stable identity: productId, or a deleted-product snapshot marker. */
  key: string;
  productId: string | null;
  /** Snapshot name; the page overrides it with the live product name when the row still exists. */
  name: string;
  /** Integer cents. */
  revenue: number;
  units: number;
};

/**
 * Fold price-group aggregates into per-product rollups. Deleted products
 * (null productId) keep their snapshot identity — two same-named deleted
 * products are distinct rows only when their names differ (the snapshot name
 * is all that remains of them).
 */
export function foldItemAggregates(rows: ItemAggregate[]): ProductRollup[] {
  const map = new Map<string, ProductRollup>();
  for (const row of rows) {
    const key = row.productId ?? `deleted:${row.nameSnapshot}`;
    const entry = map.get(key) ?? {
      key,
      productId: row.productId,
      name: row.nameSnapshot,
      revenue: 0,
      units: 0,
    };
    entry.revenue += row.unitPrice * row.units;
    entry.units += row.units;
    map.set(key, entry);
  }
  return [...map.values()];
}

/** Sort by revenue (cents, desc) and take the top n. */
export function topProducts(rollups: ProductRollup[], n: number): ProductRollup[] {
  return [...rollups].sort((a, b) => b.revenue - a.revenue).slice(0, n);
}
