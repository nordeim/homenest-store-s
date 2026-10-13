import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Admin coupon management (session-19 S19-5) — the full CRUD loop plus the
 * redemption surface it controls: the seeded coupons render, a new coupon
 * can be created, APPLIED at the cart, deactivated (the same code then
 * rejects) and deleted. The spec cleans up after itself: the created coupon
 * is deleted at the end, leaving the seed data as found.
 *
 * Session-20 S20-1 (isolation hardening — the run-20 suite failure): the
 * admin cart is DURABLE shared DB state, so this spec
 *   1. seeds its cart line through the API (one deterministic POST; the
 *      session-19 shape clicked Add-to-Cart and pinned an absolute badge
 *      "1", which Playwright's actionability re-dispatch could double-fire
 *      and any pre-existing cart content broke),
 *   2. deletes any leftover SESSION5 from a previously aborted run before
 *      creating (the code-clash P2002 would fail the create step),
 *   3. restores the cart line to its pre-spec quantity at the end (delete
 *      when it was absent), leaving the durable cart as found.
 *
 * Session-21 S21-1 (the API seeding made cookie-correct — the run-22 suite
 * failure): the per-test `request` fixture is a fully ISOLATED cookie jar —
 * it does NOT share the browser context's cookies — and the production
 * session cookie is `Secure`, which a plain-HTTP API client refuses to send
 * even when present. The original S20-1 shape therefore acted as a GUEST on
 * every request-fixture call: the seeded line landed on a throwaway guest
 * cart while the /cart page (the admin's own cart) stayed empty and the
 * coupon box never rendered. It only ever passed on a DB whose durable
 * admin cart already had content (the empty-cart failure was masked). The
 * fix reads the session cookie from the browser context and sends it
 * explicitly on every admin-identity call below.
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
  test("create → apply → deactivate → reject → delete", async ({ page, request, context }) => {
    await loginAsAdmin(page);

    // S21-1: the isolated request fixture never sees the browser context's
    // `Secure` session cookie — send it explicitly on admin-identity calls
    // (verified: with the header the POST lands on the admin's own cart;
    // without it, on a throwaway guest cart).
    const session = (await context.cookies()).find((c) => c.name === "homenest_session");
    expect(session, "admin session cookie must exist after login").toBeTruthy();
    const adminIdentity = { headers: { cookie: `homenest_session=${session!.value}` } };

    // The management surface lists the seeded coupons.
    await gotoHydrated(page, "/admin/coupons");
    await expect(page.getByRole("heading", { name: "Coupons" })).toBeVisible();
    for (const seeded of ["WELCOME10", "SAVE20", "FREESHIP"]) {
      await expect(page.getByRole("heading", { name: seeded, exact: true })).toBeVisible();
    }

    // S20-1 self-healing setup: a previously failed run may have left
    // SESSION5 behind — remove it through the same confirm flow so the
    // create below starts from a clean slate.
    const leftoverDelete = page.getByRole("button", { name: `Delete coupon ${CODE}` });
    if (await leftoverDelete.isVisible().catch(() => false)) {
      await leftoverDelete.click();
      const confirm = page.getByRole("dialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Delete", exact: true }).click();
      // .first(): the toast title also lives inside the aria-live wrapper —
      // the session-9 strict-mode race (the admin.spec precedent).
      await expect(page.getByText("Coupon deleted").first()).toBeVisible();
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

    // S20-1: seed the admin's cart through the API. The request fixture is
    // identity-isolated — the explicit session-cookie header (S21-1) is what
    // makes this the admin's own cart rather than a throwaway guest cart.
    // Snapshot the target product's pre-spec quantity so the cleanup can
    // restore it exactly.
    const search = await request.get("/api/search?q=knife");
    const { results } = (await search.json()) as { results: Array<{ id: string; name: string }> };
    expect(results.length).toBeGreaterThan(0);
    const product = results[0]!;

    const summaryBefore = await request.get("/api/cart-summary", adminIdentity);
    const before = (await summaryBefore.json()) as {
      lines: Array<{ productId: string; quantity: number }>;
    };
    const preQuantity = before.lines.find((l) => l.productId === product.id)?.quantity ?? 0;

    const added = await request.post("/api/cart", { ...adminIdentity, data: { productId: product.id, quantity: 1 } });
    expect(added.ok()).toBeTruthy();

    // The new code redeems at the cart (the admin's own cart is a real cart).
    await gotoHydrated(page, "/cart");
    await page.getByLabel("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    const applied = page.getByText(`${CODE}: Session 19 e2e coupon — applied at checkout`);
    await expect(applied).toBeVisible();

    // Deactivate it — the SAME code now rejects at the same surface.
    await gotoHydrated(page, "/admin/coupons");
    await page.getByRole("button", { name: `Deactivate coupon ${CODE}` }).click();
    await expect(page.getByText("Coupon deactivated").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: CODE, exact: true })).toBeVisible();
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible();

    await gotoHydrated(page, "/cart");
    await page.getByLabel("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("#cart-coupon-error")).toContainText(/not valid/i);

    // Delete it.
    await gotoHydrated(page, "/admin/coupons");
    await page.getByRole("button", { name: `Delete coupon ${CODE}` }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    // .first(): the toast title also lives inside the aria-live wrapper —
      // the session-9 strict-mode race (the admin.spec precedent).
      await expect(page.getByText("Coupon deleted").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: CODE, exact: true })).toHaveCount(0);
    for (const seeded of ["WELCOME10", "SAVE20", "FREESHIP"]) {
      await expect(page.getByRole("heading", { name: seeded, exact: true })).toBeVisible();
    }

    // S20-1 cleanup: restore the cart line to its pre-spec quantity (delete
    // the line entirely when the cart did not have the product before) —
    // "leaves the seed data as found" includes the durable cart.
    const summaryAfter = await request.get("/api/cart-summary", adminIdentity);
    const after = (await summaryAfter.json()) as {
      lines: Array<{ id: string; productId: string }>;
    };
    const line = after.lines.find((l) => l.productId === product.id);
    if (preQuantity === 0) {
      if (line) {
        const removed = await request.delete(`/api/cart?line=${encodeURIComponent(line.id)}`, adminIdentity);
        expect(removed.ok()).toBeTruthy();
      }
    } else if (line) {
      const patched = await request.patch("/api/cart", {
        ...adminIdentity,
        data: { lineId: line.id, quantity: preQuantity },
      });
      expect(patched.ok()).toBeTruthy();
    }
  });
});
