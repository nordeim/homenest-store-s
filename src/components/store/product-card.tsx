import Image from "next/image";
import Link from "next/link";

import { discountPercent, formatMoney } from "@/lib/money";
import type { ProductCardData } from "@/lib/products";
import { StarRating } from "./star-rating";
import { AddToCartButton, AddToWishlistButton } from "./add-to-cart-button";

/**
 * ProductCard — matches the reference card anatomy: media with stacked
 * [-N%] red pill + [Featured] orange pill, orange uppercase category label,
 * serif product name, amber stars + review count, bold price + struck
 * compare-at price.
 */
export function ProductCard({
  product,
  priority = false,
  inWishlist = false,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Session-11 S11-2: server-rendered wishlist membership for the heart. */
  inWishlist?: boolean;
}) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <Link
        href={`/product/${product.id}`}
        className="relative block aspect-square overflow-hidden bg-secondary"
        aria-label={product.name}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount !== null && (
            <span className="rounded-full bg-badge-sale px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
              {discount}%
            </span>
          )}
          {product.badge && (
            <span className="rounded-full bg-badge-featured px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
              {product.badge}
            </span>
          )}
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <AddToWishlistButton
          productId={product.id}
          productName={product.name}
          initialInWishlist={inWishlist}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{product.categoryName}</p>
        <h3 className="font-display text-base font-semibold leading-snug text-foreground">
          <Link href={`/product/${product.id}`} className="hover:text-primary transition-colors">
            {product.name}
          </Link>
        </h3>
        <div className="flex items-center gap-1.5">
          <StarRating rating={product.rating} />
          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
        </div>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-lg font-bold text-foreground">{formatMoney(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatMoney(product.compareAtPrice)}
            </span>
          )}
        </div>
        <div className="pt-2">
          <AddToCartButton productId={product.id} size="sm" className="w-full">
            Add to Cart
          </AddToCartButton>
        </div>
      </div>
    </article>
  );
}
