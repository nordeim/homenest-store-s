import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cookieOptions } from "./cart";

/**
 * Server-side wishlist — same token-cookie pattern as the cart. Guest
 * wishlists merge into the user's wishlist on login.
 */
export const WISHLIST_COOKIE = "homenest_wishlist";
const TTL_S = 60 * 60 * 24 * 120; // 120 days

export async function getOrCreateWishlist(userId: string | null): Promise<string> {
  const store = await cookies();
  const token = store.get(WISHLIST_COOKIE)?.value;

  if (userId) {
    const own = await db.wishlist.findUnique({ where: { userId } });
    if (own) {
      if (token && token !== own.token) {
        const guest = await db.wishlist.findUnique({ where: { token }, include: { items: true } });
        if (guest) {
          // Merge inside ONE transaction with idempotent upserts + token
          // rotation — mirrors cart.ts (session-5 S5-7; session-6 S6-2): a
          // mid-loop failure must never leave a half-merged guest wishlist,
          // and a retried merge cannot double-write.
          const newToken = randomBytes(24).toString("base64url");
          await db.$transaction(async (tx) => {
            for (const item of guest.items) {
              await tx.wishlistItem.upsert({
                where: { wishlistId_productId: { wishlistId: own.id, productId: item.productId } },
                create: { wishlistId: own.id, productId: item.productId },
                update: {},
              });
            }
            await tx.wishlist.delete({ where: { id: guest.id } }).catch(() => undefined);
            await tx.wishlist.update({ where: { id: own.id }, data: { token: newToken } });
          });
          store.set(WISHLIST_COOKIE, newToken, { ...cookieOptions(), maxAge: TTL_S });
        }
      }
      return own.id;
    }
    const created = await safeCreateWishlist(userId, token);
    store.set(WISHLIST_COOKIE, created.token, { ...cookieOptions(), maxAge: TTL_S });
    return created.id;
  }

  if (token) {
    const existing = await db.wishlist.findUnique({ where: { token } });
    if (existing) return existing.id;
  }
  const newToken = randomBytes(24).toString("base64url");
  const created = await db.wishlist.create({ data: { token: newToken } });
  store.set(WISHLIST_COOKIE, newToken, { ...cookieOptions(), maxAge: TTL_S });
  return created.id;
}

/**
 * Create the user's wishlist, surviving the token @unique race (session-6
 * S6-2): two concurrent first requests can both observe "no wishlist" and
 * both create — the loser hits P2002 and re-reads the winner instead of 500ing.
 *
 * Session-7 S7-1 (mirrors cart.ts): the P2002 winner is frequently the GUEST
 * wishlist holding the cookie token — the first-login path. The row is
 * claimed with a GUARDED update (`userId: null`), never stealing a row
 * another user owns; a lost claim race self-heals via the merge branch.
 */
async function safeCreateWishlist(userId: string, token: string | undefined): Promise<{ id: string; token: string }> {
  try {
    return await db.wishlist.create({
      data: { userId, token: token ?? randomBytes(24).toString("base64url") },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const winner = await db.wishlist.findFirst({
      where: token ? { token } : { userId },
      orderBy: { id: "asc" },
    });
    if (winner) {
      await db.wishlist
        .updateMany({ where: { id: winner.id, userId: null }, data: { userId } })
        .catch(() => undefined);
      return winner;
    }
    throw error;
  }
}

export async function getWishlistIds(): Promise<Set<string>> {
  const { getCurrentUser } = await import("./auth");
  const user = await getCurrentUser();
  const store = await cookies();
  const token = store.get(WISHLIST_COOKIE)?.value;

  if (user) {
    const own = await db.wishlist.findUnique({
      where: { userId: user.id },
      include: { items: { select: { productId: true } } },
    });
    if (own) return new Set(own.items.map((i) => i.productId));
  }
  if (token) {
    const guest = await db.wishlist.findUnique({
      where: { token },
      include: { items: { select: { productId: true } } },
    });
    if (guest) return new Set(guest.items.map((i) => i.productId));
  }
  return new Set();
}
