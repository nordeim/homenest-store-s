import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";

import { db } from "@/lib/db";
import { toCardData } from "@/lib/products";
import { getWishlistIds, MAX_WISHLIST_ITEMS } from "@/lib/wishlist";
import { ProductCard } from "@/components/store/product-card";

import { AddAllToCartButton } from "./add-all-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Wishlist",
  description: "The HomeNest Kitchen products you saved for later.",
  // Per-visitor private content — nothing here for a search engine.
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const ids = await getWishlistIds();
  const products =
    ids.size > 0
      ? await db.product.findMany({
          where: { id: { in: Array.from(ids) }, isActive: true },
          include: { category: { select: { name: true, slug: true } } },
          orderBy: { createdAt: "desc" },
          // The write path caps the wishlist at MAX_WISHLIST_ITEMS (S8-6);
          // the read mirrors that bound instead of loading unbounded rows.
          take: MAX_WISHLIST_ITEMS,
        })
      : [];

  if (products.length === 0) {
    return (
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <Heart className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Your wishlist is empty</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Save your favorite items for later and they will show up here.
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex flex-col gap-8 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">My Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {products.length} saved item{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <AddAllToCartButton productIds={products.map((p) => p.id)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={toCardData(p, p.category)} inWishlist={true} />
        ))}
      </div>
    </div>
  );
}
