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

  test("first login CLAIMS the guest cart — a second device sees the same items (S7-1)", async ({
    browser,
  }) => {
    // A DEDICATED fresh account keeps this deterministic under parallel
    // workers: no pre-existing cart can shadow the first-login claim path.
    // Device A shops as a guest (guest cart token cookie minted), then
    // registers. The user has NO pre-existing cart, so this exercises the
    // safeCreateCart P2002 path: the guest row wins the token collision and
    // MUST be claimed (userId set), not merely returned.
    const email = `s7-claim-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const deviceA = await browser.newContext();
    const pageA = await deviceA.newPage();
    await gotoHydrated(pageA, "/products");
    const productName = (await pageA.locator("article").first().locator("h3").innerText()).trim();
    await pageA.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
    await expect(pageA.getByTestId("cart-count")).toHaveText("1");

    await gotoHydrated(pageA, "/register");
    await pageA.getByLabel("Name").fill("S7 Claim Check");
    await pageA.getByLabel("Email").fill(email);
    await pageA.getByLabel("Password").fill("ClaimCheck1!");
    await pageA.getByRole("button", { name: /Create account/i }).click();
    await expect(pageA).toHaveURL(/\/account/, { timeout: 10_000 });

    // Device B: a FRESH context (no cookies) signing in as the same user must
    // land on the claimed cart. If the claim regressed, getOrCreateCart would
    // find no cart for the userId and mint a fresh empty one instead.
    const deviceB = await browser.newContext();
    const pageB = await deviceB.newPage();
    await gotoHydrated(pageB, "/login");
    await pageB.getByLabel("Email").fill(email);
    await pageB.getByLabel("Password").fill("ClaimCheck1!");
    await pageB.getByRole("button", { name: "Sign in" }).click();
    await expect(pageB).toHaveURL(/\/account/, { timeout: 10_000 });

    await gotoHydrated(pageB, "/cart");
    await expect(pageB.getByRole("heading", { name: "Shopping Cart" })).toBeVisible();
    await expect(pageB.getByRole("link", { name: productName }).first()).toBeVisible();

    await deviceA.close();
    await deviceB.close();
  });

  test("guest wishlist merges into the account at registration (S10-4 wiring)", async ({ page }) => {
    // Guest hearts two products, then registers a fresh account. The merge tx
    // plans through planWishlistMerge (dedupe + cap truncation) and upserts
    // only plan.toAdd — this pins the WIRING end-to-end (the pure plan is
    // unit-pinned in session10-hardening.test.ts).
    await gotoHydrated(page, "/products");
    const hearts = page.getByRole("button", { name: /to wishlist$/ });
    const firstProduct = ((await hearts.nth(0).getAttribute("aria-label")) ?? "").replace(
      /^Add (.*) to wishlist$/,
      "$1",
    );
    await hearts.nth(0).click();
    await expect(page.getByText("Added to wishlist").first()).toBeVisible({ timeout: 10_000 });
    const secondProduct = ((await hearts.nth(1).getAttribute("aria-label")) ?? "").replace(
      /^Add (.*) to wishlist$/,
      "$1",
    );
    await hearts.nth(1).click();
    await expect(page.getByText("Added to wishlist").first()).toBeVisible({ timeout: 10_000 });

    const email = `s12-wishlist-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    await gotoHydrated(page, "/register");
    await page.getByLabel("Name").fill("S12 Wishlist Merge");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("MergeCheck1!");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    // Both guest hearts survive into the account wishlist.
    await gotoHydrated(page, "/wishlist");
    await expect(page.getByText(/2 saved items?/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: firstProduct }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: secondProduct }).first()).toBeVisible();
  });

  test("the production login page ships no demo credentials in its scripts (S13-1)", async ({
    page,
  }) => {
    // S13-1's regression guard: the quick-fill box is hidden in production
    // builds, and since session 13 the credential STRINGS must not even
    // reach the client — neither in the page HTML (the RSC payload included)
    // nor in any referenced script chunk.
    const response = await page.goto("/login");
    const html = (await response?.text()) ?? "";
    await page.waitForSelector('html[data-hydrated="true"]', { timeout: 20_000 });

    const scriptUrls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]"))
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => src.startsWith(window.location.origin)),
    );
    expect(scriptUrls.length).toBeGreaterThan(0);

    const bodies = await Promise.all(
      scriptUrls.map((src) => page.request.get(src).then((r) => r.text())),
    );
    for (const secret of ["Admin123!", "Demo1234!"]) {
      expect(html).not.toContain(secret);
      for (const body of bodies) {
        expect(body).not.toContain(secret);
      }
    }
  });

  test("profile edits persist through updateProfileAction and Sign Out ends the session (S14-3)", async ({
    page,
  }) => {
    // C4's wiring pin: the account profile form → updateProfileAction →
    // persisted name, then logoutAction → signed-out header. The seed name is
    // restored at the end so the demo account stays pristine (the seed's
    // `update: {}` policy never re-resets the name).
    const seedName = "Jordan Rivera";
    await gotoHydrated(page, "/login");
    await page.getByLabel("Email").fill("demo@homenestkitchen.com");
    await page.getByLabel("Password").fill("Demo1234!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    // Profile is the default tab. Edit the display name and save.
    const nameInput = page.getByLabel("Full name");
    await expect(nameInput).toHaveValue(seedName);
    await nameInput.fill("Jordan Rivera Edited");
    await page.getByRole("button", { name: "Save Changes" }).click();

    // The success toast confirms the action ran (Radix toast + auto-dismiss).
    await expect(page.getByText("Profile updated")).toBeVisible({ timeout: 10_000 });

    // The persisted name survives a full reload (server truth, not local state).
    await gotoHydrated(page, "/account");
    await expect(page.getByLabel("Full name")).toHaveValue("Jordan Rivera Edited");

    // Restore the seed name so the demo account stays pristine.
    await page.getByLabel("Full name").fill(seedName);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Profile updated")).toBeVisible({ timeout: 10_000 });

    // Sign Out → the session ends and the header offers Sign in again.
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await gotoHydrated(page, "/");
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
  });
});
