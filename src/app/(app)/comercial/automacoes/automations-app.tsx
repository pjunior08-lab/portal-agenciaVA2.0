"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  History,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionCard,
  SegmentedControl,
  Select,
  Switch,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { STAGES } from "@/features/comercial/schemas";
import {
  ACTIONS,
  RULE_STAGES,
  SOURCES,
  TRIGGERS,
  describeRule,
  parseActions,
  ruleSchema,
  type ActionT,
  type RuleConditions,
  type TriggerT,
} from "@/features/comercial/automations";
import { deleteRule, saveDistribution, saveRule, toggleRule } from "@/features/comercial/automation-actions";
import type { RuleRow, RunRow } from "@/features/comercial/data";
import { useCrm } from "../crm-shell";

type Tab = "regras" | "execucoes" | "distribuicao";
const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function AutomationsApp({
  rules,
  runs,
  distribution,
}: {
  rules: RuleRow[];
  runs: RunRow[];
  distribution: { members: string[]; auto_new: boolean; pointer: number };
}) {
  const [tab, setTab] = useState<Tab>("regras");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Parte das automações"
        value={tab}
        onChange={setTab}
        options={[
          { value: "regras", label: `Regras (${rules.length})` },
          { value: "execucoes", label: "Execuções" },
          { value: "distribuicao", label: "Distribuição" },
        ]}
      />
      {tab === "regras" && <Rules rules={rules} />}
      {tab === "execucoes" && <Runs runs={runs} />}
      {tab === "distribuicao" && <Distribution distribution={distribution} />}
    </div>
  );
}

// ---------- Regras ----------
function Rules({ rules }: { rules: RuleRow[] }) {
  const router = useRouter();
  const { canEdit, personName } = useCrm();
  const [modal, setModal] = useState<RuleRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Não foi possível salvar.");
      router.refresh();
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-muted">
          As regras rodam sozinhas, em ordem de criação, para qualquer oportunidade (cadastro, importação, API
          ou formulário). Uma regra não dispara outra.
        </p>
        {canEdit && (
          <Button onClick={() => setModal("new")}>
            <Plus /> Nova regra
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={Workflow}
            title="Nenhuma regra ainda"
            description="Ex.: quando um lead vier do Instagram, adicionar a tag “insta” e marcar o próximo passo para hoje."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4",
                !r.active && "opacity-60",
              )}
            >
              <Switch
                checked={r.active}
                disabled={!canEdit || pending}
                onCheckedChange={(v) => run(() => toggleRule(r.id, v))}
                aria-label={r.active ? `Desativar ${r.name}` : `Ativar ${r.name}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {r.name}
                  <Badge>{TRIGGERS[r.trigger].label}</Badge>
                  {!r.active && <Badge>Pausada</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {describeRule(
                    r.trigger,
                    r.conditions as RuleConditions,
                    parseActions(r.actions),
                    personName,
                  )}
                </p>
              </div>
              {canEdit &&
                (confirm === r.id ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    Apagar a regra?
                    <Button
                      size="sm"
                      variant="danger"
                      loading={pending}
                      onClick={() => run(() => deleteRule(r.id))}
                    >
                      Apagar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${r.name}`}
                      onClick={() => setModal(r)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Apagar ${r.name}`}
                      onClick={() => setConfirm(r.id)}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}
      {modal && <RuleModal rule={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}

interface ActionDraft {
  type: ActionT;
  stage: string;
  user_id: string;
  tag: string;
  text: string;
  days: string;
}
interface RuleDraft {
  name: string;
  active: boolean;
  trigger: TriggerT;
  stage: string;
  origin: string;
  source: string;
  days: string;
  actions: ActionDraft[];
}
const blankAction = (type: ActionT = "adicionar_tag"): ActionDraft => ({
  type,
  stage: "contato_feito",
  user_id: "",
  tag: "",
  text: "",
  days: "0",
});

/** Monta a ação no formato salvo, só com os campos do tipo. */
function toAction(a: ActionDraft) {
  switch (a.type) {
    case "mover_etapa":
      return { type: a.type, stage: a.stage };
    case "definir_responsavel":
      return { type: a.type, user_id: a.user_id };
    case "distribuir":
      return { type: a.type };
    case "adicionar_tag":
      return { type: a.type, tag: a.tag };
    case "proximo_passo":
      return { type: a.type, text: a.text, days: a.days };
  }
}

function RuleModal({ rule, onClose }: { rule: RuleRow | null; onClose: () => void }) {
  const router = useRouter();
  const { base } = useCrm();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const c = (rule?.conditions ?? {}) as RuleConditions;
  const {
    register,
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<RuleDraft>({
    defaultValues: {
      name: rule?.name ?? "",
      active: rule?.active ?? true,
      trigger: rule?.trigger ?? "lead_criado",
      stage: c.stage ?? "",
      origin: c.origin ?? "",
      source: c.source ?? "",
      days: String(c.days ?? 7),
      actions: rule
        ? parseActions(rule.actions).map((a) => ({
            ...blankAction(a.type),
            ...a,
            days: "days" in a ? String(a.days) : "0",
          }))
        : [blankAction()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "actions" });
  const trigger = useWatch({ control, name: "trigger" });
  const actions = useWatch({ control, name: "actions" });
  const origins = [...new Set(base.opps.map((o) => o.origin).filter(Boolean))] as string[];

  const submit = handleSubmit((v) => {
    const input = { ...v, actions: v.actions.map(toAction) };
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const path = i.path.join(".") as Parameters<typeof setFieldError>[0];
        setFieldError(path, { message: i.message });
      }
      return setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
    }
    start(async () => {
      const r = await saveRule(rule?.id ?? null, input);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={rule ? "Editar" : "Nova"}
      accent="regra"
      size="lg"
      footer={
        <Button type="submit" form="form-regra" loading={pending}>
          Salvar regra
        </Button>
      }
    >
      <form id="form-regra" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Nome da regra" htmlFor="rg-name" required error={errors.name?.message}>
          <Input id="rg-name" {...register("name")} placeholder="Ex.: Leads do Instagram" autoFocus />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
          <legend className="sr-only">Quando</legend>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Quando</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gatilho" htmlFor="rg-trigger" hint={TRIGGERS[trigger].hint}>
              <Select id="rg-trigger" {...register("trigger")}>
                {Object.entries(TRIGGERS).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            {trigger === "sem_contato" && (
              <Field label="Dias sem contato" htmlFor="rg-days" error={errors.days?.message}>
                <Input id="rg-days" type="number" min={1} max={365} {...register("days")} />
              </Field>
            )}
            <Field
              label={trigger === "etapa_alterada" ? "Chegou na etapa" : "Só na etapa (opcional)"}
              htmlFor="rg-stage"
              required={trigger === "etapa_alterada"}
              error={errors.stage?.message}
            >
              <Select id="rg-stage" {...register("stage")}>
                <option value="">{trigger === "etapa_alterada" ? "Escolha…" : "Qualquer etapa"}</option>
                {Object.entries(STAGES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Só com a origem (opcional)" htmlFor="rg-origin" hint="Sem diferença de maiúsculas.">
              <Input id="rg-origin" list="rg-origins" {...register("origin")} placeholder="Ex.: Instagram" />
              <datalist id="rg-origins">
                {origins.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>
            <Field label="Só vindo de (opcional)" htmlFor="rg-source">
              <Select id="rg-source" {...register("source")}>
                <option value="">Qualquer entrada</option>
                {Object.entries(SOURCES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
          <legend className="sr-only">Então</legend>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Então</p>
          {errors.actions?.message && <p className="text-xs text-danger">{errors.actions.message}</p>}
          {fields.map((f, i) => {
            const type = actions?.[i]?.type ?? f.type;
            const err = errors.actions?.[i];
            return (
              <div
                key={f.id}
                className="grid gap-2 rounded-lg bg-surface p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
              >
                <Field label={`Ação ${i + 1}`} htmlFor={`rg-a${i}`}>
                  <Select id={`rg-a${i}`} {...register(`actions.${i}.type`)}>
                    {Object.entries(ACTIONS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  {type === "mover_etapa" && (
                    <Field
                      label="Etapa"
                      htmlFor={`rg-a${i}-stage`}
                      className="sm:col-span-2"
                      error={err?.stage?.message}
                    >
                      <Select id={`rg-a${i}-stage`} {...register(`actions.${i}.stage`)}>
                        {RULE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGES[s].label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {type === "definir_responsavel" && (
                    <Field
                      label="Pessoa"
                      htmlFor={`rg-a${i}-user`}
                      className="sm:col-span-2"
                      error={err?.user_id?.message}
                    >
                      <Select id={`rg-a${i}-user`} {...register(`actions.${i}.user_id`)}>
                        <option value="">Escolha…</option>
                        {base.people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {type === "distribuir" && (
                    <p className="self-center text-xs text-muted sm:col-span-2">
                      Passa para a próxima pessoa do rodízio (aba Distribuição).
                    </p>
                  )}
                  {type === "adicionar_tag" && (
                    <Field
                      label="Tag"
                      htmlFor={`rg-a${i}-tag`}
                      className="sm:col-span-2"
                      error={err?.tag?.message}
                    >
                      <Input id={`rg-a${i}-tag`} list="crm-rule-tags" {...register(`actions.${i}.tag`)} />
                    </Field>
                  )}
                  {type === "proximo_passo" && (
                    <>
                      <Field label="Próximo passo" htmlFor={`rg-a${i}-text`} error={err?.text?.message}>
                        <Input
                          id={`rg-a${i}-text`}
                          {...register(`actions.${i}.text`)}
                          placeholder="Ex.: Ligar"
                        />
                      </Field>
                      <Field label="Daqui a (dias)" htmlFor={`rg-a${i}-days`} error={err?.days?.message}>
                        <Input
                          id={`rg-a${i}-days`}
                          type="number"
                          min={0}
                          max={365}
                          className="w-24"
                          {...register(`actions.${i}.days`)}
                        />
                      </Field>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-danger"
                  aria-label={`Remover ação ${i + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <datalist id="crm-rule-tags">
            {base.settings.tags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {fields.length < 5 && (
            <div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => append(blankAction("proximo_passo"))}
              >
                <Plus /> Adicionar ação
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}

// ---------- Execuções ----------
function Runs({ runs }: { runs: RunRow[] }) {
  const { base, openOpp } = useCrm();
  const [status, setStatus] = useState<"" | "ok" | "erro">("");
  const opps = useMemo(() => new Map(base.opps.map((o) => [o.id, o])), [base.opps]);
  const list = runs.filter((r) => !status || r.status === status);
  return (
    <SectionCard
      title="Execuções"
      icon={History}
      description="As últimas 300 vezes que uma regra rodou. Registros ficam guardados por 90 dias."
      action={
        <Select
          aria-label="Situação"
          className="h-8 w-auto text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="">Todas</option>
          <option value="ok">Deram certo</option>
          <option value="erro">Com erro</option>
        </Select>
      }
    >
      {list.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          Nenhuma execução {status ? "com esse filtro" : "ainda"}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {["Quando", "Regra", "Oportunidade", "Resultado"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const o = r.opportunity_id ? opps.get(r.opportunity_id) : undefined;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-2 text-xs whitespace-nowrap text-muted">
                      {when.format(new Date(r.ran_at))}
                    </td>
                    <td className="px-2 py-2">
                      <span className="block">{r.rule_name}</span>
                      <span className="text-[11px] text-muted">
                        {TRIGGERS[r.trigger as TriggerT]?.label ?? r.trigger}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {o ? (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => openOpp(o)}
                        >
                          {o.company || o.name}
                        </button>
                      ) : (
                        <span className="text-muted-2">Excluída</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span
                        className={cn(
                          "inline-flex items-start gap-1",
                          r.status === "ok" ? "text-success" : "text-danger",
                        )}
                      >
                        {r.status === "ok" ? (
                          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <XCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="sr-only">{r.status === "ok" ? "Certo:" : "Erro:"}</span>
                        <span className={r.status === "ok" ? "text-ink" : ""}>{r.detail}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ---------- Distribuição ----------
function Distribution({
  distribution,
}: {
  distribution: { members: string[]; auto_new: boolean; pointer: number };
}) {
  const router = useRouter();
  const { base, canEdit } = useCrm();
  const [members, setMembers] = useState(
    distribution.members.filter((id) => base.people.some((p) => p.id === id)),
  );
  const [autoNew, setAutoNew] = useState(distribution.auto_new);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => base.people.find((p) => p.id === id)?.name ?? "Ex-membro";
  const out = base.people.filter((p) => !members.includes(p.id));
  const next = members.length ? members[distribution.pointer % members.length] : null;
  const move = (i: number, d: -1 | 1) =>
    setMembers((m) => {
      const c = [...m];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });

  return (
    <SectionCard
      title="Distribuição em rodízio"
      icon={Shuffle}
      description="Os leads são passados um para cada pessoa, na ordem da lista, e depois recomeça."
    >
      <div className="flex flex-col gap-4">
        {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
        <div className="flex items-start gap-3">
          <Switch id="dist-auto" checked={autoNew} disabled={!canEdit} onCheckedChange={setAutoNew} />
          <label htmlFor="dist-auto" className="text-sm">
            Distribuir automaticamente os leads novos sem responsável
            <span className="block text-xs text-muted">
              Vale para cadastro, importação, API e formulários. Nas regras, use a ação “Distribuir no
              rodízio”.
            </span>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">No rodízio ({members.length})</p>
            {members.length === 0 ? (
              <p className="rounded-xl bg-surface-2 p-4 text-center text-xs text-muted">
                Ninguém ainda. Adicione pessoas ao lado.
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {members.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="w-5 text-xs text-muted tabular-nums">{i + 1}º</span>
                    <span className="flex-1 truncate">{name(id)}</span>
                    {id === next && distribution.members.join() === members.join() && (
                      <Badge tone="info">Próximo</Badge>
                    )}
                    {canEdit && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Subir ${name(id)}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Descer ${name(id)}`}
                          disabled={i === members.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-danger"
                          aria-label={`Tirar ${name(id)} do rodízio`}
                          onClick={() => setMembers((m) => m.filter((x) => x !== id))}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
          {canEdit && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Fora do rodízio</p>
              {out.length === 0 ? (
                <p className="text-xs text-muted">Toda a equipe já está no rodízio.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {out.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      <Button size="sm" variant="secondary" onClick={() => setMembers((m) => [...m, p.id])}>
                        <Plus /> Adicionar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveDistribution({ members, auto_new: autoNew });
                  setMsg(r.ok ? { ok: true, text: "Distribuição salva." } : { ok: false, text: r.error });
                  if (r.ok) router.refresh();
                })
              }
            >
              Salvar distribuição
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
