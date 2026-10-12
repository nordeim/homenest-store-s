"use client";

/**
 * MobileNav — the reference's push-down panel below the header.
 *
 * Tailwind v4 trap-log note (the bug this file is structured around): v4
 * changed the generation order of display utilities, so JS-toggling the
 * `hidden` class alongside a sibling `flex`/`block` class on the SAME
 * element is unreliable (tailwindlabs/tailwindcss#15884, #18653 — and
 * preflight now also gives `[hidden]` `!important`). This component never
 * toggles display utilities: the panel is conditionally MOUNTED via React
 * state (no `hidden` vs `flex` fight is possible) and animates with a
 * keyframe animation on mount. The desktop nav's `hidden lg:flex` is a
 * static responsive pair that never gets JS-toggled, so it is unaffected.
 *
 * The e2e regression guard is tests/e2e/mobile-navigation.spec.ts.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStore } from "./store-provider";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/track-order", label: "Track Order" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MobileNav({ isAuthenticated, isAdmin }: { isAuthenticated: boolean; isAdmin: boolean }) {
  const { mobileNavOpen, setMobileNavOpen } = useStore();
  const pathname = usePathname();

  // Close on route change (links navigate) — matches reference behavior.
  React.useEffect(() => {
    setMobileNavOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!mobileNavOpen) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="border-t border-border bg-card lg:hidden" data-testid="mobile-menu">
      <div className="container-page animate-in slide-in-from-top-2 fade-in duration-200">
        <div className="flex items-center justify-between py-3">
          <form action="/products" className="relative flex-1" role="search">
            <input
              type="search"
              name="q"
              placeholder="Search products..."
              aria-label="Search products"
              className="h-10 w-2/3 max-w-xs rounded-full bg-secondary px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </form>
          {/* The reference's close affordance: a green circular button. */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Mobile" className="flex flex-col gap-1.5 pb-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-xl px-5 py-3.5 text-base font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-secondary",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" />
          <Link
            href={isAuthenticated ? "/account" : "/login"}
            className="rounded-xl px-5 py-3.5 text-base font-medium text-foreground/80 hover:bg-secondary"
          >
            {isAuthenticated ? "My Account" : "Sign In"}
          </Link>
          <Link
            href="/wishlist"
            className="rounded-xl px-5 py-3.5 text-base font-medium text-foreground/80 hover:bg-secondary"
          >
            Wishlist
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-xl px-5 py-3.5 text-base font-medium text-primary hover:bg-secondary"
            >
              Admin Dashboard
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
