import { describe, expect, it } from "vitest";

import { discountPercent, formatMoney, parseDollarsToCents } from "@/lib/money";

describe("formatMoney", () => {
  it("formats integer cents as USD", () => {
    expect(formatMoney(19999)).toBe("$199.99");
    expect(formatMoney(5)).toBe("$0.05");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(123456)).toBe("$1,234.56");
  });

  it("handles negative amounts", () => {
    expect(formatMoney(-1999)).toBe("-$19.99");
  });

  it("rounds fractional input", () => {
    expect(formatMoney(199.6)).toBe("$2.00");
  });
});

describe("parseDollarsToCents", () => {
  it("parses plain dollar strings", () => {
    expect(parseDollarsToCents("199.99")).toBe(19999);
    expect(parseDollarsToCents("5")).toBe(500);
    expect(parseDollarsToCents("0.05")).toBe(5);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseDollarsToCents("$1,299.50")).toBe(129950);
    expect(parseDollarsToCents(" $42 ")).toBe(4200);
  });

  it("accepts at most two decimal places", () => {
    expect(parseDollarsToCents("1.999")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("-5")).toBeNull();
  });
});

describe("discountPercent", () => {
  it("computes the whole-percent discount", () => {
    expect(discountPercent(19999, 27999)).toBe(-29);
    expect(discountPercent(8999, 12999)).toBe(-31);
    expect(discountPercent(34999, 42999)).toBe(-19);
  });

  it("returns null when there is nothing to compare", () => {
    expect(discountPercent(19999, null)).toBeNull();
    expect(discountPercent(19999, 0)).toBeNull();
    expect(discountPercent(19999, 19999)).toBeNull();
    expect(discountPercent(25000, 19999)).toBeNull();
  });
});
