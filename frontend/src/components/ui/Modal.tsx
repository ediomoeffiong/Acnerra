import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className, size = "md" }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={cn(
          "relative z-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-all duration-300 transform scale-100",
          sizeClasses,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4">
          {title ? (
            <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">{title}</h2>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div>{children}</div>
      </div>
    </div>
  );
};

export { Modal };
