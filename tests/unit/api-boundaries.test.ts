// Session-14 S14-2 / C1-C3 — API boundary mappings for the health, newsletter,
// contact, and checkout route handlers. Session-15 S15-3/C1: Retry-After
// response-contract assertions + the order-number exhaustion pin.
// Session-27 S27-1: the LAST 11 metered surfaces join the grid — cart
// POST/PATCH/DELETE, cart/bulk, cart-summary, coupon/apply, search,
// wishlist, and the three addresses handlers — each exhausting its REAL
// budget through the REAL limiter and pinning status + Retry-After + the
// exact 429 body (the coupon route's body is the CouponApplyResponse shape,
// not the generic sibling copy).
//
// The route handlers are import-safe in the Vitest node env (verified
// empirically before these tests were written — the session-12 convention).
// The DB layer is mocked (the boundary under test is the HTTP mapping, not
// the data layer), and rate-limit budgets are isolated per-test via the
// `clientIp` contract: the RIGHTMOST `x-forwarded-for` hop names the client.
// The `post()` helper below appends a constant proxy hop, so EVERY request
// through it shares one bucket per key prefix — fine for the one-describe-
// per-prefix pins above, but the session-27 same-key groups (cart ×3,
// addresses ×3) use the `nextReq()` SINGLE-HOP helper with a UNIQUE per-test
// IP (the C1 pin's isolation convention).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    newsletterSubscriber: { upsert: vi.fn().mockResolvedValue({}) },
    contactMessage: { create: vi.fn().mockResolvedValue({}) },
    cart: { findUnique: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    product: { findUnique: vi.fn() },
    storeSetting: { findMany: vi.fn().mockResolvedValue([]) },
    order: { count: vi.fn(), findUnique: vi.fn() },
  },
}));

// The checkout flow reads cookies (session + cart token) before the retry
// loop; outside a Next request context `cookies()` throws, so the store is
// mocked: a guest session (no session cookie) carrying a guest CART token so
// the exhaustion test reaches the order-allocation loop with a non-empty cart.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "homenest_cart" ? { value: "guest-token" } : undefined),
  })),
}));

// Session-27: the addresses limiter sits BEHIND `getCurrentUser`, so the
// module is mocked to let each describe choose its auth state. Safe: no
// `src/lib/**` module imports `@/lib/auth` (only `src/lib/actions/*`, which
// no API route imports). The file-level beforeEach resets it to null — the
// guest-path pins (C3/C1/C7) run exactly as before.
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

import { GET as healthGET } from "@/app/api/health/route";
import { POST as newsletterPOST } from "@/app/api/newsletter/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { DELETE as cartDELETE, PATCH as cartPATCH, POST as cartPOST } from "@/app/api/cart/route";
import { POST as cartBulkPOST } from "@/app/api/cart/bulk/route";
import { GET as cartSummaryGET } from "@/app/api/cart-summary/route";
import { POST as couponApplyPOST } from "@/app/api/coupon/apply/route";
import { GET as searchGET } from "@/app/api/search/route";
import { POST as wishlistPOST } from "@/app/api/wishlist/route";
import { DELETE as addressesDELETE, PATCH as addressesPATCH, POST as addressesPOST } from "@/app/api/addresses/route";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const ORIGIN = "http://localhost:3000";

function post(pathname: string, body: string, ip: string, extraHeaders: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${pathname}`, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `${ip}, 198.51.100.1`,
      ...extraHeaders,
    },
  }) as NextRequest;
}

/** A minimal body that passes checkoutSchema (cod payment → no card block). */
function checkoutBody(ipSeed: number): string {
  return JSON.stringify({
    email: `guest-${ipSeed}@example.com`,
    customerName: "Test Customer",
    shippingMethod: "standard",
    paymentMethod: "cod",
    address: {
      fullName: "Test Customer",
      phone: "+1 555 000 0000",
      line1: "123 Test Street",
      city: "Testville",
      state: "TS",
      postalCode: "12345",
    },
  });
}

beforeEach(() => {
  vi.mocked(db.$queryRaw).mockReset();
  vi.mocked(db.$queryRaw).mockResolvedValue([]);
  // Session-27: every test starts as a GUEST — the addresses describes
  // override this to a signed-in user (their limiter sits behind auth).
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue(null);
});

/**
 * Session-27 S27-1: a SINGLE-HOP `x-forwarded-for` request — no constant
 * proxy hop, so the unique per-test IP IS the limiter key's client. Builds
 * a real NextRequest: the DELETE/search handlers read `request.nextUrl`,
 * which a plain Request cast (the `post()` helper's trick) does not carry.
 */
function nextReq(method: string, pathname: string, ip: string, body?: string): NextRequest {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });
}

const GENERIC_429 = { error: "Too many requests. Please slow down." };

describe("GET /api/health (C1)", () => {
  it("reports ok + db:up when the roundtrip succeeds", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; db: string };
    expect(json.status).toBe("ok");
    expect(json.db).toBe("up");
  });

  it("reports degraded + db:down with 503 when the roundtrip fails", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(new Error("database is closed"));
    const res = await healthGET();
    expect(res.status).toBe(503);
    const json = (await res.json()) as { status: string; db: string };
    expect(json.status).toBe("degraded");
    expect(json.db).toBe("down");
  });
});

describe("POST /api/newsletter (C2)", () => {
  it("maps malformed JSON to 400", async () => {
    const res = await newsletterPOST(post("/api/newsletter", "{not json", "203.0.113.11"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("maps an invalid body to 400", async () => {
    const res = await newsletterPOST(post("/api/newsletter", JSON.stringify({ email: "nope" }), "203.0.113.12"));
    expect(res.status).toBe(400);
  });

  it("maps an exhausted per-IP budget to 429 (5/min)", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await newsletterPOST(
        post("/api/newsletter", JSON.stringify({ email: "subscriber@example.com" }), "203.0.113.13"),
      );
      expect(res.status).toBe(200);
    }
    const sixth = await newsletterPOST(
      post("/api/newsletter", JSON.stringify({ email: "subscriber@example.com" }), "203.0.113.13"),
    );
    expect(sixth.status).toBe(429);
    // S15-3: the 429 contract includes Retry-After on EVERY metered route.
    expect(sixth.headers.get("retry-after")).toBeTruthy();
  });
});

describe("POST /api/contact (C2)", () => {
  it("maps an exhausted per-IP budget to 429 (5/min)", async () => {
    const body = JSON.stringify({
      name: "Test Customer",
      email: "contact@example.com",
      message: "A message long enough for the schema.",
    });
    for (let i = 0; i < 5; i++) {
      const res = await contactPOST(post("/api/contact", body, "203.0.113.21"));
      expect(res.status).toBe(200);
    }
    const sixth = await contactPOST(post("/api/contact", body, "203.0.113.21"));
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("retry-after")).toBeTruthy();
    await expect(sixth.json()).resolves.toEqual({
      error: "Too many messages sent. Please try again shortly.",
    });
  });
});

describe("POST /api/checkout (C3)", () => {
  it("maps an exhausted per-IP budget to 429 with a Retry-After header (20/min)", async () => {
    // The limiter sits after the schema parse, so all 20 in-budget attempts
    // proceed past it (and fail later on the missing request scope) — the
    // 21st is rejected at the boundary with the Retry-After contract.
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await checkoutPOST(post("/api/checkout", checkoutBody(i), "203.0.113.31"));
      statuses.push(res.status);
    }
    const twentyFirst = await checkoutPOST(post("/api/checkout", checkoutBody(99), "203.0.113.31"));
    expect(twentyFirst.status).toBe(429);
    expect(twentyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(twentyFirst.json()).resolves.toEqual({
      error: "Too many checkout attempts. Please try again shortly.",
    });
    // Every in-budget attempt consumed exactly one limiter slot — the array
    // is built by this loop, so a bare toHaveLength would be vacuous (S15-1):
    // a limiter misconfigured to 10/min would 429 attempts 11-20 and still
    // pass. Every recorded status must be a real 200/4xx from the handler.
    expect(statuses).toHaveLength(20);
    expect(statuses.every((s) => s !== 429)).toBe(true);
  });
});

describe("POST /api/checkout — order-number allocation exhaustion (C1)", () => {
  it("retries five sequential P2002s on the NUMBER, never entering the replay branch, then 500s", async () => {
    // Guest with a non-empty cart, settings from defaults, and an order
    // allocation that collides five times: db.$transaction rejects with a
    // P2002 whose target is the NUMBER field (not the idempotency key).
    // placeOrderWithRetry must retry with the next suffix each attempt,
    // never consult the replay branch (order.findUnique), and surface the
    // exhaustion as the generic 500 — the raw engine error never escapes.
    vi.mocked(db.cart.findUnique).mockResolvedValue({
      id: "cart-1",
      userId: null,
      token: "guest-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item-1",
          cartId: "cart-1",
          productId: "p1",
          quantity: 2,
          createdAt: new Date(),
          product: {
            id: "p1",
            name: "Test Product",
            slug: "test-product",
            images: JSON.stringify(["/images/product-damascus-knife-set.png"]),
            price: 1000,
            stock: 10,
            isActive: true,
          },
        },
      ],
    } as never);
    vi.mocked(db.order.count).mockResolvedValue(0);
    const numberCollision = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["number"] },
    });
    vi.mocked(db.$transaction).mockRejectedValue(numberCollision);

    // A unique RIGHTMOST x-forwarded-for hop: the C3 limiter test above
    // exhausts the shared checkout bucket (its helper appends a constant
    // proxy hop), so this request must arrive from its own IP to meet the
    // 20/min budget with room to spare.
    const res = await checkoutPOST(
      post("/api/checkout", checkoutBody(77), "203.0.113.41", { "x-forwarded-for": "203.0.113.41" }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Something went wrong placing your order.",
    });
    // Five allocation attempts, each re-reading the counter for the next suffix.
    expect(db.order.count).toHaveBeenCalledTimes(5);
    // The P2002 on the NUMBER must NOT route into the idempotency recovery
    // branch (session-8 S8-3 discrimination) — replayAuthorized is never consulted.
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/cart?all=1 (C7 — session 17)", () => {
  function del(query: string, ip: string) {
    return new NextRequest(`${ORIGIN}/api/cart${query}`, {
      method: "DELETE",
      headers: { "x-forwarded-for": `${ip}, 198.51.100.1` },
    });
  }

  it("answers itemCount 0 for a request with no cart and never touches cartItem", async () => {
    vi.mocked(db.cart.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(db.cartItem.deleteMany).mockReset().mockResolvedValue({ count: 0 });

    const res = await cartDELETE(del("?all=1", "203.0.113.41"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ itemCount: 0 });
    expect(db.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("empties the guest cart with a cartId-scoped deleteMany and reports the fresh summary", async () => {
    const findCart = vi.mocked(db.cart.findUnique);
    findCart.mockReset();
    // Queued cart rows: the first read resolves the guest token (findCartId),
    // the second is getCartSummary's re-read (emptied by the deleteMany).
    // `as never` = the file's C1 convention — Prisma's default findUnique
    // payload type excludes the relation fields the mocked rows carry.
    findCart.mockResolvedValueOnce({
      id: "cart-1",
      userId: null,
      token: "guest-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    } as never);
    findCart.mockResolvedValueOnce({
      id: "cart-1",
      userId: null,
      token: "guest-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    } as never);
    vi.mocked(db.cartItem.deleteMany).mockReset().mockResolvedValue({ count: 2 });

    const res = await cartDELETE(del("?all=1", "203.0.113.42"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ itemCount: 0 });
    // The bulk delete is scoped to the resolved cart — never an unscoped table wipe.
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
  });
});

// ---------------------------------------------------------------------------
// Session-27 S27-1 — the last 11 metered surfaces join the boundary-pin grid.
// Every pin exhausts its route's REAL budget through the REAL limiter
// (`@/lib/rate-limit` is NOT mocked) and pins the full 429 contract: status,
// `Retry-After`, and the exact body. Same-key groups (cart ×3, addresses ×3)
// are isolated per-test via the single-hop unique-IP convention — the
// `nextReq()` helper sends NO constant proxy hop, so the unique IP IS the
// rightmost (the limiter key's) client.
// ---------------------------------------------------------------------------

describe("POST /api/cart — 429 wiring (S27-1, 60/min)", () => {
  it("consumes exactly 60 in-budget slots (404s past the limiter) and 429s the 61st", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null);
    // The limiter sits AFTER the schema parse, so every valid body consumes a
    // slot and fails later on the product lookup (404) — the S15-1 shape: the
    // recorded statuses prove no in-budget attempt was rate-limited.
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await cartPOST(nextReq("POST", "/api/cart", "203.0.113.51", JSON.stringify({ productId: "p1", quantity: 1 })));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 404)).toBe(true);

    const sixtyFirst = await cartPOST(nextReq("POST", "/api/cart", "203.0.113.51", JSON.stringify({ productId: "p1", quantity: 1 })));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("PATCH /api/cart — 429 wiring (S27-1, 60/min)", () => {
  it("consumes exactly 60 in-budget slots (limiter FIRST, then 400s) and 429s the 61st", async () => {
    // The limiter runs BEFORE the body parse, so malformed payloads still
    // consume slots — 60 × 400, then the boundary.
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await cartPATCH(nextReq("PATCH", "/api/cart", "203.0.113.52", "{not json"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 400)).toBe(true);

    const sixtyFirst = await cartPATCH(nextReq("PATCH", "/api/cart", "203.0.113.52", "{not json"));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("DELETE /api/cart — 429 wiring (S27-1, 60/min)", () => {
  it("consumes exactly 60 in-budget slots (guest no-cart 200s) and 429s the 61st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await cartDELETE(nextReq("DELETE", "/api/cart", "203.0.113.53"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const sixtyFirst = await cartDELETE(nextReq("DELETE", "/api/cart", "203.0.113.53"));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("POST /api/cart/bulk — 429 wiring (S27-1, 10/min)", () => {
  it("consumes exactly 10 in-budget slots and 429s the 11th", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await cartBulkPOST(nextReq("POST", "/api/cart/bulk", "203.0.113.54", "{not json"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(10);
    expect(statuses.every((s) => s === 400)).toBe(true);

    const eleventh = await cartBulkPOST(nextReq("POST", "/api/cart/bulk", "203.0.113.54", "{not json"));
    expect(eleventh.status).toBe(429);
    expect(eleventh.headers.get("retry-after")).toBeTruthy();
    await expect(eleventh.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("GET /api/cart-summary — 429 wiring (S27-1, 120/min)", () => {
  it("consumes exactly 120 in-budget slots and 429s the 121st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 120; i++) {
      const res = await cartSummaryGET(nextReq("GET", "/api/cart-summary", "203.0.113.55"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(120);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const hundredTwentyFirst = await cartSummaryGET(nextReq("GET", "/api/cart-summary", "203.0.113.55"));
    expect(hundredTwentyFirst.status).toBe(429);
    expect(hundredTwentyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(hundredTwentyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("POST /api/coupon/apply — 429 wiring (S27-1, 30/min)", () => {
  it("consumes exactly 30 in-budget slots and 429s the 31st with the CouponApplyResponse body", async () => {
    // In-budget attempts parse, pass the limiter, and die on the empty guest
    // cart — a 200 with { ok: false } (the L3 split: a domain no is not an
    // HTTP error). The 31st is the boundary, and its body is the route's
    //CouponApplyResponse shape — NOT the generic `{ error }` sibling copy.
    const statuses: number[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await couponApplyPOST(nextReq("POST", "/api/coupon/apply", "203.0.113.56", JSON.stringify({ code: "SAVE10" })));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(30);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const thirtyFirst = await couponApplyPOST(nextReq("POST", "/api/coupon/apply", "203.0.113.56", JSON.stringify({ code: "SAVE10" })));
    expect(thirtyFirst.status).toBe(429);
    expect(thirtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(thirtyFirst.json()).resolves.toEqual({
      ok: false,
      error: "Too many attempts. Please try again shortly.",
    });
  });
});

describe("GET /api/search — 429 wiring (S27-1, 120/min)", () => {
  it("consumes exactly 120 in-budget slots and 429s the 121st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 120; i++) {
      const res = await searchGET(nextReq("GET", "/api/search", "203.0.113.57"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(120);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const hundredTwentyFirst = await searchGET(nextReq("GET", "/api/search", "203.0.113.57"));
    expect(hundredTwentyFirst.status).toBe(429);
    expect(hundredTwentyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(hundredTwentyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("POST /api/wishlist — 429 wiring (S27-1, 60/min)", () => {
  it("consumes exactly 60 in-budget slots (404s past the limiter) and 429s the 61st", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null);
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await wishlistPOST(nextReq("POST", "/api/wishlist", "203.0.113.58", JSON.stringify({ productId: "p1" })));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 404)).toBe(true);

    const sixtyFirst = await wishlistPOST(nextReq("POST", "/api/wishlist", "203.0.113.58", JSON.stringify({ productId: "p1" })));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("POST /api/addresses — 429 wiring (S27-1, 60/min, behind auth)", () => {
  beforeEach(() => {
    // The limiter sits BEHIND getCurrentUser — the pin's requests must be
    // signed in to reach (and consume) the budget at all.
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      phone: null,
      role: "CUSTOMER",
    });
  });

  it("consumes exactly 60 in-budget slots (limiter BEFORE the body parse) and 429s the 61st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await addressesPOST(nextReq("POST", "/api/addresses", "203.0.113.59", "{not json"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 400)).toBe(true);

    const sixtyFirst = await addressesPOST(nextReq("POST", "/api/addresses", "203.0.113.59", "{not json"));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("PATCH /api/addresses — 429 wiring (S27-1, 60/min, behind auth)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      phone: null,
      role: "CUSTOMER",
    });
  });

  it("consumes exactly 60 in-budget slots and 429s the 61st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await addressesPATCH(nextReq("PATCH", "/api/addresses", "203.0.113.60", "{not json"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 400)).toBe(true);

    const sixtyFirst = await addressesPATCH(nextReq("PATCH", "/api/addresses", "203.0.113.60", "{not json"));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});

describe("DELETE /api/addresses — 429 wiring (S27-1, 60/min, behind auth)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      phone: null,
      role: "CUSTOMER",
    });
  });

  it("consumes exactly 60 in-budget slots (400s on the missing id) and 429s the 61st", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await addressesDELETE(nextReq("DELETE", "/api/addresses", "203.0.113.61"));
      statuses.push(res.status);
    }
    expect(statuses).toHaveLength(60);
    expect(statuses.every((s) => s === 400)).toBe(true);

    const sixtyFirst = await addressesDELETE(nextReq("DELETE", "/api/addresses", "203.0.113.61"));
    expect(sixtyFirst.status).toBe(429);
    expect(sixtyFirst.headers.get("retry-after")).toBeTruthy();
    await expect(sixtyFirst.json()).resolves.toEqual(GENERIC_429);
  });
});
