"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { FocusScope } from "@radix-ui/react-focus-scope";

export type ModalSize = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Dialog panel max-width. sm=448px md=512px lg=672px. Default "md". */
  size?: ModalSize;
  /** Close when clicking the backdrop. Default true. */
  dismissOnBackdrop?: boolean;
  /** Close on Escape key. Default true. */
  dismissOnEscape?: boolean;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  dismissOnBackdrop = true,
  dismissOnEscape = true,
}: ModalProps) {
  const titleId = useId();

  // Escape key handler
  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, dismissOnEscape, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <FocusScope
        asChild
        loop
        trapped
      >
        <div
          className={`relative w-full ${SIZE_CLASS[size]} rounded-xl bg-white shadow-xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </FocusScope>
    </div>,
    document.body
  );
}
