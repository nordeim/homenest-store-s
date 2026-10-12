"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { useStore } from "./store-provider";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/track-order", label: "Track Order" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Header — nav row (h-16) matching the reference DOM: [hamburger | logo |
 * centered nav | search | icon cluster]. The sticky wrapper + mobile panel
 * are composed by the storefront layout.
 */
export function Header({
  user,
  cartCount,
}: {
  user: { name: string; role: string } | null;
  cartCount: number;
}) {
  const { setMobileNavOpen, mobileNavOpen, cartDrawerOpen, setCartDrawerOpen } = useStore();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="container-page flex h-16 items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Direct row child (reference structure): hamburger sits left of the logo. */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary lg:hidden"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileNavOpen}
          aria-haspopup="dialog"
          data-testid="mobile-menu-button"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <Menu className="h-5.5 w-5.5" />
        </button>
        <Logo />
      </div>

      <nav className="hidden items-center gap-2 lg:flex" aria-label="Main">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive(link.href)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/70 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1.5">
        {/* Desktop inline search — the reference's rounded muted input. */}
        <form action="/products" role="search" className="hidden md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              placeholder="Search products..."
              aria-label="Search products"
              className="h-10 w-48 rounded-full bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:w-64 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-[width]"
            />
          </div>
        </form>
        {/* Mobile search icon toggles the panel below (which carries the input). */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary md:hidden"
          aria-label="Search"
          onClick={() => setMobileNavOpen(true)}
        >
          <Search className="h-5 w-5" />
        </button>

        <Link
          href="/wishlist"
          aria-label="Wishlist"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
        >
          <Heart className="h-5 w-5" />
        </Link>
        <Link
          href={user ? "/account" : "/login"}
          aria-label={user ? `Account: ${user.name}` : "Sign in"}
          className="hidden h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary sm:inline-flex"
        >
          <User className="h-5 w-5" />
        </Link>
        <button
          type="button"
          aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
          aria-haspopup="dialog"
          aria-expanded={cartDrawerOpen}
          onClick={() => setCartDrawerOpen(!cartDrawerOpen)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
        >
          <ShoppingBag className="h-5 w-5" />
          {cartCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              data-testid="cart-count"
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
