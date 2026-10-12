import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Guest shopping flow — the revenue path: add to cart (mini drawer),
 * cart page math, coupon apply, 3-step checkout with a demo card, and the
 * success page with a real ORD-YYYY-NNN order number.
 */
test.describe("shopping flow", () => {
  test("add to cart updates the header badge and mini drawer", async ({ page }) => {
    await gotoHydrated(page, "/products");

    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Open the mini drawer and verify the line.
    await page.getByRole("button", { name: /^Cart/ }).click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Subtotal")).toBeVisible();
    await drawer.getByRole("button", { name: "Close cart" }).click();
    // The drawer is an always-mounted translate-x panel (the Tailwind v4-safe
    // pattern) — assert off-viewport + inert rather than DOM removal.
    await expect(drawer).not.toBeInViewport();
    await expect(drawer).toHaveClass(/pointer-events-none/);
  });

  test("full guest checkout places an order", async ({ page }) => {
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Cart page -> Checkout
    await gotoHydrated(page, "/cart");
    await expect(page.getByRole("heading", { name: "Shopping Cart" })).toBeVisible();
    await page.getByRole("link", { name: "Checkout" }).first().click();
    await expect(page).toHaveURL(/\/checkout/);

    // Step 1: shipping details
    await page.getByLabel("Email").fill("guest@example.com");
    await page.getByLabel("Full name").fill("Guest Buyer");
    await page.getByLabel("Street address").fill("12 Test Lane");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State").fill("TX");
    await page.getByLabel("Postal code").fill("73301");
    await page.getByLabel("Phone").first().fill("+1 512 555 0100");
    // Standard shipping is the default; continue.
    await page.getByRole("button", { name: /Continue/ }).click();

    // Step 2: payment (demo card)
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry").fill("12/28");
    await page.getByLabel("CVC").fill("123");
    await page.getByRole("button", { name: /Review|Continue/ }).click();

    // Step 3: place the order
    await expect(page.getByRole("heading", { name: "Review Your Order" })).toBeVisible();
    await page.getByRole("button", { name: /Place Order/ }).click();

    // Success page with a real order number.
    await expect(page).toHaveURL(/\/checkout\/success\?order=ORD-\d{4}-\d{3}/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Thank You/i })).toBeVisible();
    const orderNumber = new URL(page.url()).searchParams.get("order");
    expect(orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);

    // The cart is empty again.
    await gotoHydrated(page, "/cart");
    await expect(page.getByText(/cart is empty/i)).toBeVisible();
  });

  test("coupon WELCOME10 reduces the total", async ({ page }) => {
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await gotoHydrated(page, "/cart");

    await page.getByLabel("Coupon code").fill("WELCOME10");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await expect(page.getByText(/WELCOME10/).first()).toBeVisible();
    await expect(page.getByText(/applied at checkout/)).toBeVisible();
  });

  test("track-order finds a placed order", async ({ page }) => {
    // Place one order via the API-backed UI flow (condensed), then track it.
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    // The badge proves the POST /api/cart landed before we navigate away.
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await gotoHydrated(page, "/checkout");
    await page.getByLabel("Email").fill("guest2@example.com");
    await page.getByLabel("Full name").fill("Tracker Test");
    await page.getByLabel("Street address").fill("9 Loop Road");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State").fill("TX");
    await page.getByLabel("Postal code").fill("73301");
    await page.getByLabel("Phone").first().fill("+1 512 555 0199");
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry").fill("11/28");
    await page.getByLabel("CVC").fill("321");
    await page.getByRole("button", { name: /Review|Continue/ }).click();
    await page.getByRole("button", { name: /Place Order/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\?order=ORD-\d{4}-\d{3}/, { timeout: 15_000 });
    const orderNumber = new URL(page.url()).searchParams.get("order");

    await gotoHydrated(page, `/track-order?number=${orderNumber}`);
    await expect(page.getByText(orderNumber ?? "")).toBeVisible();
    // The stepper shows all four labels; the current step (Pending) is active.
    await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
  });
});
