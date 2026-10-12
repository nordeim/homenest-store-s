import { useMemo } from "react";
import { useCartStore } from "@/store/cartStore";
import { useCatalogStore } from "@/store/catalogStore";
import { findCoupon } from "@/data/coupons";

export interface CartLineDetail {
  productId: string;
  variantId?: string;
  quantity: number;
  name: string;
  image: string;
  price: number;
  lineTotal: number;
  stock: number;
}

export function useCartTotals() {
  const items = useCartStore((s) => s.items);
  const couponCode = useCartStore((s) => s.couponCode);
  const products = useCatalogStore((s) => s.products);
  const settings = useCatalogStore((s) => s.settings);

  return useMemo(() => {
    const lines: CartLineDetail[] = items.flatMap((line): CartLineDetail[] => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return [];
      const variant = product.variants?.find((v) => v.id === line.variantId);
      const price = product.price + (variant?.priceDelta ?? 0);
      return [
        {
          productId: product.id,
          variantId: line.variantId,
          quantity: line.quantity,
          name: product.name,
          image: product.images[0],
          price,
          lineTotal: price * line.quantity,
          stock: product.stock,
        },
      ];
    });

    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const coupon = couponCode ? findCoupon(couponCode) : undefined;
    const discount = coupon
      ? coupon.type === "percent"
        ? subtotal * (coupon.value / 100)
        : Math.min(coupon.value, subtotal)
      : 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = taxableAmount * (settings.taxRatePercent / 100);
    const shippingCost =
      subtotal === 0 || subtotal >= settings.freeShippingThreshold
        ? 0
        : settings.flatShippingRate;
    const total = Math.max(0, taxableAmount + tax + shippingCost);
    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

    return { lines, subtotal, discount, tax, shippingCost, total, itemCount, coupon };
  }, [items, products, couponCode, settings]);
}
