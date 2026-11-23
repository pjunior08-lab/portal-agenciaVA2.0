"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ListChecks, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { APPLIES_TO, templateSchema, type AppliesTo, type TemplateData, type TemplateInput } from "@/features/checklist/schemas";
import { createSuggestedTemplates, deleteTemplate, saveTemplate } from "@/features/checklist/actions";

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  applies_to: AppliesTo;
  items: string[];
}

export function TemplatesApp({ templates, canEdit }: { templates: TemplateRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [modal, setModal] = useState<"new" | TemplateRow | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  const suggest = () =>
    start(async () => {
      setError("");
      const r = await createSuggestedTemplates();
      if (!r.ok) return setError(r.error);
      setInfo(r.data!.created ? `${r.data!.created} modelo(s) criado(s). Edite como quiser.` : "Os modelos sugeridos já existem.");
      router.refresh();
    });

  return (
    <>
      <PageHeader
        title="Checklist"
        icon={ListChecks}
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={pending} onClick={suggest}>
                <Sparkles /> Modelos sugeridos
              </Button>
              <Button onClick={() => setModal("new")}>
                <Plus /> Novo modelo
              </Button>
            </div>
          )
        }
      />
      <p className="-mt-2 mb-4 text-sm text-muted">
        Os modelos daqui são aplicados dentro de cada demanda e na aba Checklists do cliente (por exemplo, “Cliente novo”).
      </p>
      {error && <Alert className="mb-4">{error}</Alert>}
      {info && (
        <Alert tone="info" className="mb-4">
          {info}
        </Alert>
      )}

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Nenhum modelo ainda"
            description="Comece pelos modelos sugeridos (Antes de publicar, Cliente novo e Fechamento do mês) ou crie o seu."
            action={
              canEdit && (
                <Button loading={pending} onClick={suggest}>
                  <Sparkles /> Criar modelos sugeridos
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <section key={t.id} className="flex flex-col gap-3 rounded-card bg-surface p-5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  {t.description && <p className="text-xs text-muted">{t.description}</p>}
                </div>
                <Badge tone={t.applies_to === "cliente" ? "brand" : "info"}>{APPLIES_TO[t.applies_to]}</Badge>
                {canEdit && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Editar ${t.name}`} onClick={() => setModal(t)}>
                    <Pencil />
                  </Button>
                )}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {t.items.slice(0, 8).map((it, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-2" aria-hidden />
                    {it}
                  </li>
                ))}
                {t.items.length > 8 && <li className="text-xs text-muted">+ {t.items.length - 8} itens</li>}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal && <TemplateModal template={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}

function TemplateModal({ template, onClose }: { template: TemplateRow | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<TemplateInput, unknown, TemplateData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name ?? "",
      description: template?.description ?? "",
      applies_to: template?.applies_to ?? "demanda",
      items_text: template?.items.join("\n") ?? "",
    },
  });

  const onSubmit = handleSubmit(() =>
    start(async () => {
      const r = await saveTemplate(template?.id ?? null, getValues());
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    }),
  );

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={template ? "Editar" : "Novo"}
      accent="modelo de checklist"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {template &&
            (confirmDelete ? (
              <Button
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteTemplate(template.id);
                    if (!r.ok) return setError(r.error);
                    onClose();
                    router.refresh();
                  })
                }
              >
                Confirmar exclusão
              </Button>
            ) : (
              <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </Button>
            ))}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-checklist" loading={pending}>
            Salvar
          </Button>
        </div>
      }
    >
      <form id="form-checklist" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nome" htmlFor="ck-name" error={errors.name?.message} required>
          <Input id="ck-name" placeholder="Ex.: Antes de publicar um post" {...register("name")} />
        </Field>
        <Field label="Descrição" htmlFor="ck-desc" error={errors.description?.message}>
          <Input id="ck-desc" {...register("description")} />
        </Field>
        <Field label="Usado em" htmlFor="ck-where" error={errors.applies_to?.message}>
          <Select id="ck-where" {...register("applies_to")}>
            {(Object.keys(APPLIES_TO) as AppliesTo[]).map((k) => (
              <option key={k} value={k}>
                {APPLIES_TO[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Itens (um por linha)" htmlFor="ck-items" error={errors.items_text?.message} required>
          <Textarea id="ck-items" rows={10} placeholder={"Legenda revisada\nArte no tamanho certo\n…"} {...register("items_text")} />
        </Field>
      </form>
    </Modal>
  );
}
