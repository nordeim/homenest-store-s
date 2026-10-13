// @vitest-environment jsdom
// Session-19 S19-1 — the QuantityStepper's DEFAULT max comes from the
// single-sourced MAX_CART_QUANTITY, not a retyped literal.
//
// The literal-default drift vector: the component's `max = 99` default
// parameter retyped the S17-2 ceiling. This pin MOCKS the constant to 7 and
// asserts the default-max stepper disables "+" AT 7 — impossible unless the
// default parameter is bound to the imported constant (with the literal the
// "+" at 7 stays enabled and the test fails).
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/cart-quantity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cart-quantity")>();
  return { ...actual, MAX_CART_QUANTITY: 7 };
});

import { QuantityStepper } from "@/components/store/quantity-stepper";

afterEach(() => {
  cleanup();
});

describe("QuantityStepper default max binds MAX_CART_QUANTITY (S19-1)", () => {
  it('disables "+" at the mocked ceiling when max is left at its default', () => {
    render(<QuantityStepper value={7} onChange={() => {}} />);
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    expect(plus).toBeDisabled();
  });

  it('keeps "+" enabled below the mocked ceiling', () => {
    render(<QuantityStepper value={6} onChange={() => {}} />);
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    expect(plus).toBeEnabled();
    fireEvent.click(plus);
  });

  it("an explicitly passed max still wins (the purchase-panel contract)", () => {
    render(<QuantityStepper value={3} max={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });
});
