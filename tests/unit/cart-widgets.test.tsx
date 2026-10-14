// @vitest-environment jsdom
// Session-23 S23-2 — the cart's free-shipping hint goes coupon-aware (S21-7).
//
// The cart page's threshold-progress hint ("Add $15.01 more for free
// shipping") used to be server-rendered from the settings threshold only and
// could coexist with an applied FREESHIP below the threshold — contradictory
// UX on a money-adjacent surface. CartSummaryWidgets lifts the applied-coupon
// state from the CouponBox through a callback and renders the hint in THREE
// states: (a) applied free_shipping coupon → the coupon-attributed block
// (no progressbar — shipping is already free); (b) subtotal ≥ threshold →
// "You've unlocked free shipping!"; (c) otherwise → progress bar + the
// "Add $X more" nag. A percent/fixed coupon leaves (b)/(c) unchanged.
//
// These tests drive the REAL CouponBox through stubbed fetch (the S14-1
// toaster test is the component-test precedent: per-file jsdom docblock,
// testing-library, the provider rendered for the toast context).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CartSummaryWidgets } from "@/app/(storefront)/cart/cart-widgets";
import { Toaster } from "@/components/ui/toaster";

const FREESHIP_PAYLOAD = {
  ok: true,
  code: "FREESHIP",
  discount: 0,
  label: "Free shipping",
  description: "Free standard shipping on orders over $30",
  freeShipping: true,
} as const;

const WELCOME10_PAYLOAD = {
  ok: true,
  code: "WELCOME10",
  discount: 349,
  label: "10% off",
  description: "10% off your order",
} as const;

/** Stub the global fetch to answer /api/coupon/apply with the given payload. */
function stubApply(payload: object) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => payload }) as unknown as Response),
  );
}

async function applyCode(code: string) {
  fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

function renderWidgets(subtotalCents = 3499, thresholdCents = 5000) {
  return render(
    <Toaster>
      <CartSummaryWidgets subtotalCents={subtotalCents} thresholdCents={thresholdCents} />
    </Toaster>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("CartSummaryWidgets (S23-2 coupon-aware free-shipping hint)", () => {
  it("renders the progress hint below the threshold with no coupon", () => {
    renderWidgets(3499, 5000);
    // The amount lives in an inner span (testing-library matches direct text
    // nodes only) — pin the nag via its direct-text tail and the amount span.
    expect(screen.getByText("more for free shipping", { exact: false })).toBeVisible();
    expect(screen.getByText("$15.01")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Progress toward free shipping" })).toBeInTheDocument();
  });

  it("renders the unlocked state at the threshold with no coupon", () => {
    renderWidgets(5000, 5000);
    expect(screen.getByText("You've unlocked free shipping!")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("more for free shipping", { exact: false })).not.toBeInTheDocument();
  });

  it("a percent coupon leaves the threshold-based hint unchanged", async () => {
    stubApply(WELCOME10_PAYLOAD);
    renderWidgets(3499, 5000);
    await applyCode("WELCOME10");
    // The applied block renders (the description flows through)…
    await waitFor(() => {
      expect(screen.getByText(": 10% off your order — applied at checkout", { exact: false })).toBeVisible();
    });
    // …and the hint still speaks the threshold truth (the discount does not
    // touch the free-shipping threshold pre-discount).
    expect(screen.getByText("more for free shipping", { exact: false })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Progress toward free shipping" })).toBeInTheDocument();
  });

  it("an applied free_shipping coupon swaps the hint to the coupon-attributed block", async () => {
    stubApply(FREESHIP_PAYLOAD);
    renderWidgets(3499, 5000);
    expect(screen.getByText("more for free shipping", { exact: false })).toBeVisible();

    await applyCode("FREESHIP");
    // The coupon-attributed block replaces BOTH the nag and the progressbar —
    // shipping is already free, "Add $X more" would contradict it.
    await waitFor(() => {
      expect(screen.getByText("Free shipping active", { exact: false })).toBeVisible();
    });
    expect(screen.getByText("Free shipping active — FREESHIP applied at checkout", { exact: false })).toBeVisible();
    expect(screen.queryByText("more for free shipping", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("removing the coupon restores the threshold-based hint", async () => {
    stubApply(FREESHIP_PAYLOAD);
    renderWidgets(3499, 5000);
    await applyCode("FREESHIP");
    await waitFor(() => {
      expect(screen.getByText("Free shipping active", { exact: false })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove coupon FREESHIP" }));
    expect(await screen.findByText("more for free shipping", { exact: false })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Progress toward free shipping" })).toBeInTheDocument();
    expect(screen.queryByText("Free shipping active", { exact: false })).not.toBeInTheDocument();
  });
});
