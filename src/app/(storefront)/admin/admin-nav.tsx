"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Images, LayoutDashboard, Package, Settings, ShoppingBag, Tags, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package, exact: false },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, exact: false },
  { href: "/admin/categories", label: "Categories", icon: Tags, exact: false },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket, exact: false },
  { href: "/admin/carousel", label: "Carousel", icon: Images, exact: false },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin navigation links — client component so the active item can react to
 * the current route (usePathname). Rendered twice by the admin layout:
 * a vertical sidebar (lg+) and a horizontal scrollable row (mobile).
 */
export function AdminNavLinks({ variant }: { variant: "sidebar" | "row" }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
              variant === "sidebar" ? "px-3 py-2.5" : "px-3.5 py-2",
              active
                ? "bg-primary text-white"
                : "text-background/75 hover:bg-background/10 hover:text-background",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className={variant === "row" ? "whitespace-nowrap" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
