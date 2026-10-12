import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/utils/cn";

const navLinks = [
  { label: "Shop All", to: "/products" },
  { label: "Cookware", to: "/categories/cookware" },
  { label: "Knives", to: "/categories/knives-cutlery" },
  { label: "Storage", to: "/categories/kitchen-storage" },
  { label: "Appliances", to: "/categories/small-appliances" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export function Header() {
  const settings = useCatalogStore((s) => s.settings);
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const user = useAuthStore((s) => s.currentUser());
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-cream-50/95 backdrop-blur">
      <div className="bg-forest-900 py-2 text-center text-xs font-medium text-cream-100">
        Free shipping on orders over ${settings.freeShippingThreshold.toFixed(0)} · Lifetime
        sharpening guarantee on all knives
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 lg:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
        >
          <Menu size={22} />
        </button>

        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-forest-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-800 text-cream-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 21V9a8 8 0 0 1 16 0v12" strokeLinecap="round" />
              <path d="M4 21h16" strokeLinecap="round" />
              <path d="M9 9h.01M15 9h.01" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hidden sm:inline">{settings.storeName}</span>
        </Link>

        <nav className="ml-6 hidden flex-1 items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium text-ink-600 transition-colors hover:text-forest-800",
                  isActive && "text-forest-900 font-semibold",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
            aria-label="Toggle search"
            aria-expanded={searchOpen}
          >
            <Search size={20} />
          </button>
          <Link
            to="/wishlist"
            className="relative hidden h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 sm:inline-flex"
            aria-label={`Wishlist, ${wishlistCount} items`}
          >
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-600 px-1 text-[10px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link
            to={user ? "/account" : "/login"}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 sm:inline-flex"
            aria-label={user ? "My account" : "Sign in"}
          >
            <User size={20} />
          </Link>
          <Link
            to="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
            aria-label={`Cart, ${cartCount} items`}
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-600 px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-ink-100 bg-cream-50 px-4 py-3 sm:px-6 lg:px-8">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-7xl gap-2">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for cookware, knives, storage…"
              className="w-full rounded-lg border border-ink-200 bg-cream-50 px-3.5 py-2.5 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-forest-800 px-4 text-sm font-semibold text-cream-50 hover:bg-forest-900"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile nav: always mounted, visibility driven by transform/opacity (not the
          `hidden` utility) to avoid the Tailwind v4 display-utility cascade-order bug
          where toggling `hidden` alongside `flex`/`block` on the same element can be
          unreliable (tailwindlabs/tailwindcss#15884, #18653). Conditional rendering of
          the overlay plus transform-driven panel keeps this deterministic and animatable. */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink-950/50 transition-opacity duration-300 lg:hidden",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col bg-cream-50 shadow-lifted transition-transform duration-300 ease-out lg:hidden",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <span className="font-display text-lg font-semibold text-forest-900">
            {settings.storeName}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "block rounded-lg px-4 py-3 text-base font-medium text-ink-700 hover:bg-forest-50",
                  isActive && "bg-forest-50 text-forest-900",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-ink-100" />
          <Link
            to={user ? "/account" : "/login"}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-ink-700 hover:bg-forest-50"
          >
            <User size={18} /> {user ? "My Account" : "Sign In / Register"}
          </Link>
          <Link
            to="/wishlist"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-ink-700 hover:bg-forest-50"
          >
            <Heart size={18} /> Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
          </Link>
          <Link
            to="/order-tracking"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-ink-700 hover:bg-forest-50"
          >
            Track Order
          </Link>
          {user?.role === "admin" && (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-forest-800 hover:bg-forest-50"
            >
              Admin Dashboard
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
