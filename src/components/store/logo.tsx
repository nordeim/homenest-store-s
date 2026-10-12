import Link from "next/link";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, brandName = "HomeNest" }: { className?: string; brandName?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label={`${brandName} home`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Home className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="font-display text-2xl font-bold tracking-tight text-foreground">{brandName}</span>
    </Link>
  );
}
