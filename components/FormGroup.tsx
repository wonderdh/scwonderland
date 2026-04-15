import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function FormGroup({ label, htmlFor, required, help, error, children, className = "" }: Props) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-base font-medium text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {help && !error && <p className="text-sm text-slate-500">{help}</p>}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
