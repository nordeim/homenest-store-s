import { WishlistGrid } from "@/components/shop/WishlistGrid";

export function Wishlist() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Your Wishlist</h1>
      <div className="mt-8">
        <WishlistGrid />
      </div>
    </div>
  );
}
