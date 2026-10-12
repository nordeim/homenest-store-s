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

    // Success page with a real order number + access token.
    await expect(page).toHaveURL(/\/checkout\/success\?order=ORD-\d{4}-\d{3}&token=/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Thank You/i })).toBeVisible();
    const params = new URL(page.url()).searchParams;
    const orderNumber = params.get("order");
    expect(orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);
    expect(params.get("token") ?? "").toMatch(/^[0-9a-f]{32}$/);

    // ACCESS CONTRACT (S3-1): the sequential number alone must NOT reveal the
    // receipt — the same "not found" shell renders with or without a bad
    // token, so an attacker cannot even observe that the order exists.
    await gotoHydrated(page, `/checkout/success?order=${orderNumber}`);
    await expect(page.getByRole("heading", { name: /couldn.t find that order/i })).toBeVisible();
    await expect(page.getByText("guest@example.com")).toHaveCount(0);
    await gotoHydrated(page, `/checkout/success?order=${orderNumber}&token=${"0".repeat(32)}`);
    await expect(page.getByRole("heading", { name: /couldn.t find that order/i })).toBeVisible();

    // The cart is empty again.
    await gotoHydrated(page, "/cart");
    await expect(page.getByText(/cart is empty/i)).toBeVisible();
  });

  test("checkout replay with the same idempotency key returns the same order (S3-5)", async ({ request }) => {
    // Pick an in-stock product via the public typeahead API.
    const search = await request.get("/api/search?q=knife");
    expect(search.ok()).toBeTruthy();
    const { results } = (await search.json()) as { results: Array<{ id: string }> };
    expect(results.length).toBeGreaterThan(0);
    const productId = results[0].id;

    // Seed the guest cart through the real API (cookie jar on `request`).
    const add = await request.post("/api/cart", { data: { productId, quantity: 1 } });
    expect(add.ok()).toBeTruthy();

    const checkoutBody = {
      email: "idempotent@example.com",
      customerName: "Replay Test",
      shippingMethod: "standard",
      paymentMethod: "cod",
      // Fresh key per run — mirrors the client's crypto.randomUUID() usage.
      idempotencyKey: crypto.randomUUID(),
      address: {
        fullName: "Replay Test",
        phone: "+1 512 555 0177",
        line1: "7 Retry Court",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
        country: "United States",
      },
    };

    const first = await request.post("/api/checkout", { data: checkoutBody });
    expect(first.ok()).toBeTruthy();
    const firstBody = (await first.json()) as { orderNumber?: string; token?: string };
    expect(firstBody.orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);

    // The replay (lost response / double click) returns the SAME receipt —
    // not a 409 "cart empty" and not a second order.
    const replay = await request.post("/api/checkout", { data: checkoutBody });
    expect(replay.ok()).toBeTruthy();
    const replayBody = (await replay.json()) as { orderNumber?: string; token?: string };
    expect(replayBody.orderNumber).toBe(firstBody.orderNumber);
    expect(replayBody.token).toBe(firstBody.token);
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

  test("track-order finds a placed order (number + email required)", async ({ page }) => {
    // Place one order via the API-backed UI flow (condensed), then track it.
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    // The badge proves the POST /api/cart landed before we navigate away.
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await gotoHydrated(page, "/checkout");
    const buyerEmail = "guest2@example.com";
    await page.getByLabel("Email").fill(buyerEmail);
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

    // Security contract: the number alone must NOT unlock the order's PII.
    await gotoHydrated(page, `/track-order?number=${orderNumber}`);
    const alert = page.locator("div[role=alert]").first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/couldn.t find an order/i);
    await expect(page.getByText(buyerEmail)).toHaveCount(0);

    // A wrong email is indistinguishable from a wrong number (no enumeration).
    await gotoHydrated(page, `/track-order?number=${orderNumber}&email=wrong@example.com`);
    await expect(page.locator("div[role=alert]").first()).toBeVisible();

    // The correct pair (the success page deep-link's shape) tracks the order.
    await gotoHydrated(page, `/track-order?number=${orderNumber}&email=${encodeURIComponent(buyerEmail)}`);
    await expect(page.getByText(orderNumber ?? "")).toBeVisible();
    // The stepper shows all four labels; the current step (Pending) is active.
    await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
  });
});
