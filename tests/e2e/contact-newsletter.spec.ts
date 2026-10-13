import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

/**
 * Contact + newsletter — the two support/marketing capture surfaces
 * (session-12 C5: these routes previously had zero route-level coverage; only
 * their Zod schemas were pinned via validation.test.ts). The UI cases exercise
 * the hydrated forms; the API cases pin the 400/429 boundary responses.
 */
test.describe("contact and newsletter", () => {
  test("contact form sends a message (success toast)", async ({ page }) => {
    await gotoHydrated(page, "/contact");

    await page.getByLabel("Name").fill("E2E Contact Check");
    await page.getByLabel("Email").fill("e2e-contact@example.com");
    await page.getByLabel("Subject").fill("Automated check");
    // getByRole textbox: the section's aria-label ("Send us a message") also
    // matches getByLabel("Message") — a strict-mode trap.
    await page.getByRole("textbox", { name: "Message" }).fill("This is an automated end-to-end contact message.");
    await page.getByRole("button", { name: /send/i }).click();

    // .first(): the toast title also lives inside Radix's aria-live wrapper
    // (the strict-mode convention documented in admin.spec.ts).
    await expect(page.getByText("Message sent!").first()).toBeVisible({ timeout: 10_000 });
  });

  test("POST /api/contact with an invalid email is a 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {
        name: "E2E Contact Check",
        email: "not-an-email",
        subject: "Automated check",
        message: "This message is long enough for the schema.",
      },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  test("POST /api/contact with a too-short message is a 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "E2E Contact Check", email: "e2e@example.com", subject: "", message: "short" },
    });
    expect(res.status()).toBe(400);
  });

  test("newsletter form subscribes from the home page (inline success)", async ({ page }) => {
    await gotoHydrated(page, "/");
    const email = `e2e-news-${Date.now()}@example.com`;
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Subscribe" }).click();
    // .first()/hasText filter: the success <p role=status> shares the page
    // with an empty aria-live status span (the suite's strict-mode convention).
    await expect(
      page.getByRole("status").filter({ hasText: "Thanks for subscribing" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("POST /api/newsletter with an invalid email is a 400", async ({ request }) => {
    const res = await request.post("/api/newsletter", { data: { email: "nope" } });
    expect(res.status()).toBe(400);
  });

  test("POST /api/newsletter with malformed JSON is a 400", async ({ request }) => {
    // Playwright quirk (documented in AGENTS.md): data as a raw Buffer skips
    // the JSON-encoding of strings, producing genuinely malformed JSON.
    const res = await request.post("/api/newsletter", { data: Buffer.from("{not-json") });
    expect(res.status()).toBe(400);
  });
});
