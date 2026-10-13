import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Admin coupon management (session-19 S19-5) — the full CRUD loop plus the
 * redemption surface it controls: the seeded coupons render, a new coupon
 * can be created, APPLIED at the cart, deactivated (the same code then
 * rejects) and deleted. The spec cleans up after itself: the created coupon
 * is deleted at the end, leaving the seed data as found.
 */
const CODE = "SESSION5";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill("admin@homenestkitchen.com");
  await page.getByLabel("Password").fill("Admin123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(account|admin)/, { timeout: 10_000 });
}

test.describe("admin coupon management", () => {
  test("create → apply → deactivate → reject → delete", async ({ page }) => {
    await loginAsAdmin(page);

    // The management surface lists the seeded coupons.
    await gotoHydrated(page, "/admin/coupons");
    await expect(page.getByRole("heading", { name: "Coupons" })).toBeVisible();
    for (const seeded of ["WELCOME10", "SAVE20", "FREESHIP"]) {
      await expect(page.getByRole("heading", { name: seeded, exact: true })).toBeVisible();
    }

    // Create a fresh 5% coupon through the dialog.
    await page.getByRole("button", { name: "Add Coupon" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Code").fill(CODE);
    await dialog.getByLabel("Percent off (1–100)").fill("5");
    await dialog.getByLabel("Description").fill("Session 19 e2e coupon");
    await dialog.getByRole("button", { name: "Create Coupon" }).click();
    await expect(page.getByRole("heading", { name: CODE, exact: true })).toBeVisible();
    await expect(page.getByText("5% off")).toBeVisible();

    // The new code redeems at the cart (the admin's own cart is a real cart).
    await gotoHydrated(page, "/products");
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await gotoHydrated(page, "/cart");
    await page.getByLabel("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    const applied = page.getByText(`${CODE}: Session 19 e2e coupon — applied at checkout`);
    await expect(applied).toBeVisible();

    // Deactivate it — the SAME code now rejects at the same surface.
    await gotoHydrated(page, "/admin/coupons");
    await page.getByRole("button", { name: `Deactivate coupon ${CODE}` }).click();
    await expect(page.getByText("Coupon deactivated")).toBeVisible();
    await expect(page.getByRole("heading", { name: CODE, exact: true })).toBeVisible();
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible();

    await gotoHydrated(page, "/cart");
    await page.getByLabel("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("#cart-coupon-error")).toContainText(/not valid/i);

    // Delete it — the spec leaves the seed data as found.
    await gotoHydrated(page, "/admin/coupons");
    await page.getByRole("button", { name: `Delete coupon ${CODE}` }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Coupon deleted")).toBeVisible();
    await expect(page.getByRole("heading", { name: CODE, exact: true })).toHaveCount(0);
    for (const seeded of ["WELCOME10", "SAVE20", "FREESHIP"]) {
      await expect(page.getByRole("heading", { name: seeded, exact: true })).toBeVisible();
    }
  });
});
