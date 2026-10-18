// S51-1 (session 51) — the seeded coupons' deterministic display order.
//
// Finding: the seed's coupon loop created its three rows within ~1ms of each
// other (observed: WELCOME10 .090Z, SAVE20 .091Z, FREESHIP .091Z on the same
// seed run), and /admin/coupons lists them `orderBy: { createdAt: "desc" }`
// with SQLite's millisecond-precision DateTime strings — a same-millisecond
// tie has no deterministic tie-break, so the card grid order flipped
// run-to-run against an otherwise identical database (run 52's 15b screenshot
// rendered SAVE20-first vs the committed FREESHIP-first raster — an 11,876
// pixel content diff, the cards genuinely in swapped grid positions). The
// product catalog has had the fix since session-12 (productSeedCreatedAt);
// the coupons never got it.
//
// The pin: couponSeedCreatedAt gives the seed list the same contract as
// productSeedCreatedAt — the FIRST-listed row is the newest, timestamps
// strictly descend along the list, one full minute apart so no two rows can
// ever tie — and the COUPONS array is authored in the display order the
// admin surface has shipped since its session-19 introduction
// (FREESHIP → SAVE20 → WELCOME10, the run-30..51 raster class).
import { describe, expect, it } from "vitest";

import { couponSeedCreatedAt } from "@/lib/seed-policy";
import { COUPONS } from "../../prisma/seed";

describe("couponSeedCreatedAt (S51-1)", () => {
  const base = new Date("2026-10-18T00:00:00.000Z");

  it("assigns the FIRST-listed coupon (the admin grid's first card) the newest timestamp", () => {
    expect(couponSeedCreatedAt(0, base).getTime()).toBe(base.getTime());
  });

  it("is strictly descending along the seed list (later listings are older)", () => {
    for (let i = 1; i < COUPONS.length; i++) {
      expect(couponSeedCreatedAt(i, base).getTime()).toBeLessThan(
        couponSeedCreatedAt(i - 1, base).getTime(),
      );
    }
  });

  it("spaces timestamps a full minute apart so no two rows can tie at SQLite's ms precision", () => {
    for (let i = 1; i < COUPONS.length; i++) {
      expect(
        couponSeedCreatedAt(i - 1, base).getTime() - couponSeedCreatedAt(i, base).getTime(),
      ).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("rejects a negative or non-integer index (the productSeedCreatedAt contract)", () => {
    expect(() => couponSeedCreatedAt(-1, base)).toThrow(/non-negative integer/);
    expect(() => couponSeedCreatedAt(1.5, base)).toThrow(/non-negative integer/);
  });
});

describe("the seeded coupon list order (S51-1)", () => {
  it("is authored in the admin display order — FREESHIP, SAVE20, WELCOME10", () => {
    // The array order IS the `createdAt: desc` display order under
    // couponSeedCreatedAt (first-listed = newest). This is the card order
    // the admin coupons page has shipped since session-19 and that the
    // 15b screenshot pins — reordering the array reorders the grid.
    expect(COUPONS.map((c) => c.code)).toEqual(["FREESHIP", "SAVE20", "WELCOME10"]);
  });

  it("keeps the three seeded lifecycle shapes the storefront pins assume", () => {
    const byCode = new Map(COUPONS.map((c) => [c.code, c]));
    expect(byCode.get("WELCOME10")).toMatchObject({ type: "percent", value: 10, maxRedemptions: null });
    expect(byCode.get("SAVE20")).toMatchObject({ type: "percent", value: 20, maxRedemptions: 500 });
    expect(byCode.get("FREESHIP")).toMatchObject({ type: "free_shipping", value: 0, maxRedemptions: null });
  });
});
