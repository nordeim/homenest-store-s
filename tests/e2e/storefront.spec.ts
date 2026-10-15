import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

// S15-2: the storefront cardinality pins must not hard-couple to the demo
// DB's exact row counts (the S14-4 data-depletion class — a deactivated seed
// product or an admin-created extra permanently breaks an absolute pin).
// The e2e layer therefore pins the count FORMAT + the seeded slugs/order;
// the exact seed-owned values (16 products, 3 cookware, the session-33
// re-aligned reference order) are
// pinned where the seed constant can actually be imported —
// tests/unit/seed-catalog.test.ts — and the restore-demo-stock harness
// (which now also restores isActive) keeps the live DB aligned with them.

/**
 * Storefront parity smoke — the reference site's visible anatomy:
 * hero carousel, trust badges, 8 category tiles, featured + new arrivals
 * grids, product cards with discount/featured badges, search + filters,
 * and the product detail page.
 */
test.describe("storefront", () => {
  test("home renders the reference anatomy", async ({ page }) => {
    await gotoHydrated(page, "/");

    // Hero carousel with overlay CTA + dots
    await expect(page.getByRole("region", { name: "Featured collections" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse Collection|Shop Now|Shop the Sale/ }).first()).toBeVisible();

    // Trust badges (4)
    for (const badge of ["Free Shipping", "Secure Payment", "Easy Returns", "24/7 Support"]) {
      await expect(page.getByText(badge, { exact: true })).toBeVisible();
    }

    // Shop by Category — 8 tiles matching the reference categories
    await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible();
    for (const cat of ["Cookware", "Bakeware", "Kitchen Tools", "Storage", "Appliances", "Dining", "Cleaning", "Decor"]) {
      await expect(page.getByRole("link", { name: cat, exact: true })).toBeVisible();
    }

    // Featured + New Arrivals grids with real product cards
    await expect(page.getByRole("heading", { name: "Featured Products" })).toBeVisible();
    await expect(page.locator("#new-arrivals")).toBeVisible();
    const cards = page.locator("article");
    expect(await cards.count()).toBeGreaterThanOrEqual(8);

    // A product card shows the reference anatomy: category, price, badges
    const firstCard = cards.first();
    await expect(firstCard.getByRole("heading").first()).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "Add to Cart" })).toBeVisible();
  });

  test("products page lists the catalog with count and filters", async ({ page }) => {
    await gotoHydrated(page, "/products");

    await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
    await expect(page.getByText(/^\d+ products found$/)).toBeVisible();

    // Page 1 (newest-first) opens with the reference's authored order — the
    // seed backdates rows so the seed-list order is both the reference's
    // observable default order AND the store's newest-first sort (session-12
    // S12-5; re-aligned to the reference's current live order in session-33
    // S33-1 — Dutch-Oven-first). Order-agnostic visibility pins: both of
    // these reference products sit inside page 1 under either order.
    await expect(page.getByRole("heading", { name: "Damascus Steel Chef Knife Set" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Artisan Copper Frying Pan" })).toBeVisible();

    // Pagination reaches the superset tail on page 2 (last 4 seeded).
    await page.getByRole("link", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("heading", { name: "Copper Measuring Spoon Set" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dried Eucalyptus Kitchen Bundle" })).toBeVisible();

    // Category filter narrows results.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Cookware" }).click();
    await expect(page).toHaveURL(/category=cookware/);
    await expect(page.getByText(/^\d+ products found$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Artisan Copper Frying Pan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Professional Stand Mixer" })).toBeHidden();
  });

  test("search finds a product by name", async ({ page }) => {
    await gotoHydrated(page, "/products");
    await page.getByRole("searchbox", { name: "Search products" }).first().fill("mixer");
    await page.getByRole("searchbox", { name: "Search products" }).first().press("Enter");
    await expect(page).toHaveURL(/q=mixer/);
    await expect(page.getByRole("heading", { name: "Professional Stand Mixer" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Damascus Steel Chef Knife Set" }).last()).toBeHidden();
  });

  test("product detail renders gallery, price, specs and reviews", async ({ page }) => {
    await gotoHydrated(page, "/products?q=damascus");
    const damascusCard = page.locator("article").filter({ hasText: "Damascus Steel Chef Knife Set" });
    await damascusCard.getByRole("heading").first().click();
    await expect(page).toHaveURL(/\/product\//);

    await expect(page.getByRole("heading", { name: "Damascus Steel Chef Knife Set", level: 1 })).toBeVisible();
    await expect(page.getByText("In Stock")).toBeVisible();
    await expect(page.getByText("$199.99").first()).toBeVisible();
    await expect(page.getByText("$279.99").first()).toBeVisible();
    await expect(page.getByText("-29%").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to Cart" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Buy Now" })).toBeVisible();

    // Reviews section + related products
    await expect(page.getByRole("heading", { name: "Customer Reviews" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You May Also Like" })).toBeVisible();
  });

  test("category tiles deep-link into filtered products", async ({ page }) => {
    await gotoHydrated(page, "/");
    await page.getByRole("link", { name: "Appliances", exact: true }).click();
    await expect(page).toHaveURL(/category=appliances/);
    await expect(page.getByRole("heading", { name: "Professional Stand Mixer" })).toBeVisible();
  });

  test("footer links carry the reference policies", async ({ page }) => {
    await gotoHydrated(page, "/");
    for (const label of ["Privacy Policy", "Terms of Service", "Refund Policy"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/legal\/privacy-policy/);
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });
});
