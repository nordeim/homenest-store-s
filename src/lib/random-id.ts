/**
 * Request-id generation that survives non-secure origins (session-7 S7-10).
 *
 * `crypto.randomUUID()` exists only in secure contexts (HTTPS / localhost) —
 * a plain-HTTP LAN or staging deploy throws at the call site, which used to
 * kill the checkout page at mount. The server treats the idempotency key as
 * optional, so a degraded (non-UUID) key is strictly better than a crashed
 * checkout. Pure and unit-pinned in tests/unit/session7-hardening.test.ts.
 */
export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues: (array: Uint8Array) => Uint8Array;
}

export function newRequestId(cryptoLike: CryptoLike = globalThis.crypto): string {
  if (typeof cryptoLike.randomUUID === "function") {
    return cryptoLike.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoLike.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
