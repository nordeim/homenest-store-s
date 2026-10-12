import { describe, expect, it } from "vitest";

import { formatDateTime, orderStatusBadgeClass, slugify, statusStepIndex } from "@/lib/format";

describe("orderStatusBadgeClass", () => {
  it("maps every known status to a pill palette", () => {
    expect(orderStatusBadgeClass("pending")).toContain("amber");
    expect(orderStatusBadgeClass("processing")).toContain("blue");
    expect(orderStatusBadgeClass("shipped")).toContain("violet");
    expect(orderStatusBadgeClass("delivered")).toContain("emerald");
    expect(orderStatusBadgeClass("cancelled")).toContain("red");
  });

  it("falls back to neutral for unknown statuses", () => {
    expect(orderStatusBadgeClass("mystery")).toContain("stone");
  });
});

describe("statusStepIndex", () => {
  it("maps the 4-step tracking timeline", () => {
    expect(statusStepIndex("pending")).toBe(0);
    expect(statusStepIndex("processing")).toBe(1);
    expect(statusStepIndex("shipped")).toBe(2);
    expect(statusStepIndex("delivered")).toBe(3);
  });

  it("treats cancelled as pending-position (banner replaces the stepper)", () => {
    expect(statusStepIndex("cancelled")).toBe(0);
  });
});

describe("slugify", () => {
  it("slugifies product names", () => {
    expect(slugify("Damascus Steel Chef Knife Set")).toBe("damascus-steel-chef-knife-set");
    expect(slugify("  Enameled  Cast-Iron Dutch Oven! ")).toBe("enameled-cast-iron-dutch-oven");
    expect(slugify("Copper 2qt Sauce Pan")).toBe("copper-2qt-sauce-pan");
  });

  it("strips non-alphanumerics", () => {
    expect(slugify("Salt & Pepper")).toBe("salt-pepper");
  });
});

describe("formatDateTime", () => {
  it("formats a placed-at timestamp readably", () => {
    const out = formatDateTime(new Date("2026-02-14T15:30:00Z"));
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Feb/);
  });
});
