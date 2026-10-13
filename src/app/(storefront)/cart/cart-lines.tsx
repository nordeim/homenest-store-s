"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";

import type { CartLine } from "@/lib/cart";
import { MAX_CART_QUANTITY } from "@/lib/cart-quantity";
import { formatMoney } from "@/lib/money";
import { useStore } from "@/components/store/store-provider";
import { useToast } from "@/components/ui/toaster";

/**
 * CartLines — the cart page's interactive line rows. Mutations go through
 * /api/cart (PATCH for quantity, DELETE for removal) with optimistic UI +
 * rollback, then router.refresh() so the server-rendered order summary and
 * header badge stay honest.
 */
export function CartLines({ initialLines }: { initialLines: CartLine[] }) {
  const [lines, setLines] = React.useState<CartLine[]>(initialLines);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const { setCartCount } = useStore();
  const { toast } = useToast();
  const router = useRouter();

  // Re-sync whenever the server sends fresh lines (after router.refresh()).
  // This is the documented "adjust state when a prop changes" pattern —
  // setState during render of the SAME component, no effects, no refs.
  const [prevInitial, setPrevInitial] = React.useState(initialLines);
  if (initialLines !== prevInitial) {
    setPrevInitial(initialLines);
    if (pendingId === null) setLines(initialLines);
  }

  async function updateQuantity(line: CartLine, next: number) {
    const prev = lines;
    setLines(
      next <= 0
        ? prev.filter((l) => l.id !== line.id)
        : prev.map((l) => (l.id === line.id ? { ...l, quantity: next, lineTotal: l.unitPrice * next } : l)),
    );
    setPendingId(line.id);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId: line.id, quantity: next }),
      });
      const data = (await res.json()) as { itemCount?: number; quantity?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update your cart.");
      if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      // Mirror the SERVER clamp (stock/99 cap): the page's local copy must
      // never disagree with the cart's truth — same contract the drawer uses.
      if (typeof data.quantity === "number" && next > 0 && data.quantity !== next) {
        const clamped = data.quantity;
        setLines((prevLines) =>
          clamped === 0
            ? prevLines.filter((l) => l.id !== line.id)
            : prevLines.map((l) =>
                l.id === line.id ? { ...l, quantity: clamped, lineTotal: l.unitPrice * clamped } : l,
              ),
        );
      }
      router.refresh();
    } catch (error) {
      setLines(prev); // rollback the optimistic change
      toast({
        title: "Cart update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function removeLine(line: CartLine) {
    const prev = lines;
    setLines(prev.filter((l) => l.id !== line.id));
    setPendingId(line.id);
    try {
      const res = await fetch(`/api/cart?line=${encodeURIComponent(line.id)}`, { method: "DELETE" });
      const data = (await res.json()) as { itemCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove that item.");
      if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      toast({ title: "Removed from cart", description: line.name, variant: "success" });
      router.refresh();
    } catch (error) {
      setLines(prev); // rollback the optimistic change
      toast({
        title: "Could not remove item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
      {lines.map((line) => {
        const busy = pendingId === line.id;
        return (
          <li key={line.id} className="flex gap-4 p-4 sm:p-5" data-testid={`cart-line-${line.productId}`}>
            <Link
              href={`/product/${line.productId}`}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary"
              aria-label={line.name}
            >
              <Image src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold leading-snug">
                    <Link href={`/product/${line.productId}`} className="transition-colors hover:text-primary">
                      {line.name}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatMoney(line.unitPrice)} each</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeLine(line)}
                  disabled={pendingId !== null}
                  aria-label={`Remove ${line.name} from cart`}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-lg border border-input bg-card">
                  <button
                    type="button"
                    onClick={() => void updateQuantity(line, line.quantity - 1)}
                    disabled={pendingId !== null || busy}
                    aria-label={`Decrease quantity of ${line.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span
                    className="w-10 text-center text-sm font-semibold tabular-nums"
                    aria-live="polite"
                    aria-label={`Quantity ${line.quantity}`}
                  >
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => void updateQuantity(line, line.quantity + 1)}
                    disabled={
                      pendingId !== null || busy || line.quantity >= Math.min(line.stock, MAX_CART_QUANTITY)
                    }
                    aria-label={`Increase quantity of ${line.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="text-sm font-bold">{formatMoney(line.lineTotal)}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
