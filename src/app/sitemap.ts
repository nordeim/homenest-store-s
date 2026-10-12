import type { MetadataRoute } from "next";

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// sitemap.xml — static routes plus every active product detail page. The DB
// query is wrapped in try/catch so a build without a reachable database still
// emits the static routes instead of failing the build.
// ---------------------------------------------------------------------------

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/track-order", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/login", priority: 0.4, changeFrequency: "yearly" },
  { path: "/register", priority: 0.4, changeFrequency: "yearly" },
  { path: "/cart", priority: 0.4, changeFrequency: "weekly" },
  { path: "/wishlist", priority: 0.4, changeFrequency: "weekly" },
  { path: "/legal/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/disclaimer", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/refund-policy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
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
