import * as React from "react";
import { cn } from "../../utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            // Variants
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 border border-indigo-700/30":
              variant === "primary",
            "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/50":
              variant === "secondary",
            "bg-transparent hover:bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white":
              variant === "outline",
            "bg-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-100":
              variant === "ghost",
            "bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50":
              variant === "destructive",
            "text-indigo-400 underline-offset-4 hover:underline bg-transparent p-0 active:scale-100":
              variant === "link",

            // Sizes
            "px-3 py-1.5 text-xs": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3.5 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
