import Link from "next/link";

const ICON_GRADIENTS: Record<string, string> = {
  "from-orange-400 to-orange-600": "bg-gradient-to-br from-orange-400 to-orange-600",
  "from-pink-400 to-pink-600": "bg-gradient-to-br from-pink-400 to-pink-600",
  "from-amber-400 to-orange-500": "bg-gradient-to-br from-amber-400 to-orange-500",
  "from-teal-400 to-emerald-500": "bg-gradient-to-br from-teal-400 to-emerald-500",
  "from-blue-400 to-blue-600": "bg-gradient-to-br from-blue-400 to-blue-600",
  "from-purple-400 to-purple-600": "bg-gradient-to-br from-purple-400 to-purple-600",
  "from-cyan-400 to-sky-500": "bg-gradient-to-br from-cyan-400 to-sky-500",
  "from-green-400 to-emerald-600": "bg-gradient-to-br from-green-400 to-emerald-600",
};

export function CategoryIcon({ icon, gradient, className }: { icon: string; gradient: string; className?: string }) {
  const gradientClass = ICON_GRADIENTS[gradient] ?? ICON_GRADIENTS["from-orange-400 to-orange-600"];
  return (
    <span
      className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm ${gradientClass} ${className ?? ""}`}
      aria-hidden
    >
      <CategoryGlyph icon={icon} />
    </span>
  );
}

/** Minimal inline glyphs — keeps category tiles dependency-free and fast. */
function CategoryGlyph({ icon }: { icon: string }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "cooking-pot":
      return (
        <svg {...common}>
          <path d="M2 12h20" />
          <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
          <path d="M4 8h16v4H4z" />
          <path d="M9 5v3M15 5v3" />
        </svg>
      );
    case "cake":
      return (
        <svg {...common}>
          <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
          <path d="M4 16s.5-1 2-1 2 1 4 1 2-1 4-1 2 1 4 1 2-1 2-1" />
          <path d="M12 4v3" />
          <circle cx="12" cy="3" r="1" />
        </svg>
      );
    case "utensils-crossed":
      return (
        <svg {...common}>
          <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
          <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
          <path d="m2.1 21.8 6.4-6.3" />
          <path d="m19 5-7 7" />
        </svg>
      );
    case "package":
      return (
        <svg {...common}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "zap":
      return (
        <svg {...common}>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "wine":
      return (
        <svg {...common}>
          <path d="M8 22h8" />
          <path d="M7 10h10" />
          <path d="M12 15v7" />
          <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
        </svg>
      );
    case "sprout":
      return (
        <svg {...common}>
          <path d="M7 20h10" />
          <path d="M10 20c5.5-2.5.8-6.4 3-10" />
          <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z" />
          <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

/** Category tile — white card, gradient icon tile, label below. */
export function CategoryCard({
  slug,
  name,
  icon,
  iconGradient,
}: {
  slug: string;
  name: string;
  icon: string;
  iconGradient: string;
}) {
  return (
    <Link
      href={`/products?category=${slug}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <CategoryIcon icon={icon} gradient={iconGradient} className="transition-transform group-hover:scale-110" />
      <span className="text-sm font-semibold text-foreground">{name}</span>
    </Link>
  );
}
