"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";

import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

/**
 * AddAllToCartButton — adds every wishlist product to the cart with ONE
 * request to /api/cart/bulk (session-8 S8-6), then routes to /cart. Skipped
 * lines (gone/inactive products AND lines sold out under the click — both
 * counted in the response since session-10 S10-5) are reported in a summary
 * toast instead of blocking.
 */
export function AddAllToCartButton({ productIds }: { productIds: string[] }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const { setCartCount } = useStore();
  const router = useRouter();

  async function addAll() {
    if (pending || productIds.length === 0) return;
    setPending(true);
    try {
      const res = await fetch("/api/cart/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: productIds.map((productId) => ({ productId, quantity: 1 })) }),
      });
      const data = (await res.json()) as { error?: string; itemCount?: number; added?: number; skipped?: number };
      if (!res.ok) {
        setPending(false);
        toast({
          title: "Could not add items",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      setPending(false);
      const added = data.added ?? 0;
      const skipped = data.skipped ?? 0;
      if (added > 0) {
        toast({
          title: added === productIds.length ? "All items added to cart" : `Added ${added} of ${productIds.length} items`,
          description:
            skipped > 0
              ? `${skipped} item${skipped === 1 ? "" : "s"} could not be added — they may be out of stock.`
              : undefined,
          variant: "success",
        });
        router.push("/cart");
      } else {
        toast({
          title: "Could not add items",
          description: "They may be out of stock. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      setPending(false);
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Button type="button" onClick={addAll} disabled={pending || productIds.length === 0}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <ShoppingBag className="h-4 w-4" aria-hidden />
      )}
      {pending ? "Adding…" : "Add All to Cart"}
    </Button>
  );
}
