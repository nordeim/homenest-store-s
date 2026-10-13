// Session-14 S14-2 / C1-C3 — API boundary mappings for the health, newsletter,
// contact, and checkout route handlers.
//
// The route handlers are import-safe in the Vitest node env (verified
// empirically before these tests were written — the session-12 convention).
// The DB layer is mocked (the boundary under test is the HTTP mapping, not
// the data layer), and rate-limit budgets are isolated per-test via the
// `clientIp` contract: the RIGHTMOST `x-forwarded-for` hop names the client,
// so each test posts from its own unique IP.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    newsletterSubscriber: { upsert: vi.fn().mockResolvedValue({}) },
    contactMessage: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { GET as healthGET } from "@/app/api/health/route";
import { POST as newsletterPOST } from "@/app/api/newsletter/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
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
});

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
    // Every in-budget attempt consumed exactly one limiter slot.
    expect(statuses).toHaveLength(20);
  });
});
