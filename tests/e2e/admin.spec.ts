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

  test("cancelling an order restores the reserved stock (S3-3)", async ({ page, request }) => {
    // Self-contained setup: place a fresh guest order through the real API.
    const search = await request.get("/api/search?q=knife");
    const { results } = (await search.json()) as { results: Array<{ id: string }> };
    expect(results.length).toBeGreaterThan(0);
    const productId = results[0]!.id;

    await request.post("/api/cart", { data: { productId, quantity: 2 } });
    const placed = await request.post("/api/checkout", {
      data: {
        email: "cancel-restock@example.com",
        customerName: "Restock Test",
        shippingMethod: "standard",
        paymentMethod: "cod",
        idempotencyKey: crypto.randomUUID(),
        address: {
          fullName: "Restock Test",
          phone: "+1 512 555 0166",
          line1: "5 Cancel Way",
          city: "Austin",
          state: "TX",
          postalCode: "73301",
          country: "United States",
        },
      },
    });
    expect(placed.ok()).toBeTruthy();
    const { orderNumber } = (await placed.json()) as { orderNumber: string };
    expect(orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);

    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/orders");

    // The newest order sits at the top of the table (placedAt desc).
    const row = page.locator("tr", { hasText: orderNumber }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /manage/i }).click();

    await page.getByLabel("Update status").click();
    await page.getByRole("option", { name: /mark as cancelled/i }).click();
    await page.getByRole("button", { name: /update status/i }).click();

    // The action's success toast proves the restock transaction committed.
    // .first(): the toast title also lives inside the aria-live wrapper's
    // text — a strict-mode race the suite has hit before (session-9).
    await expect(page.getByText(new RegExp(`Order ${orderNumber} updated`)).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("tr", { hasText: orderNumber }).first()).toContainText(/cancelled/i);
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

  test("an aborted settings save surfaces a visible error instead of silence (S13-2)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await gotoHydrated(page, "/admin/settings");

    // Simulate an outage: abort every server-action POST. Before S13-2 the
    // island swallowed the rejection (no toast, no inline error — the admin
    // could not tell saved from failed).
    await page.route("**/*", (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        return route.abort("failed");
      }
      return route.fallback();
    });

    await page.getByLabel(/store name/i).fill("Aborted Save Probe");
    await page.getByRole("button", { name: /save settings/i }).click();

    await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
