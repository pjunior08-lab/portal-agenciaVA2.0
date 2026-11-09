"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Copy, MessageSquare, Phone, StickyNote, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import type { CrmStageT } from "@/lib/supabase/database.types";
import {
  CHANNELS,
  RESULTS,
  STAGES,
  STAGE_IDS,
  activitySchema,
  fillTemplate,
  opportunitySchema,
  splitList,
  type OpportunityData,
  type OpportunityFormValues,
} from "@/features/comercial/schemas";
import {
  addActivity,
  deleteOpportunity,
  loadOpportunityDetails,
  saveOpportunity,
  type OppDetails,
} from "@/features/comercial/actions";
import type { OppView } from "@/features/comercial/data";
import { useCrm } from "./crm-shell";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function OpportunityModal({
  opp,
  stage,
  onClose,
}: {
  opp: OppView | null;
  stage?: CrmStageT;
  onClose: () => void;
}) {
  const { canEdit } = useCrm();
  const [tab, setTab] = useState("dados");
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={opp ? opp.name : "Nova"}
      accent={opp ? undefined : "oportunidade"}
      description={opp ? [opp.company, STAGES[opp.stage].label].filter(Boolean).join(" · ") : undefined}
      size="lg"
      footer={
        tab === "dados" &&
        canEdit && (
          <Button type="submit" form="form-oportunidade">
            Salvar
          </Button>
        )
      }
    >
      {opp ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="contatos">Contatos e notas</TabsTrigger>
            <TabsTrigger value="historico">Histórico de etapas</TabsTrigger>
          </TabsList>
          <TabsContent value="dados">
            <OpportunityForm opp={opp} onClose={onClose} />
          </TabsContent>
          <TabsContent value="contatos">
            <Activities opp={opp} />
          </TabsContent>
          <TabsContent value="historico">
            <History opp={opp} />
          </TabsContent>
        </Tabs>
      ) : (
        <OpportunityForm opp={null} stage={stage} onClose={onClose} />
      )}
    </Modal>
  );
}

function OpportunityForm({
  opp,
  stage,
  onClose,
}: {
  opp: OppView | null;
  stage?: CrmStageT;
  onClose: () => void;
}) {
  const router = useRouter();
  const { base, canEdit, userId } = useCrm();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OpportunityFormValues, unknown, OpportunityData>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: opp?.name ?? "",
      company: opp?.company ?? "",
      document: opp?.document ?? "",
      email: opp?.email ?? "",
      phone: opp?.phone ?? "",
      segment: opp?.segment ?? "",
      origin: opp?.origin ?? "",
      tags: opp?.tags ?? [],
      owner_id: opp ? (opp.owner_id ?? "") : base.people.some((p) => p.id === userId) ? userId : "",
      stage: opp?.stage ?? stage ?? "novo_lead",
      value: opp?.value == null ? "" : String(opp.value).replace(".", ","),
      next_step: opp?.next_step ?? "",
      next_step_at: opp?.next_step_at ?? "",
      lost_reason: opp?.lost_reason ?? "",
      notes: opp?.notes ?? "",
      custom: Object.fromEntries(
        base.fields.map((f) => [f.key, opp?.custom[f.key] == null ? "" : String(opp.custom[f.key])]),
      ),
    },
  });
  const currentStage = useWatch({ control, name: "stage" });
  const ro = !canEdit;

  const submit = handleSubmit((v) =>
    start(async () => {
      setError("");
      // campos personalizados vazios não são gravados
      const custom = Object.fromEntries(Object.entries(v.custom).filter(([, x]) => x !== "" && x !== null));
      const r = await saveOpportunity(opp?.id ?? null, { ...v, value: v.value ?? "", custom });
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    }),
  );

  return (
    <form id="form-oportunidade" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <fieldset disabled={ro || pending} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do contato" htmlFor="op-name" required error={errors.name?.message}>
          <Input id="op-name" {...register("name")} autoFocus={!opp} />
        </Field>
        <Field label="Empresa" htmlFor="op-company" error={errors.company?.message}>
          <Input id="op-company" {...register("company")} />
        </Field>
        <Field
          label="CNPJ ou CPF"
          htmlFor="op-doc"
          hint="Evita cadastrar a mesma empresa duas vezes."
          error={errors.document?.message}
        >
          <Input id="op-doc" inputMode="numeric" {...register("document")} />
        </Field>
        <Field label="Valor mensal (R$)" htmlFor="op-value" error={errors.value?.message}>
          <Input id="op-value" inputMode="decimal" placeholder="0,00" {...register("value")} />
        </Field>
        <Field label="E-mail" htmlFor="op-email" error={errors.email?.message}>
          <Input id="op-email" type="email" {...register("email")} />
        </Field>
        <Field label="Telefone" htmlFor="op-phone" error={errors.phone?.message}>
          <Input id="op-phone" type="tel" {...register("phone")} />
        </Field>
        <Field label="Etapa" htmlFor="op-stage">
          <Select id="op-stage" {...register("stage")}>
            {STAGE_IDS.map((s) => (
              <option key={s} value={s}>
                {STAGES[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsável" htmlFor="op-owner">
          <Select id="op-owner" {...register("owner_id")}>
            <option value="">Sem responsável</option>
            {base.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {currentStage === "perdido" && (
          <Field
            label="Motivo da perda"
            htmlFor="op-lost"
            required
            error={errors.lost_reason?.message}
            className="sm:col-span-2"
          >
            <Input
              id="op-lost"
              placeholder="Ex.: preço, sem orçamento, escolheu outra agência"
              {...register("lost_reason")}
            />
          </Field>
        )}
        <Field label="Próximo passo" htmlFor="op-next" error={errors.next_step?.message}>
          <Input id="op-next" placeholder="Ex.: enviar proposta" {...register("next_step")} />
        </Field>
        <Field label="Data do próximo passo" htmlFor="op-next-at" error={errors.next_step_at?.message}>
          <Input id="op-next-at" type="date" {...register("next_step_at")} />
        </Field>
        <Field label="Segmento" htmlFor="op-segment">
          <Input id="op-segment" list="crm-segments" {...register("segment")} />
        </Field>
        <Field label="Origem" htmlFor="op-origin" hint="De onde veio o lead (indicação, Instagram, site…).">
          <Input id="op-origin" list="crm-origins" {...register("origin")} />
        </Field>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagsInput
              value={field.value}
              onChange={field.onChange}
              options={base.settings.tags}
              error={errors.tags?.message}
            />
          )}
        />
        {base.fields.map((f) => (
          <Field key={f.id} label={f.label} htmlFor={`op-c-${f.key}`}>
            {f.type === "opcoes" ? (
              <Select id={`op-c-${f.key}`} {...register(`custom.${f.key}`)}>
                <option value="">—</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input
                id={`op-c-${f.key}`}
                type={f.type === "numero" ? "number" : f.type === "data" ? "date" : "text"}
                {...register(`custom.${f.key}`)}
              />
            )}
          </Field>
        ))}
        <Field label="Observações" htmlFor="op-notes" className="sm:col-span-2" error={errors.notes?.message}>
          <Textarea id="op-notes" rows={3} {...register("notes")} />
        </Field>
      </fieldset>
      <datalist id="crm-segments">
        {base.settings.segments.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="crm-origins">
        {[...new Set(base.opps.map((o) => o.origin).filter(Boolean))].map((s) => (
          <option key={s} value={s!} />
        ))}
      </datalist>
      {opp && canEdit && (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              Excluir de vez esta oportunidade e seus contatos?
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteOpportunity(opp.id);
                    if (!r.ok) return setError(r.error);
                    router.refresh();
                    onClose();
                  })
                }
              >
                Excluir
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Excluir oportunidade
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

function TagsInput({
  value,
  onChange,
  options,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  error?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Field label="Tags" htmlFor="op-tags" hint="Separe por vírgula." error={error}>
      <Input
        id="op-tags"
        list="crm-tags"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(splitList(text))}
      />
      <datalist id="crm-tags">
        {options.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </Field>
  );
}

function useDetails(id: string, version: string) {
  const [state, setState] = useState<{ data: OppDetails | null; error: string }>({ data: null, error: "" });
  useEffect(() => {
    let alive = true;
    loadOpportunityDetails(id).then(
      (r) => alive && setState(r.ok ? { data: r.data!, error: "" } : { data: null, error: r.error }),
    );
    return () => {
      alive = false;
    };
  }, [id, version]);
  return state;
}

function Activities({ opp }: { opp: OppView }) {
  const router = useRouter();
  const { base, canEdit, personName, userId } = useCrm();
  // recarrega quando o banco mudar a oportunidade (último contato, tentativas)
  const { data, error } = useDetails(opp.id, `${opp.last_contact_at}-${opp.attempts}-${opp.next_step_at}`);
  const [kind, setKind] = useState<"contato" | "nota">("contato");
  const [channel, setChannel] = useState("whatsapp");
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const templates = base.templates.filter((t) => t.channel === channel);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge>Tentativas sem resposta: {opp.attempts}</Badge>
        <Badge>
          Último contato: {opp.last_contact_at ? dateTime.format(new Date(opp.last_contact_at)) : "nunca"}
        </Badge>
        {opp.next_step_at && (
          <Badge tone="info">
            Próximo passo: {shortDate(opp.next_step_at)}
            {opp.next_step && ` · ${opp.next_step}`}
          </Badge>
        )}
      </div>

      {canEdit && (
        <form
          className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const input = {
              kind,
              channel: kind === "contato" ? channel : "",
              result: kind === "contato" ? result : "",
              note,
            };
            const parsed = activitySchema.safeParse(input);
            if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? "Confira os campos.");
            start(async () => {
              setFormError("");
              const r = await addActivity(opp.id, input);
              if (!r.ok) return setFormError(r.error);
              setNote("");
              setResult("");
              router.refresh();
            });
          }}
        >
          <SegmentedControl
            label="Tipo de registro"
            value={kind}
            onChange={setKind}
            options={[
              { value: "contato", label: "Registrar contato" },
              { value: "nota", label: "Anotação" },
            ]}
          />
          {formError && <Alert>{formError}</Alert>}
          {kind === "contato" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Canal" htmlFor="act-channel">
                <Select id="act-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {Object.entries(CHANNELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Resultado"
                htmlFor="act-result"
                hint={
                  base.settings.cadence_paused
                    ? "Cadência pausada."
                    : "Sem resposta agenda a próxima tentativa."
                }
              >
                <Select id="act-result" value={result} onChange={(e) => setResult(e.target.value)}>
                  <option value="">Escolha…</option>
                  {Object.entries(RESULTS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {kind === "contato" && templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Modelos:</span>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="rounded-full bg-surface px-2.5 py-1 hover:bg-surface-3"
                  onClick={() => {
                    const text = fillTemplate(t.body, opp, personName(userId));
                    setNote(text);
                    navigator.clipboard?.writeText(text).then(
                      () => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      },
                      () => undefined,
                    );
                  }}
                >
                  <Copy className="mr-1 inline size-3" aria-hidden />
                  {t.name}
                </button>
              ))}
              {copied && <span className="text-success">Copiado!</span>}
            </div>
          )}
          <Field label={kind === "contato" ? "Observação (opcional)" : "Anotação"} htmlFor="act-note">
            <Textarea
              id="act-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={4000}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              Salvar registro
            </Button>
          </div>
        </form>
      )}

      {error && <Alert>{error}</Alert>}
      {!data && !error && <Skeleton className="h-24" />}
      {data && data.activities.length === 0 && (
        <p className="text-sm text-muted">Nenhum contato ou anotação ainda.</p>
      )}
      {data && data.activities.length > 0 && (
        <ol className="flex flex-col gap-2">
          {data.activities.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-xl border border-line p-3 text-sm">
              {a.kind === "nota" ? (
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              ) : a.channel === "ligacao" ? (
                <Phone className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              ) : (
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {dateTime.format(new Date(a.happened_at))} · {personName(a.author_id)}
                </p>
                {a.kind === "contato" && (
                  <p className="font-medium">
                    {CHANNELS[a.channel as keyof typeof CHANNELS]} ·{" "}
                    {RESULTS[a.result as keyof typeof RESULTS]}
                  </p>
                )}
                {a.note && <p className="mt-1 whitespace-pre-wrap">{a.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function History({ opp }: { opp: OppView }) {
  const { personName } = useCrm();
  const { data, error } = useDetails(opp.id, `${opp.stage}-${opp.stage_changed_at}`);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Skeleton className="h-24" />;
  if (!data.history.length) return <p className="text-sm text-muted">Sem mudanças registradas.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {data.history.map((h) => (
        <li
          key={h.id}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm"
        >
          {h.from_stage ? (
            <>
              <StageDot stage={h.from_stage as CrmStageT} />
              <ArrowRight className="size-3.5 text-muted" aria-label="para" />
            </>
          ) : (
            <span className="text-xs text-muted">Entrou em</span>
          )}
          <StageDot stage={h.to_stage as CrmStageT} />
          <span className="ml-auto text-xs text-muted">
            {dateTime.format(new Date(h.changed_at))} ·{" "}
            {h.changed_by ? personName(h.changed_by) : "importação/sistema"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function StageDot({ stage }: { stage: CrmStageT }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: STAGES[stage].color }} aria-hidden />
      {STAGES[stage].label}
    </span>
  );
}

export const money = (n: number | null) => (n == null ? "—" : formatBRL(n));
