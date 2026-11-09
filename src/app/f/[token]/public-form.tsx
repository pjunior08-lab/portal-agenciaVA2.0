"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { FORM_FIELDS, type FormFieldKey } from "@/features/comercial/automations";
import { submitPublicForm } from "@/features/comercial/public-actions";

export function PublicForm({
  token,
  fields,
  successMessage,
}: {
  token: string;
  fields: { key: FormFieldKey; required: boolean }[];
  successMessage: string | null;
}) {
  const [startedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center" role="status">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="text-base font-medium">Recebemos seu contato!</p>
        <p className="text-sm whitespace-pre-wrap text-muted">
          {successMessage || "Em breve alguém da equipe fala com você."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const values = Object.fromEntries(
          [...fd.entries()].filter(([k]) => k !== "website").map(([k, v]) => [k, String(v)]),
        );
        start(async () => {
          setError("");
          const r = await submitPublicForm(token, {
            values,
            website: String(fd.get("website") ?? ""),
            startedAt,
          });
          if (r.ok) return setDone(true);
          setError(r.error);
          setFieldErrors(r.fieldErrors ?? {});
        });
      }}
    >
      {error && <Alert>{error}</Alert>}
      <Field label="Seu nome" htmlFor="pf-nome" required error={fieldErrors.nome?.[0]}>
        <Input id="pf-nome" name="nome" autoComplete="name" maxLength={120} required />
      </Field>
      {fields.map((f) => {
        const meta = FORM_FIELDS[f.key];
        if (!meta) return null;
        const id = `pf-${meta.payload}`;
        return (
          <Field
            key={f.key}
            label={meta.label}
            htmlFor={id}
            required={f.required}
            error={fieldErrors[meta.payload]?.[0]}
          >
            {f.key === "message" ? (
              <Textarea id={id} name={meta.payload} rows={4} maxLength={2000} required={f.required} />
            ) : (
              <Input
                id={id}
                name={meta.payload}
                required={f.required}
                maxLength={200}
                type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"}
                inputMode={f.key === "document" ? "numeric" : undefined}
                autoComplete={
                  f.key === "email"
                    ? "email"
                    : f.key === "phone"
                      ? "tel"
                      : f.key === "company"
                        ? "organization"
                        : "off"
                }
              />
            )}
          </Field>
        );
      })}
      {/* campo invisível: pessoas não preenchem, robôs costumam preencher */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="pf-website">Site</label>
        <input id="pf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" loading={pending} className="mt-2">
        Enviar
      </Button>
      <p className="text-center text-[11px] text-muted-2">
        Seus dados são usados só para a agência entrar em contato com você.
      </p>
    </form>
  );
}
