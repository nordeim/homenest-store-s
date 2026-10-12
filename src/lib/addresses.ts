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
