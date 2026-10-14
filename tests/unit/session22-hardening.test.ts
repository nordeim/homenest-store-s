// Session-22 S22-2 — the coupon engine carries the marketing description, and
// the coupon-apply route resolves a coupon with EXACTLY ONE lookup.
//
// The audit found `/api/coupon/apply` calling `findActiveCoupon` a SECOND time
// solely to read `description` — because `couponDiscount` dropped the field
// `findActiveCoupon` had already fetched. The fix widens `CouponApplication`'s
// ok-branch with `description: string` and the route reads `applied.description`.
// The route-level pin (db.coupon.findUnique called exactly once) is the
// regression guard: a reintroduced second lookup fails it.
//
// DB layer is mocked (the boundary under test is the contract, not the data
// layer); rate-limit budgets are isolated per-test via a unique rightmost
// x-forwarded-for hop (the clientIp contract).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    coupon: { findUnique: vi.fn() },
  },
}));

// The route reads the session via getCurrentUser (auth) and the cart via
// findCartId/getCartSummary — both are module mocks so the route test stays
// focused on the coupon lookup contract.
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

vi.mock("@/lib/cart", () => ({
  findCartId: vi.fn(async () => "cart-1"),
  getCartSummary: vi.fn(async () => ({
    lines: [
      {
        id: "line-1",
        productId: "product-1",
        name: "Damascus Steel Chef Knife Set",
        slug: "damascus-steel-chef-knife-set",
        image: "/images/products/damascus-knife-set.jpg",
        unitPrice: 19999,
        quantity: 1,
        stock: 12,
        lineTotal: 19999,
      },
    ],
    itemCount: 1,
    subtotal: 19999,
  })),
}));

import { applyCouponCode, couponDiscount, type CouponInfo } from "@/lib/coupons";
import { POST as couponApplyPOST } from "@/app/api/coupon/apply/route";
import { db } from "@/lib/db";

const PERCENT: CouponInfo = {
  code: "WELCOME10",
  type: "percent",
  value: 10,
  minSubtotal: 0,
  description: "10% off your first order",
};

const FIXED: CouponInfo = {
  code: "TENOFF",
  type: "fixed",
  value: 1000,
  minSubtotal: 5000,
  description: "$10 off orders over $50",
};

const FREE_SHIP: CouponInfo = {
  code: "FREESHIP",
  type: "free_shipping",
  value: 0,
  minSubtotal: 3000,
  description: "Free standard shipping on orders over $30",
};

function couponRow(info: CouponInfo) {
  return {
    id: `row-${info.code}`,
    code: info.code,
    type: info.type,
    value: info.value,
    minSubtotal: info.minSubtotal,
    description: info.description,
    isActive: true,
    expiresAt: null,
    maxRedemptions: null,
    timesUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function applyRequest(code: string, ip: string) {
  return new Request("http://localhost:3000/api/coupon/apply", {
    method: "POST",
    body: JSON.stringify({ code }),
    headers: {
      "content-type": "application/json",
      // Single hop = the RIGHTMOST hop clientIp resolves — unique per test.
      "x-forwarded-for": ip,
    },
  }) as NextRequest;
}

describe("couponDiscount carries the marketing description (S22-2)", () => {
  it("percent branch", () => {
    const applied = couponDiscount(PERCENT, 19999);
    expect(applied).toEqual({
      ok: true,
      code: "WELCOME10",
      discount: 2000,
      label: "10% off",
      description: "10% off your first order",
    });
  });

  it("fixed branch", () => {
    const applied = couponDiscount(FIXED, 8000);
    expect(applied).toEqual({
      ok: true,
      code: "TENOFF",
      discount: 1000,
      label: "$10.00 off",
      description: "$10 off orders over $50",
    });
  });

  it("free_shipping branch (discount 0 + the flag, description intact)", () => {
    const applied = couponDiscount(FREE_SHIP, 19999);
    expect(applied).toEqual({
      ok: true,
      code: "FREESHIP",
      discount: 0,
      label: "Free shipping",
      freeShipping: true,
      description: "Free standard shipping on orders over $30",
    });
  });
});

describe("applyCouponCode carries the description (S22-2)", () => {
  it("ok-branch passes the looked-up description through", async () => {
    vi.mocked(db.coupon.findUnique).mockReset().mockResolvedValue(couponRow(PERCENT));
    const applied = await applyCouponCode("welcome10", 19999);
    expect(applied).toEqual({
      ok: true,
      code: "WELCOME10",
      discount: 2000,
      label: "10% off",
      description: "10% off your first order",
    });
  });

  it("unknown code stays a typed error (no description)", async () => {
    vi.mocked(db.coupon.findUnique).mockReset().mockResolvedValue(null);
    const applied = await applyCouponCode("NOPE", 19999);
    expect(applied).toEqual({ ok: false, error: "This coupon code is not valid." });
  });
});

describe("POST /api/coupon/apply resolves a coupon with ONE lookup (S22-2)", () => {
  beforeEach(() => {
    vi.mocked(db.coupon.findUnique).mockReset().mockResolvedValue(couponRow(FREE_SHIP));
  });

  it("responds with the description from the widened engine result", async () => {
    const res = await couponApplyPOST(applyRequest("FREESHIP", "203.0.113.10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; description?: string; freeShipping?: true };
    expect(body.ok).toBe(true);
    expect(body.description).toBe("Free standard shipping on orders over $30");
    expect(body.freeShipping).toBe(true);
  });

  it("calls db.coupon.findUnique exactly ONCE (the second-lookup regression pin)", async () => {
    const res = await couponApplyPOST(applyRequest("FREESHIP", "203.0.113.11"));
    expect(res.status).toBe(200);
    expect(db.coupon.findUnique).toHaveBeenCalledTimes(1);
  });
});
