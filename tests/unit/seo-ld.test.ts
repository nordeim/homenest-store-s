import { describe, expect, it } from "vitest";

import {
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebsiteJsonLd,
  siteBaseUrl,
} from "@/lib/seo";
import type { JsonLdObject } from "@/lib/seo";

const BASE = "https://homenest.example";

const PRODUCT = {
  id: "prod_knife",
  name: "Damascus Steel Chef Knife Set",
  shortDescription: "Hand-forged blades for the modern home chef.",
  description: "Full description of the knife set with many details.",
  images: "/images/knife-1.jpg,/images/knife-2.jpg",
  sku: "KN-SET-01",
  price: 19999,
  compareAtPrice: 27999,
  currency: "USD",
  stock: 24,
  rating: 4.7,
  reviewCount: 412,
  categoryName: "Kitchen Tools",
  url: `${BASE}/product/prod_knife`,
  brandName: "HomeNest Kitchen",
};

describe("buildProductJsonLd", () => {
  const ld = buildProductJsonLd(PRODUCT) as JsonLdObject & {
    offers: Record<string, unknown>;
    aggregateRating: Record<string, unknown>;
  };

  it("emits a schema.org Product with the core identity fields", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Damascus Steel Chef Knife Set");
    expect(ld.sku).toBe("KN-SET-01");
    expect(ld.description).toBe(PRODUCT.shortDescription);
  });

  it("converts integer cents to decimal-dollar price strings", () => {
    expect(ld.offers.price).toBe(199.99);
    expect(ld.offers.priceCurrency).toBe("USD");
  });

  it("maps stock to the schema.org availability vocabulary", () => {
    expect(ld.offers.availability).toBe("https://schema.org/InStock");
    const out = buildProductJsonLd({ ...PRODUCT, stock: 0 }) as JsonLdObject & {
      offers: Record<string, unknown>;
    };
    expect(out.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("carries the offer url and item condition", () => {
    expect(ld.offers.url).toBe(`${BASE}/product/prod_knife`);
    expect(ld.offers.itemCondition).toBe("https://schema.org/NewCondition");
  });

  it("exposes the aggregate rating only when reviews exist", () => {
    expect(ld.aggregateRating.ratingValue).toBe(4.7);
    expect(ld.aggregateRating.reviewCount).toBe(412);
    const unreviewed = buildProductJsonLd({ ...PRODUCT, reviewCount: 0 }) as JsonLdObject & {
      aggregateRating?: unknown;
    };
    expect(unreviewed.aggregateRating).toBeUndefined();
  });

  it("parses the images JSON into an http(s)-absolute array", () => {
    expect(ld.image).toEqual([
      `${BASE}/images/knife-1.jpg`,
      `${BASE}/images/knife-2.jpg`,
    ]);
  });
});

describe("buildOrganizationJsonLd", () => {
  it("emits the Organization node with contact + social surface", () => {
    const ld = buildOrganizationJsonLd({
      baseUrl: BASE,
      name: "HomeNest Kitchen",
      description: "Premium home & kitchen products",
      email: "hello@homenest.com",
      phone: "+1 (555) 123-4567",
      socials: [`${BASE}/facebook`, `${BASE}/instagram`],
    }) as JsonLdObject & { contactPoint: Record<string, unknown>; sameAs: string[] };

    expect(ld["@type"]).toBe("Organization");
    expect(ld.url).toBe(BASE);
    expect(ld.sameAs).toEqual([`${BASE}/facebook`, `${BASE}/instagram`]);
    expect(ld.contactPoint.email).toBe("hello@homenest.com");
  });

  it("omits sameAs when there are no social links", () => {
    const ld = buildOrganizationJsonLd({
      baseUrl: BASE,
      name: "HomeNest Kitchen",
      description: "x",
      email: "",
      phone: "",
      socials: [],
    }) as JsonLdObject & { sameAs?: string[]; contactPoint?: unknown };
    expect(ld.sameAs).toBeUndefined();
    expect(ld.contactPoint).toBeUndefined();
  });
});

describe("buildWebsiteJsonLd", () => {
  it("emits a WebSite node with the typeahead SearchAction", () => {
    const ld = buildWebsiteJsonLd({ baseUrl: BASE, name: "HomeNest Kitchen" }) as JsonLdObject & {
      potentialAction: { target: string };
    };
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.url).toBe(BASE);
    expect(ld.potentialAction.target).toBe(`${BASE}/products?q={search_term_string}`);
  });
});

// --- session-6 S6-14: priceValidUntil (Google rich-result recommendation) ---
describe("buildProductJsonLd — priceValidUntil (session-6)", () => {
  it("emits offers.priceValidUntil as a YYYY-MM-DD date about a year out", () => {
    const ld = buildProductJsonLd(PRODUCT) as JsonLdObject & { offers: Record<string, unknown> };
    const value = ld.offers.priceValidUntil;
    expect(typeof value).toBe("string");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = new Date(`${value as string}T00:00:00Z`).getTime();
    expect(Number.isNaN(parsed)).toBe(false);
    const yearAhead = Date.now() + 360 * 24 * 60 * 60 * 1000;
    expect(parsed).toBeGreaterThanOrEqual(yearAhead);
  });
});

// --- session-6 S6-4: shared canonical base-URL helper -----------------------
describe("siteBaseUrl (session-6)", () => {
  it("returns NEXT_PUBLIC_SITE_URL when set, trailing slashes stripped", () => {
    expect(siteBaseUrl("https://shop.example.com/")).toBe("https://shop.example.com");
    expect(siteBaseUrl("https://shop.example.com")).toBe("https://shop.example.com");
  });

  it("falls back to localhost:3000 when unset or empty", () => {
    expect(siteBaseUrl(undefined)).toBe("http://localhost:3000");
    expect(siteBaseUrl("")).toBe("http://localhost:3000");
  });
});
