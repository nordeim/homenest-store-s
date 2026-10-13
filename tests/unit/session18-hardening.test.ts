// Session-18 S18-1 / S18-2 / C8 — the checkout saveAddress extraction, its
// at-cap skip-save contract, and the friendly cart-quantity ceiling messages.
//
// The checkout route module is import-unsafe in the Vitest node env
// (next/server — the carried convention), so the in-tx saveAddress block
// lives at the lib level (`saveCheckoutAddressInTx`, the S11-6 module
// pattern) and the pin lives here with a fake typed to the minimal surface
// the helper touches. The db client is a fake; call ORDER is pinned with
// `invocationCallOrder` (unset defaults must precede the create).
import { describe, expect, it, vi } from "vitest";

import {
  AddressCapError,
  MAX_ADDRESSES_PER_USER,
  saveCheckoutAddressInTx,
  type CheckoutAddressSavingClient,
} from "@/lib/addresses";
import {
  cartBulkSchema,
  cartLinePatchSchema,
  cartMutateSchema,
} from "@/lib/validation";

const DRAFT = {
  fullName: "Jordan Rivera",
  phone: "+1 (512) 555-0133",
  line1: "123 Cedar Lane",
  line2: "",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  country: "United States",
};

type Calls = {
  count: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

function fakeClient(overrides: {
  count?: number;
  countError?: unknown;
  createError?: unknown;
} = {}): { client: CheckoutAddressSavingClient; calls: Calls } {
  const count =
    overrides.countError
      ? vi.fn().mockRejectedValue(overrides.countError)
      : vi.fn().mockResolvedValue(overrides.count ?? 0);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const create = overrides.createError
    ? vi.fn().mockRejectedValue(overrides.createError)
    : vi.fn().mockResolvedValue({});
  return {
    client: { address: { count, updateMany, create } } satisfies CheckoutAddressSavingClient,
    calls: { count, updateMany, create },
  };
}

describe("saveCheckoutAddressInTx (S18-1 / C8)", () => {
  it("saves under the cap: unset defaults first, then create with isDefault true (order pinned)", async () => {
    const { client, calls } = fakeClient({ count: 5 });
    const outcome = await saveCheckoutAddressInTx(client, "user-1", DRAFT);
    expect(outcome).toBe("saved");
    expect(calls.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(calls.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        label: "Home",
        fullName: DRAFT.fullName,
        phone: DRAFT.phone,
        line1: DRAFT.line1,
        line2: null,
        city: DRAFT.city,
        state: DRAFT.state,
        postalCode: DRAFT.postalCode,
        country: DRAFT.country,
        isDefault: true,
      },
    });
    const unsetAt = calls.updateMany.mock.invocationCallOrder[0];
    const createAt = calls.create.mock.invocationCallOrder[0];
    expect(typeof unsetAt === "number" && typeof createAt === "number" && unsetAt < createAt).toBe(
      true,
    );
  });

  it("honors a non-empty label and line2 verbatim", async () => {
    const { client, calls } = fakeClient();
    await saveCheckoutAddressInTx(client, "user-1", { ...DRAFT, label: "Office", line2: "Suite 4" });
    expect(calls.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ label: "Office", line2: "Suite 4" }),
    });
  });

  it(`returns "at-cap" at ${MAX_ADDRESSES_PER_USER} addresses and performs NO writes (the S7-8 skip-save contract)`, async () => {
    const { client, calls } = fakeClient({ count: MAX_ADDRESSES_PER_USER });
    const outcome = await saveCheckoutAddressInTx(client, "user-1", DRAFT);
    expect(outcome).toBe("at-cap");
    expect(calls.updateMany).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
  });

  it("maps the cap error by identity: a thrown AddressCapError from the count lands on 'at-cap'", async () => {
    const { client, calls } = fakeClient({ countError: new AddressCapError(MAX_ADDRESSES_PER_USER) });
    const outcome = await saveCheckoutAddressInTx(client, "user-1", DRAFT);
    expect(outcome).toBe("at-cap");
    expect(calls.create).not.toHaveBeenCalled();
  });

  it("rethrows unrelated count failures (unknown errors are never swallowed into a skip)", async () => {
    const { client } = fakeClient({ countError: new Error("db offline") });
    await expect(saveCheckoutAddressInTx(client, "user-1", DRAFT)).rejects.toThrow("db offline");
  });

  it("rethrows unrelated create failures (the S13-2 contract: unknown errors are not swallowed)", async () => {
    const { client } = fakeClient({ createError: new Error("write failed") });
    await expect(saveCheckoutAddressInTx(client, "user-1", DRAFT)).rejects.toThrow("write failed");
  });
});

describe("cart quantity ceiling carries store copy, not the Zod default (S18-2 / C8)", () => {
  const MESSAGE = "Quantity is limited to 99 per item.";

  it("cartMutateSchema rejects 100 with the friendly message", () => {
    const parsed = cartMutateSchema.safeParse({ productId: "p1", quantity: 100 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(MESSAGE);
  });

  it("cartLinePatchSchema rejects 100 with the friendly message (0-deletes-line floor intact)", () => {
    const parsed = cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 100 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(MESSAGE);
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 0 }).success).toBe(true);
  });

  it("cartBulkSchema rejects an over-ceiling per-line quantity with the friendly message", () => {
    const parsed = cartBulkSchema.safeParse({ items: [{ productId: "p1", quantity: 100 }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(MESSAGE);
  });

  it("boundary values 1 and 99 stay valid everywhere", () => {
    expect(cartMutateSchema.safeParse({ productId: "p1", quantity: 99 }).success).toBe(true);
    expect(cartLinePatchSchema.safeParse({ lineId: "l1", quantity: 99 }).success).toBe(true);
    expect(cartBulkSchema.safeParse({ items: [{ productId: "p1", quantity: 1 }] }).success).toBe(true);
  });
});
