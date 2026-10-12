import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Auth — demo-account login (success + wrong password), register
 * validation, and the account dashboard. Credentials come from the seed:
 *   admin@homenestkitchen.com / Admin123!
 *   demo@homenestkitchen.com / Demo1234!
 */
test.describe("auth", () => {
  test("login page renders the reference card", async ({ page }) => {
    await gotoHydrated(page, "/login");
    await expect(page.getByRole("heading", { name: "Welcome to HomeNest Kitchen" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create an account/i })).toBeVisible();
  });

  test("demo customer can sign in and sees the account dashboard", async ({ page }) => {
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("Demo1234!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  });

  test("wrong password shows an inline error, never a redirect", async ({ page }) => {
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("WrongPassword1!");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.locator("div[role=alert]").first();
    await expect(alert).toBeVisible();
    // Uniform message — the UI must not reveal whether the account exists.
    await expect(alert).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown email gets the same uniform error (no enumeration)", async ({ page }) => {
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("nobody@nowhere.test");
    await page.getByLabel("Password").fill("Whatever123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("div[role=alert]").first()).toContainText(/invalid email or password/i);
  });

  test("register rejects a short password via the server action", async ({ page }) => {
    await gotoHydrated(page, "/register");
    await page.getByLabel("Name").fill("New User");
    await page.getByLabel("Email").fill("newuser@example.com");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: /Create account/i }).click();

    // The server action's Zod validation renders the inline alert; the URL stays.
    const alert = page.locator("div[role=alert]").first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/at least 8 characters/i);
    await expect(page).toHaveURL(/\/register/);
  });

  test("account requires a session (redirects to login)", async ({ page }) => {
    await gotoHydrated(page, "/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("guest cart merges into the account cart on login (S3-4)", async ({ page }) => {
    // As a guest: add the first catalog product to the cart.
    await gotoHydrated(page, "/products");
    const productName = (await page.locator("article").first().locator("h3").innerText()).trim();
    await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Sign in — the server action must claim the guest cart right here.
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("Demo1234!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    // The account cart already contains the guest's item — no re-add needed.
    await gotoHydrated(page, "/cart");
    await expect(page.getByRole("heading", { name: "Shopping Cart" })).toBeVisible();
    await expect(page.getByRole("link", { name: productName }).first()).toBeVisible();
  });
});
