"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  {
    label: "Customer demo",
    email: "demo@homenestkitchen.com",
    password: "Demo1234!",
  },
  {
    label: "Admin demo",
    email: "admin@homenestkitchen.com",
    password: "Admin123!",
  },
] as const;

/**
 * Demo quick-fill is a reference-parity feature for evaluation builds. Deploy
 * with NEXT_PUBLIC_DEMO_MODE="false" to hide the credentials box in a real
 * store (see .env.example).
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/**
 * Sign-in form — `useActionState` + the server action: works without JS
 * (native POST fallback), pending is framework-owned (no hydration race),
 * failures render inline, and success redirects inside the action.
 */
export function LoginForm() {
  const [state, formAction, pending] = React.useActionState(loginAction, {
    error: null,
  });
  const error = state.error;

  function fillDemoAccount(demo: (typeof DEMO_ACCOUNTS)[number]) {
    const form = document.getElementById("login-form") as HTMLFormElement | null;
    if (!form) return;
    const emailInput = form.elements.namedItem("email");
    const passwordInput = form.elements.namedItem("password");
    if (emailInput instanceof HTMLInputElement) emailInput.value = demo.email;
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = demo.password;
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome to HomeNest Kitchen</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>

      <form id="login-form" action={formAction} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password">Password</Label>
            <a
              href="mailto:hello@homenest.com?subject=Password%20reset%20request"
              className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {/* Demo accounts helper — mirrors the reference SPA's quick-fill box */}
      {DEMO_MODE && (
        <div className="mt-5 rounded-xl border border-border bg-secondary/60 p-3.5">
          <p className="text-xs font-semibold text-secondary-foreground">Demo accounts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Explore the store with a pre-seeded account.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => fillDemoAccount(demo)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                Use {demo.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">New to HomeNest?</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link
          href="/register"
          className="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
