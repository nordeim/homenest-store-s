import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Session-20 S20-6 — the `free_shipping` coupon type end-to-end. The seeded
 * FREESHIP coupon zeroes shipping OUTRIGHT (independent of the spend
 * threshold): the pin cart ($34.99) sits ABOVE the coupon's $30 minimum but
 * BELOW the $50 free-shipping threshold, so without the coupon standard
 * shipping costs $6.95 — the "FREE" assertions are meaningful, not
 * threshold accidents. Pins the full money path: the cart's applied label,
 * the checkout mirror, and the SERVER-derived receipt (the strongest pin —
 * computeOrderMoney's couponFreeShipping override, re-derived in-tx).
 */
test.describe("free_shipping coupon (S20-6)", () => {
  test("FREESHIP zeroes shipping below the spend threshold, through the receipt", async ({ page }) => {
    // Guest cart with a $34.99 product (min $30 met, threshold $50 NOT met).
    await gotoHydrated(page, "/products");
    const card = page.locator("article").filter({ hasText: "French Rolling Pin & Baking Set" }).first();
    await card.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Apply FREESHIP at the cart — the applied block carries the seeded
    // description plus the free_shipping label.
    await gotoHydrated(page, "/cart");
    await page.getByLabel("Coupon code").fill("FREESHIP");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(
      page.getByText("FREESHIP: Free standard shipping on orders over $30 — applied at checkout"),
    ).toBeVisible();
    // The label renders in the applied block AND the success toast — the
    // .first() takes the block (the toast is transient).
    await expect(page.getByText("Free shipping", { exact: true }).first()).toBeVisible();

    // Checkout (the cart hands the coupon over via sessionStorage).
    await page.getByRole("link", { name: "Checkout" }).first().click();
    await expect(page).toHaveURL(/\/checkout/);

    await page.getByLabel("Email").fill("freeship@example.com");
    await page.getByLabel("Full name").fill("Free Ship");
    await page.getByLabel("Street address").fill("9 Shipping Way");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State").fill("TX");
    await page.getByLabel("Postal code").fill("73301");
    await page.getByLabel("Phone").first().fill("+1 512 555 0140");
    // Standard shipping is the default; continue.
    await page.getByRole("button", { name: /Continue/ }).click();

    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry").fill("12/28");
    await page.getByLabel("CVC").fill("123");
    await page.getByRole("button", { name: /Review|Continue/ }).click();

    // Step 3: the coupon is still applied and the SHIPPING ROWS are FREE —
    // pinned on the actual shipping lines (the review card's dl row AND the
    // sticky summary's), not a bare getByText("FREE"), which is a
    // case-insensitive substring match that also hits the coupon label's
    // "Free shipping" — the vacuous pin that let the dropped mirror flag
    // (session-21 S21-3) pass 65/65. The review card renders only at step 3
    // (conditional mount); the summary aside renders on every step.
    await expect(page.getByRole("heading", { name: "Review Your Order" })).toBeVisible();
    await expect(page.getByText(/Coupon FREESHIP — Free shipping/)).toBeVisible();
    const summaryShippingRow = page
      .getByRole("complementary", { name: "Order summary" })
      .locator("dl div", { has: page.getByText("Shipping", { exact: true }) });
    await expect(summaryShippingRow).toHaveCount(1);
    await expect(summaryShippingRow).toContainText("FREE");
    const reviewShippingRow = page
      .locator("section dl div", { has: page.getByText("Shipping", { exact: true }) });
    await expect(reviewShippingRow).toHaveCount(1);
    await expect(reviewShippingRow).toContainText("FREE");
    await page.getByRole("button", { name: /Place Order/ }).click();

    // The SERVER-derived receipt pins the real math (not just the mirror).
    await expect(page).toHaveURL(/\/checkout\/success\?order=ORD-\d{4}-\d{3}&token=/, { timeout: 15_000 });
    const params = new URL(page.url()).searchParams;
    await expect(page.getByRole("heading", { name: /Thank You/i })).toBeVisible();
    const shippingRow = page.locator("dl div", { has: page.getByText("Shipping", { exact: true }) });
    await expect(shippingRow).toContainText("FREE");
    expect(params.get("order")).toMatch(/^ORD-\d{4}-\d{3}$/);
  });

  // Session-23 S23-2 — the cart's free-shipping hint is coupon-aware (the
  // S21-7 deferral resolved). The same pin cart ($34.99, below the $50
  // threshold) shows the progress nag pre-apply; an applied FREESHIP swaps
  // the nag for the coupon-attributed block (shipping is ALREADY free — the
  // "Add $X more" text would contradict the applied block right below it);
  // removing the coupon restores the threshold-based hint.
  test("the cart hint goes coupon-aware: nag → applied → restore", async ({ page }) => {
    await gotoHydrated(page, "/products");
    const card = page.locator("article").filter({ hasText: "French Rolling Pin & Baking Set" }).first();
    await card.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await gotoHydrated(page, "/cart");
    const nag = page.getByText("Add $15.01 more for free shipping");
    await expect(nag).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Progress toward free shipping" })).toBeVisible();

    // Apply FREESHIP — the nag and the progressbar give way to the
    // coupon-attributed block.
    await page.getByLabel("Coupon code").fill("FREESHIP");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("Free shipping active — FREESHIP applied at checkout")).toBeVisible();
    await expect(nag).toHaveCount(0);
    await expect(page.getByRole("progressbar", { name: "Progress toward free shipping" })).toHaveCount(0);

    // Remove — the threshold-based hint returns.
    await page.getByRole("button", { name: "Remove coupon FREESHIP" }).click();
    await expect(nag).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Progress toward free shipping" })).toBeVisible();
    await expect(page.getByText("Free shipping active — FREESHIP applied at checkout")).toHaveCount(0);
  });
});
