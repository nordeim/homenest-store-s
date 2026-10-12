import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Mobile navigation — the Tailwind v4 regression guard.
 *
 * The bug this spec pins: Tailwind v4 changed the generation order of
 * display utilities, so JS-toggling the `hidden` class on an element that
 * also carries `flex`/`block` silently fails (tailwindlabs/tailwindcss#15884,
 * #18653; preflight's `[hidden]` now also carries !important).
 *
 * The implementation contract (src/components/store/mobile-nav.tsx):
 * the panel is conditionally MOUNTED via React state and never toggles a
 * display utility. These tests fail if anyone reintroduces a hidden-vs-flex
 * toggle: open -> panel visible with nav links; navigate works; the green
 * close button hides it; the hamburger re-opens it.
 */
test.describe("mobile navigation (Tailwind v4 regression guard)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, "/");
  });

  test("hamburger opens the push-down panel with search and nav links", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-menu-button");
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    const panel = page.getByTestId("mobile-menu");
    await expect(panel).toBeVisible();

    // The reference panel: a search field + the five nav links.
    await expect(panel.getByRole("searchbox", { name: "Search products" })).toBeVisible();
    for (const label of ["Home", "Products", "Track Order", "About", "Contact"]) {
      await expect(panel.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("nav links navigate and the panel closes afterwards", async ({ page }) => {
    await page.getByTestId("mobile-menu-button").click();
    const panel = page.getByTestId("mobile-menu");
    await panel.getByRole("link", { name: "Products", exact: true }).click();
    await expect(page).toHaveURL(/\/products/);
    // Route change closes the panel (mobile-nav effect).
    await expect(page.getByTestId("mobile-menu")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
  });

  test("the green close button hides the panel and it can be reopened", async ({ page }) => {
    await page.getByTestId("mobile-menu-button").click();
    const panel = page.getByTestId("mobile-menu");
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByTestId("mobile-menu")).toHaveCount(0);

    // Reopen — proves the toggle is state-driven, not a one-shot class flip.
    await page.getByTestId("mobile-menu-button").click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();
  });

  test("the active route is highlighted with the primary pill", async ({ page }) => {
    await gotoHydrated(page, "/products");
    await page.getByTestId("mobile-menu-button").click();
    const panel = page.getByTestId("mobile-menu");
    const activeLink = panel.getByRole("link", { name: "Products", exact: true });
    await expect(activeLink).toHaveAttribute("aria-current", "page");
    await expect(activeLink).toHaveClass(/bg-primary/);
  });

  test("panel works on the reference's core routes (track-order)", async ({ page }) => {
    await page.getByTestId("mobile-menu-button").click();
    await page.getByTestId("mobile-menu").getByRole("link", { name: "Track Order" }).click();
    await expect(page).toHaveURL(/\/track-order/);
    await expect(page.getByRole("heading", { name: "Track Your Order" })).toBeVisible();
  });

  test("body scroll locks while the panel is open", async ({ page }) => {
    const menuButton = page.getByTestId("mobile-menu-button");
    await menuButton.click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();
    const locked = await page.evaluate(() => document.body.style.overflow === "hidden");
    if (!locked) {
      // The provider locks scroll for the panel; if it ever regresses, fail loudly.
      throw new Error("body scroll lock missing while mobile menu is open");
    }
    await page.getByTestId("mobile-menu").getByRole("button", { name: "Close menu" }).click();
    await expect
      .poll(async () => page.evaluate(() => document.body.style.overflow === ""))
      .toBe(true);
  });
});
