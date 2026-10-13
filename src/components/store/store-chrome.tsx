"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag, X } from "lucide-react";
import Image from "next/image";

import { MAX_CART_QUANTITY } from "@/lib/cart-quantity";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { useStore } from "./store-provider";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";

/**
 * StoreChrome — the sticky header wrapper (reference DOM order): sticky
 * header bar, then the mobile push-down nav panel, then the page body and
 * footer inside ONE inert-able shell, with the cart drawer riding at the end
 * so it overlays everything.
 */
export function StoreChrome({
  user,
  cartCount,
  children,
  footer,
}: {
  user: { name: string; role: string } | null;
  cartCount: number;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // The store's cartCount is null on BOTH the server and the client until the
  // first in-page mutation, so the SSR markup (and every fresh load) falls
  // back to the server-computed prop — no hydration guard (and no
  // set-state-on-mount effect) is needed. (Context type is `number | null`,
  // session-9 S9-1 — initializing at 0 made this fallback dead code.)
  const { cartCount: liveCount, cartDrawerOpen } = useStore();
  const count = liveCount ?? cartCount;

  return (
    <>
      {/* Session-16 S16-3: while the cart drawer is open (role="dialog" +
          aria-modal="true") the page behind it must be inert — the dialog
          declared modal semantics but the background stayed keyboard-tabbable
          (the carried S8-7 deferral, closed here). `inert` is a boolean
          attribute, not a display utility, so the Tailwind v4 trap does not
          apply; the SSR/client contexts both start closed, so hydration is
          unaffected. Native focus containment: inert content is skipped by
          Tab, so focus cycles inside the dialog with no JS trap loop. */}
      <div
        data-testid="page-shell"
        inert={cartDrawerOpen}
        className="flex min-h-screen flex-col"
      >
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
          <Header user={user} cartCount={count} />
        </header>
        <MobileNav
          isAuthenticated={Boolean(user)}
          isAdmin={user?.role === "admin"}
        />
        {children}
        {footer}
      </div>
      <CartDrawer />
    </>
  );
}

type DrawerLine = {
  id: string;
  productId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

/**
 * CartDrawer — slide-in cart sheet. Loads its lines on open (single fetch),
 * supports quantity updates and removal, mirrors the reference's mini-cart.
 * `lines === null` means "loading" — no sync setState in the open effect.
 */
function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen, setCartCount } = useStore();
  const [lines, setLines] = React.useState<DrawerLine[] | null>(null);
  const loading = lines === null;
  // Per-line pending lock — rapid +/- clicks can't race each other or the
  // cart-summary refresh (mirrors cart-lines.tsx on the cart page).
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cartDrawerOpen) return;
    let cancelled = false;
    // Stale lines stay visible while the fresh summary loads — the fetch
    // callbacks are the only setState sites (no sync setState here).
    fetch("/api/cart-summary")
      .then((r) => r.json())
      .then((data: { lines?: DrawerLine[]; itemCount?: number }) => {
        if (cancelled) return;
        setLines(data.lines ?? []);
        if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      })
      .catch(() => !cancelled && setLines((prev) => prev ?? []));
    return () => {
      cancelled = true;
    };
  }, [cartDrawerOpen, setCartCount]);

  // a11y: Escape closes the dialog; focus moves to the close button when the
  // drawer opens, and returns to the opener when it closes (native dialog
  // semantics — the shell is no longer inert by then; S16-3). While open,
  // Tab wraps INSIDE the dialog: the shell's `inert` keeps background content
  // out of the tab order, but Chromium drops focus to browser chrome at the
  // drawer's last control instead of wrapping — the wrap handler closes that
  // gap (the S8-7 OPEN-state focus trap, in its native-behavior form).
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const drawerRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!cartDrawerOpen) {
      openerRef.current?.focus();
      openerRef.current = null;
      return;
    }
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const scope = drawerRef.current;
      if (!scope) return;
      const focusables = scope.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && scope.contains(current);
      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartDrawerOpen, setCartDrawerOpen]);

  const resolvedLines = lines ?? [];
  const subtotal = resolvedLines.reduce((sum, l) => sum + l.lineTotal, 0);

  async function updateQty(lineId: string, quantity: number) {
    if (pendingId !== null) return; // one in-flight mutation per drawer
    const prev = lines;
    // Optimistic mirror of the server's own math (unitPrice × qty).
    setLines(
      (prev) =>
        (prev ?? []).map((l) =>
          l.id === lineId
            ? quantity === 0
              ? null
              : { ...l, quantity, lineTotal: l.unitPrice * quantity }
            : l,
        ).filter((l): l is DrawerLine => l !== null),
    );
    setPendingId(lineId);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId, quantity }),
      });
      const data = (await res.json()) as { itemCount?: number; quantity?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update your cart.");
      if (typeof data.itemCount === "number") setCartCount(data.itemCount);
      // Mirror the SERVER clamp (the drawer has no stock data): the server is
      // the only truth for what quantity survived — including "0" (the line
      // was deleted because the product sold out under the click).
      if (typeof data.quantity === "number") {
        setLines((prev) =>
          (prev ?? [])
            .map((l) =>
              l.id === lineId
                ? data.quantity === 0
                  ? null
                  : { ...l, quantity: data.quantity as number, lineTotal: l.unitPrice * (data.quantity as number) }
                : l,
            )
            .filter((l): l is DrawerLine => l !== null),
        );
      }
    } catch {
      // Roll back to the pre-click state; the drawer re-syncs on next open.
      setLines(prev);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
          cartDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setCartDrawerOpen(false)}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        data-testid="cart-drawer"
        ref={drawerRef}
        // Session-13 S13-3: the panel is always mounted for the transform
        // animation (the Tailwind v4-safe pattern), but a transform does NOT
        // remove elements from the tab order or the accessibility tree — a
        // closed drawer must be `inert` + `aria-hidden` so its close button,
        // steppers and links are unreachable while invisible. `inert` is a
        // boolean attribute, not a display utility, so the v4 display-toggle
        // trap does not apply.
        inert={!cartDrawerOpen}
        aria-hidden={!cartDrawerOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-xl transition-transform duration-300 ease-out ${
          cartDrawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Your Cart</h2>
          <button
            type="button"
            ref={closeRef}
            onClick={() => setCartDrawerOpen(false)}
            aria-label="Close cart"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading your cart…</p>
          ) : resolvedLines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/40" aria-hidden />
              <p className="font-medium">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">Browse the collection and find something you love.</p>
              <Button onClick={() => setCartDrawerOpen(false)} asChild>
                <Link href="/products">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {resolvedLines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <Image src={line.image} alt={line.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{line.name}</p>
                      <button
                        type="button"
                        onClick={() => updateQty(line.id, 0)}
                        disabled={pendingId === line.id}
                        aria-label={`Remove ${line.name}`}
                        className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatMoney(line.unitPrice)}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="inline-flex items-center rounded-lg border border-input">
                        <button
                          type="button"
                          onClick={() => updateQty(line.id, Math.max(0, line.quantity - 1))}
                          disabled={pendingId === line.id}
                          aria-label="Decrease quantity"
                          className="h-8 w-8 text-sm disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.id, line.quantity + 1)}
                          // The drawer carries no stock data (the server clamp
                          // remains the stock guard), but the 99 ceiling is
                          // client-known — pre-disable so the click can never
                          // surface the schema's 400 (session-18 S18-2).
                          disabled={pendingId === line.id || line.quantity >= MAX_CART_QUANTITY}
                          aria-label="Increase quantity"
                          className="h-8 w-8 text-sm disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold">{formatMoney(line.lineTotal)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {resolvedLines.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-base font-bold">{formatMoney(subtotal)}</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Shipping, taxes and discount codes are calculated at checkout.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/checkout" onClick={() => setCartDrawerOpen(false)}>
                  Checkout
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/cart" onClick={() => setCartDrawerOpen(false)}>
                  View Cart
                </Link>
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
