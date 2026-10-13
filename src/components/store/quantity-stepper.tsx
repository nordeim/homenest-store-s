"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { MAX_CART_QUANTITY } from "@/lib/cart-quantity";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  // Session-19 S19-1: the default binds the single-sourced ceiling (the S17-2
  // invariant) — never retype the literal here.
  max = MAX_CART_QUANTITY,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center rounded-lg border border-input bg-card", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="inline-flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        className="w-10 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
        aria-label={`Quantity ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="inline-flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
