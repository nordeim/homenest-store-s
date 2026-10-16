/**
 * Capture the documentation screenshots into docs/screenshots/.
 *
 * Usage: node scripts/capture-screenshots.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000 (a running production or dev server).
 *
 * Desktop shots at 1440x900, mobile shots at 390x844. Admin + account shots
 * sign in with the seeded demo credentials (the login page's quick-fill box
 * is irrelevant here — the script fills the form fields directly).
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;

mkdirSync(OUT, { recursive: true });

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const mobile = { ...devices["iPhone 13"], browserName: "chromium" };

async function shoot(browser, device, name, mode, fn) {
  const context = await browser.newContext({ ...device, baseURL: BASE });
  const page = await context.newPage();
  try {
    await fn(page, context);
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: mode === "full" });
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
  } finally {
    await context.close();
  }
}

async function login(page, email, password) {
  await page.goto("/login");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(admin|account)/, { timeout: 15_000 });
}

/** Deterministic add-to-cart: the header badge must read the given count. */
async function expectBadgeCount(page, count) {
  const badge = page.getByTestId("cart-count");
  await badge.waitFor({ state: "visible", timeout: 15_000 });
  const text = (await badge.textContent())?.trim();
  if (text !== String(count)) {
    throw new Error(`cart-count badge shows "${text}", expected "${count}"`);
  }
}

const browser = await chromium.launch();

// ---------- Public desktop pages ----------
await shoot(browser, desktop, "01-home", "full", async (page) => {
  await page.goto("/");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, desktop, "02-products", "full", async (page) => {
  await page.goto("/products");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, desktop, "03-product-detail", "full", async (page) => {
  await page.goto("/products");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.locator("article a").first().click();
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "04-cart", "full", async (page) => {
  await page.goto("/products");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
  // The add is a fire-and-forget fetch — wait for the badge before the
  // navigation or the goto aborts it and the shot captures the empty cart
  // (session-23: the run-24 capture hit exactly this race).
  await expectBadgeCount(page, 1);
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
});
// Session-23 S23-2 evidence: the coupon-aware free-shipping hint. A
// below-threshold cart shows the progress nag; an applied FREESHIP swaps it
// for the coupon-attributed block (the S21-7 contradiction, resolved).
await shoot(browser, desktop, "04b-cart-coupon-hint", "full", async (page) => {
  await page.goto("/products");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page
    .locator("article")
    .filter({ hasText: "French Rolling Pin & Baking Set" })
    .first()
    .getByRole("button", { name: "Add to Cart" })
    .click();
  await expectBadgeCount(page, 1);
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  await page.getByText("Add $15.01 more for free shipping").waitFor();
  await page.getByLabel("Coupon code").fill("FREESHIP");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByText("Free shipping active — FREESHIP applied at checkout").waitFor();
});
await shoot(browser, desktop, "05-login", "viewport", async (page) => {
  await page.goto("/login");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, desktop, "06-track-order", "full", async (page) => {
  // The protected tracking page (number + email contract).
  await page.goto("/track-order?number=ORD-2026-001&email=demo%40homenestkitchen.com");
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "07-about", "full", async (page) => {
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "08-contact", "full", async (page) => {
  await page.goto("/contact");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, desktop, "09-legal", "full", async (page) => {
  await page.goto("/legal/privacy-policy");
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "10-register", "viewport", async (page) => {
  await page.goto("/register");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, desktop, "11-checkout", "full", async (page) => {
  await page.goto("/products");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.locator("article").first().getByRole("button", { name: "Add to Cart" }).click();
  // The add is a fire-and-forget fetch — wait for the badge before the
  // navigation or the goto aborts it and the shot captures the empty-cart
  // shell at /checkout (session-35: the run-35 capture lost exactly this
  // race and shipped the empty state; the run-36 capture won it — the
  // same fix the 04-cart shot got in session-24).
  await expectBadgeCount(page, 1);
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
});

// ---------- Authenticated desktop pages ----------
await shoot(browser, desktop, "19-account", "full", async (page) => {
  await login(page, "demo@homenestkitchen.com", "Demo1234!");
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "12-admin-dashboard", "full", async (page) => {
  await login(page, "admin@homenestkitchen.com", "Admin123!");
  await page.waitForLoadState("networkidle");
});
for (const [name, path] of [
  ["13-admin-products", "/admin/products"],
  ["14-admin-orders", "/admin/orders"],
  ["15-admin-categories", "/admin/categories"],
  ["15b-admin-coupons", "/admin/coupons"],
  ["16-admin-carousel", "/admin/carousel"],
  ["17-admin-analytics", "/admin/analytics"],
  ["18-admin-settings", "/admin/settings"],
]) {
  await shoot(browser, desktop, name, "full", async (page) => {
    await login(page, "admin@homenestkitchen.com", "Admin123!");
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  });
}

// ---------- Mobile ----------
await shoot(browser, mobile, "20-mobile-home", "viewport", async (page) => {
  await page.goto("/");
  await page.waitForSelector('html[data-hydrated="true"]');
});
await shoot(browser, mobile, "21-mobile-menu-open", "viewport", async (page) => {
  await page.goto("/");
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.getByTestId("mobile-menu-button").click();
  await page.getByTestId("mobile-menu").waitFor();
});
await shoot(browser, mobile, "22-tracking-locked", "viewport", async (page) => {
  // The anti-enumeration contract, visually: a number without its email.
  await page.goto("/track-order?number=ORD-2026-001");
  await page.waitForLoadState("networkidle");
});
await shoot(browser, desktop, "23-checkout-success-locked", "viewport", async (page) => {
  // S3-1 access contract, visually: a guessed sequential order number without
  // its token renders the same not-found shell — no receipt, no PII.
  await page.goto("/checkout/success?order=ORD-2026-001");
  await page.waitForLoadState("networkidle");
});

await browser.close();
console.log(`\nScreenshots written to ${OUT}`);
