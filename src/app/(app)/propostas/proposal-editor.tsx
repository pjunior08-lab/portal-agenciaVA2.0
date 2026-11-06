"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, FileSignature, Link2, Plus, Save, Trash2 } from "lucide-react";
import { Alert, Badge, Button, buttonVariants, Field, Input, Modal, RichTextEditor, SectionCard, Select, Textarea } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { parseMoney } from "@/features/clientes/schemas";
import {
  CADENCES,
  CADENCE_IDS,
  COVERS,
  NOTE_SNIPPETS,
  PAYMENT_METHODS,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_IDS,
  investment,
  itemTotal,
  proposalSchema,
  type ProposalData,
  type ProposalFormValues,
} from "@/features/propostas/schemas";
import { deleteProposal, saveProposal, saveProposalTemplate, shareProposal } from "@/features/propostas/actions";
import type { EditorTemplate } from "./editor-data";

export type EditorInitial = ProposalFormValues;

export const emptyItem = (): EditorInitial["items"][number] => ({ service: "", quantity: "1", unit_price: "", cadence: "mensal", scope_html: "" });

const CONTRACT_LABEL: Record<string, string> = { rascunho: "Rascunho", aguardando: "Aguardando assinatura", assinado: "Assinado", cancelado: "Cancelado" };
const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function ProposalEditor({
  proposalId,
  initial,
  clients,
  templates,
  services,
  canEdit,
  canContract,
  meta,
}: {
  proposalId: string | null;
  initial: EditorInitial;
  clients: { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null }[];
  templates: EditorTemplate[];
  services: string[];
  canEdit: boolean;
  canContract: boolean;
  meta: {
    sent_at: string | null;
    decided_at: string | null;
    decision_name: string | null;
    decision_comment: string | null;
    hasLink: boolean;
    contracts: { id: string; title: string; status: string }[];
  } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openScope, setOpenScope] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProposalFormValues, unknown, ProposalData>({ resolver: zodResolver(proposalSchema), defaultValues: initial });
  const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" }) ?? [];
  const cover = useWatch({ control, name: "cover" });
  const status = useWatch({ control, name: "status" });
  const notes = useWatch({ control, name: "notes" }) ?? "";
  const methods = useWatch({ control, name: "payment.methods" }) ?? [];

  const numericItems = items.map((i) => ({
    quantity: parseMoney(i?.quantity ?? "") || 0,
    unit_price: parseMoney(i?.unit_price ?? "") || 0,
    cadence: i?.cadence ?? "unica",
  }));
  const totals = investment(numericItems);

  const onSave = handleSubmit(() =>
    start(async () => {
      setError("");
      const r = await saveProposal(proposalId, getValues());
      if (!r.ok) return setError(r.error);
      reset(getValues());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (!proposalId) router.replace(`/propostas/${r.data!.id}`);
      else router.refresh();
    }),
  );

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    setValue("template_id", id, { shouldDirty: true });
    if (!t) return;
    if (t.title) setValue("title", t.title, { shouldDirty: true });
    if ((COVERS as readonly string[]).includes(t.cover)) setValue("cover", t.cover as (typeof COVERS)[number], { shouldDirty: true });
    if (Array.isArray(t.items) && t.items.length) setValue("items", t.items as EditorInitial["items"], { shouldDirty: true });
    if (t.payment && typeof t.payment === "object") setValue("payment", { ...getValues("payment"), ...(t.payment as object) }, { shouldDirty: true });
    if (t.notes) setValue("notes", t.notes, { shouldDirty: true });
  };

  const applyClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    if (!getValues("contact_name") && c.contact_name) setValue("contact_name", c.contact_name);
    if (!getValues("contact_email") && c.email) setValue("contact_email", c.email);
    if (!getValues("contact_phone") && c.phone) setValue("contact_phone", c.phone);
  };

  return (
    <form onSubmit={onSave} noValidate>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/propostas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Propostas
        </Link>
        <h1 className="text-2xl font-normal tracking-tight">
          {proposalId ? (
            <>
              Proposta <span className="text-brand-strong">nº {initial.number}</span>
            </>
          ) : (
            <>
              Nova <span className="text-brand-strong">proposta</span>
            </>
          )}
        </h1>
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}
      {meta?.decided_at && (
        <Alert tone={initial.status === "aceita" ? "success" : "info"} className="mb-4">
          {initial.status === "aceita" ? "Aceita" : "Respondida"} pelo cliente ({meta.decision_name}) em {when.format(new Date(meta.decided_at))}.
          {meta.decision_comment && <> Comentário: “{meta.decision_comment}”</>}
        </Alert>
      )}

      <fieldset disabled={!canEdit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="Dados da proposta">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <Field label="Título" htmlFor="pr-title" required error={errors.title?.message}>
                <Input id="pr-title" autoFocus={!proposalId} placeholder="Ex.: Gestão de redes sociais" {...register("title")} />
              </Field>
              <Field label="Número" htmlFor="pr-number" error={errors.number?.message} hint={proposalId ? undefined : "Vazio: gerado sozinho."}>
                <Input id="pr-number" placeholder="Automático" {...register("number")} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Modelo" htmlFor="pr-template">
                <Controller
                  control={control}
                  name="template_id"
                  render={({ field }) => (
                    <Select id="pr-template" value={field.value ?? ""} onChange={(e) => applyTemplate(e.target.value)}>
                      <option value="">Sem modelo</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field label="Status" htmlFor="pr-status">
                <Select id="pr-status" {...register("status")}>
                  {PROPOSAL_STATUS_IDS.map((s) => (
                    <option key={s} value={s}>
                      {PROPOSAL_STATUS[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Válida até" htmlFor="pr-valid" error={errors.valid_until?.message}>
                <Input id="pr-valid" type="date" {...register("valid_until")} />
              </Field>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-xs font-medium text-muted">Capa</legend>
              <div className="flex gap-2">
                {COVERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("cover", c, { shouldDirty: true })}
                    aria-label={`Cor de capa ${c}`}
                    aria-pressed={cover === c}
                    className={cn("inline-flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface", cover === c && "ring-2 ring-ink")}
                    style={{ background: c }}
                  >
                    {cover === c && <Check className="size-4 text-white mix-blend-difference" aria-hidden />}
                  </button>
                ))}
              </div>
            </fieldset>
          </SectionCard>

          <SectionCard title="Cliente e contato">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente" htmlFor="pr-client" error={errors.client_id?.message} hint="Opcional para quem ainda não é cliente.">
                <Select id="pr-client" {...register("client_id", { onChange: (e) => applyClient(e.target.value) })}>
                  <option value="">Sem cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Oportunidade do Comercial" htmlFor="pr-opp" hint="Disponível quando o Comercial (CRM) for implantado.">
                <Select id="pr-opp" disabled>
                  <option>—</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Pessoa de contato" htmlFor="pr-cname" error={errors.contact_name?.message}>
                <Input id="pr-cname" {...register("contact_name")} />
              </Field>
              <Field label="E-mail" htmlFor="pr-cmail" error={errors.contact_email?.message}>
                <Input id="pr-cmail" type="email" {...register("contact_email")} />
              </Field>
              <Field label="Telefone" htmlFor="pr-cphone" error={errors.contact_phone?.message}>
                <Input id="pr-cphone" type="tel" {...register("contact_phone")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Itens e valores" description="Cada serviço com quantidade, valor e cadência. O escopo detalha o que está incluído.">
            {errors.items?.root?.message && <p className="mb-2 text-xs text-danger">{errors.items.root.message}</p>}
            {typeof errors.items?.message === "string" && <p className="mb-2 text-xs text-danger">{errors.items.message}</p>}
            <datalist id="pr-services">
              {services.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <ol className="flex flex-col gap-3">
              {fields.map((f, n) => {
                const e = errors.items?.[n];
                return (
                  <li key={f.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_80px_130px_150px]">
                      <Field label="Serviço" htmlFor={`it-s-${n}`} required error={e?.service?.message}>
                        <Input id={`it-s-${n}`} list="pr-services" {...register(`items.${n}.service`)} />
                      </Field>
                      <Field label="Qtd." htmlFor={`it-q-${n}`} error={e?.quantity?.message}>
                        <Input id={`it-q-${n}`} inputMode="decimal" {...register(`items.${n}.quantity`)} />
                      </Field>
                      <Field label="Valor unitário" htmlFor={`it-p-${n}`} error={e?.unit_price?.message}>
                        <Input id={`it-p-${n}`} inputMode="decimal" placeholder="0,00" {...register(`items.${n}.unit_price`)} />
                      </Field>
                      <Field label="Cadência" htmlFor={`it-c-${n}`}>
                        <Select id={`it-c-${n}`} {...register(`items.${n}.cadence`)}>
                          {CADENCE_IDS.map((c) => (
                            <option key={c} value={c}>
                              {CADENCES[c].label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenScope(openScope === n ? null : n)}
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                        aria-expanded={openScope === n}
                      >
                        {openScope === n ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        Escopo {items[n]?.scope_html ? "(preenchido)" : ""}
                      </button>
                      <span className="flex-1" />
                      <span className="text-sm font-medium tabular-nums">
                        {formatBRL(itemTotal(numericItems[n] ?? { quantity: 0, unit_price: 0, cadence: "unica" }))}
                        <span className="text-xs text-muted">{CADENCES[numericItems[n]?.cadence ?? "unica"].suffix}</span>
                      </span>
                      {canEdit && (
                        <span className="flex">
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Subir item" disabled={n === 0} onClick={() => move(n, n - 1)}>
                            <ChevronUp />
                          </Button>
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Descer item" disabled={n === fields.length - 1} onClick={() => move(n, n + 1)}>
                            <ChevronDown />
                          </Button>
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Remover item" disabled={fields.length === 1} onClick={() => remove(n)}>
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </div>
                    {openScope === n && (
                      <Controller
                        control={control}
                        name={`items.${n}.scope_html`}
                        render={({ field }) => (
                          <RichTextEditor
                            label={`Escopo do item ${n + 1}`}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="O que está incluído, entregas, frequência..."
                            minHeight={120}
                            disabled={!canEdit}
                            className="mt-2 bg-surface"
                          />
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            {canEdit && (
              <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => append(emptyItem())}>
                <Plus /> Adicionar item
              </Button>
            )}
          </SectionCard>

          <SectionCard title="Condições de pagamento">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Parcelas" htmlFor="pr-inst" error={errors.payment?.installments?.message}>
                <Input id="pr-inst" type="number" min={1} max={60} {...register("payment.installments")} />
              </Field>
              <Field label="Entrada (R$)" htmlFor="pr-down" error={errors.payment?.down_payment?.message} hint="Opcional.">
                <Input id="pr-down" inputMode="decimal" placeholder="0,00" {...register("payment.down_payment")} />
              </Field>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-xs font-medium text-muted">Formas de pagamento</legend>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const on = methods.includes(m);
                  return (
                    <label key={m} className={cn("cursor-pointer rounded-full px-3 py-1 text-xs", on ? "bg-panel text-panel-ink" : "bg-surface-2 text-muted hover:bg-surface-3")}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={(e) =>
                          setValue("payment.methods", e.target.checked ? [...methods, m] : methods.filter((x) => x !== m), { shouldDirty: true })
                        }
                      />
                      {m}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Detalhes" htmlFor="pr-paydet" className="mt-4">
              <Textarea id="pr-paydet" rows={2} maxLength={1000} placeholder="Ex.: vencimento todo dia 10" {...register("payment.details")} />
            </Field>
          </SectionCard>

          <SectionCard title="Observações">
            {canEdit && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted">Textos prontos:</span>
                {NOTE_SNIPPETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setValue("notes", notes ? `${notes}\n\n${s.text}` : s.text, { shouldDirty: true })}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] hover:bg-surface-3"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            )}
            <Textarea id="pr-notes" aria-label="Observações" rows={6} maxLength={10000} {...register("notes")} />
            <p className="mt-1 text-[11px] text-muted">Os textos prontos são um ponto de partida; revise com o seu jurídico.</p>
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Investimento">
            {totals.length === 0 ? (
              <p className="text-xs text-muted">Preencha os valores dos itens.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {totals.map((t) => (
                  <li key={t.cadence} className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted">{CADENCES[t.cadence].label}</span>
                    <span className="text-lg font-medium tabular-nums">
                      {formatBRL(t.total)}
                      <span className="text-xs text-muted">{CADENCES[t.cadence].suffix}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          {proposalId && meta && (
            <SectionCard title="Envio">
              <div className="flex flex-col gap-2 text-xs">
                <Badge tone={PROPOSAL_STATUS[initial.status].tone}>{PROPOSAL_STATUS[initial.status].label}</Badge>
                {meta.sent_at ? <p className="text-muted">Enviada em {when.format(new Date(meta.sent_at))}.</p> : <p className="text-muted">Ainda não enviada.</p>}
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending || isDirty}
                    onClick={() =>
                      start(async () => {
                        const r = await shareProposal(proposalId);
                        if (!r.ok) return setError(r.error);
                        setShareUrl(r.data!.url);
                        router.refresh();
                      })
                    }
                  >
                    <Link2 /> {meta.hasLink ? "Gerar novo link do cliente" : "Gerar link do cliente"}
                  </Button>
                )}
                {isDirty && <p className="text-muted">Salve as alterações antes de gerar o link.</p>}
                {meta.hasLink && <p className="text-muted">Por segurança, o link só aparece quando é gerado. Gerar outro desativa o anterior.</p>}
              </div>
            </SectionCard>
          )}
          {proposalId && meta && (initial.status === "aceita" || meta.contracts.length > 0) && (
            <SectionCard title="Contrato">
              {meta.contracts.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-xs">
                  {meta.contracts.map((c) => (
                    <li key={c.id}>
                      <Link href={`/contratos/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-2 hover:bg-surface-3">
                        <span className="truncate">{c.title}</span>
                        <span className="text-muted">{CONTRACT_LABEL[c.status] ?? c.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-xs text-muted">Proposta aceita: gere o contrato a partir dela.</p>
              )}
              {canContract && initial.client_id && (
                <Link href={`/contratos/novo?proposta=${proposalId}`} className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-2")}>
                  <FileSignature /> Gerar contrato
                </Link>
              )}
              {canContract && !initial.client_id && <p className="text-xs text-muted">Escolha um cliente para gerar o contrato.</p>}
            </SectionCard>
          )}
        </aside>
      </fieldset>

      {canEdit && (
        // barra fixa de salvar: gruda no rodapé da tela enquanto a página rola
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-surface/95 backdrop-blur sm:-mx-6 lg:-mx-8">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <span className="hidden text-xs text-muted sm:inline">
              {status && PROPOSAL_STATUS[status].label}
              {totals.length > 0 && " · " + totals.map((t) => `${formatBRL(t.total)}${CADENCES[t.cadence].suffix}`).join(" + ")}
            </span>
            <span className="flex-1" />
            {proposalId &&
              (confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteProposal(proposalId);
                      if (!r.ok) return setError(r.error);
                      router.push("/propostas");
                    })
                  }
                >
                  Confirmar exclusão
                </Button>
              ) : (
                <Button type="button" variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setTemplateName("")}>
              Salvar como modelo
            </Button>
            <Button type="submit" loading={pending}>
              {saved ? <Check /> : <Save />} {saved ? "Salvo" : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}
      {templateName !== null && (
        <Modal
          open
          onOpenChange={(v) => !v && setTemplateName(null)}
          title="Salvar como"
          accent="modelo"
          footer={
            <>
              <Button variant="secondary" onClick={() => setTemplateName(null)}>
                Cancelar
              </Button>
              <Button
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await saveProposalTemplate(templateName, getValues());
                    if (!r.ok) return setError(r.error);
                    setTemplateName(null);
                    router.refresh();
                  })
                }
              >
                Salvar modelo
              </Button>
            </>
          }
        >
          <Field label="Nome do modelo" htmlFor="tpl-name" hint="Guarda título, capa, itens, escopo, condições e observações (sem cliente e contato).">
            <Input id="tpl-name" autoFocus value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          </Field>
        </Modal>
      )}
    </form>
  );
}

function ShareModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Link do" accent="cliente">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Envie este link ao cliente. Ele vê a proposta e pode aceitar ou recusar, sem precisar de login.</p>
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Link da proposta" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <p className="text-[11px] text-muted">Guarde o link agora: por segurança ele não fica salvo. Gerar outro desativa este.</p>
      </div>
    </Modal>
  );
}
