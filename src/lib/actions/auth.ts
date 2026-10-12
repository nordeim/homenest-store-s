"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scryptHash, scryptVerify } from "@/lib/password";
import { firstError, loginSchema, profileSchema, registerSchema } from "@/lib/validation";

/**
 * Auth server actions — bound to forms via useActionState so they degrade to
 * native POSTs without JS (the action id travels with the form) and pending
 * state is framework-owned. `redirect()` inside an action throws
 * NEXT_REDIRECT, which the framework turns into client navigation — it never
 * reaches the returned state.
 */
export type AuthFormState = { error: string | null };

/** Verify credentials, start a session, land on /account (or /admin). */
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash) {
    return { error: "No account found with this email." };
  }
  if (!scryptVerify(parsed.data.password, user.passwordHash)) {
    return { error: "Incorrect password. Please try again." };
  }
  await createSession(user.id);
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

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: scryptHash(parsed.data.password),
      role: "customer",
    },
  });
  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/account");
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
