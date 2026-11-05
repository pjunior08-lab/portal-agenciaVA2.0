"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { createCaptionTemplate, deleteCaptionTemplate } from "@/features/aprovacoes/actions";
import { captionTemplateSchema } from "@/features/aprovacoes/schemas";

/** Legendas padrão: textos prontos (hashtags, assinatura, chamada) para inserir nos posts. */
export function CaptionsModal({
  templates,
  clients,
  onClose,
}: {
  templates: { id: string; title: string; body: string; client_id: string | null }[];
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", body: "", client_id: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const save = () => {
    const parsed = captionTemplateSchema.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return setErrors({ title: f.title?.[0], body: f.body?.[0] });
    }
    setErrors({});
    start(async () => {
      const r = await createCaptionTemplate(form);
      if (!r.ok) return setError(r.error);
      setError("");
      setForm({ title: "", body: "", client_id: "" });
      router.refresh();
    });
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Legendas" accent="padrão" size="lg">
      <div className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        <form
          className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" htmlFor="cap-title" required error={errors.title}>
              <Input id="cap-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Hashtags da marca" />
            </Field>
            <Field label="Cliente" htmlFor="cap-client">
              <Select id="cap-client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">Todos os clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Texto" htmlFor="cap-body" required error={errors.body}>
            <Textarea id="cap-body" rows={4} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Button type="submit" size="sm" loading={pending} className="self-end">
            Salvar legenda
          </Button>
        </form>
        {templates.length === 0 ? (
          <p className="text-center text-xs text-muted">Nenhuma legenda padrão ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t.title} <span className="text-[11px] font-normal text-muted">· {t.client_id ? clientName.get(t.client_id) : "Todos os clientes"}</span>
                  </p>
                  <p className="line-clamp-2 text-xs whitespace-pre-wrap text-muted">{t.body}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Excluir ${t.title}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteCaptionTemplate(t.id);
                      if (!r.ok) return setError(r.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
