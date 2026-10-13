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

// ---------------------------------------------------------------------------
// Dashboard revenue chart (session-9 S9-4). The dashboard used to load EVERY
// non-cancelled order in the 14-day window into JS to fold a per-day revenue
// map — unbounded, growing linearly with order volume on a force-dynamic
// admin page. Now the page aggregates in SQL
// (`SUM(total) GROUP BY date(placedAt/1000,'unixepoch')` — Prisma stores
// SQLite DateTimes as epoch-millis INTEGERs, so the bare date() form returns
// NULL) and the fold below shapes the bounded result set (≤ 14 rows).
// ---------------------------------------------------------------------------

/** One SQL revenue bucket: a UTC `YYYY-MM-DD` day key and its summed cents. */
export type RevenueDayRow = {
  day: string;
  /** SQLite SUM comes back as number or bigint; NULL only for an empty set. */
  revenue: number | bigint | null;
};

/** One Recharts point for the admin dashboard's 14-day revenue chart. */
export type RevenuePoint = {
  /** `en-US` short date label rendered from the UTC day key (e.g. "Oct 13"). */
  date: string;
  /** Integer cents for that UTC day. */
  revenue: number;
};

/**
 * Fold SQL day buckets into the fixed 14-day chart window ending "today"
 * (UTC). Missing days are 0-filled; duplicate-day rows are summed
 * defensively even though GROUP BY guarantees uniqueness. Pure, so the
 * bucket/label math is unit-pinned in tests/unit/analytics.test.ts.
 */
export function buildRevenueChart(rows: RevenueDayRow[], now: Date): RevenuePoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.revenue ?? 0);
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + value);
  }
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const points: RevenuePoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(utcMidnight - i * 86_400_000);
    points.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      revenue: byDay.get(d.toISOString().slice(0, 10)) ?? 0,
    });
  }
  return points;
}

/**
 * UTC midnight of the first of `now`'s UTC month — the "Revenue This Month"
 * window. Session-13 S13-6: every admin money surface must bucket by UTC day
 * (the SQL buckets fold `date(placedAt/1000,'unixepoch')`, which is UTC), so
 * the month start is derived with UTC getters instead of the host-local ones
 * a bare `new Date(y, m, 1)` would use. Pure, unit-pinned.
 */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
