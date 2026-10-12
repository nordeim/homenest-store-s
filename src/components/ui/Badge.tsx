import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type Tone = "forest" | "ember" | "neutral" | "amber" | "red" | "blue";

const toneClasses: Record<Tone, string> = {
  forest: "bg-forest-100 text-forest-800",
  ember: "bg-ember-100 text-ember-800",
  neutral: "bg-ink-100 text-ink-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
