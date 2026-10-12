import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing — Node's scrypt (memory-hard, no native deps beyond Node
 * itself). Format: `scrypt$N$r$p$saltB64$hashB64`.
 *
 * Pure node:crypto so both the Next server runtime and `tsx prisma/seed.ts`
 * can import it without a server-only guard.
 */
const N = 16384; // 2^14 — OWASP 2023 baseline for interactive logins
const R = 8;
const P = 1;
const KEYLEN = 64;

export function scryptHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function scryptVerify(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, rStr, pStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const expected = Buffer.from(hashB64 as string, "base64");
    const actual = scryptSync(password, Buffer.from(saltB64 as string, "base64"), expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
