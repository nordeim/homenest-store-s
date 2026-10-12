import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  FolderTree,
  GalleryHorizontal,
  Settings,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/Toaster";
import { cn } from "@/utils/cn";

const links = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Categories", to: "/admin/categories", icon: FolderTree },
  { label: "Carousel", to: "/admin/carousel", icon: GalleryHorizontal },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.currentUser());
  const logout = useAuthStore((s) => s.logout);

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-100/80 hover:bg-cream-50/10",
              isActive && "bg-cream-50/15 text-cream-50",
            )
          }
        >
          <link.icon size={18} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-forest-950 py-6 lg:flex">
        <Link to="/admin" className="mb-6 px-5 font-display text-lg font-semibold text-cream-50">
          HomeNest Admin
        </Link>
        {Nav}
        <div className="mt-auto space-y-2 px-3 pt-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-100/70 hover:bg-cream-50/10"
          >
            <ArrowLeft size={16} /> Back to Store
          </Link>
          <button
            onClick={logout}
            className="w-full rounded-lg bg-cream-50/10 px-3 py-2.5 text-left text-sm font-medium text-cream-50 hover:bg-cream-50/20"
          >
            Sign Out ({user?.name})
          </button>
        </div>
      </aside>

      {/* Mobile drawer: conditional mount + transform, same pattern as storefront header. */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink-950/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-forest-950 py-6 shadow-lifted transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-5">
          <span className="font-display text-lg font-semibold text-cream-50">HomeNest Admin</span>
          <button onClick={() => setOpen(false)} className="text-cream-100" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        {Nav}
        <div className="mt-auto space-y-2 px-3 pt-4">
          <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-cream-100/70">
            <ArrowLeft size={16} /> Back to Store
          </Link>
          <button
            onClick={logout}
            className="w-full rounded-lg bg-cream-50/10 px-3 py-2.5 text-left text-sm font-medium text-cream-50"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-ink-200 bg-cream-50 px-4 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 lg:hidden"
            aria-label="Open admin menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-ink-500">Store Management Console</h1>
          <div className="ml-auto text-sm text-ink-500">
            Signed in as <span className="font-medium text-ink-800">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
