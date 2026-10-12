"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { useStore } from "./store-provider";

/**
 * AddToCartButton — client island over the cart server action. Handles the
 * signed-out and signed-in cases identically (guest carts are token-cookie
 * backed) and refreshes the RSC tree so header badges stay honest.
 */
export function AddToCartButton({
  productId,
  quantity = 1,
  size = "default",
  className,
  children,
  buyNow = false,
}: {
  productId: string;
  quantity?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
  buyNow?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const { setCartCount } = useStore();
  const { toast } = useToast();
  const router = useRouter();

  async function handleClick() {
    setPending(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = (await res.json()) as { itemCount?: number; error?: string };
      if (!res.ok) {
        toast({ title: "Could not add to cart", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      toast({ title: buyNow ? "Taking you to checkout" : "Added to cart", variant: "success" });
      if (buyNow) {
        router.push("/checkout");
      } else {
        router.refresh();
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60",
        size === "sm" && "h-9 px-4 text-sm",
        size === "default" && "h-11 px-6 text-sm",
        size === "lg" && "h-12 px-8 text-base",
        className,
      )}
    >
      <ShoppingBag className="h-4 w-4" aria-hidden />
      {pending ? "Adding…" : (children ?? "Add to Cart")}
    </button>
  );
}

export function AddToWishlistButton({
  productId,
  productName,
  className,
  compact = false,
}: {
  productId: string;
  /** Session-7 S7-13: the label names the product — identical "Toggle wishlist"
   *  strings across a grid give a screen-reader user nothing to distinguish. */
  productName?: string;
  className?: string;
  compact?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = (await res.json()) as { inWishlist?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: "Could not update wishlist", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: data.inWishlist ? "Added to wishlist" : "Removed from wishlist",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={productName ? `Add ${productName} to wishlist` : "Add to wishlist"}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur transition-all hover:bg-white hover:shadow hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        compact ? "h-8 w-8" : "h-9 w-9",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4")} aria-hidden />
    </button>
  );
}
