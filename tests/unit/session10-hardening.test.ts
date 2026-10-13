import { describe, expect, it } from "vitest";

import {
  AddressCapError,
  MAX_ADDRESSES_PER_USER,
  assertAddressCap,
  reassignDefaultAfterDeleteInTx,
} from "@/lib/addresses";
import { planWishlistMerge } from "@/lib/wishlist";

// ---------------------------------------------------------------------------
// S10-1 — reassign the default after the default address is deleted
// ---------------------------------------------------------------------------

type ReassignCalls = {
  findFirst: Array<{
    where: { userId: string };
    orderBy: { createdAt: string };
    select: { id: true };
  }>;
  promote: Array<{ where: { userId: string; id: string }; data: { isDefault: boolean } }>;
  unset: Array<{ where: { userId: string; id: unknown }; data: { isDefault: boolean } }>;
};

/** In-memory fake of the minimal Prisma surface reassignDefaultAfterDeleteInTx touches. */
function makeFakeReassignClient(newestRemainingId: string | null) {
  const calls: ReassignCalls = { findFirst: [], promote: [], unset: [] };
  const client = {
    address: {
      findFirst: async (args: {
        where: { userId: string };
        orderBy: { createdAt: string };
        select: { id: true };
      }) => {
        calls.findFirst.push(args);
        return newestRemainingId ? { id: newestRemainingId } : null;
      },
      updateMany: async (args: {
        where: { userId: string; id: string } | { userId: string; id: { not: string } };
        data: { isDefault: boolean };
      }) => {
        if (args.data.isDefault) {
          calls.promote.push(args as { where: { userId: string; id: string }; data: { isDefault: boolean } });
          return { count: 1 };
        }
        calls.unset.push(args as { where: { userId: string; id: unknown }; data: { isDefault: boolean } });
        return { count: 0 };
      },
    },
  };
  return { client, calls };
}

describe("reassignDefaultAfterDeleteInTx (S10-1)", () => {
  it("promotes the newest remaining address when the deleted row was the default", async () => {
    const { client, calls } = makeFakeReassignClient("addr-newest");
    await reassignDefaultAfterDeleteInTx(client, "user-1", true);
    // The replacement default is the NEWEST remaining row (scoped + id-only).
    expect(calls.findFirst).toEqual([
      { where: { userId: "user-1" }, orderBy: { createdAt: "desc" }, select: { id: true } },
    ]);
    // The promotion is the race-safe promote-first write (S9-3).
    expect(calls.promote).toEqual([
      { where: { userId: "user-1", id: "addr-newest" }, data: { isDefault: true } },
    ]);
    expect(calls.unset).toEqual([
      { where: { userId: "user-1", id: { not: "addr-newest" } }, data: { isDefault: false } },
    ]);
  });

  it("no-ops when no addresses remain after the default is deleted", async () => {
    const { client, calls } = makeFakeReassignClient(null);
    await reassignDefaultAfterDeleteInTx(client, "user-1", true);
    expect(calls.findFirst).toHaveLength(1);
    expect(calls.promote).toEqual([]);
    expect(calls.unset).toEqual([]);
  });

  it("skips the lookup entirely when the deleted row was not the default", async () => {
    const { client, calls } = makeFakeReassignClient("addr-newest");
    await reassignDefaultAfterDeleteInTx(client, "user-1", false);
    expect(calls.findFirst).toEqual([]);
    expect(calls.promote).toEqual([]);
    expect(calls.unset).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// S10-3 — the address cap check (pinned so it can safely move inside the tx)
// ---------------------------------------------------------------------------

function makeFakeCapClient(count: number) {
  const calls: Array<{ where: { userId: string } }> = [];
  const client = {
    address: {
      count: async (args: { where: { userId: string } }) => {
        calls.push(args);
        return count;
      },
    },
  };
  return { client, calls };
}

describe("assertAddressCap (S10-3)", () => {
  it("passes when the user is under the cap", async () => {
    const { client, calls } = makeFakeCapClient(MAX_ADDRESSES_PER_USER - 1);
    await expect(assertAddressCap(client, "user-1")).resolves.toBeUndefined();
    expect(calls).toEqual([{ where: { userId: "user-1" } }]);
  });

  it("throws the actionable AddressCapError at the cap", async () => {
    const { client } = makeFakeCapClient(MAX_ADDRESSES_PER_USER);
    try {
      await assertAddressCap(client, "user-1");
      expect.unreachable("expected AddressCapError");
    } catch (error) {
      expect(error).toBeInstanceOf(AddressCapError);
      expect((error as AddressCapError).message).toContain("remove one before saving another");
    }
  });
});

// ---------------------------------------------------------------------------
// S10-4 — the wishlist merge never pushes the user over the cap
// ---------------------------------------------------------------------------

describe("planWishlistMerge (S10-4)", () => {
  it("returns an empty plan for an empty guest wishlist", () => {
    const plan = planWishlistMerge(new Set(["p-1"]), [], 100);
    expect(plan.toAdd).toEqual([]);
    expect(plan.skipped).toBe(0);
  });

  it("keeps guest order for all-new items", () => {
    const plan = planWishlistMerge(new Set<string>(), [{ productId: "p-3" }, { productId: "p-1" }], 100);
    expect(plan.toAdd).toEqual(["p-3", "p-1"]);
    expect(plan.skipped).toBe(0);
  });

  it("skips products the user already owns", () => {
    const plan = planWishlistMerge(new Set(["p-1"]), [{ productId: "p-1" }, { productId: "p-2" }], 100);
    expect(plan.toAdd).toEqual(["p-2"]);
    expect(plan.skipped).toBe(1);
  });

  it("dedupes repeated guest productIds, keeping the first occurrence", () => {
    const plan = planWishlistMerge(
      new Set<string>(),
      [{ productId: "p-1" }, { productId: "p-2" }, { productId: "p-1" }],
      100,
    );
    expect(plan.toAdd).toEqual(["p-1", "p-2"]);
    expect(plan.skipped).toBe(1);
  });

  it("truncates at the remaining capacity (near-cap partial merge)", () => {
    const existing = new Set(Array.from({ length: 98 }, (_, i) => `p-owned-${i}`));
    const guest = Array.from({ length: 10 }, (_, i) => ({ productId: `p-guest-${i}` }));
    const plan = planWishlistMerge(existing, guest, 100);
    expect(plan.toAdd).toEqual(["p-guest-0", "p-guest-1"]);
    expect(plan.skipped).toBe(8);
  });

  it("adds nothing when the wishlist is already full", () => {
    const existing = new Set(Array.from({ length: 100 }, (_, i) => `p-owned-${i}`));
    const guest = [{ productId: "p-guest-0" }, { productId: "p-guest-1" }];
    const plan = planWishlistMerge(existing, guest, 100);
    expect(plan.toAdd).toEqual([]);
    expect(plan.skipped).toBe(2);
  });
});
