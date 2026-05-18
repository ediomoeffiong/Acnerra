import * as React from "react";
import { cn } from "../../utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "destructive" | "info";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border",
          {
            "bg-indigo-950/40 text-indigo-400 border-indigo-900/50": variant === "primary",
            "bg-zinc-800/40 text-zinc-400 border-zinc-700/50": variant === "secondary",
            "bg-emerald-950/40 text-emerald-400 border-emerald-900/50": variant === "success",
            "bg-amber-950/40 text-amber-400 border-amber-900/50": variant === "warning",
            "bg-red-950/40 text-red-400 border-red-900/50": variant === "destructive",
            "bg-cyan-950/40 text-cyan-400 border-cyan-900/50": variant === "info",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
