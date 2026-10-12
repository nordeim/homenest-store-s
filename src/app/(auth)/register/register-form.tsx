"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Registration form — `useActionState` + the server action: works without JS
 * (native POST fallback; the server Zod schema is the authority), pending is
 * framework-owned, failures render inline, success redirects to /account.
 */
export function RegisterForm() {
  const [state, formAction, pending] = React.useActionState(registerAction, {
    error: null,
  });
  const error = state.error;

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-display text-3xl font-bold tracking-tight">Create Your Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Save your details for faster checkout, order tracking, and a synced wishlist.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ada Lovelace"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            placeholder="••••••••"
            aria-describedby="register-password-hint"
          />
          <p id="register-password-hint" className="text-xs text-muted-foreground">
            At least 8 characters — the server rejects anything shorter.
          </p>
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
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
