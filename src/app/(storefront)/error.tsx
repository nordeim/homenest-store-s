"use client";

// Route error boundary for the storefront — a server-side throw anywhere under
// (storefront) lands here instead of Next's unbranded default screen. Rendered
// per-request, so the proxy CSP nonce applies normally. Session-5 audit S5-3.

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in server logs / browser console for diagnosis; the digest lets
    // support correlate a user report with the server-side stack.
    console.error("storefront error boundary:", error);
  }, [error]);

  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error interrupted this page. Your cart and account are safe — try again, or head
          back to the catalog.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <a href="/products">Back to Products</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
