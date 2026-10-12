"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";

import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

/**
 * AddAllToCartButton — adds every wishlist product to the cart with
 * sequential POSTs to /api/cart, then routes to /cart. Items that fail
 * (e.g. out of stock) are reported in a summary toast instead of blocking.
 */
export function AddAllToCartButton({ productIds }: { productIds: string[] }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const { setCartCount } = useStore();
  const router = useRouter();

  async function addAll() {
    if (pending || productIds.length === 0) return;
    setPending(true);
    let added = 0;
    let failed = 0;
    let itemCount: number | null = null;

    for (const productId of productIds) {
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity: 1 }),
        });
        if (res.ok) {
          added += 1;
          const data = (await res.json()) as { itemCount?: number };
          if (typeof data.itemCount === "number") itemCount = data.itemCount;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    if (itemCount !== null) setCartCount(itemCount);
    setPending(false);

    if (added > 0) {
      toast({
        title:
          added === productIds.length
            ? "All items added to cart"
            : `Added ${added} of ${productIds.length} items`,
        description:
          failed > 0
            ? `${failed} item${failed === 1 ? "" : "s"} could not be added — they may be out of stock.`
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
