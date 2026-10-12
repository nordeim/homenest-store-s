import { expect, test } from "@playwright/test";

import { gotoHydrated } from "./helpers";

/**
 * SEO + platform contracts (session-5 audit S5-1/S5-4/S5-5):
 * structured data, sitemap/robots, web manifest, app icon, and the
 * framework-fingerprint security headers — pinned against regressions.
 */

/** Pull every ld+json data block and parse them (script elements have no
 *  rendered text, so locators must read textContent directly). */
async function jsonLdBlocks(page: import("@playwright/test").Page): Promise<Record<string, unknown>[]> {
  const scripts = page.locator('script[type="application/ld+json"]');
  const count = await scripts.count();
  const blocks: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const raw = (await scripts.nth(i).textContent()) ?? "";
    try {
      blocks.push(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      // A malformed block would be a real regression — surfaced by the assertions below.
    }
  }
  return blocks;
}

test.describe("seo + platform", () => {
  test("home emits Organization + WebSite JSON-LD", async ({ page }) => {
    await gotoHydrated(page, "/");

    const blocks = await jsonLdBlocks(page);
    const org = blocks.find((b) => b["@type"] === "Organization");
    expect(org, "Organization JSON-LD present").toBeTruthy();
    // storeName is admin-editable seed data — assert presence, not a literal.
    expect(String(org!["name"]).length).toBeGreaterThan(0);
    expect(String(org!["url"])).toMatch(/^https?:\/\//);

    const site = blocks.find((b) => b["@type"] === "WebSite");
    expect(site, "WebSite JSON-LD present").toBeTruthy();
    expect((site!.potentialAction as { target: string }).target).toContain("/products?q=");
  });

  test("product page emits Product JSON-LD with price, stock and rating", async ({ page, request }) => {
    // Discover an active product from the public catalog page.
    await gotoHydrated(page, "/products");
    const detailLink = page.locator('a[href^="/product/"]').first();
    const href = await detailLink.getAttribute("href");
    expect(href).toBeTruthy();

    await gotoHydrated(page, href!);
    const blocks = await jsonLdBlocks(page);
    const data = blocks.find((b) => b["@type"] === "Product") as
      | {
          name: string;
          sku: string;
          offers: { price: number; priceCurrency: string; availability: string };
          aggregateRating?: { reviewCount: number };
        }
      | undefined;
    expect(data, "Product JSON-LD present").toBeTruthy();
    expect(data!.name).toBeTruthy();
    expect(data!.sku).toBeTruthy();
    // Integer cents are converted to decimal dollars in the offer.
    expect(typeof data!.offers.price).toBe("number");
    expect(data!.offers.price).toBeGreaterThan(0);
    expect(data!.offers.priceCurrency).toBe("USD");
    expect(data!.offers.availability).toMatch(/schema\.org\/(In|OutOf)Stock$/);
    expect(data!.aggregateRating?.reviewCount ?? 0).toBeGreaterThan(0);
    // Canonical URL is present in the metadata.
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    expect(await canonical.getAttribute("href")).toContain("/product/");

    // S6-3: product shares carry the product image + a large Twitter card.
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);
    expect(await ogImage.getAttribute("content")).toMatch(/^https?:\/\//);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
  });

  test("site-wide share tags + canonicals ship on the public pages (session-6 S6-3/S6-4)", async ({ page, request }) => {
    // Home: branded OG card + Twitter card + self canonical.
    await gotoHydrated(page, "/");
    expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(/og-default\.png$/);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
    const homeCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(homeCanonical).toMatch(/\/$|:\d+\/?(\?.*)?$/);

    // /products with faceted params canonicalizes to the un-parameterized URL.
    await gotoHydrated(page, "/products?category=cookware&sort=price-asc&page=2");
    const productsCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(productsCanonical).toBeTruthy();
    expect(productsCanonical!).not.toContain("category=");
    expect(productsCanonical!).not.toContain("page=");

    // About + contact are canonical too (request-level head check).
    for (const path of ["/about", "/contact"]) {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain('rel="canonical"');
      expect(html).toContain(`href="http`);
    }
  });

  test("robots.txt allows the catalog, disallows private surfaces, points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /checkout");
  });

  test("sitemap.xml lists the catalog and never the private surfaces", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("/products");
    expect(body).not.toContain("/login");
    expect(body).not.toContain("/checkout");
  });

  test("web manifest and app icon resolve", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const data = (await manifest.json()) as { name?: string; icons?: unknown[] };
    expect(data.name).toBe("HomeNest Kitchen");
    expect(Array.isArray(data.icons) && data.icons.length > 0).toBe(true);

    const icon = await request.get("/icon.svg");
    expect(icon.status()).toBe(200);
  });

  test("private surfaces ship noindex (session-8 S8-9)", async ({ request }) => {
    for (const path of ["/cart", "/login", "/track-order", "/account", "/checkout"]) {
      const res = await request.get(path);
      expect(res.status(), `${path} should render`).toBeLessThan(500);
      const html = await res.text();
      expect(html, `${path} should carry noindex`).toMatch(/name="robots"\s+content="[^"]*noindex[^"]*"/);
    }
  });

  test("security headers ship and the framework fingerprint does not", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const headers = res.headers();
    // S5-5: Next.js defaults X-Powered-By to true unless disabled.
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["strict-transport-security"]).toContain("includeSubDomains");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});
