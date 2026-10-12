import { test, expect } from "@playwright/test";

test.describe("Core shopping flow", () => {
  test("browse, add to cart, and reach checkout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /HomeNest Kitchen|Elevate Every Meal/i }).first()).toBeVisible();

    await page.getByRole("link", { name: "Shop All" }).first().click();
    await expect(page).toHaveURL(/\/products$/);

    const firstProduct = page.locator("a[href^='/products/']").first();
    await firstProduct.click();
    await expect(page.getByRole("button", { name: /Add to Cart/ })).toBeVisible();

    await page.getByRole("button", { name: /Add to Cart/ }).click();
    await page.getByLabel(/Cart, \d+ items/).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Order Summary")).toBeVisible();

    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  });

  test("search surfaces matching products", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle search" }).click();
    await page.getByPlaceholder(/Search for cookware/).fill("knife");
    await page.getByPlaceholder(/Search for cookware/).press("Enter");
    await expect(page).toHaveURL(/q=knife/);
    await expect(page.getByText(/Results for "knife"/)).toBeVisible();
  });
});

test.describe("Authentication", () => {
  test("signs in with the demo customer account", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Use Customer Demo" }).click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Jordan Rivera" })).toBeVisible();
  });

  test("rejects an incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("WrongPassword1");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/Incorrect password/)).toBeVisible();
  });
});
