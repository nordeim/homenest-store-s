// Session-19 — S19-2 (the S18-1 extraction's unset-defaults scope), and
// S19-5 (the admin coupon-management surface: boundary schema, pure label
// helper, guarded actions).
//
// The addresses pin extends the session-18 contract with the clause the
// pre-extraction checkout block used (the extraction's documented
// "no behavior change" is restored and pinned). The coupon action pins
// follow the session-16 module pattern: `@/lib/db`, `@/lib/auth` and
// `next/cache` are mocked; the boundary under test is the action mapping,
// not the data layer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    coupon: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
import { couponLabel } from "@/lib/coupons";
import { deleteCouponAction, upsertCouponAction } from "@/lib/actions/admin";
import { saveCheckoutAddressInTx, type CheckoutAddressSavingClient } from "@/lib/addresses";
import { couponInputSchema } from "@/lib/validation";

// ---------------------------------------------------------------------------
// S19-2 — the unset targets ONLY the previous defaults (the pre-extraction
// clause; the extraction's "no behavior change" contract restored).
// ---------------------------------------------------------------------------

const DRAFT = {
  fullName: "Jordan Rivera",
  phone: "+1 (512) 555-0133",
  line1: "123 Cedar Lane",
  line2: "",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  country: "United States",
};

function fakeSavingClient(count: number): { client: CheckoutAddressSavingClient; updateMany: ReturnType<typeof vi.fn> } {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const client = {
    address: {
      count: vi.fn().mockResolvedValue(count),
      updateMany,
      create: vi.fn().mockResolvedValue({}),
    },
  } satisfies CheckoutAddressSavingClient;
  return { client, updateMany };
}

describe("saveCheckoutAddressInTx unset scope (S19-2)", () => {
  it("unsets only the DEFAULT rows — where carries userId AND isDefault: true", async () => {
    const { client, updateMany } = fakeSavingClient(3);
    const outcome = await saveCheckoutAddressInTx(client, "user-1", DRAFT);
    expect(outcome).toBe("saved");
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isDefault: true },
      data: { isDefault: false },
    });
  });
});

// ---------------------------------------------------------------------------
// S19-5 — couponInputSchema boundary table.
// ---------------------------------------------------------------------------

describe("couponInputSchema (S19-5)", () => {
  const VALID_PERCENT = { code: "SAVE5", type: "percent", value: 5 } as const;

  it("accepts a minimal percent coupon and applies the defaults", () => {
    const parsed = couponInputSchema.safeParse(VALID_PERCENT);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.description).toBe("");
      expect(parsed.data.minSubtotal).toBe(0);
      expect(parsed.data.isActive).toBe(true);
      expect(parsed.data.expiresAt).toBeNull();
      expect(parsed.data.maxRedemptions).toBeNull();
    }
  });

  it("rejects percent values outside 1..100 with the store copy", () => {
    // Over the ceiling hits the superRefinement's percent-specific copy…
    const over = couponInputSchema.safeParse({ ...VALID_PERCENT, value: 101 });
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.issues[0]?.message).toMatch(/percent/i);
    // …while non-positive values hit the base bound's copy (still rejected).
    for (const value of [0, -5]) {
      const parsed = couponInputSchema.safeParse({ ...VALID_PERCENT, value });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.message).toMatch(/positive/i);
    }
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, value: 100 }).success).toBe(true);
  });

  it("rejects non-positive fixed values but allows large cent amounts", () => {
    expect(couponInputSchema.safeParse({ code: "BIG", type: "fixed", value: 0 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ code: "BIG", type: "fixed", value: -100 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ code: "BIG", type: "fixed", value: 695 }).success).toBe(true);
  });

  it("enforces the code charset and length (letters, digits, dashes; 3-40)", () => {
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, code: "ab" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, code: "a".repeat(41) }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, code: "SAVE 5" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, code: "SAVE-5!" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, code: "save5" }).success).toBe(true);
  });

  it("rejects negative minSubtotal and non-integer values", () => {
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, minSubtotal: -1 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, value: 2.5 }).success).toBe(false);
  });

  it("rejects a zero or negative redemption cap but allows null (unlimited)", () => {
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, maxRedemptions: 0 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, maxRedemptions: -1 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, maxRedemptions: null }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, maxRedemptions: 500 }).success).toBe(true);
  });

  it("accepts a parseable expiry date string or null, rejects garbage", () => {
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, expiresAt: "2026-12-31" }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, expiresAt: "2026-12-31T23:59:59.999Z" }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, expiresAt: null }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, expiresAt: "not-a-date" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, expiresAt: "" }).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(couponInputSchema.safeParse({ ...VALID_PERCENT, type: "percentage" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S19-5 — couponLabel truth table (single-sourced with couponDiscount).
// ---------------------------------------------------------------------------

describe("couponLabel (S19-5)", () => {
  it("formats percent and fixed labels identically to the coupon engine", () => {
    expect(couponLabel("percent", 10)).toBe("10% off");
    expect(couponLabel("percent", 100)).toBe("100% off");
    expect(couponLabel("fixed", 695)).toBe("$6.95 off");
    expect(couponLabel("fixed", 10000)).toBe("$100.00 off");
  });

  it("is the same helper the coupon engine consumes (single-sourced in coupons.ts)", () => {
    // couponDiscount's labels are built by couponLabel — pin the strings stay
    // identical through the engine path (the coupons.test.ts engine pins
    // assert the same strings end-to-end).
    expect(couponLabel("percent", 20)).toBe("20% off");
    expect(couponLabel("fixed", 2000)).toBe("$20.00 off");
  });
});

// ---------------------------------------------------------------------------
// S19-5 — guarded coupon actions (the S8-13 narrowed-mapping pattern).
// ---------------------------------------------------------------------------

const ADMIN_INPUT = {
  code: "save5",
  type: "percent",
  value: 5,
  description: "Five off",
  minSubtotal: 0,
  isActive: true,
  expiresAt: null,
  maxRedemptions: null,
} as const;

function mockAdmin(signedIn: boolean) {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(isAdmin).mockReset();
  vi.mocked(getCurrentUser).mockResolvedValue(signedIn ? ({ id: "admin-1" } as never) : null);
  vi.mocked(isAdmin).mockReturnValue(signedIn);
}

beforeEach(() => {
  vi.mocked(db.coupon.findFirst).mockReset();
  vi.mocked(db.coupon.create).mockReset();
  vi.mocked(db.coupon.update).mockReset();
  vi.mocked(db.coupon.delete).mockReset();
});

describe("upsertCouponAction (S19-5)", () => {
  it("denies a signed-out caller", async () => {
    mockAdmin(false);
    await expect(upsertCouponAction(ADMIN_INPUT)).resolves.toEqual({ ok: false, error: "Unauthorized" });
    expect(db.coupon.findFirst).not.toHaveBeenCalled();
  });

  it("rejects schema-invalid input (percent 101) with the store copy", async () => {
    mockAdmin(true);
    const result = await upsertCouponAction({ ...ADMIN_INPUT, value: 101 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/percent/i);
    expect(db.coupon.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes the code to uppercase and creates (the findActiveCoupon convention)", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.findFirst).mockResolvedValue(null);
    vi.mocked(db.coupon.create).mockResolvedValue({ id: "c1" } as never);
    const result = await upsertCouponAction(ADMIN_INPUT);
    expect(result.ok).toBe(true);
    expect(db.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "SAVE5" }),
    });
  });

  it("maps a pre-checked code clash to the friendly message", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.findFirst).mockResolvedValue({ id: "clash" } as never);
    const result = await upsertCouponAction(ADMIN_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("A coupon with this code already exists.");
    expect(db.coupon.create).not.toHaveBeenCalled();
  });

  it("maps a concurrent P2002 on the unique code to the same friendly message", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.findFirst).mockResolvedValue(null);
    vi.mocked(db.coupon.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await upsertCouponAction(ADMIN_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("A coupon with this code already exists.");
  });

  it("maps a concurrent P2025 (row deleted mid-edit) to the refresh message", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.findFirst).mockResolvedValue(null);
    vi.mocked(db.coupon.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );
    const result = await upsertCouponAction({ ...ADMIN_INPUT, id: "gone" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it("rethrows unknown failures (the S13-2 contract)", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.findFirst).mockResolvedValue(null);
    vi.mocked(db.coupon.create).mockRejectedValue(new Error("db offline"));
    await expect(upsertCouponAction(ADMIN_INPUT)).rejects.toThrow("db offline");
  });
});

describe("deleteCouponAction (S19-5)", () => {
  it("denies a signed-out caller", async () => {
    mockAdmin(false);
    await expect(deleteCouponAction("c1")).resolves.toEqual({ ok: false, error: "Unauthorized" });
    expect(db.coupon.delete).not.toHaveBeenCalled();
  });

  it("rejects a missing id", async () => {
    mockAdmin(true);
    await expect(deleteCouponAction("")).resolves.toMatchObject({ ok: false });
    expect(db.coupon.delete).not.toHaveBeenCalled();
  });

  it("deletes by id and reports success", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.delete).mockResolvedValue({ id: "c1" } as never);
    const result = await deleteCouponAction("c1");
    expect(result.ok).toBe(true);
    expect(db.coupon.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("maps a concurrent P2025 to the refresh message", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );
    const result = await deleteCouponAction("gone");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it("rethrows unknown failures (the S13-2 contract)", async () => {
    mockAdmin(true);
    vi.mocked(db.coupon.delete).mockRejectedValue(new Error("db offline"));
    await expect(deleteCouponAction("c1")).rejects.toThrow("db offline");
  });
});
