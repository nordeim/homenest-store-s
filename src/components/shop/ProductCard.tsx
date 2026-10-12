import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "@/types";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

export function ProductCard({ product }: { product: Product }) {
  const inWishlist = useWishlistStore((s) => s.has(product.id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const addItem = useCartStore((s) => s.addItem);
  const push = useToastStore((s) => s.push);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock <= 0) return;
    addItem(product.id, 1);
    push(`${product.name} added to cart`, "success");
  }

  function handleToggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
    push(inWishlist ? "Removed from wishlist" : "Added to wishlist", "info");
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-cream-50 transition-shadow hover:shadow-lifted"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isNew && <Badge tone="forest">New</Badge>}
          {product.compareAtPrice && <Badge tone="ember">Sale</Badge>}
          {product.stock === 0 && <Badge tone="red">Out of Stock</Badge>}
        </div>
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={inWishlist}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream-50/90 text-ink-600 shadow-sm hover:text-ember-600"
        >
          <Heart size={16} className={cn(inWishlist && "fill-ember-600 text-ember-600")} />
        </button>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-2 rounded-lg bg-forest-900 py-2.5 text-sm font-semibold text-cream-50 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
        >
          <ShoppingBag size={15} /> Quick Add
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {product.categorySlug.replace("-", " ")}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold text-ink-900">{product.name}</h3>
        <Rating value={product.rating} count={product.reviewCount} size={14} />
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold text-ink-900">{formatCurrency(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-ink-400 line-through">
              {formatCurrency(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
