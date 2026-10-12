import type { Page } from "@playwright/test";

/**
 * Navigate and WAIT FOR HYDRATION before any interaction.
 *
 * Playwright's actionability checks do not cover React hydration — clicking
 * a button before the client bundle wires events silently falls back to
 * native form submission (the login regression this guard exists for).
 * StoreProvider stamps <html data-hydrated="true"> once the tree is live.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 20_000 });
}

export const DEMO_CUSTOMER = {
  email: "demo@homenestkitchen.com",
  password: "Demo1234!",
};

export const DEMO_ADMIN = {
  email: "admin@homenestkitchen.com",
  password: "Admin123!",
};
