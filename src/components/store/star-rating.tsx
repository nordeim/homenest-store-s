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
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`Rated ${rating} out of 5`}>
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
