import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Admin — the role gate keeps customers out; the seeded admin account gets
 * the full back office (dashboard KPIs, products, orders).
 */
const ADMIN = { email: "admin@homenestkitchen.com", password: "Admin123!" };

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(account|admin)/, { timeout: 10_000 });
}

test.describe("admin back office", () => {
  test("a customer account cannot open /admin", async ({ page }) => {
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("Demo1234!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    await gotoHydrated(page, "/admin");
    await expect(page.getByText(/admin access required/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeHidden();
  });

  test("admin sign-in lands on the dashboard with KPIs", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin");
    await expect(page.getByRole("heading", { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible();
  });

  test("products manager lists seeded products", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/products");
    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /add product/i })).toBeVisible();
    // The table paginates 10/page — search pins the reference product.
    const search = page.getByLabel("Search products by name");
    await search.fill("Damascus");
    search.press("Enter");
    await expect(page.getByText("Damascus Steel Chef Knife Set").first()).toBeVisible();
  });

  test("orders manager lists orders and opens management", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();

    const manageButtons = page.getByRole("button", { name: /manage/i });
    if (await manageButtons.first().isVisible()) {
      await manageButtons.first().click();
      // The management dialog carries status + tracking affordances.
      await expect(page.getByText(/status/i).first()).toBeVisible();
    } else {
      await expect(page.getByText(/no orders/i)).toBeVisible();
    }
  });

  test("carousel manager lists the seeded hero slides", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/carousel");
    await expect(page.getByText("New Arrivals").first()).toBeVisible();
    await expect(page.getByText("Elevate Your Kitchen").first()).toBeVisible();
    await expect(page.getByText("Sale Up to 40% Off").first()).toBeVisible();
  });

  test("settings manager loads the seeded store values", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/settings");
    const emailInput = page.getByLabel(/contact email/i);
    await expect(emailInput).toHaveValue(/homenest\.com/);
  });
});
