import { describe, expect, it } from "vitest";

import {
  addressSchema,
  cartMutateSchema,
  checkoutSchema,
  contactSchema,
  firstError,
  loginSchema,
  registerSchema,
  reviewSchema,
  trackOrderSchema,
  carouselSlideInputSchema,
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
