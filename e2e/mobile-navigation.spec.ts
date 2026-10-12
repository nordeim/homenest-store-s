import { test, expect, devices } from "@playwright/test";

// Regression coverage for the Tailwind v4 "hidden vs. flex" cascade-order bug
// (tailwindlabs/tailwindcss#15884, #18653): the mobile drawer must be driven by
// transform/opacity, not by toggling the `hidden` utility, so it has to be both
// invisible-and-non-interactive when closed AND visible-and-interactive when open.
test.use({ ...devices["iPhone 13"] });

test.describe("Mobile navigation drawer", () => {
  test("is closed by default and hidden from interaction", async ({ page }) => {
    await page.goto("/");
    const drawer = page.locator("#mobile-nav-drawer");
    await expect(drawer).toHaveCount(1);
    // Off-canvas: translated out of view, so its nav links must not be clickable.
    await expect(page.getByRole("link", { name: "Shop All" }).first()).not.toBeInViewport();
  });

  test("opens on hamburger tap and reveals working navigation links", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const drawer = page.locator("#mobile-nav-drawer");
    await expect(drawer).toBeVisible();

    const shopAllLink = drawer.getByRole("link", { name: "Shop All" });
    await expect(shopAllLink).toBeVisible();
    await expect(shopAllLink).toBeInViewport();

    await shopAllLink.click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("closes when the close button is pressed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#mobile-nav-drawer")).toBeVisible();

    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("link", { name: "Shop All" }).first()).not.toBeInViewport();
  });

  test("closes when the backdrop is tapped", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#mobile-nav-drawer")).toBeVisible();

    // Tap far right edge of the screen, outside the drawer panel.
    await page.mouse.click(390, 400);
    await expect(page.getByRole("link", { name: "Shop All" }).first()).not.toBeInViewport();
  });
});
