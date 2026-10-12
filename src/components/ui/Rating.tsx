import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

export function Rating({
  value,
  count,
  size = 16,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div className="flex items-center" role="img" aria-label={`Rated ${value} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.min(1, Math.max(0, value - i));
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star
                width={size}
                height={size}
                className="absolute inset-0 text-ink-200"
                fill="currentColor"
              />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star width={size} height={size} className="text-ember-500" fill="currentColor" />
              </span>
            </span>
          );
        })}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-ink-400">({count.toLocaleString()})</span>
      )}
    </div>
  );
}
