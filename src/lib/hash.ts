/**
 * Client-only demo password hashing. This app has no server; credentials never
 * leave the browser. SHA-256 avoids storing plaintext in localStorage, but this
 * is NOT a substitute for a real backend auth system (bcrypt/argon2 + server
 * verification) and must not be treated as production-grade secret storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
