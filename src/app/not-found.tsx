import type { Metadata } from "next";
import Link from "next/link";
import { CookingPot } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false },
};

// ---------------------------------------------------------------------------
// Root 404 — rendered inside the root layout (no storefront chrome), so the
// card is centered on the warm cream background with its own full-height shell.
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <CookingPot className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-5 font-display text-6xl font-bold tracking-tight text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Page Not Found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for may have been moved, renamed, or never existed. Let&apos;s get
          you back to the good stuff.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 sm:w-auto"
          >
            Go Home
          </Link>
          <Link
            href="/products"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-primary/30 px-6 text-sm font-semibold text-primary transition-colors hover:bg-accent sm:w-auto"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}
