import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Address-book defaulting (session-8 S8-1): the FIRST address saved through
 * the account UI becomes the default and actually prefills checkout; any
 * later address can be promoted with the per-card "Set as default" control.
 * Uses a dedicated fresh account so prior runs cannot skew the book.
 */
test.describe("account address defaulting", () => {
  test("first saved address is default and prefills checkout (S8-1)", async ({ page }) => {
    const email = `s8-addr-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    await gotoHydrated(page, "/register");
    await page.getByLabel("Name").fill("S8 Default Check");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Default123!");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    // Save the first address through the account dialog.
    await gotoHydrated(page, "/account?tab=addresses");
    await page.getByRole("button", { name: /Add Address/i }).click();
    await page.getByLabel("Label").fill("Home");
    await page.getByLabel("Full name").fill("S8 Default Check");
    await page.getByLabel("Street address").fill("17 Carousel Way");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State").fill("TX");
    await page.getByLabel("ZIP code").fill("73301");
    await page.getByLabel("Phone").fill("+1 512 555 0177");
    await page.getByRole("button", { name: /Save Address/i }).click();
    await expect(page.getByRole("button", { name: /Add Address/i })).toBeVisible({ timeout: 10_000 });

    // The card renders the Default badge (the S7-8 single-default invariant
    // now covers the account write path).
    await expect(page.getByText("Default", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("17 Carousel Way")).toBeVisible();

    // Checkout redirects to /cart while the cart is empty — drop one item in
    // so the shipping step renders and the prefill can be asserted.
    await gotoHydrated(page, "/products");
    await page.getByRole("button", { name: /Add to cart/i }).first().click();
    await expect(page.locator('[data-testid="cart-count"]')).not.toHaveText(/^0$/, { timeout: 10_000 });

    // Checkout prefills the shipping form from the default address.
    await gotoHydrated(page, "/checkout");
    await expect(page.getByLabel("Street address")).toHaveValue("17 Carousel Way", { timeout: 10_000 });
    await expect(page.getByLabel("Full name")).toHaveValue("S8 Default Check");
  });

  test("Set as default promotes another address (badge moves)", async ({ page }) => {
    const email = `s8-addr2-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    await gotoHydrated(page, "/register");
    await page.getByLabel("Name").fill("S8 Promote Check");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Promote123!");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    await gotoHydrated(page, "/account?tab=addresses");
    const addAddress = async (label: string, line1: string) => {
      await page.getByRole("button", { name: /Add Address/i }).click();
      await page.getByLabel("Label").fill(label);
      await page.getByLabel("Full name").fill("S8 Promote Check");
      await page.getByLabel("Street address").fill(line1);
      await page.getByLabel("City").fill("Austin");
      await page.getByLabel("State").fill("TX");
      await page.getByLabel("ZIP code").fill("73301");
      await page.getByLabel("Phone").fill("+1 512 555 0188");
      await page.getByRole("button", { name: /Save Address/i }).click();
      await expect(page.getByText(line1)).toBeVisible({ timeout: 10_000 });
    };
    await addAddress("Home", "1 First Street");
    await addAddress("Office", "2 Second Street");

    // The first address was auto-defaulted; only the Office card carries the
    // promote control (the control names the card's LABEL, not the street).
    await expect(page.getByText("Default", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Set Office as the default address/i })).toBeVisible();
    await page.getByRole("button", { name: /Set Office as the default address/i }).click();

    // The badge MOVES: exactly one "Default" badge remains, now on the Office
    // card, and the Home card gained a promote control instead.
    await expect(page.getByText("2 Second Street")).toBeVisible();
    await expect(page.getByRole("button", { name: /Set Home as the default address/i })).toBeVisible({
      timeout: 10_000,
    });
    const badges = await page.getByText("Default", { exact: true }).count();
    expect(badges).toBe(1);

    // And checkout prefill follows the promoted address.
    await gotoHydrated(page, "/products");
    await page.getByRole("button", { name: /Add to cart/i }).first().click();
    await expect(page.locator('[data-testid="cart-count"]')).not.toHaveText(/^0$/, { timeout: 10_000 });
    await gotoHydrated(page, "/checkout");
    await expect(page.getByLabel("Street address")).toHaveValue("2 Second Street", { timeout: 10_000 });
  });
});
