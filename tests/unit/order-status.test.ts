import { describe, expect, it } from "vitest";

import {
  canTransitionOrderStatus,
  shouldRestockOnStatusChange,
} from "@/lib/order-status";

describe("canTransitionOrderStatus", () => {
  it("allows forward workflow transitions", () => {
    expect(canTransitionOrderStatus("pending", "processing")).toBe(true);
    expect(canTransitionOrderStatus("processing", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "delivered")).toBe(true);
    expect(canTransitionOrderStatus("pending", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("processing", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "cancelled")).toBe(true);
  });

  it("treats cancelled as terminal — no reopening", () => {
    expect(canTransitionOrderStatus("cancelled", "pending")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "processing")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "delivered")).toBe(false);
  });

  it("treats delivered as terminal — no going back", () => {
    expect(canTransitionOrderStatus("delivered", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("delivered", "cancelled")).toBe(false);
  });

  it("rejects same-status no-ops and unknown statuses", () => {
    expect(canTransitionOrderStatus("pending", "pending")).toBe(false);
    expect(canTransitionOrderStatus("delivered", "delivered")).toBe(false);
    expect(canTransitionOrderStatus("unknown", "pending")).toBe(false);
    expect(canTransitionOrderStatus("pending", "unknown")).toBe(false);
  });
});

describe("shouldRestockOnStatusChange", () => {
  it("restocks exactly when an order transitions into cancelled", () => {
    expect(shouldRestockOnStatusChange("pending", "cancelled")).toBe(true);
    expect(shouldRestockOnStatusChange("processing", "cancelled")).toBe(true);
    expect(shouldRestockOnStatusChange("shipped", "cancelled")).toBe(true);
  });

  it("never restocks on other transitions", () => {
    expect(shouldRestockOnStatusChange("pending", "processing")).toBe(false);
    expect(shouldRestockOnStatusChange("processing", "shipped")).toBe(false);
    expect(shouldRestockOnStatusChange("shipped", "delivered")).toBe(false);
  });

  it("never restocks an already-cancelled order (idempotent cancel)", () => {
    expect(shouldRestockOnStatusChange("cancelled", "cancelled")).toBe(false);
  });
});
