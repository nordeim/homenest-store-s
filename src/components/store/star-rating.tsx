import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  rating,
  size = 14,
  className,
  showValue = false,
}: {
  rating: number;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  const rounded = Math.round(rating);
  // Session-47 S47-2: role="img" makes the aria-label LEGAL (aria-label on a
  // role-less span is prohibited by the ARIA spec — Lighthouse
  // aria-prohibited-attr) and announces "Rated X out of 5, image" to screen
  // readers. Zero visual delta; the Stars stay aria-hidden decorations.
  return (
    <span
      role="img"
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < rounded ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200"}
          aria-hidden
        />
      ))}
      {showValue && <span className="ml-1 text-sm font-medium text-foreground">{rating.toFixed(1)}</span>}
    </span>
  );
}
