import { describe, expect, it } from "vitest";

import {
  addressSchema,
  clampSearchTerm,
  cartLinePatchSchema,
  cartMutateSchema,
  checkoutSchema,
  contactSchema,
  couponApplySchema,
  couponInputSchema,
  firstError,
  loginSchema,
  registerSchema,
  reviewSchema,
  trackOrderSchema,
  carouselSlideInputSchema,
  productInputSchema,
  wishlistToggleSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const parsed = registerSchema.parse({
      name: "  Jordan Rivera ",
      email: "  Jordan@Example.COM ",
      password: "Sup3rSecret!",
    });
    expect(parsed.name).toBe("Jordan Rivera");
    expect(parsed.email).toBe("jordan@example.com");
  });

  it("enforces the 8-character password floor", () => {
    const result = registerSchema.safeParse({ name: "Jo", email: "a@b.co", password: "short" });
    expect(result.success).toBe(false);
  });

  it("requires a plausible email", () => {
    const result = registerSchema.safeParse({ name: "Jo", email: "not-an-email", password: "longenough1" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
  });
});

describe("addressSchema", () => {
  const valid = {
    fullName: "Jordan Rivera",
    phone: "+1 512 555 0133",
    line1: "482 Maple Avenue",
    city: "Austin",
    state: "TX",
    postalCode: "73301",
  };

  it("applies defaults for optional fields", () => {
    const parsed = addressSchema.parse(valid);
    expect(parsed.label).toBe("Home");
    expect(parsed.country).toBe("United States");
    expect(parsed.line2).toBeUndefined();
  });

  it("rejects a too-short street", () => {
    expect(addressSchema.safeParse({ ...valid, line1: "12" }).success).toBe(false);
  });
});

describe("cartMutateSchema", () => {
  it("bounds quantity to 1..99", () => {
    expect(cartMutateSchema.safeParse({ productId: "p1", quantity: 1 }).success).toBe(true);
    expect(cartMutateSchema.safeParse({ productId: "p1", quantity: 0 }).success).toBe(false);
    expect(cartMutateSchema.safeParse({ productId: "p1", quantity: 100 }).success).toBe(false);
    expect(cartMutateSchema.safeParse({ productId: "", quantity: 1 }).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  const valid = {
    email: "demo@homenestkitchen.com",
    customerName: "Jordan Rivera",
    shippingMethod: "standard",
    paymentMethod: "card",
    address: {
      fullName: "Jordan Rivera",
      phone: "+1 512 555 0133",
      line1: "482 Maple Avenue",
      city: "Austin",
      state: "TX",
      postalCode: "73301",
    },
  };

  it("accepts the demo checkout payload", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown shipping/payment methods", () => {
    expect(checkoutSchema.safeParse({ ...valid, shippingMethod: "drone" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: "crypto" }).success).toBe(false);
  });

  it("accepts an optional idempotency key (16..64 chars)", () => {
    const key = "3f2b8a64-1c5d-4e9a-9f0b-2d7c8e1a4b5c"; // uuid-shaped, 36 chars
    expect(checkoutSchema.safeParse(valid).success).toBe(true); // absent = fine
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: key }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: "short" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: "x".repeat(65) }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: "" }).success).toBe(false);
  });
});

describe("reviewSchema", () => {
  it("bounds the rating to 1..5", () => {
    const base = { productId: "p1", title: "Great", comment: "This is a great product for the kitchen." };
    expect(reviewSchema.safeParse({ ...base, rating: 0, author: "Jo" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: 6, author: "Jo" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: 5, author: "Jo" }).success).toBe(true);
  });

  it("requires a substantive comment", () => {
    expect(
      reviewSchema.safeParse({ productId: "p1", rating: 5, comment: "short", author: "Jo" }).success,
    ).toBe(false);
  });
});

describe("contactSchema", () => {
  it("requires a real message", () => {
    expect(
      contactSchema.safeParse({ name: "Jo", email: "a@b.co", message: "hi" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: "Jo", email: "a@b.co", message: "Do you ship to Canada quickly?" }).success,
    ).toBe(true);
  });
});

describe("firstError", () => {
  it("returns the first issue message", () => {
    const result = registerSchema.safeParse({ name: "", email: "bad", password: "x" });
    if (result.success) throw new Error("expected failure");
    expect(typeof firstError(result.error)).toBe("string");
    expect(firstError(result.error).length).toBeGreaterThan(0);
  });
});

describe("trackOrderSchema", () => {
  it("accepts an order number plus the purchase email and normalizes it", () => {
    const parsed = trackOrderSchema.parse({ number: " ord-2026-001 ", email: " Buyer@Example.COM " });
    expect(parsed.number).toBe("ORD-2026-001");
    expect(parsed.email).toBe("buyer@example.com");
  });

  it("requires both fields", () => {
    expect(trackOrderSchema.safeParse({ number: "", email: "a@b.co" }).success).toBe(false);
    expect(trackOrderSchema.safeParse({ number: "ORD-2026-001", email: "" }).success).toBe(false);
    expect(trackOrderSchema.safeParse({ number: "ORD-2026-001", email: "not-an-email" }).success).toBe(false);
  });
});

describe("carouselSlideInputSchema.ctaLink", () => {
  it("accepts internal paths and absolute http(s) URLs", () => {
    const base = { title: "Summer Sale", image: "/images/hero-sale.png" };
    expect(carouselSlideInputSchema.safeParse({ ...base, ctaLink: "/products" }).success).toBe(true);
    expect(carouselSlideInputSchema.safeParse({ ...base, ctaLink: "https://example.com/promo" }).success).toBe(true);
  });

  it("rejects javascript: and other scheme-injected links", () => {
    const base = { title: "Summer Sale", image: "/images/hero-sale.png" };
    expect(carouselSlideInputSchema.safeParse({ ...base, ctaLink: "javascript:alert(1)" }).success).toBe(false);
    expect(carouselSlideInputSchema.safeParse({ ...base, ctaLink: "data:text/html,<script>" }).success).toBe(false);
    expect(carouselSlideInputSchema.safeParse({ ...base, ctaLink: "vbscript:x" }).success).toBe(false);
  });
});

describe("productInputSchema.images", () => {
  const base = {
    name: "Test Knife",
    slug: "test-knife",
    description: "A very good test knife for chopping test vegetables.",
    categoryId: "cat_kitchen-tools",
    price: 1999,
    sku: "KN-TEST-01",
    stock: 10,
  };

  it("accepts root-relative store paths only (session-7 S7-6: CSP img-src alignment)", () => {
    expect(productInputSchema.safeParse({ ...base, images: ["/images/knife-1.jpg"] }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...base, images: ["/images/products/deep/nested/knife.webp"] }).success).toBe(true);
  });

  it("rejects absolute http(s) urls the production CSP would block (session-7 S7-6)", () => {
    expect(productInputSchema.safeParse({ ...base, images: ["https://cdn.example.com/k.jpg?w=200"] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, images: ["http://cdn.example.com/k.jpg"] }).success).toBe(false);
  });

  it("rejects protocol-relative, script and data urls", () => {
    expect(productInputSchema.safeParse({ ...base, images: ["//evil.example/x.png"] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, images: ["javascript:alert(1)"] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, images: ["data:text/html,<script>"] }).success).toBe(false);
  });

  it("still requires at least one image", () => {
    expect(productInputSchema.safeParse({ ...base, images: [] }).success).toBe(false);
  });
});

// --- session-6 S6-5: carousel slide images carry the same scheme gate -------
describe("carouselSlideInputSchema.image (session-6)", () => {
  const base = { title: "Summer Sale" };

  it("accepts root-relative store paths only (session-7 S7-6)", () => {
    expect(carouselSlideInputSchema.safeParse({ ...base, image: "/images/hero-sale.png" }).success).toBe(true);
    expect(carouselSlideInputSchema.safeParse({ ...base, image: "https://cdn.example.com/hero.jpg" }).success).toBe(false);
  });

  it("rejects data:, javascript: and protocol-relative URLs (CSP img-src 'self' alignment)", () => {
    expect(carouselSlideInputSchema.safeParse({ ...base, image: "data:image/png;base64,AAAA" }).success).toBe(false);
    expect(carouselSlideInputSchema.safeParse({ ...base, image: "javascript:alert(1)" }).success).toBe(false);
    expect(carouselSlideInputSchema.safeParse({ ...base, image: "//evil.example.com/x.png" }).success).toBe(false);
  });
});

// --- session-6 S6-14: bounded spec/tag inputs -------------------------------
function productBase(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "Test Knife",
    slug: "test-knife",
    description: "A very good test knife for chopping test vegetables.",
    categoryId: "cat_kitchen-tools",
    price: 1999,
    sku: "KN-TEST-01",
    stock: 10,
    images: ["/images/knife-1.jpg"],
    ...overrides,
  };
}

describe("productInputSchema.price bounds (session-7 S7-7)", () => {
  it("rejects prices at or above the $1M ceiling (Int32-safe)", () => {
    expect(productInputSchema.safeParse(productBase({ price: 100_000_000 })).success).toBe(true);
    expect(productInputSchema.safeParse(productBase({ price: 100_000_001 })).success).toBe(false);
    expect(productInputSchema.safeParse(productBase({ price: 2_147_483_647 })).success).toBe(false);
  });

  it("bounds compareAtPrice identically", () => {
    expect(productInputSchema.safeParse(productBase({ compareAtPrice: 100_000_000 })).success).toBe(true);
    expect(productInputSchema.safeParse(productBase({ compareAtPrice: 100_000_001 })).success).toBe(false);
  });
});

describe("productInputSchema.specs/tags bounds (session-6)", () => {
  it("rejects spec labels/values above 80 characters", () => {
    const long = "x".repeat(81);
    expect(productInputSchema.safeParse(productBase({ specs: [{ label: "Material", value: "Steel" }] })).success).toBe(true);
    expect(productInputSchema.safeParse(productBase({ specs: [{ label: long, value: "Steel" }] })).success).toBe(false);
    expect(productInputSchema.safeParse(productBase({ specs: [{ label: "Material", value: long }] })).success).toBe(false);
  });

  it("rejects individual tags above 40 characters", () => {
    const long = "x".repeat(41);
    expect(productInputSchema.safeParse(productBase({ tags: ["knife", long] })).success).toBe(false);
    expect(productInputSchema.safeParse(productBase({ tags: ["knife"] })).success).toBe(true);
  });
});

describe("clampSearchTerm (S15-4)", () => {
  it("trims whitespace and caps the query at 100 characters", () => {
    expect(clampSearchTerm("  whisk  ")).toBe("whisk");
    expect(clampSearchTerm("x".repeat(250))).toBe("x".repeat(100));
    expect(clampSearchTerm("x".repeat(100))).toHaveLength(100);
  });

  it("returns an empty string for blank input and keeps non-ASCII intact", () => {
    expect(clampSearchTerm("   ")).toBe("");
    expect(clampSearchTerm("日本語の包丁")).toBe("日本語の包丁");
  });

  it("honors a custom cap", () => {
    expect(clampSearchTerm("abcdefghij", 4)).toBe("abcd");
  });
});

describe("wishlistToggleSchema (S16-2 hoist)", () => {
  it("requires a non-empty productId", () => {
    expect(wishlistToggleSchema.safeParse({ productId: "p1" }).success).toBe(true);
    expect(wishlistToggleSchema.safeParse({ productId: "" }).success).toBe(false);
    expect(wishlistToggleSchema.safeParse({}).success).toBe(false);
  });
});

describe("cartLinePatchSchema (S16-2 hoist)", () => {
  it("keeps the PATCH 0-deletes-line semantics the POST schema forbids", () => {
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 0 }).success).toBe(true);
    expect(cartMutateSchema.safeParse({ productId: "p1", quantity: 0 }).success).toBe(false);
  });

  it("bounds quantity to integer 0..99", () => {
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 99 }).success).toBe(true);
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 100 }).success).toBe(false);
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 1.5 }).success).toBe(false);
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: -1 }).success).toBe(false);
    expect(cartLinePatchSchema.safeParse({ lineId: "", quantity: 1 }).success).toBe(false);
  });
});

describe("couponApplySchema (S16-2 hoist)", () => {
  it("trims and enforces the same 40-char cap as checkoutSchema.couponCode", () => {
    const parsed = couponApplySchema.safeParse({ code: "  WELCOME10  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe("WELCOME10");

    const long = "x".repeat(41);
    const tooLong = couponApplySchema.safeParse({ code: long });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) expect(firstError(tooLong.error)).toBe("That code is too long");
    expect(couponApplySchema.safeParse({ code: "x".repeat(40) }).success).toBe(true);
  });

  it("gives the friendly empty-code message", () => {
    const empty = couponApplySchema.safeParse({ code: "   " });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(firstError(empty.error)).toBe("Enter a coupon code");
  });
});

describe("MAX_CART_QUANTITY single-sourcing (S17-2)", () => {
  it("is 99 and is the ceiling the cart schemas and the clamp share", async () => {
    const { MAX_CART_QUANTITY } = await import("@/lib/cart-quantity");
    expect(MAX_CART_QUANTITY).toBe(99);
    // The schemas interpolate the shared constant, not a retyped literal.
    expect(
      cartMutateSchema.safeParse({ productId: "p1", quantity: MAX_CART_QUANTITY + 1 }).success,
    ).toBe(false);
    expect(
      cartLinePatchSchema.safeParse({ lineId: "l1", quantity: MAX_CART_QUANTITY + 1 }).success,
    ).toBe(false);
  });
});

describe("couponInputSchema free_shipping (session-20 S20-6)", () => {
  it("accepts a free_shipping coupon with value 0 and applies the defaults", () => {
    const parsed = couponInputSchema.safeParse({ code: "FREESHIP", type: "free_shipping", value: 0 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minSubtotal).toBe(0);
      expect(parsed.data.isActive).toBe(true);
      expect(parsed.data.maxRedemptions).toBeNull();
    }
  });

  it("rejects a free_shipping coupon carrying a non-zero value", () => {
    // Positive values hit the free_shipping-specific refinement copy…
    for (const value of [1, 695]) {
      const parsed = couponInputSchema.safeParse({ code: "FREESHIP", type: "free_shipping", value });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.message).toMatch(/free shipping/i);
    }
    // …while a negative value is already caught by the base non-negative bound.
    expect(couponInputSchema.safeParse({ code: "FREESHIP", type: "free_shipping", value: -5 }).success).toBe(false);
  });

  it("keeps the percent and fixed positive bounds (regression guard)", () => {
    const zeroPercent = couponInputSchema.safeParse({ code: "SAVE0", type: "percent", value: 0 });
    expect(zeroPercent.success).toBe(false);
    if (!zeroPercent.success) expect(zeroPercent.error.issues[0]?.message).toMatch(/positive/i);
    const zeroFixed = couponInputSchema.safeParse({ code: "BIG0", type: "fixed", value: 0 });
    expect(zeroFixed.success).toBe(false);
    if (!zeroFixed.success) expect(zeroFixed.error.issues[0]?.message).toMatch(/positive/i);
  });

  it("rejects an unknown type", () => {
    expect(couponInputSchema.safeParse({ code: "ODD", type: "mystery", value: 1 }).success).toBe(false);
  });
});
