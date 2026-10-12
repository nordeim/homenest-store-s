"use client";

import * as React from "react";

import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { QuantityStepper } from "@/components/store/quantity-stepper";

/**
 * PurchasePanel — client island that owns the quantity state shared by the
 * QuantityStepper and the Add to Cart / Buy Now buttons on the product
 * detail page. (Extracted so the server page can render a single island
 * instead of three unconnected client components.)
 *
 * Task ID 5-a note: this extra colocated island was needed to wire the
 * stepper's quantity into the cart buttons; no existing files were modified.
 */
export function PurchasePanel({ productId, stock }: { productId: string; stock: number }) {
  const [quantity, setQuantity] = React.useState(1);
  const outOfStock = stock <= 0;
  const max = Math.max(1, Math.min(stock, 99));

  if (outOfStock) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span
          className="inline-flex h-12 items-center rounded-lg bg-secondary px-8 text-sm font-medium text-muted-foreground"
          aria-disabled="true"
        >
          Out of Stock
        </span>
        <p className="text-sm text-muted-foreground">Check back soon — this item is currently unavailable.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <QuantityStepper value={quantity} onChange={setQuantity} max={max} />
      <AddToCartButton productId={productId} quantity={quantity} size="lg" className="flex-1 sm:flex-none">
        Add to Cart
      </AddToCartButton>
      <AddToCartButton
        productId={productId}
        quantity={quantity}
        size="lg"
        buyNow
        className="flex-1 bg-foreground text-background hover:bg-foreground/90 sm:flex-none"
      >
        Buy Now
      </AddToCartButton>
    </div>
  );
}
