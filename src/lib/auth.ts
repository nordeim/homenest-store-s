/**
 * Session auth — DB-backed sessions with an HMAC-signed cookie.
 *
 * Cookie value: `<token>.<hmac(token)>`. The token is a 256-bit random value
 * stored (hashed) in the Session table; the HMAC is integrity-in-depth so a
 * crafted cookie never even reaches the database lookup.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "homenest_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function authSecret(): string {
  return process.env.AUTH_SECRET || "insecure-dev-only-secret-change-me";
}

function sign(token: string): string {
  return createHmac("sha256", authSecret()).update(token).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
};

/** Create a session row and set the signed cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      token: tokenHash(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Resolve the current user from the cookie, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const dot = raw.lastIndexOf(".");
    if (dot <= 0) return null;
    const token = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    if (!safeEqual(sig, sign(token))) return null;
    const session = await db.session.findUnique({
      where: { token: tokenHash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      phone: session.user.phone,
      role: session.user.role,
    };
  } catch {
    return null;
  }
}

/** Delete the session row and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const token = raw.slice(0, raw.lastIndexOf("."));
    try {
      await db.session.deleteMany({ where: { token: tokenHash(token) } });
    } catch {
      // Session already gone — clearing the cookie is still correct.
    }
  }
  store.delete(SESSION_COOKIE);
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "admin";
}
