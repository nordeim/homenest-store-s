"use client";

import * as React from "react";
import { Tag, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

/**
 * Session-storage handoff key: the cart page stores the applied code here so
 * the checkout wizard can pick it up (see checkout-client.tsx).
 */
export const COUPON_STORAGE_KEY = "homenest_coupon";

type CouponApplyResponse =
  | { ok: true; code: string; discount: number; label: string; description: string; freeShipping?: true }
  | { ok: false; error: string };

type AppliedCoupon = { code: string; discount: number; label: string; description: string; freeShipping?: true };

/**
 * CouponBox — coupon code entry for the cart summary card. Applies via
 * POST /api/coupon/apply (the server re-derives the discount from the live
 * cart), shows inline success/error state and persists the code to
 * sessionStorage for checkout.
 */
export function CouponBox({ className }: { className?: string }) {
  const [applied, setApplied] = React.useState<AppliedCoupon | null>(null);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const hydrated = React.useRef(false);

  const apply = React.useCallback(
    async (rawCode: string, silent = false) => {
      const code = rawCode.trim();
      if (!code) {
        setError("Enter a coupon code.");
        return;
      }
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/coupon/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as CouponApplyResponse;
        if (data.ok) {
          setApplied(data);
          window.sessionStorage.setItem(COUPON_STORAGE_KEY, data.code);
          setInput("");
          if (!silent) toast({ title: `Coupon ${data.code} applied`, description: data.label, variant: "success" });
        } else {
          setApplied(null);
          window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
          setError(data.error);
          if (!silent) toast({ title: "Coupon not applied", description: data.error, variant: "destructive" });
        }
      } catch {
        setError("Network error — please try again.");
        if (!silent) toast({ title: "Network error", variant: "destructive" });
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  // Pick up a code stored by a previous apply (or carried from checkout).
  // Deferred to a timeout so the fetch (and its pending setState) runs
  // outside the render-effect cycle (react-hooks/set-state-in-effect).
  React.useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = window.sessionStorage.getItem(COUPON_STORAGE_KEY);
    if (!stored) return;
    const timer = window.setTimeout(() => void apply(stored, true), 0);
    return () => window.clearTimeout(timer);
  }, [apply]);

  function remove() {
    setApplied(null);
    setError(null);
    window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
    toast({ title: "Coupon removed" });
  }

  return (
    <div className={cn("rounded-xl bg-secondary/50 p-3.5", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Tag className="h-3.5 w-3.5 text-primary" aria-hidden /> Coupon
      </p>

      {applied ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">{applied.code}</span>
              {applied.description ? `: ${applied.description}` : ""} — applied at checkout
            </p>
            <button
              type="button"
              onClick={remove}
              aria-label={`Remove coupon ${applied.code}`}
              className="rounded p-0.5 text-emerald-700 transition-colors hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-emerald-700">{applied.label}</p>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void apply(input);
          }}
        >
          <label htmlFor="cart-coupon-code" className="sr-only">
            Coupon code
          </label>
          <Input
            id="cart-coupon-code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Coupon code"
            autoComplete="off"
            autoCapitalize="characters"
            className="h-9 flex-1 bg-card"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "cart-coupon-error" : undefined}
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending} className="h-9 px-4">
            {pending ? "Checking…" : "Apply"}
          </Button>
        </form>
      )}

      {error && (
        <p id="cart-coupon-error" role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {/* Session-20 S20-7: only the evergreen codes are advertised — SAVE20
          caps at 500 redemptions and would dead-end the hint once burned. */}
      <p className="mt-2 text-xs text-muted-foreground">Try WELCOME10 or FREESHIP</p>
    </div>
  );
}
