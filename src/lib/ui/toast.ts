import { toast } from "sonner";

export function toastSuccess(message: string, opts?: { description?: string; duration?: number }) {
  return toast.success(message, { duration: 6000, description: opts?.description, ...opts });
}

export function toastError(message: string, opts?: { description?: string; duration?: number }) {
  return toast.error(message, {
    duration: 8000,
    description: opts?.description,
    closeButton: true,
    ...opts,
  });
}

// re-export raw toast for special cases
export { toast };
