import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { getCurrentUser, isAdmin } from "@/lib/auth";

import { AdminNavLinks } from "./admin-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin shell — server component. Resolves the session once; non-admins (and
 * anonymous visitors) get a neutral access-denied card that does not reveal
 * anything about the admin routes. Admins get the dark sidebar + content area.
 *
 * Rendered inside the storefront layout's <main>, so the store header/footer
 * remain available for navigation back to the shop.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user || !isAdmin(user)) {
    return (
      <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Lock className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with an admin account to manage the store.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      {/* Mobile navigation — horizontal scrollable row above the content. */}
      <nav
        aria-label="Admin sections"
        className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        <AdminNavLinks variant="row" />
      </nav>

      <div className="flex items-start gap-6">
        <aside className="sticky top-6 hidden w-60 shrink-0 flex-col rounded-2xl bg-foreground p-4 text-background shadow-md lg:flex lg:min-h-[calc(100vh-4rem)]">
          <div className="px-2 pb-4">
            <p className="font-display text-lg font-bold leading-tight">HomeNest</p>
            <p className="mt-0.5 text-xs text-background/60">Store Management Console</p>
          </div>

          <nav aria-label="Admin sections" className="flex flex-col gap-1">
            <AdminNavLinks variant="sidebar" />
          </nav>

          <div className="mt-auto space-y-1 border-t border-background/10 pt-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-background/75 transition-colors hover:bg-background/10 hover:text-background"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to Store
            </Link>
            <p className="px-3 pt-1 text-xs text-background/60">
              Signed in as <span className="font-medium text-background">{user.name}</span>
            </p>
            <p className="px-3 pb-1 text-[11px] text-background/45">
              To sign out, use the account menu in the store header.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-10">{children}</div>
      </div>
    </div>
  );
}
