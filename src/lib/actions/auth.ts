"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { getOrCreateCart } from "@/lib/cart";
import { db } from "@/lib/db";
import { getOrCreateWishlist } from "@/lib/wishlist";
import { scryptHash, scryptVerify } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { firstError, loginSchema, profileSchema, registerSchema } from "@/lib/validation";

/**
 * Auth server actions — bound to forms via useActionState so they degrade to
 * native POSTs without JS (the action id travels with the form) and pending
 * state is framework-owned. `redirect()` inside an action throws
 * NEXT_REDIRECT, which the framework turns into client navigation — it never
 * reaches the returned state.
 */
export type AuthFormState = { error: string | null };

/** Uniform message for every credential failure — never reveals whether the account exists. */
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Burn target for unknown accounts: verifying the submitted password against
 * a real scrypt hash keeps the response time of "unknown email" and "wrong
 * password" indistinguishable (anti-enumeration, anti-timing).
 */
let dummyHash: string | null = null;
function burnDummyScrypt(password: string): void {
  dummyHash ??= scryptHash("dummy-password-for-unknown-accounts");
  scryptVerify(password, dummyHash);
}

/** Opportunistically purge expired sessions (no cron in the standalone deploy). */
async function purgeExpiredSessions(): Promise<void> {
  try {
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Housekeeping only — never block a login on the purge.
  }
}

/**
 * Claim the guest cart + wishlist right after the session starts. This is the
 * documented invariant "on login the guest cart merges into the user's": the
 * merge lives in getOrCreateCart/getOrCreateWishlist, so WITHOUT this call a
 * guest with a full cart who signs in would see their old (possibly empty)
 * cart until the next add-to-cart. Best-effort — a merge failure must never
 * block a login (server actions may set cookies, so this works here).
 */
async function mergeGuestCarts(userId: string): Promise<void> {
  try {
    await getOrCreateCart(userId);
    await getOrCreateWishlist(userId);
  } catch {
    // The merge retried at the next cart/wishlist touch; login proceeds.
  }
}

/** Verify credentials, start a session, land on /account (or /admin). */
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const limit = rateLimit(`login:${parsed.data.email}`, 10, 60_000);
  if (!limit.ok) {
    return { error: `Too many sign-in attempts. Please try again in ${limit.retryAfterSec}s.` };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash) {
    burnDummyScrypt(parsed.data.password);
    return { error: INVALID_CREDENTIALS };
  }
  if (!scryptVerify(parsed.data.password, user.passwordHash)) {
    return { error: INVALID_CREDENTIALS };
  }

  void purgeExpiredSessions();
  await createSession(user.id);
  await mergeGuestCarts(user.id);
  revalidatePath("/", "layout");
  redirect(user.role === "admin" ? "/admin" : "/account");
}

/** Create a customer account, sign them in, land on /account. */
export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const limit = rateLimit(`register:${parsed.data.email}`, 5, 60_000);
  if (!limit.ok) {
    return { error: `Too many registration attempts. Please try again in ${limit.retryAfterSec}s.` };
  }

  try {
    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: scryptHash(parsed.data.password),
        role: "customer",
      },
    });
    await createSession(user.id);
    await mergeGuestCarts(user.id);
    revalidatePath("/", "layout");
    redirect("/account");
  } catch (error) {
    // The pre-check + create races under concurrent registrations — map the
    // unique-constraint violation to the friendly message instead of a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfileAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });
  revalidatePath("/account");
  return { ok: true };
}
