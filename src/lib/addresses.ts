/**
 * Address-book integrity (session-7 S7-8).
 *
 * The Address table was the one per-user surface with no ceiling: every
 * "save this address" checkout minted another row, so a scripted client (or
 * an accidentally repeated checkout) could grow it without bound, and each
 * new row carried `isDefault: true` — making the checkout page's
 * `findFirst({ isDefault: true })` an arbitrary pick among many defaults.
 *
 * The cap is enforced at every write path that creates addresses (the
 * addresses API returns a friendly 409; checkout skips the save and lets the
 * order proceed — the address rides on the order regardless). Default-making
 * writes unset the previous defaults inside the same transaction, so "the
 * default address" is always the most recently saved one.
 */

export const MAX_ADDRESSES_PER_USER = 20;

/** Minimal shape shared by `db` and transaction clients — just what we touch. */
export interface AddressCountingClient {
  address: {
    count: (args: { where: { userId: string } }) => Promise<number>;
  };
}

/** Thrown by `assertAddressCap` when the user's address book is full. */
export class AddressCapError extends Error {
  readonly cap: number;

  constructor(cap: number) {
    super(`Your address book is full (${cap} addresses maximum). Please remove one before saving another.`);
    this.name = "AddressCapError";
    this.cap = cap;
  }
}

/** Throws AddressCapError when the user already has MAX_ADDRESSES_PER_USER rows. */
export async function assertAddressCap(
  client: AddressCountingClient,
  userId: string,
): Promise<void> {
  const count = await client.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES_PER_USER) {
    throw new AddressCapError(MAX_ADDRESSES_PER_USER);
  }
}

/**
 * Minimal shape of `db` / a transaction client that `promoteAddressInTx`
 * touches — keeps the helper unit-testable with an in-memory fake.
 */
export interface AddressPromotingClient {
  address: {
    updateMany: (args: {
      where: { userId: string; id: string } | { userId: string; id: { not: string } };
      data: { isDefault: boolean };
    }) => Promise<{ count: number }>;
  };
}

/** Thrown when the address vanished before its promotion could win. */
export class AddressGoneError extends Error {
  constructor() {
    super("Address not found.");
    this.name = "AddressGoneError";
  }
}

/**
 * Promote one address to `isDefault: true` and unset the others, race-safe
 * (session-9 S9-3). The PROMOTE runs first as a scoped conditional
 * `updateMany`: if a concurrent delete removed the row, `count === 0` throws
 * `AddressGoneError` and the caller's transaction aborts — the previous
 * defaults are never cleared for a promotion that lost the race (the old
 * unset-all-then-update order could strand a user with zero defaults).
 * Must run inside the caller's `$transaction` so the pair is atomic.
 */
export async function promoteAddressInTx(
  client: AddressPromotingClient,
  userId: string,
  id: string,
): Promise<void> {
  const promoted = await client.address.updateMany({
    where: { id, userId },
    data: { isDefault: true },
  });
  if (promoted.count === 0) {
    throw new AddressGoneError();
  }
  await client.address.updateMany({
    where: { userId, id: { not: id } },
    data: { isDefault: false },
  });
}

/**
 * Minimal shape of `db` / a transaction client that
 * `reassignDefaultAfterDeleteInTx` touches — the promote client plus the
 * scoped newest-row lookup.
 */
export interface AddressReassigningClient extends AddressPromotingClient {
  address: AddressPromotingClient["address"] & {
    findFirst: (args: {
      where: { userId: string };
      orderBy: { createdAt: "desc" };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * After a DELETE removes the user's DEFAULT address, the remaining rows are
 * all `isDefault: false` — checkout's `findFirst({ isDefault: true })` would
 * return null and prefill would silently die (session-10 S10-1). This helper
 * re-promotes the NEWEST remaining address inside the caller's delete
 * transaction, so the single-default invariant survives the delete path with
 * zero stranded states. A non-default delete (or a book left empty) no-ops.
 */
export async function reassignDefaultAfterDeleteInTx(
  client: AddressReassigningClient,
  userId: string,
  deletedWasDefault: boolean,
): Promise<void> {
  if (!deletedWasDefault) return;
  const newest = await client.address.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!newest) return;
  await promoteAddressInTx(client, userId, newest.id);
}

/** The parsed checkout address fields (addressSchema's output shape). */
export interface CheckoutAddressDraft {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Minimal shape of `db` / a transaction client that
 * `saveCheckoutAddressInTx` touches — keeps the helper unit-testable with an
 * in-memory fake (the session-18 S18-1 extraction of the checkout route's
 * in-tx saveAddress block).
 */
export interface CheckoutAddressSavingClient {
  address: {
    count: (args: { where: { userId: string } }) => Promise<number>;
    updateMany: (args: {
      where: { userId: string; isDefault: true };
      data: { isDefault: boolean };
    }) => Promise<{ count: number }>;
    create: (args: {
      data: {
        userId: string;
        label: string;
        fullName: string;
        phone: string;
        line1: string;
        line2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        isDefault: boolean;
      };
    }) => Promise<unknown>;
  };
}

/**
 * The checkout tx's best-effort address-book save (session-7 S7-8), extracted
 * from the checkout route (session-18 S18-1) so its contract is unit-pinned
 * and shared with any future in-tx caller.
 *
 * Returns `"saved"` after unsetting the previous defaults and creating the
 * new row with `isDefault: true` (so `findFirst({ isDefault: true })` stays
 * deterministic — the latest save wins), or `"at-cap"` when the book is
 * full: the caller KEEPS THE ORDER and skips only the bookkeeping save (the
 * address rides on the order in shippingAddressJson regardless).
 *
 * The cap gate is the PRE-create `assertAddressCap` (a fast-fail), NOT a
 * post-create throw — deliberately the OPPOSITE of the S11-6/S16-1 create
 * paths: a post-create throw here would roll back the ENTIRE checkout
 * transaction (order, stock, coupon), violating the order-still-places
 * invariant, and Prisma interactive transactions have no savepoints. The
 * residual race (two concurrent checkouts by the same user at exactly
 * cap−1 land one extra row) is bounded and benign — recorded as accepted
 * debt in AGENTS.md (the S17-3 pattern). Unknown errors rethrow so the
 * caller's transaction aborts honestly (the S13-2 contract).
 */
export async function saveCheckoutAddressInTx(
  client: CheckoutAddressSavingClient,
  userId: string,
  address: CheckoutAddressDraft,
): Promise<"saved" | "at-cap"> {
  try {
    await assertAddressCap(client, userId);
    // Session-19 S19-2: the unset targets ONLY the previous defaults — the
    // exact clause the pre-extraction checkout block used (touching every
    // row of the book was a subtle S18-1 extraction delta; restoring the
    // scoped shape keeps the checkout tx's writes minimal).
    await client.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    await client.address.create({
      data: {
        userId,
        label: address.label || "Home",
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ? address.line2 : null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: true,
      },
    });
    return "saved";
  } catch (error) {
    if (error instanceof AddressCapError) return "at-cap";
    throw error;
  }
}
