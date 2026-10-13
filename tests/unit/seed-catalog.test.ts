// S15-2 (session 15) — the seed-owned catalog constants, pinned at the layer
// that can actually import `prisma/seed.ts` (Vitest transpiles it; Playwright
// cannot — its CJS transform rejects the seed's `import.meta` execution
// guard).
//
// The storefront e2e spec consumes these assumptions (16-product catalog,
// Damascus-first authored order, 2-page pagination at 12/page, 3 cookware
// rows); the restore-demo-stock harness keeps the live demo DB aligned with
// them (stock AND isActive since S15-2). If a seed change moves any value
// here, re-check the storefront/shopping-flow e2e assumptions in the same
// change.
import { describe, expect, it } from "vitest";

import { PRODUCTS } from "../../prisma/seed";

describe("seed catalog constants (S15-2)", () => {
  it("ships the 16-product reference catalog the e2e pins assume", () => {
    expect(PRODUCTS).toHaveLength(16);
    expect(new Set(PRODUCTS.map((p) => p.slug)).size).toBe(16);
  });

  it("opens with the reference's authored order — Damascus-first (S12-5)", () => {
    expect(PRODUCTS[0]?.slug).toBe("damascus-steel-chef-knife-set");
  });

  it("carries the 3 cookware rows the /products category-filter pin assumes", () => {
    expect(PRODUCTS.filter((p) => p.category === "cookware")).toHaveLength(3);
  });

  it("fills page 1 of the 12-per-page /products grid (pagination pin reaches page 2)", () => {
    expect(PRODUCTS.length).toBeGreaterThan(12);
    expect(PRODUCTS.length).toBeLessThanOrEqual(24);
  });

  it("spans the 8 seed categories the storefront tiles assume", () => {
    expect(new Set(PRODUCTS.map((p) => p.category)).size).toBe(8);
  });

  it("every product carries the fields the restore harness restores against", () => {
    for (const p of PRODUCTS) {
      expect(typeof p.slug).toBe("string");
      expect(Number.isInteger(p.stock)).toBe(true);
      expect(p.stock).toBeGreaterThan(0);
    }
  });
});
