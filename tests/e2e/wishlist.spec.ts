import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Wishlist flows (session-8 S8-6/S8-12): hearts toggle into the guest
 * wishlist, the page lists the saved items (bounded read), and "Add All to
 * Cart" lands everything in ONE bulk request instead of a limiter-fighting
 * sequential loop.
 */
test.describe("wishlist", () => {
  test("hearts toggle, the page lists items, and Add All bulk-adds to the cart", async ({ page }) => {
    await gotoHydrated(page, "/products");

    // Add the first two products via their wishlist hearts (labels name the
    // product — session-7 S7-13).
    const hearts = page.getByRole("button", { name: /to wishlist$/ });
    const first = hearts.nth(0);
    const second = hearts.nth(1);
    const firstName = (await first.getAttribute("aria-label")) ?? "";
    const secondName = (await second.getAttribute("aria-label")) ?? "";
    expect(firstName).not.toBe("");
    expect(secondName).not.toBe("");
    await first.click();
    await expect(page.getByText("Added to wishlist")).toBeVisible({ timeout: 10_000 });
    await second.click();
    await expect(page.getByText("Added to wishlist").nth(1)).toBeVisible({ timeout: 10_000 });

    // The wishlist page lists exactly the two saved items.
    await gotoHydrated(page, "/wishlist");
    await expect(page.getByText(/2 saved items?/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Add All to Cart/i })).toBeEnabled();

    // One bulk request → both lines in the cart → routed to /cart.
    await page.getByRole("button", { name: /Add All to Cart/i }).click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 15_000 });
    await expect(page.getByText(/2 items?/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("removing a heart takes the item back out of the wishlist", async ({ page }) => {
    await gotoHydrated(page, "/products");
    const heart = page.getByRole("button", { name: /to wishlist$/ }).first();
    const label = (await heart.getAttribute("aria-label")) ?? "";
    await heart.click();
    await expect(page.getByText("Added to wishlist")).toBeVisible({ timeout: 10_000 });

    await gotoHydrated(page, "/wishlist");
    await expect(page.getByText(/1 saved item/)).toBeVisible({ timeout: 10_000 });

    // Toggle the same product's heart again → removed.
    await gotoHydrated(page, "/products");
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await expect(page.getByText("Removed from wishlist")).toBeVisible({ timeout: 10_000 });

    await gotoHydrated(page, "/wishlist");
    await expect(page.getByText(/wishlist is empty/i)).toBeVisible({ timeout: 10_000 });
  });
});
