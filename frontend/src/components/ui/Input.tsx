import * as React from "react";
import { cn } from "../../utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label ? (
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50",
              {
                "border-red-900/60 focus:ring-red-900 focus:border-red-900": error,
              },
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs font-medium text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-zinc-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
