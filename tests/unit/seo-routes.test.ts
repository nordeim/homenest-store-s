import { describe, expect, it, vi } from "vitest";

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

// C2 (session-15): the sitemap's DB-failure fallback + product-URL emission.
// The DB layer is mocked; sitemap() itself stays unmocked so the try/catch
// boundary under test is the real one.
vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn() } },
}));

import sitemap from "@/app/sitemap";
import { db } from "@/lib/db";

describe("sitemap product URLs (C2)", () => {
  it("appends every active product detail URL when the DB is reachable", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00Z");
    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: "prod-1", updatedAt },
      { id: "prod-2", updatedAt },
    ] as never);

    const entries = await sitemap();
    expect(entries).toHaveLength(STATIC_ROUTES.length + 2);
    expect(entries[0]?.url).toBe(`http://localhost:3000${STATIC_ROUTES[0]!.path}`);
    expect(entries.at(-2)?.url).toBe("http://localhost:3000/product/prod-1");
    expect(entries.at(-1)?.url).toBe("http://localhost:3000/product/prod-2");
    expect(entries.at(-1)?.changeFrequency).toBe("weekly");
    expect(entries.at(-1)?.priority).toBe(0.7);
    expect(entries.at(-1)?.lastModified).toBe(updatedAt);
  });

  it("falls back to static-routes-only when the DB is unreachable (build without a database)", async () => {
    vi.mocked(db.product.findMany).mockRejectedValue(new Error("database is closed"));

    const entries = await sitemap();
    expect(entries).toHaveLength(STATIC_ROUTES.length);
    for (const route of STATIC_ROUTES) {
      expect(entries.map((e) => e.url)).toContain(`http://localhost:3000${route.path}`);
    }
    expect(entries.some((e) => e.url.includes("/product/"))).toBe(false);
  });
});
