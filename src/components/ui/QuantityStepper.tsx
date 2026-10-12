import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="inline-flex items-center rounded-lg border border-ink-200 bg-cream-50">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${dim} inline-flex items-center justify-center rounded-l-lg text-ink-600 hover:bg-ink-100 disabled:opacity-30`}
        aria-label="Decrease quantity"
      >
        <Minus size={14} />
      </button>
      <span className="w-9 text-center text-sm font-semibold text-ink-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${dim} inline-flex items-center justify-center rounded-r-lg text-ink-600 hover:bg-ink-100 disabled:opacity-30`}
        aria-label="Increase quantity"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
