import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-transparent bg-surface-2 px-3 text-sm text-ink placeholder:text-muted-2 transition-colors hover:border-line focus:border-brand focus:bg-surface focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(control, "h-10", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(control, "py-2.5", className)} {...props} />
));
Textarea.displayName = "Textarea";

/** Select nativo estilizado: acessível e funciona bem no celular. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Envolve um controle com rótulo, dica e mensagem de erro ligados por aria. */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-erro` : hint ? `${htmlFor}-dica` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {React.isValidElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>(children)
        ? React.cloneElement(children, {
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {error ? (
        <p id={`${htmlFor}-erro`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-dica`} className="text-xs text-muted-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
