"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  /**
   * Convenience flag — when true, forces the danger styling (red confirm button
   * + warning icon). Equivalent to `variant="danger"`. Kept for API compat with
   * existing callsites.
   */
  danger?: boolean;
  /**
   * Optional list of impact bullet points shown in a slate-100 box below the
   * description. Useful for destructive actions that cascade (e.g. "3명의 학생
   * 배정이 해제됩니다").
   */
  impactList?: string[];
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  variant = "danger",
  danger,
  impactList,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Default focus on the cancel button (safe action) when dialog opens
  useEffect(() => {
    if (open) {
      // defer one tick so FocusScope has trapped focus first
      const id = setTimeout(() => cancelRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const isDanger = danger ?? variant === "danger";

  const confirmClass = isDanger
    ? "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    : "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";

  const cancelClass =
    "inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50";

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="p-6">
        <div className="flex items-start gap-3">
          {isDanger ? (
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-red-600"
              aria-hidden="true"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            {description && (
              <p className="mt-2 text-base text-slate-600">{description}</p>
            )}
          </div>
        </div>

        {impactList && impactList.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-700">영향:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {impactList.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className={cancelClass}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={confirmClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
