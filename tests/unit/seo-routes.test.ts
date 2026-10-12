import { describe, expect, it } from "vitest";

import { STATIC_ROUTES } from "@/app/sitemap";
import robots from "@/app/robots";

describe("sitemap STATIC_ROUTES", () => {
  const paths = STATIC_ROUTES.map((r) => r.path);

  it("keeps the public catalog + content routes", () => {
    for (const p of ["/", "/products", "/about", "/contact", "/legal/privacy-policy"]) {
      expect(paths).toContain(p);
    }
  });

  it("never lists private, per-visitor or noindex routes", () => {
    for (const p of ["/track-order", "/login", "/register", "/cart", "/wishlist", "/checkout", "/account", "/admin"]) {
      expect(paths).not.toContain(p);
    }
  });

  it("every legal slug stays listed", () => {
    const legal = paths.filter((p) => p.startsWith("/legal/"));
    expect(legal).toHaveLength(5);
  });
});

describe("robots", () => {
  it("allows crawlers and points at the sitemap", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules) ? rules[0]?.allow : rules?.allow).toBe("/");
    expect(robots().sitemap).toContain("/sitemap.xml");
  });

  it("disallows the admin, account, checkout and api surfaces", () => {
    const rules = robots().rules;
    const first = Array.isArray(rules) ? rules[0] : rules;
    const disallow = first && !Array.isArray(first) ? first.disallow : undefined;
    const list = Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
    for (const p of ["/admin", "/account", "/checkout", "/api"]) {
      expect(list).toContain(p);
    }
  });
});
