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

export function toastInfo(message: string, opts?: { description?: string; duration?: number }) {
  return toast(message, { duration: 5000, description: opts?.description, ...opts });
}

// re-export raw toast for special cases
export { toast };
