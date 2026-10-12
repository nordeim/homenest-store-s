import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, initials } from "./format";

describe("formatCurrency", () => {
  it("formats whole numbers with two decimal places and default $ symbol", () => {
    expect(formatCurrency(89)).toBe("$89.00");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(19.999)).toBe("$20.00");
  });

  it("supports a custom currency symbol", () => {
    expect(formatCurrency(10, "€")).toBe("€10.00");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("formatDate", () => {
  it("formats an ISO date into a human readable string", () => {
    expect(formatDate("2025-11-18T00:00:00.000Z")).toMatch(/Nov/);
  });

  it("returns the original string when given an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("initials", () => {
  it("builds initials from a two-word name", () => {
    expect(initials("Jordan Rivera")).toBe("JR");
  });

  it("builds initials from a single word name", () => {
    expect(initials("Cher")).toBe("C");
  });

  it("ignores extra whitespace and extra name parts", () => {
    expect(initials("  Mary   Jane Watson  ")).toBe("MJ");
  });
});
