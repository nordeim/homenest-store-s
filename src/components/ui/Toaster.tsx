import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const toneClasses = {
  success: "bg-forest-800 text-cream-50",
  error: "bg-red-700 text-white",
  info: "bg-ink-900 text-cream-50",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:right-6 sm:left-auto"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lifted",
              toneClasses[toast.variant],
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-xs opacity-70 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
