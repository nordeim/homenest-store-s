import type { MetadataRoute } from "next";

import { siteBaseUrl } from "@/lib/seo";

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
    sitemap: `${siteBaseUrl()}/sitemap.xml`,
  };
}
