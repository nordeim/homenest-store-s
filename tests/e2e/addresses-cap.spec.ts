import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Address book integrity (session-7 S7-8): a per-user cap keeps the Address
 * table bounded, and the API says so with a friendly 409. Uses a dedicated
 * fresh account so prior test runs cannot skew the count.
 */
test.describe("account addresses", () => {
  test("POST /api/addresses enforces the per-user cap with a friendly 409 (S7-8)", async ({ page }) => {
    const email = `s7-cap-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    await gotoHydrated(page, "/register");
    await page.getByLabel("Name").fill("S7 Cap Check");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("CapCheck123!");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 10_000 });

    // page.request shares the browser context's cookies — the session cookie
    // from the register above authorizes these API calls.
    const payload = {
      label: "Home",
      fullName: "S7 Cap Check",
      phone: "+1 512 555 0133",
      line1: "482 Maple Avenue",
      city: "Austin",
      state: "TX",
      postalCode: "73301",
    };

    let lastOk: number | null = null;
    for (let i = 1; i <= 20; i++) {
      const res = await page.request.post("/api/addresses", { data: payload });
      if (res.ok()) {
        lastOk = i;
        continue;
      }
      // The FIRST rejection must be the cap itself — a 409, not a 500.
      expect(res.status(), `address #${i} should hit the cap with 409`).toBe(409);
      const body = (await res.json()) as { error?: string };
      expect(body.error ?? "").toMatch(/address book is full/i);
      break;
    }
    // Exactly MAX_ADDRESSES_PER_USER (20) writes succeeded before the cap.
    expect(lastOk).toBe(20);
  });
});
