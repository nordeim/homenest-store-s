import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Review submission flow (session-8 S8-12): the write path — validation,
 * row create, transactional aggregate growth (S8-2), revalidate — had no
 * flow coverage at all; this spec pins the happy path end-to-end.
 */
test.describe("product reviews", () => {
  test("a visitor can submit a review and see it published below", async ({ page }) => {
    await gotoHydrated(page, "/products?q=damascus");
    const damascusCard = page.locator("article").filter({ hasText: "Damascus Steel Chef Knife Set" });
    await damascusCard.getByRole("heading").first().click();
    await expect(page).toHaveURL(/\/product\//, { timeout: 10_000 });

    const title = `E2E review ${Date.now()}`;
    await page.getByLabel("Your name").fill("E2E Reviewer");
    await page.getByRole("radio", { name: "4 stars" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Your review").fill("Solid heft, beautiful handle, and the edge is impressively even out of the box.");
    await page.getByRole("button", { name: /Submit Review/i }).click();

    // The success toast fires, then the server-rendered list refreshes with
    // the new row.
    await expect(page.getByText("Thanks for your review!").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  });

  test("rejects a too-short comment with an inline error", async ({ page }) => {
    await gotoHydrated(page, "/products?q=copper");
    const copperCard = page.locator("article").filter({ hasText: "Artisan Copper Frying Pan" });
    await copperCard.getByRole("heading").first().click();
    await expect(page).toHaveURL(/\/product\//, { timeout: 10_000 });

    await page.getByLabel("Your name").fill("E2E Reviewer");
    await page.getByLabel("Your review").fill("short");
    // Native minLength (10) blocks submission client-side; force the request
    // past it so the SERVER-side Zod boundary answers with the inline alert.
    await page.getByLabel("Your review").evaluate((el) => {
      if (el instanceof HTMLTextAreaElement) el.minLength = 0;
    });
    await page.getByRole("button", { name: /Submit Review/i }).click();
    // The Zod boundary (reviewSchema min 10 chars) answers with an inline
    // alert — no toast, no row. (The page can carry other alert roles — pin
    // the exact boundary copy.)
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible({ timeout: 10_000 });
  });
});
