import { CookingPot } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <CookingPot size={48} className="text-forest-700" />
      <h1 className="mt-4 font-display text-4xl font-semibold text-ink-900">404</h1>
      <p className="mt-2 text-ink-500">
        We couldn't find the page you're looking for. It may have been moved or no longer exists.
      </p>
      <LinkButton to="/" className="mt-6">
        Back to Home
      </LinkButton>
    </div>
  );
}
