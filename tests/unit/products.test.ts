import { describe, expect, it } from "vitest";

import { parseImages, parseSpecs, parseTags, toCardData, type ProductCardData } from "@/lib/products";
import type { Category, Product } from "@prisma/client";

/** Minimal Product/Category fixtures cast from partials (schema-shape only). */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    slug: "damascus-steel-chef-knife-set",
    name: "Damascus Steel Chef Knife Set",
    shortDescription: "Professional 5-piece knife set.",
    description: "Professional 5-piece knife set with Damascus steel blades.",
    categoryId: "cat-1",
    price: 19999,
    compareAtPrice: 27999,
    cost: null,
    sku: "HN-KNIFE-001",
    stock: 24,
    rating: 4.9,
    reviewCount: 412,
    images: JSON.stringify(["/images/product-damascus-knife-set.png"]),
    tags: JSON.stringify(["Damascus steel", "professional"]),
    specs: JSON.stringify([
      { label: "Blade Material", value: "67-layer Damascus steel" },
      { label: "Pieces", value: "5 knives" },
    ]),
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Product;
}

const category: Pick<Category, "name" | "slug"> = { name: "Kitchen Tools", slug: "kitchen-tools" };

describe("parseImages / parseTags", () => {
  it("parses JSON string arrays", () => {
    expect(parseImages('["/a.png","/b.png"]')).toEqual(["/a.png", "/b.png"]);
    expect(parseTags('["steel","gift"]')).toEqual(["steel", "gift"]);
  });

  it("returns [] on malformed JSON or non-arrays", () => {
    expect(parseImages("not-json")).toEqual([]);
    expect(parseImages('{"a":1}')).toEqual([]);
    expect(parseImages("[1,2]")).toEqual([]);
    expect(parseImages("")).toEqual([]);
  });
});

describe("parseSpecs", () => {
  it("parses label/value pairs", () => {
    const specs = parseSpecs(makeProduct().specs);
    expect(specs).toEqual([
      { label: "Blade Material", value: "67-layer Damascus steel" },
      { label: "Pieces", value: "5 knives" },
    ]);
  });

  it("drops entries without a string label, keeps label-only entries", () => {
    expect(parseSpecs(JSON.stringify([{ label: "X" }, null, "nope"]))).toEqual([{ label: "X" }]);
    expect(parseSpecs(JSON.stringify([null, 42]))).toEqual([]);
  });
});

describe("toCardData", () => {
  it("projects the exact card shape", () => {
    const card: ProductCardData = toCardData(makeProduct(), category);
    expect(card).toEqual({
      id: "prod-1",
      name: "Damascus Steel Chef Knife Set",
      image: "/images/product-damascus-knife-set.png",
      price: 19999,
      compareAtPrice: 27999,
      rating: 4.9,
      reviewCount: 412,
      categoryName: "Kitchen Tools",
      categorySlug: "kitchen-tools",
      badge: "Featured",
    });
  });

  it("falls back to the placeholder image", () => {
    const card = toCardData(makeProduct({ images: "[]" }), category);
    expect(card.image).toBe("/images/placeholder.svg");
  });
});
