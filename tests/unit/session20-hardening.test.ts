// Session-20 — S20-2 (the narrow coupon active-toggle action) and the
// S20-6 engine increment (the `free_shipping` coupon type + the completed
// atomic redemption guard).
//
// The action pins follow the session-19 module pattern: `@/lib/db`,
// `@/lib/auth` and `next/cache` are mocked; the boundary under test is the
// action mapping, not the data layer. The F1 contract under test: the
// toggle writes ONLY `isActive` — never the row's other fields (the
// session-19 toggle round-tripped a full rendered snapshot, silently
// reverting concurrent edits and renormalizing stored expiries).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    coupon: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { couponDiscount, couponLabel, couponRedemptionFilter } from "@/lib/coupons";
import { toggleCouponActiveAction } from "@/lib/actions/admin";

const ADMIN = { id: "admin-1", email: "admin@homenestkitchen.com", name: "Admin", phone: null, role: "admin" };
const CUSTOMER = { id: "user-1", email: "demo@homenestkitchen.com", name: "Demo", phone: null, role: "customer" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(ADMIN);
  vi.mocked(isAdmin).mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// S20-2 — the narrow toggle: writes ONLY isActive (the toggleProductActiveAction
// precedent), P2025 narrowed, unknown rethrown.
// ---------------------------------------------------------------------------

describe("toggleCouponActiveAction (S20-2)", () => {
  it("denies a non-admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(CUSTOMER);
    vi.mocked(isAdmin).mockReturnValue(false);
    const result = await toggleCouponActiveAction("coupon-1", false);
    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(db.coupon.update).not.toHaveBeenCalled();
  });

  it("denies an anonymous caller", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(isAdmin).mockReturnValue(false);
    const result = await toggleCouponActiveAction("coupon-1", false);
    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(db.coupon.update).not.toHaveBeenCalled();
  });

  it("rejects an empty id or a non-boolean target without touching the db", async () => {
    expect(await toggleCouponActiveAction("", false)).toEqual({ ok: false, error: "Invalid request." });
    expect(await toggleCouponActiveAction("coupon-1", "no" as unknown as boolean)).toEqual({
      ok: false,
      error: "Invalid request.",
    });
    expect(db.coupon.update).not.toHaveBeenCalled();
  });

  it("writes ONLY isActive — the F1 lost-update contract", async () => {
    vi.mocked(db.coupon.update).mockResolvedValue({ id: "coupon-1" } as never);
    const result = await toggleCouponActiveAction("coupon-1", false);
    expect(result).toEqual({ ok: true });
    expect(db.coupon.update).toHaveBeenCalledTimes(1);
    const args = vi.mocked(db.coupon.update).mock.calls[0]![0];
    expect(args.where).toEqual({ id: "coupon-1" });
    expect(args.data).toEqual({ isActive: false });
    expect(vi.mocked(db.coupon.update).mock.calls[0]!.length).toBe(1);
  });

  it("maps a concurrent delete (P2025) to the friendly message", async () => {
    vi.mocked(db.coupon.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("gone", { code: "P2025", clientVersion: "6" }),
    );
    const result = await toggleCouponActiveAction("coupon-1", true);
    expect(result).toEqual({ ok: false, error: "Coupon not found. Refresh the list and try again." });
  });

  it("rethrows unknown errors (the S13-2 contract)", async () => {
    vi.mocked(db.coupon.update).mockRejectedValue(new Error("db outage"));
    await expect(toggleCouponActiveAction("coupon-1", true)).rejects.toThrow("db outage");
  });
});

// ---------------------------------------------------------------------------
// S20-6 — couponRedemptionFilter: the completed atomic redemption guard.
// The checkout in-tx increment must refuse a coupon deactivated between the
// in-tx read and the increment (count === 0 → 409 → rollback) — so the
// where-clause composition carries `isActive: true` ALWAYS, plus the cap.
// ---------------------------------------------------------------------------

describe("couponRedemptionFilter (S20-6 / audit I4)", () => {
  it("always carries isActive: true next to the cap clause", () => {
    expect(couponRedemptionFilter("WELCOME10", 500)).toEqual({
      code: "WELCOME10",
      isActive: true,
      timesUsed: { lt: 500 },
    });
  });

  it("omits the cap clause for an uncapped (null) coupon but keeps the active guard", () => {
    expect(couponRedemptionFilter("FREESHIP", null)).toEqual({
      code: "FREESHIP",
      isActive: true,
    });
  });
});

// ---------------------------------------------------------------------------
// S20-6 — the free_shipping coupon type (the engine branch).
// ---------------------------------------------------------------------------

describe("free_shipping coupon type (S20-6 / audit I1)", () => {
  const FREE_SHIP = {
    code: "FREESHIP",
    type: "free_shipping",
    value: 0,
    minSubtotal: 3000,
    description: "Free standard shipping on orders over $30",
  };

  it("labels the coupon without a dollar/percent value", () => {
    expect(couponLabel("free_shipping", 0)).toBe("Free shipping");
  });

  it("applies a ZERO merchandise discount and flags freeShipping", () => {
    const applied = couponDiscount(FREE_SHIP, 19999);
    expect(applied).toEqual({
      ok: true,
      code: "FREESHIP",
      discount: 0,
      label: "Free shipping",
      freeShipping: true,
    });
  });

  it("still enforces the minimum subtotal", () => {
    const applied = couponDiscount(FREE_SHIP, 2999);
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.error).toMatch(/minimum subtotal of \$30\.00/);
  });
});
