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

/**
 * Session-8 S8-6: the wishlist is a bounded surface like the address book
 * (session-7 S7-8). A scripted client could otherwise grow WishlistItem rows
 * at the limiter's pace forever. The cap is enforced on BOTH write paths that
 * create items — POST /api/wishlist (friendly 409) and the guest→user merge
 * at login, whose upserts are planned through `planWishlistMerge` (session-10
 * S10-4) so a merge can never push the user over the cap. The wishlist page
 * reads at most this many rows (`take`).
 */
export const MAX_WISHLIST_ITEMS = 100;

/** Minimal shape shared by `db` and transaction clients — just what we touch. */
export interface WishlistCountingClient {
  wishlistItem: {
    count: (args: { where: { wishlistId: string } }) => Promise<number>;
  };
}

/** Thrown by `assertWishlistCap` when the wishlist is full. */
export class WishlistCapError extends Error {
  readonly cap: number;

  constructor(cap: number) {
    super(`Your wishlist is full (${cap} items maximum). Please remove one before adding another.`);
    this.name = "WishlistCapError";
    this.cap = cap;
  }
}

/** Throws WishlistCapError when the wishlist already has MAX_WISHLIST_ITEMS rows. */
export async function assertWishlistCap(
  client: WishlistCountingClient,
  wishlistId: string,
): Promise<void> {
  const count = await client.wishlistItem.count({ where: { wishlistId } });
  if (count >= MAX_WISHLIST_ITEMS) {
    throw new WishlistCapError(MAX_WISHLIST_ITEMS);
  }
}

/**
 * Plan the guest→user wishlist merge (session-10 S10-4). The old merge
 * upserted EVERY guest item unconditionally — the one create path outside
 * the POST cap — so a user at the cap whose guest wishlist held more items
 * ended over `MAX_WISHLIST_ITEMS`, with the overflow permanently invisible
 * behind the page's `take`. The plan keeps the guest's item order, skips
 * products the user already owns (mirroring the upsert's no-op `update: {}`),
 * dedupes repeated guest productIds (the first occurrence wins), and
 * TRUNCATES at the remaining capacity so the merge can never exceed the cap.
 * Pure and unit-pinned; the merge transaction only writes `plan.toAdd`.
 */
export function planWishlistMerge(
  existingProductIds: ReadonlySet<string>,
  guestItems: ReadonlyArray<{ productId: string }>,
  cap: number = MAX_WISHLIST_ITEMS,
): { toAdd: string[]; skipped: number } {
  const remaining = Math.max(0, cap - existingProductIds.size);
  const toAdd: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of guestItems) {
    if (existingProductIds.has(item.productId)) {
      skipped += 1; // already owned — the upsert would be a no-op
      continue;
    }
    if (seen.has(item.productId)) {
      skipped += 1; // guest-internal duplicate
      continue;
    }
    if (toAdd.length >= remaining) {
      skipped += 1; // over the cap — the row the user cannot keep
      continue;
    }
    seen.add(item.productId);
    toAdd.push(item.productId);
  }
  return { toAdd, skipped };
}

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
          // and a retried merge cannot double-write. Session-10 S10-4: the
          // upserts are planned through `planWishlistMerge` so the merge can
          // never push the user's wishlist over MAX_WISHLIST_ITEMS (the old
          // unbounded loop was the one create path outside the POST cap).
          const newToken = randomBytes(24).toString("base64url");
          await db.$transaction(async (tx) => {
            const existing = await tx.wishlistItem.findMany({
              where: { wishlistId: own.id },
              select: { productId: true },
            });
            const plan = planWishlistMerge(
              new Set(existing.map((row) => row.productId)),
              guest.items,
            );
            for (const productId of plan.toAdd) {
              await tx.wishlistItem.upsert({
                where: { wishlistId_productId: { wishlistId: own.id, productId } },
                create: { wishlistId: own.id, productId },
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
