import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { siteBaseUrl } from "@/lib/seo";

// ---------------------------------------------------------------------------
// sitemap.xml — static routes plus every active product detail page. The DB
// query is wrapped in try/catch so a build without a reachable database still
// emits the static routes instead of failing the build.
// ---------------------------------------------------------------------------

// Static routes eligible for the sitemap. PRIVATE / per-visitor / noindex
// surfaces (login, register, cart, wishlist, track-order, checkout, account,
// admin) are intentionally EXCLUDED — listing noindexed URLs is a
// Search-Console warning and order/account helpers are not catalog content.
// Exported for tests/unit/seo-routes.test.ts.
export const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/disclaimer", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/refund-policy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    });
    for (const product of products) {
      entries.push({
        url: `${base}/product/${product.id}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Database not reachable at build time — ship static routes only.
  }

  return entries;
}
