import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCatalogStore } from "@/store/catalogStore";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export function WishlistGrid() {
  const productIds = useWishlistStore((s) => s.productIds);
  const products = useCatalogStore((s) => s.products);
  const items = products.filter((p) => productIds.includes(p.id));

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Save items you love for later by tapping the heart icon on any product."
        action={<LinkButton to="/products">Browse Products</LinkButton>}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
