import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/utils/cn";

export type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-forest-800 text-cream-50 hover:bg-forest-900 focus-visible:outline-forest-800 disabled:bg-ink-200 disabled:text-ink-400",
  secondary:
    "bg-ember-600 text-cream-50 hover:bg-ember-700 focus-visible:outline-ember-600 disabled:bg-ink-200 disabled:text-ink-400",
  outline:
    "border border-ink-200 bg-transparent text-ink-900 hover:border-forest-700 hover:bg-forest-50 disabled:text-ink-400 disabled:border-ink-100",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100 disabled:text-ink-400",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-ink-200 disabled:text-ink-400",
  link: "bg-transparent text-forest-800 underline-offset-4 hover:underline p-0 h-auto",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md gap-1.5",
  md: "h-11 px-5 text-sm rounded-lg gap-2",
  lg: "h-13 px-7 text-base rounded-lg gap-2",
  icon: "h-10 w-10 rounded-full justify-center",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
    variant !== "link" && sizeClasses[size],
    variantClasses[variant],
    className,
  );
}

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <Link ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  ),
);
LinkButton.displayName = "LinkButton";

interface AnchorButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
}

export const AnchorButton = forwardRef<HTMLAnchorElement, AnchorButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <a ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  ),
);
AnchorButton.displayName = "AnchorButton";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
          variant !== "link" && sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
