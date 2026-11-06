"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Eye, Pencil, Save } from "lucide-react";
import { Alert, Button, Field, Input, RichTextEditor, SectionCard, SegmentedControl, Switch } from "@/components/ui";
import { ContractSheet } from "@/features/contratos/document";
import { VARIABLES, templateSchema, type TemplateFormValues } from "@/features/contratos/schemas";
import { saveContractTemplate } from "@/features/contratos/actions";

/** Na prévia do modelo, cada variável aparece com o nome entre colchetes (sem dados inventados). */
const PREVIEW_VALUES = Object.fromEntries(VARIABLES.map((v) => [v.key, `[${v.label}]`]));
const previewHtml = (html: string) =>
  html.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, k: string) => `<strong>${PREVIEW_VALUES[k.toLowerCase()] ?? `[${k}]`}</strong>`);
const previewText = (s: string) => s.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, k: string) => PREVIEW_VALUES[k.toLowerCase()] ?? `[${k}]`);

export function TemplateEditor({ templateId, initial }: { templateId: string | null; initial: TemplateFormValues }) {
  const router = useRouter();
  const [mode, setMode] = useState<"editar" | "previa">("editar");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), defaultValues: initial });
  const v = useWatch({ control });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(() =>
        start(async () => {
          setError("");
          const r = await saveContractTemplate(templateId, getValues());
          if (!r.ok) return setError(r.error);
          reset(getValues());
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          if (!templateId) router.replace(`/contratos/modelos/${r.data!.id}`);
          else router.refresh();
        }),
      )}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/contratos?aba=modelos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Modelos
        </Link>
        <h1 className="text-2xl font-normal tracking-tight">
          {templateId ? "Personalizar" : "Novo"} <span className="text-brand-strong">modelo</span>
        </h1>
        <span className="flex-1" />
        <SegmentedControl
          label="Modo"
          value={mode}
          onChange={setMode}
          options={[
            { value: "editar", label: "Editar" },
            { value: "previa", label: "Pré-visualizar" },
          ]}
        />
      </div>
      {error && <Alert className="mb-4">{error}</Alert>}

      {mode === "previa" ? (
        <div className="mx-auto max-w-3xl">
          <ContractSheet html={previewHtml(v.body_html ?? "")} header={previewText(v.header_text ?? "")} footer={previewText(v.footer_text ?? "")} watermark={v.watermark ?? ""} />
          <p className="mt-2 text-center text-[11px] text-muted">Na prévia, as variáveis aparecem entre colchetes. No contrato, viram os dados do cliente e da agência.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <SectionCard title="Texto do contrato" description="Use o botão “Variável” para inserir dados que mudam em cada contrato.">
            <Controller
              control={control}
              name="body_html"
              render={({ field }) => (
                <RichTextEditor label="Texto do contrato" value={field.value} onChange={field.onChange} variables={VARIABLES} minHeight={420} placeholder="Escreva as cláusulas..." />
              )}
            />
            <p className="mt-2 text-[11px] text-muted">Os textos de contrato são de responsabilidade da agência. Revise com um advogado.</p>
          </SectionCard>
          <aside className="flex flex-col gap-4">
            <SectionCard title="Modelo">
              <div className="flex flex-col gap-3">
                <Field label="Nome" htmlFor="tp-name" required error={errors.name?.message}>
                  <Input id="tp-name" autoFocus={!templateId} {...register("name")} />
                </Field>
                <Field label="Descrição" htmlFor="tp-desc" error={errors.description?.message}>
                  <Input id="tp-desc" maxLength={300} {...register("description")} />
                </Field>
                <Controller
                  control={control}
                  name="is_default"
                  render={({ field }) => (
                    <label className="flex items-center gap-3 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Usar como modelo padrão" />
                      Usar como modelo padrão
                    </label>
                  )}
                />
              </div>
            </SectionCard>
            <SectionCard title="Página">
              <div className="flex flex-col gap-3">
                <Field label="Cabeçalho" htmlFor="tp-head" error={errors.header_text?.message} hint="Aceita variáveis, ex.: {{contratada.nome}}">
                  <Input id="tp-head" maxLength={300} {...register("header_text")} />
                </Field>
                <Field label="Rodapé" htmlFor="tp-foot" error={errors.footer_text?.message}>
                  <Input id="tp-foot" maxLength={300} {...register("footer_text")} />
                </Field>
                <Field label="Marca d'água" htmlFor="tp-wm" error={errors.watermark?.message} hint="Texto curto em diagonal, ex.: CONFIDENCIAL">
                  <Input id="tp-wm" maxLength={40} {...register("watermark")} />
                </Field>
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-surface/95 backdrop-blur sm:-mx-6 lg:-mx-8">
        <div className="flex items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="text-xs text-muted">
            {mode === "previa" ? <Eye className="mr-1 inline size-3.5" aria-hidden /> : <Pencil className="mr-1 inline size-3.5" aria-hidden />}
            {v.name || "Modelo sem nome"}
          </span>
          <span className="flex-1" />
          <Button type="submit" loading={pending}>
            {saved ? <Check /> : <Save />} {saved ? "Salvo" : "Salvar modelo"}
          </Button>
        </div>
      </div>
    </form>
  );
}
