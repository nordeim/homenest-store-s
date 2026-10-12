import { describe, expect, it } from "vitest";
import { findCoupon } from "./coupons";

describe("findCoupon", () => {
  it("finds an active coupon case-insensitively", () => {
    expect(findCoupon("welcome10")?.code).toBe("WELCOME10");
    expect(findCoupon("WELCOME10")?.code).toBe("WELCOME10");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(findCoupon("  SAVE20  ")?.code).toBe("SAVE20");
  });

  it("returns undefined for an unknown code", () => {
    expect(findCoupon("NOT-A-REAL-CODE")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(findCoupon("")).toBeUndefined();
  });
});
