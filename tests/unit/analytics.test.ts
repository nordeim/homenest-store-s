import { describe, expect, it } from "vitest";

import { foldItemAggregates, topProducts } from "@/lib/analytics";

describe("foldItemAggregates (session-6 S6-7: bounded analytics aggregation)", () => {
  it("folds price-group rows into per-product revenue (units × unitPrice summed)", () => {
    const rollups = foldItemAggregates([
      { productId: "p1", nameSnapshot: "Knife", unitPrice: 1000, units: 2 },
      { productId: "p1", nameSnapshot: "Knife", unitPrice: 900, units: 3 },
    ]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]?.revenue).toBe(2 * 1000 + 3 * 900);
    expect(rollups[0]?.units).toBe(5);
  });

  it("groups by productId, not by name — a renamed product still folds into one row", () => {
    const rollups = foldItemAggregates([
      { productId: "p1", nameSnapshot: "Old Name", unitPrice: 500, units: 1 },
      { productId: "p1", nameSnapshot: "New Name", unitPrice: 500, units: 1 },
    ]);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]?.revenue).toBe(1000);
    expect(rollups[0]?.units).toBe(2);
  });

  it("falls back to the name snapshot key for deleted products (null productId)", () => {
    const rollups = foldItemAggregates([
      { productId: null, nameSnapshot: "Discontinued Pan", unitPrice: 400, units: 1 },
      { productId: null, nameSnapshot: "Discontinued Pan", unitPrice: 400, units: 2 },
      { productId: null, nameSnapshot: "Other Legacy Item", unitPrice: 100, units: 1 },
    ]);
    expect(rollups).toHaveLength(2);
    const pan = rollups.find((r) => r.name === "Discontinued Pan");
    expect(pan?.revenue).toBe(1200);
    expect(pan?.productId).toBeNull();
  });

  it("keeps deleted-product and live-product identities separate", () => {
    const rollups = foldItemAggregates([
      { productId: null, nameSnapshot: "Knife", unitPrice: 100, units: 1 },
      { productId: "p1", nameSnapshot: "Knife", unitPrice: 100, units: 1 },
    ]);
    expect(rollups).toHaveLength(2);
  });

  it("returns an empty array for empty input (seeded database has zero orders)", () => {
    expect(foldItemAggregates([])).toEqual([]);
    expect(topProducts([], 8)).toEqual([]);
  });
});

describe("topProducts", () => {
  it("sorts by revenue descending and slices to n", () => {
    const rollups = foldItemAggregates([
      { productId: "a", nameSnapshot: "A", unitPrice: 100, units: 1 },
      { productId: "b", nameSnapshot: "B", unitPrice: 5000, units: 2 },
      { productId: "c", nameSnapshot: "C", unitPrice: 700, units: 3 },
      { productId: "d", nameSnapshot: "D", unitPrice: 100000, units: 1 },
    ]);
    const top = topProducts(rollups, 2);
    expect(top.map((r) => r.name)).toEqual(["D", "B"]);
  });
});
