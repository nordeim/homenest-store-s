import { beforeAll, describe, expect, it } from "vitest";

import { resolveReplay, ReplayDeniedError } from "@/lib/order-access";
import { productSeedUpdate, SETTINGS_CREATE_ONLY, SLIDES_CREATE_ONLY } from "@/lib/seed-policy";
import { jsonLdScript } from "@/lib/seo";
import { newRequestId } from "@/lib/random-id";
import { sessionSweepDue } from "@/lib/auth";
import { interpolateContactEmail } from "@/app/(storefront)/legal/[slug]/content";

// Deterministic secret for the order-access suite (module reads env at call time).
beforeAll(() => {
  process.env.AUTH_SECRET = "test-only-access-token-secret-0123456789abcdef";
});

// --- S7-2: the idempotency-key P2002 recovery path is ownership-bound -------
describe("resolveReplay (session-7 S7-2)", () => {
  const winner = { number: "ORD-2026-042", userId: null as string | null, cartToken: "guest-token-1" };

  it("returns the winner's number for a guest replay with the same cart cookie", () => {
    expect(resolveReplay(winner, null, "guest-token-1")).toBe("ORD-2026-042");
  });

  it("returns the winner's number for a user replay with the same session user", () => {
    expect(resolveReplay({ ...winner, userId: "user-1", cartToken: "tok" }, "user-1", "other-cookie")).toBe(
      "ORD-2026-042",
    );
  });

  it("throws ReplayDeniedError when a leaked key is presented without ownership", () => {
    // Thief has neither the placing user's session nor the guest cart cookie.
    expect(() => resolveReplay(winner, null, "stolen-guess")).toThrow(ReplayDeniedError);
    expect(() => resolveReplay({ ...winner, userId: "user-1" }, "user-2", null)).toThrow(ReplayDeniedError);
    // Legacy rows (no binding recorded) deny — matching replayAuthorized.
    expect(() => resolveReplay({ number: "ORD-2026-042", userId: null, cartToken: null }, null, "any")).toThrow(
      ReplayDeniedError,
    );
  });

  it("returns null when there is no winner (caller retries normally)", () => {
    expect(resolveReplay(null, "user-1", "tok")).toBeNull();
  });
});

// --- S7-3: reseeds never reset live/operational product data ----------------
describe("productSeedUpdate (session-7 S7-3)", () => {
  const full = {
    slug: "damascus-chef-knife",
    name: "Damascus Steel Chef Knife Set",
    shortDescription: "Short copy",
    description: "Longer catalog copy for the blade.",
    categoryId: "cat_kitchen-tools",
    price: 19999,
    compareAtPrice: 27999,
    sku: "HN-KNIFE-01",
    stock: 40,
    rating: 4.9,
    reviewCount: 412,
    images: JSON.stringify(["/images/products/knife-1.jpg"]),
    tags: JSON.stringify(["knife"]),
    specs: JSON.stringify([{ label: "Material", value: "Damascus steel" }]),
    badge: "Featured",
    isFeatured: true,
    isNewArrival: false,
    isActive: true,
  };

  it("refreshes content fields on an existing row", () => {
    const update = productSeedUpdate(full);
    expect(update).toMatchObject({
      name: full.name,
      shortDescription: full.shortDescription,
      description: full.description,
      categoryId: full.categoryId,
      images: full.images,
      tags: full.tags,
      specs: full.specs,
    });
  });

  it("never resets admin- or traffic-owned fields", () => {
    const update = productSeedUpdate(full) as Record<string, unknown>;
    // price/compareAtPrice: admin merchandising; stock: live ledger;
    // rating/reviewCount: customer-grown aggregates (S4-7); sku/badge/
    // featured/newArrival/isActive: admin-owned in the product dialog.
    for (const key of [
      "price",
      "compareAtPrice",
      "stock",
      "rating",
      "reviewCount",
      "sku",
      "badge",
      "isFeatured",
      "isNewArrival",
      "isActive",
      "slug",
    ]) {
      expect(update, `${key} must not be reset by a reseed`).not.toHaveProperty(key);
    }
  });
});

describe("seed create-only policy (session-7 S7-3)", () => {
  it("settings and carousel slides are create-only (coupon precedent)", () => {
    expect(SETTINGS_CREATE_ONLY).toBe(true);
    expect(SLIDES_CREATE_ONLY).toBe(true);
  });
});

// --- S7-5: legal body copy renders the settings contact email ---------------
describe("interpolateContactEmail (session-7 S7-5)", () => {
  it("replaces every {{contactEmail}} token", () => {
    const out = interpolateContactEmail(
      "Email {{contactEmail}} or {{contactEmail}} for help.",
      "hi@homenestkitchen.com",
    );
    expect(out).toBe("Email hi@homenestkitchen.com or hi@homenestkitchen.com for help.");
  });

  it("passes text without the token through untouched", () => {
    const text = "No email in this paragraph.";
    expect(interpolateContactEmail(text, "hi@homenestkitchen.com")).toBe(text);
  });

  it("leaves other braces alone", () => {
    expect(interpolateContactEmail("Object literal {{foo}} stays.", "a@b.c")).toBe("Object literal {{foo}} stays.");
  });
});

// --- S7-9: JSON-LD serialization cannot break out of the script element -----
describe("jsonLdScript (session-7 S7-9)", () => {
  it("escapes </script> inside strings so the block cannot terminate early", () => {
    const out = jsonLdScript({ name: "Knife</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });

  it("escapes raw < anywhere (U+003C) and still yields valid JSON", () => {
    const data = { description: "a < b and c <d", n: 3 };
    const out = jsonLdScript(data);
    expect(JSON.parse(out)).toEqual(data);
    expect(out).not.toMatch(/<(?!\\u003c)/); // no unescaped raw '<' remains
  });

  it("escapes U+2028/U+2029 line separators (valid JSON, safe JS embedding)", () => {
    const out = jsonLdScript({ text: "line sep next" });
    expect(() => JSON.parse(out)).not.toThrow();
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(out).toContain("\\u2028");
  });

  it("preserves nested structures and unicode", () => {
    const data = { name: "Café ✓", offers: { price: 21.99, currency: "USD" } };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});

// --- S7-10: idempotency keys survive non-secure origins ---------------------
describe("newRequestId (session-7 S7-10)", () => {
  it("uses crypto.randomUUID when available", () => {
    const uuid = "01890a5d-ac96-774b-bcce-b302099a8057";
    const cryptoLike = { randomUUID: () => uuid, getRandomValues: () => new Uint8Array(16) };
    expect(newRequestId(cryptoLike)).toBe(uuid);
  });

  it("falls back to getRandomValues hex when randomUUID is missing (non-secure origin)", () => {
    const cryptoLike = {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    };
    const key = newRequestId(cryptoLike);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe("000102030405060708090a0b0c0d0e0f");
  });

  it("produces a distinct key per call (fallback path)", () => {
    let counter = 0;
    const cryptoLike = {
      getRandomValues: (arr: Uint8Array) => {
        arr[0] = counter++;
        return arr;
      },
    };
    expect(newRequestId(cryptoLike)).not.toBe(newRequestId(cryptoLike));
  });
});

// --- S7-12: expired sessions are swept hourly, not only at login ------------
describe("sessionSweepDue (session-7 S7-12)", () => {
  const HOUR = 60 * 60 * 1000;

  it("is due when the last sweep is older than the interval", () => {
    expect(sessionSweepDue(2 * HOUR, 0, HOUR)).toBe(true);
  });

  it("is not due within the interval", () => {
    expect(sessionSweepDue(HOUR - 1, 0, HOUR)).toBe(false);
  });

  it("treats a never-swept store (last=0, now<interval) as due at startup", () => {
    // Boot: lastSweep=0 and Date.now() is a large epoch — due immediately.
    expect(sessionSweepDue(Date.now(), 0, HOUR)).toBe(true);
  });
});
