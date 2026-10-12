import type { ReactNode } from "react";
import Image from "next/image";
import { connection } from "next/server";

/**
 * Auth layout — split-screen card centered on the warm cream background.
 * Left (desktop only): rounded-3xl image panel with an overlay quote set in
 * the serif display face. Right: the auth card itself (page children).
 *
 * `await connection()` is REQUIRED here: the CSP proxy (src/proxy.ts) stamps
 * a per-request nonce into every response, while a prerendered shell bakes
 * either the build-time nonce or NO nonce into its script tags — the browser
 * then silently refuses to run them and hydration never happens. Next 16
 * prerenders even force-dynamic subtrees that touch no dynamic APIs, so the
 * layout awaits connection() to pin per-request rendering (the
 * ecommerce-store trap-log lesson, session-14 SEC-CSP-1).
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[1.1fr_1fr]">
        {/* Left brand panel — hidden on small screens to keep auth front and center */}
        <div className="relative hidden lg:block">
          <Image
            src="/images/hero-elevate.png"
            alt="A bright, modern kitchen styled with HomeNest cookware"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 0vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-foreground/10"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 z-10 p-10 text-background">
            <p className="font-display text-3xl font-semibold leading-snug text-balance">
              Transform your everyday cooking
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-background/80">
              Premium home &amp; kitchen products for the modern lifestyle — trusted by
              thousands of home chefs.
            </p>
          </div>
        </div>

        {/* Right auth card */}
        <div className="flex flex-col justify-center p-6 sm:p-10">{children}</div>
      </div>
    </div>
  );
}
