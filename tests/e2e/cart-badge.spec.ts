import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Cart badge freshness (session-9 S9-1): the header badge must show the
 * server-computed count on a FRESH full page load. The context used to
 * initialize `cartCount` at 0 (never null), so the `liveCount ?? serverProp`
 * fallback in StoreChrome never fired and every hard load rendered badge-less
 * until the next in-page mutation — the server-computed count was dead code.
 */
test.describe("cart badge", () => {
  test("survives a full page reload with the server-rendered count", async ({ page }) => {
    await gotoHydrated(page, "/products");

    // Add one product as a guest (context cart persists across reloads).
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // FULL reload — the badge must come back from the server-rendered count.
    await page.reload();
    await expect(page.getByTestId("cart-count")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("keeps the count across a client-side navigation into the cart", async ({ page }) => {
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Open the drawer and use its View Cart link (client-side navigation) —
    // the badge must not blank out mid-journey.
    await page.getByRole("button", { name: /^Cart/ }).click();
    await page.getByRole("link", { name: "View Cart" }).click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 15_000 });
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });
});
