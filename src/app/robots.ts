import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** robots.txt — allow the catalog, keep private/transactional surfaces out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Defense-in-depth: admin/account/checkout/api pages are either
        // session-gated or noindex already — robots makes the intent explicit
        // and keeps crawlers out of the back office.
        disallow: ["/admin", "/account", "/checkout", "/api"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
