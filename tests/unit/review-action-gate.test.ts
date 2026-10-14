// Session-24 S24-2 — the review action's two-tier gate is WIRED, not just
// defined. The key-derivation shape is pinned by session11-hardening.test.ts
// (reviewRateLimitKeys truth table); THIS pin proves submitReviewAction
// consults BOTH tiers (the per-IP ceiling and the per-author budget) and
// rejects with the friendly copy when EITHER fails — a refactor that drops
// the author-tier check (or the ip ceiling) now fails the suite.
//
// Mock family: the session-19 guarded-action precedent (next/cache +
// @/lib/db + @/lib/auth + next/headers mocked) — which is also what retired
// the "actions are not import-safe in Vitest" deferral rationale.
// @/lib/rate-limit is PARTIALLY mocked via importOriginal: the REAL
// clientIp + reviewRateLimitKeys derivations feed the gate, only the
// in-memory rateLimit counter is controlled.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn(), update: vi.fn() },
    review: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { rateLimit, reviewRateLimitKeys } from "@/lib/rate-limit";
import { submitReviewAction } from "@/lib/actions/reviews";

const IP = "203.0.113.9";
const PID = "product-1";
const GATE_COPY = "Too many reviews submitted. Please try again shortly.";
const VALID_INPUT = [PID, 5, "Great knife", "Sliced through everything I tried this week.", "Alice"] as const;

const mockedRateLimit = vi.mocked(rateLimit);
const mockedHeaders = vi.mocked(headers);

/** The REAL key derivation (assertions depend on the wired keys, not fakes). */
const { ipKey, authorKey } = reviewRateLimitKeys(IP, PID, "Alice");

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): a partially-consumed
  // mockReturnValueOnce queue from a prior test must never leak into the
  // next one — the gate's call COUNT differs per tier outcome, so a leftover
  // Once value would silently re-order the tier results.
  vi.resetAllMocks();
  mockedHeaders.mockResolvedValue(new Headers({ "cf-connecting-ip": IP }));
  mockedRateLimit.mockReturnValue({ ok: true });
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  // A superset row serves BOTH readers: the gate's fast-fail check selects
  // { id, isActive }; the aggregate growth inside the tx selects
  // { rating, reviewCount }. (The `as never` cast is the session-19 mock
  // convention — the mocked db keeps its REAL Prisma types, whose
  // select-projected return shape differs per call site.)
  vi.mocked(db.product.findUnique).mockResolvedValue({
    id: PID,
    isActive: true,
    rating: 4.7,
    reviewCount: 10,
  } as never);
  vi.mocked(db.$transaction).mockImplementation(async (fn) =>
    // The tx callback receives the client the aggregate grows through; a
    // straight passthrough exercises growReviewAggregate's real code path.
    fn(db as unknown as Parameters<typeof fn>[0]),
  );
});

describe("submitReviewAction — the two-tier gate is wired (S24-2)", () => {
  it("consults BOTH the per-IP ceiling and the per-author budget with the real derived keys", async () => {
    await submitReviewAction(...VALID_INPUT);

    expect(mockedRateLimit).toHaveBeenCalledTimes(2);
    expect(mockedRateLimit).toHaveBeenNthCalledWith(1, ipKey, 20, 60_000);
    expect(mockedRateLimit).toHaveBeenNthCalledWith(2, authorKey, 5, 60_000);
  });

  it("rejects with the friendly copy and never looks up the product when the IP tier is exhausted", async () => {
    mockedRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });

    const result = await submitReviewAction(...VALID_INPUT);

    expect(result).toEqual({ ok: false, error: GATE_COPY });
    expect(db.product.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects identically when only the AUTHOR tier is exhausted (the ip ceiling passing)", async () => {
    // The wired gate is `!rateLimit(ipKey).ok || !rateLimit(authorKey).ok` —
    // a refactor that drops the author tier leaves this call passing while
    // the attacker rotates author strings. This pin is the one that catches
    // it: ip ok (default mock), author over budget.
    mockedRateLimit
      .mockReturnValueOnce({ ok: true }) // ip tier passes
      .mockReturnValueOnce({ ok: false, retryAfterSec: 42 }); // author tier exhausted

    const result = await submitReviewAction(...VALID_INPUT);

    expect(result).toEqual({ ok: false, error: GATE_COPY });
    expect(db.product.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("proceeds to the transactional insert + aggregate growth when both tiers pass", async () => {
    const result = await submitReviewAction(...VALID_INPUT);

    expect(result).toEqual({ ok: true });
    expect(db.product.findUnique).toHaveBeenCalledWith({ where: { id: PID }, select: { id: true, isActive: true } });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // The insert carries the unverified guest attribution (no signed-in user).
    expect(db.review.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: PID,
        rating: 5,
        author: "Alice",
        userId: null,
        verified: false,
      }),
    });
    // The aggregate grew through the same tx client: (4.7 × 10 + 5) / 11 =
    // 4.727… → 4.7 (one decimal, the S8-2 growth rule) at 11 reviews.
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: PID },
      data: { rating: 4.7, reviewCount: 11 },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/product/${PID}`);
  });
});
