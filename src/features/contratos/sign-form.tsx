"use client";

import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { signSchema } from "./schemas";

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * Formulário de assinatura eletrônica: nome, CPF/CNPJ, e-mail e concordância.
 * O mesmo esquema valida aqui e no servidor.
 */
export function SignForm({
  onSign,
  askEmail = true,
  defaultName = "",
  submitLabel = "Assinar contrato",
}: {
  onSign: (values: { name: string; document: string; email: string; accept: boolean }) => Promise<Result>;
  askEmail?: boolean;
  defaultName?: string;
  submitLabel?: string;
}) {
  const [values, setValues] = useState({ name: defaultName, document: "", email: "", accept: false });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    const parsed = signSchema.safeParse(values);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return setErrors({ name: f.name?.[0], document: f.document?.[0], email: f.email?.[0], accept: f.accept?.[0] });
    }
    setErrors({});
    start(async () => {
      const r = await onSign(values);
      if (!r.ok) {
        setError(r.error);
        if (r.fieldErrors) setErrors(Object.fromEntries(Object.entries(r.fieldErrors).map(([k, v]) => [k, v?.[0]])));
      }
    });
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="sg-name" required error={errors.name}>
          <Input id="sg-name" autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </Field>
        <Field label="CPF ou CNPJ" htmlFor="sg-doc" required error={errors.document}>
          <Input id="sg-doc" inputMode="numeric" value={values.document} onChange={(e) => setValues({ ...values, document: e.target.value })} />
        </Field>
      </div>
      {askEmail && (
        <Field label="E-mail" htmlFor="sg-mail" error={errors.email}>
          <Input id="sg-mail" type="email" autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
        </Field>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--brand)]"
          checked={values.accept}
          onChange={(e) => setValues({ ...values, accept: e.target.checked })}
          aria-invalid={!!errors.accept}
        />
        <span>
          Li o contrato e concordo em assiná-lo eletronicamente. Entendo que ficam registrados meu nome, documento, data, hora, endereço de acesso (IP) e o
          código do documento.
        </span>
      </label>
      {errors.accept && <p className="-mt-2 text-xs text-danger">{errors.accept}</p>}
      <Button type="submit" loading={pending} className="self-start">
        <PenLine /> {submitLabel}
      </Button>
    </form>
  );
}
