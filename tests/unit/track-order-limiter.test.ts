// Session-24 S24-3 — the /track-order page-limiter is WIRED. The page
// consults the per-client limiter (track-order:{ip}, 30/min) before ANY
// order lookup and fails CLOSED: an over-budget lookup renders the same
// denial shell as an unknown number (no information leak, no DB read).
// Recorded session 21 as a deferral ("route-level 429 wiring pins"); the
// session-19 mock-family precedent + plain renderToString retire it.
//
// Mock family: next/headers (fixed cf-connecting-ip), @/lib/db,
// @/lib/rate-limit PARTIALLY mocked via importOriginal (the REAL clientIp
// derivation feeds the key; only the in-memory rateLimit counter is
// controlled), next/image (a null passthrough — no Next runtime here).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));

import { db } from "@/lib/db";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import TrackOrderPage from "@/app/(storefront)/track-order/page";

const IP = "198.51.100.7";
const ORDER = {
  id: "order-1",
  number: "ORD-2026-001",
  email: "buyer@example.com",
  customerName: "Jordan Rivera",
  status: "pending",
  subtotal: 3499,
  shipping: 0,
  tax: 0,
  discount: 0,
  total: 3499,
  couponCode: null,
  shippingMethod: "standard",
  shippingAddress: JSON.stringify({ fullName: "Jordan Rivera", line1: "1 Main St", city: "Austin" }),
  paymentMethod: "card",
  carrier: null,
  trackingNumber: null,
  cardLast4: null,
  userId: null,
  idempotencyKey: null,
  cartToken: null,
  placedAt: new Date("2026-01-15T10:00:00Z"),
  updatedAt: new Date("2026-01-15T10:00:00Z"),
  items: [],
  events: [],
};

const mockedRateLimit = vi.mocked(rateLimit);
const mockedHeaders = vi.mocked(headers);

/** Render the page for a submitted number+email pair. */
function renderTrack(number: string, email: string): Promise<string> {
  return Promise.resolve(
    TrackOrderPage({ searchParams: Promise.resolve({ number, email }) }),
  ).then((node) => renderToString(node as React.ReactElement));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedHeaders.mockResolvedValue(new Headers({ "cf-connecting-ip": IP }));
  mockedRateLimit.mockReturnValue({ ok: true });
  vi.mocked(db.order.findUnique).mockResolvedValue(ORDER);
});

describe("/track-order — the lookup limiter is wired (S24-3)", () => {
  it("consults the limiter with the per-client key and the documented budget", async () => {
    await renderTrack("ORD-2026-001", "buyer@example.com");

    expect(mockedRateLimit).toHaveBeenCalledTimes(1);
    expect(mockedRateLimit).toHaveBeenCalledWith(`track-order:${IP}`, 30, 60_000);
  });

  it("over-budget lookups never touch the DB and render the denial shell", async () => {
    mockedRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });

    const html = await renderTrack("ORD-2026-001", "buyer@example.com");

    expect(db.order.findUnique).not.toHaveBeenCalled();
    // Fails CLOSED: the same indistinguishable denial an unknown number gets
    // (the hardcoded form placeholder also carries the submitted-shaped
    // number, so the denial is pinned by the alert + the ABSENCE of the
    // tracking surface, not by the number string).
    expect(html).toContain("We couldn&#x27;t find an order matching that number and email");
    expect(html).not.toContain("Placed");
    expect(html).not.toContain(">pending<");
  });

  it("under-budget + matching email renders the order's tracking surface", async () => {
    const html = await renderTrack("ORD-2026-001", "buyer@example.com");

    expect(db.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { number: "ORD-2026-001" } }),
    );
    expect(html).toContain("Placed");
    expect(html).toContain(">pending<");
    expect(html).not.toContain("We couldn&#x27;t find");
  });

  it("under-budget + wrong email renders the SAME denial shell (no enumeration leak)", async () => {
    const html = await renderTrack("ORD-2026-001", "attacker@example.com");

    expect(db.order.findUnique).toHaveBeenCalledTimes(1);
    expect(html).toContain("We couldn&#x27;t find an order matching that number and email");
    expect(html).not.toContain("Placed");
    expect(html).not.toContain(">pending<");
  });
});
