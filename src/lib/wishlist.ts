import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

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
          for (const item of guest.items) {
            await db.wishlistItem.upsert({
              where: { wishlistId_productId: { wishlistId: own.id, productId: item.productId } },
              create: { wishlistId: own.id, productId: item.productId },
              update: {},
            });
          }
          await db.wishlist.delete({ where: { id: guest.id } }).catch(() => undefined);
        }
      }
      return own.id;
    }
    const created = await db.wishlist.create({
      data: { userId, token: token ?? randomBytes(24).toString("base64url") },
    });
    store.set(WISHLIST_COOKIE, created.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL_S });
    return created.id;
  }

  if (token) {
    const existing = await db.wishlist.findUnique({ where: { token } });
    if (existing) return existing.id;
  }
  const newToken = randomBytes(24).toString("base64url");
  const created = await db.wishlist.create({ data: { token: newToken } });
  store.set(WISHLIST_COOKIE, newToken, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL_S });
  return created.id;
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
