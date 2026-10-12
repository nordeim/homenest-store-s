/**
 * Server-side cart — DB-backed with a guest token cookie.
 *
 * The cart is the same Cart row whether the visitor is a guest (token cookie)
 * or signed in (userId claim). On login the guest cart is claimed by userId;
 * if the user already had a cart, the guest items are merged into it.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { computeMergedQuantities } from "./cart-merge";

export const CART_COOKIE = "homenest_cart";
const CART_TTL_S = 60 * 60 * 24 * 60; // 60 days

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  unitPrice: number; // cents
  quantity: number;
  stock: number;
  lineTotal: number; // cents
};

export type CartSummary = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number; // cents
};

function parseImages(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Read the cart token cookie, or null. */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Get (or lazily create) the caller's cart id, setting the cookie for guests. */
export async function getOrCreateCart(userId: string | null): Promise<string> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;

  if (userId) {
    // Signed in: the user's own cart wins.
    const own = await db.cart.findUnique({ where: { userId } });
    if (own) {
      // Merge a guest cart into the user cart if one rides along. The whole
      // merge (read → planned upserts → guest-cart delete → token rotation)
      // runs inside ONE transaction — a mid-loop failure must never leave a
      // half-merged guest cart behind (session-5 S5-7). Quantities come from
      // the pure planner (tests/unit/cart-merge.test.ts): per-product sums,
      // 99 ceiling, zero-sum lines dropped — and the writes are idempotent
      // final quantities (`update: { quantity }`, not `increment`), so a
      // retried merge can never double-count.
      if (token && token !== own.token) {
        const guest = await db.cart.findUnique({
          where: { token },
          include: { items: true },
        });
        if (guest) {
          const ownItems = await db.cartItem.findMany({
            where: { cartId: own.id },
            select: { productId: true, quantity: true },
          });
          const plan = computeMergedQuantities(
            ownItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            guest.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          );

          const newToken = randomBytes(24).toString("base64url");
          const mergedId = await db.$transaction(async (tx) => {
            for (const [productId, quantity] of plan) {
              await tx.cartItem.upsert({
                where: { cartId_productId: { cartId: own.id, productId } },
                create: { cartId: own.id, productId, quantity },
                update: { quantity },
              });
            }
            await tx.cart.delete({ where: { id: guest.id } }).catch(() => undefined);
            const merged = await tx.cart.update({ where: { id: own.id }, data: { token: newToken } });
            return merged.id;
          });

          // Cookie write happens after the tx commits (cookies() is request-
          // scoped, not transactional) — a retry re-derives the same plan.
          store.set(CART_COOKIE, newToken, { ...cookieOptions(), maxAge: CART_TTL_S });
          return mergedId;
        }
      }
      return own.id;
    }
    const created = await db.cart.create({
      data: { userId, token: token ?? randomBytes(24).toString("base64url") },
    });
    store.set(CART_COOKIE, created.token, { ...cookieOptions(), maxAge: CART_TTL_S });
    return created.id;
  }

  // Guest: token cookie identifies the cart.
  if (token) {
    const existing = await db.cart.findUnique({ where: { token } });
    if (existing) return existing.id;
  }
  const newToken = randomBytes(24).toString("base64url");
  const created = await db.cart.create({ data: { token: newToken } });
  store.set(CART_COOKIE, newToken, { ...cookieOptions(), maxAge: CART_TTL_S });
  return created.id;
}

/** Best-effort read of the current cart's id (never creates). */
export async function findCartId(userId: string | null): Promise<string | null> {
  if (userId) {
    const own = await db.cart.findUnique({ where: { userId } });
    if (own) return own.id;
  }
  const token = await readCartToken();
  if (!token) return null;
  const guest = await db.cart.findUnique({ where: { token } });
  return guest?.id ?? null;
}

/** Shared cookie attributes for all durable token cookies (cart, wishlist). */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/** Full cart lines joined against products, with derived totals. */
export async function getCartSummary(cartId: string | null): Promise<CartSummary> {
  if (!cartId) return { lines: [], itemCount: 0, subtotal: 0 };
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: { product: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!cart) return { lines: [], itemCount: 0, subtotal: 0 };
  const lines: CartLine[] = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    slug: item.product.slug,
    image: parseImages(item.product.images)[0] ?? "/images/placeholder.svg",
    unitPrice: item.product.price,
    quantity: item.quantity,
    stock: item.product.stock,
    lineTotal: item.product.price * item.quantity,
  }));
  return {
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
  };
}
