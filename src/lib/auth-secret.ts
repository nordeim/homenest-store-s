/**
 * AUTH_SECRET enforcement — the HMAC key that signs the session cookie.
 *
 * Extracted from `src/lib/auth.ts` so the production gate is unit-testable.
 * The dev fallback keeps local development friction-free, but production must
 * never silently run on a public constant (any future signed-payload feature
 * would inherit a forgeable key).
 */

export const DEV_FALLBACK_SECRET = "insecure-dev-only-secret-change-me";

/** Throw when running in production without a real AUTH_SECRET. */
export function assertAuthSecret(env: {
  NODE_ENV?: string | undefined;
  AUTH_SECRET?: string | undefined;
}): void {
  if (env.NODE_ENV !== "production") return;
  const secret = env.AUTH_SECRET?.trim();
  if (!secret || secret === DEV_FALLBACK_SECRET) {
    throw new Error(
      "AUTH_SECRET must be set to a strong random value in production — refusing to sign session cookies with the dev fallback.",
    );
  }
}
