"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Copy, Save, Send, Trash2, TriangleAlert } from "lucide-react";
import { Alert, Button, Field, Input, Modal, RichTextEditor, SectionCard, SegmentedControl, Select, Textarea } from "@/components/ui";
import { parseMoney } from "@/features/clientes/schemas";
import { ContractSheet, PartiesCard, TermTimeline } from "@/features/contratos/document";
import {
  VARIABLES,
  contractSchema,
  missingVariables,
  renderVariables,
  variableValues,
  type ContractData,
  type ContractFormValues,
} from "@/features/contratos/schemas";
import { deleteContract, saveContract, sendContract } from "@/features/contratos/actions";
import { today } from "@/lib/dates";
import type { ContractData as LoadedData } from "./contract-data";

export function ContractEditor({ contractId, initial, data }: { contractId: string | null; initial: ContractFormValues; data: LoadedData }) {
  const router = useRouter();
  const [mode, setMode] = useState<"editar" | "previa">("editar");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<ContractFormValues, unknown, ContractData>({ resolver: zodResolver(contractSchema), defaultValues: initial });
  const v = useWatch({ control });

  const client = data.clients.find((c) => c.id === v.client_id) ?? null;
  const proposal = data.proposals.find((p) => p.id === v.proposal_id) ?? null;
  const values = variableValues({
    client,
    agency: data.agency,
    proposal,
    contract: {
      service_description: v.service_description ?? "",
      value: parseMoney(v.value ?? "") ?? null,
      starts_on: v.starts_on || null,
      ends_on: v.ends_on || null,
    },
    today: today(),
  });
  const body = v.body_html ?? "";
  const missing = missingVariables(`${body} ${v.header_text ?? ""} ${v.footer_text ?? ""}`, values);
  const label = (k: string) => VARIABLES.find((x) => x.key === k)?.label ?? k;

  const applyTemplate = (id: string) => {
    setValue("template_id", id, { shouldDirty: true });
    const t = data.templates.find((x) => x.id === id);
    if (!t) return;
    if (body && !window.confirm("Trocar o texto atual pelo do modelo?")) return;
    setValue("body_html", t.body_html, { shouldDirty: true });
    setValue("header_text", t.header_text, { shouldDirty: true });
    setValue("footer_text", t.footer_text, { shouldDirty: true });
    setValue("watermark", t.watermark, { shouldDirty: true });
  };

  const save = handleSubmit(() =>
    start(async () => {
      setError("");
      const r = await saveContract(contractId, getValues());
      if (!r.ok) return setError(r.error);
      reset(getValues());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (!contractId) router.replace(`/contratos/${r.data!.id}`);
      else router.refresh();
    }),
  );

  return (
    <form noValidate onSubmit={save}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/contratos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Contratos
        </Link>
        <h1 className="text-2xl font-normal tracking-tight">
          {contractId ? "Editar" : "Novo"} <span className="text-brand-strong">contrato</span>
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ContractSheet
            html={renderVariables(body, values)}
            header={renderVariables(v.header_text ?? "", values).replace(/<[^>]+>/g, "")}
            footer={renderVariables(v.footer_text ?? "", values).replace(/<[^>]+>/g, "")}
            watermark={v.watermark ?? ""}
          />
          <aside className="flex flex-col gap-4">
            <PartiesCard
              contratante={{ name: client?.name ?? "Escolha o cliente", document: client?.document ?? null }}
              contratada={{ name: data.agency.legal_name || data.agency.name, document: data.agency.cnpj }}
            />
            <TermTimeline
              startsOn={v.starts_on || null}
              endsOn={v.ends_on || null}
              renewalOn={v.renewal_on || null}
              value={parseMoney(v.value ?? "") ?? null}
              today={today()}
            />
            {missing.length > 0 && <MissingWarning keys={missing.map(label)} />}
          </aside>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title="Dados do contrato">
              <div className="grid gap-4">
                <Field label="Título" htmlFor="ct-title" required error={errors.title?.message}>
                  <Input id="ct-title" autoFocus={!contractId} placeholder="Ex.: Contrato de gestão de redes sociais" {...register("title")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Cliente (contratante)" htmlFor="ct-client" required error={errors.client_id?.message}>
                    <Select id="ct-client" {...register("client_id", { onChange: () => setValue("proposal_id", "") })}>
                      <option value="">Escolha</option>
                      {data.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Proposta de origem" htmlFor="ct-prop">
                    <Select id="ct-prop" disabled={!v.client_id} {...register("proposal_id")}>
                      <option value="">Nenhuma</option>
                      {data.proposals
                        .filter((p) => p.client_id === v.client_id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Nº {p.number} · {p.title}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Modelo" htmlFor="ct-template">
                    <Select id="ct-template" value={v.template_id ?? ""} onChange={(e) => applyTemplate(e.target.value)}>
                      <option value="">Sem modelo</option>
                      {data.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.is_default ? " (padrão)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Serviço contratado" htmlFor="ct-service" hint="Entra no texto pela variável {{servico}}.">
                  <Textarea id="ct-service" rows={2} maxLength={2000} {...register("service_description")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Valor (R$)" htmlFor="ct-value" error={errors.value?.message}>
                    <Input id="ct-value" inputMode="decimal" placeholder="0,00" {...register("value")} />
                  </Field>
                  <Field label="Início" htmlFor="ct-start" error={errors.starts_on?.message}>
                    <Input id="ct-start" type="date" {...register("starts_on")} />
                  </Field>
                  <Field label="Fim" htmlFor="ct-end" error={errors.ends_on?.message}>
                    <Input id="ct-end" type="date" {...register("ends_on")} />
                  </Field>
                  <Field label="Renovação" htmlFor="ct-renew" error={errors.renewal_on?.message} hint="Vazio: usa o fim.">
                    <Input id="ct-renew" type="date" {...register("renewal_on")} />
                  </Field>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Texto do contrato" description="As variáveis viram os dados do cliente e da agência quando o contrato é enviado.">
              <Controller
                control={control}
                name="body_html"
                render={({ field }) => (
                  <RichTextEditor label="Texto do contrato" value={field.value} onChange={field.onChange} variables={VARIABLES} minHeight={380} placeholder="Escolha um modelo ou escreva as cláusulas..." />
                )}
              />
            </SectionCard>
          </div>
          <aside className="flex flex-col gap-4">
            <SectionCard title="Página">
              <div className="flex flex-col gap-3">
                <Field label="Cabeçalho" htmlFor="ct-head">
                  <Input id="ct-head" maxLength={300} {...register("header_text")} />
                </Field>
                <Field label="Rodapé" htmlFor="ct-foot">
                  <Input id="ct-foot" maxLength={300} {...register("footer_text")} />
                </Field>
                <Field label="Marca d'água" htmlFor="ct-wm">
                  <Input id="ct-wm" maxLength={40} {...register("watermark")} />
                </Field>
              </div>
            </SectionCard>
            {missing.length > 0 && <MissingWarning keys={missing.map(label)} />}
            <p className="px-1 text-[11px] text-muted">
              Os dados da agência (razão social, CNPJ, endereço) vêm de Configurações › Agência; os do cliente, da ficha do cliente.
            </p>
          </aside>
        </div>
      )}

      <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-surface/95 backdrop-blur sm:-mx-6 lg:-mx-8">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="hidden text-xs text-muted sm:inline">Rascunho · só a equipe vê</span>
          <span className="flex-1" />
          {contractId &&
            (confirmDelete ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteContract(contractId);
                    if (!r.ok) return setError(r.error);
                    router.push("/contratos");
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
          <Button type="submit" variant={contractId ? "secondary" : "primary"} loading={pending && !confirmSend}>
            {saved ? <Check /> : <Save />} {saved ? "Salvo" : "Salvar"}
          </Button>
          {contractId && (
            <Button type="button" disabled={pending || isDirty} title={isDirty ? "Salve antes de enviar" : undefined} onClick={() => setConfirmSend(true)}>
              <Send /> Enviar para assinatura
            </Button>
          )}
        </div>
      </div>

      {confirmSend && contractId && (
        <Modal
          open
          onOpenChange={(o) => !o && (setConfirmSend(false), link && router.refresh())}
          title={link ? "Link de" : "Enviar para"}
          accent="assinatura"
          footer={
            !link && (
              <>
                <Button variant="secondary" onClick={() => setConfirmSend(false)}>
                  Voltar
                </Button>
                <Button
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await sendContract(contractId);
                      if (!r.ok) {
                        setError(r.error);
                        setConfirmSend(false);
                        return;
                      }
                      setLink(r.data!.url);
                    })
                  }
                >
                  Enviar e gerar link
                </Button>
              </>
            )
          }
        >
          {link ? (
            <CopyLink url={link} />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p>O texto será congelado com os dados de hoje e não poderá mais ser editado (a não ser que volte para rascunho antes de alguém assinar).</p>
              {missing.length > 0 && <MissingWarning keys={missing.map(label)} />}
            </div>
          )}
        </Modal>
      )}
    </form>
  );
}

function MissingWarning({ keys }: { keys: string[] }) {
  return (
    <div className="rounded-card bg-brand-soft p-4 text-xs">
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        <TriangleAlert className="size-3.5" aria-hidden /> Dados que vão sair em branco
      </p>
      <p className="text-muted">{keys.join(" · ")}</p>
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Envie este link ao cliente. Ele lê o contrato e assina sem precisar de login.</p>
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="Link de assinatura" onFocus={(e) => e.currentTarget.select()} />
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
  );
}
