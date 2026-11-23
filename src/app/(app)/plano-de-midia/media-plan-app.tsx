"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Megaphone, Pencil, Plus, Target, Trash2, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, Card, EmptyState, Field, HeroStatCard, Input, Modal, Select, StatCard, Textarea } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import {
  CAMPAIGN_STATUS,
  OBJECTIVES,
  PLATFORMS,
  campaignSchema,
  elapsedPct,
  overlapsMonth,
  summarize,
  type CampaignData,
  type CampaignInput,
  type CampaignRow,
  type CampaignStatus,
  type Objective,
  type Platform,
} from "@/features/plano-midia/schemas";
import { deleteCampaign, saveCampaign, updateSpent } from "@/features/plano-midia/actions";

const tz = "America/Sao_Paulo";
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T12:00:00Z`));

function monthOptions(campaigns: CampaignRow[]) {
  const set = new Set<string>([todayIso().slice(0, 7)]);
  for (const c of campaigns) {
    // todos os meses que a campanha cobre
    let cur = c.start_date.slice(0, 7);
    const end = c.end_date.slice(0, 7);
    for (let i = 0; cur <= end && i < 36; i++) {
      set.add(cur);
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }
  return [...set].sort().reverse();
}

export function MediaPlanApp({ campaigns, clients, canEdit }: { campaigns: CampaignRow[]; clients: { id: string; name: string }[]; canEdit: boolean }) {
  const [client, setClient] = useState("");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [modal, setModal] = useState<"new" | CampaignRow | null>(null);
  const months = useMemo(() => monthOptions(campaigns), [campaigns]);
  const list = campaigns.filter((c) => (!client || c.client_id === client) && overlapsMonth(c, month));
  const s = summarize(list);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Cliente";
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Plano de Mídia"
        icon={Megaphone}
        actions={
          canEdit && (
            <Button onClick={() => setModal("new")} disabled={!clients.length}>
              <Plus /> Nova campanha
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-60">
          <Select aria-label="Cliente" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroStatCard label="Verba planejada" value={formatBRL(s.planned)} icon={Wallet} hint="campanhas que rodam no mês" />
        <StatCard label="Investido" value={formatBRL(s.spent)} icon={TrendingUp} hint={`${s.pct}% da verba`} />
        <StatCard
          label="Saldo"
          value={<span className={s.balance < 0 ? "text-danger" : undefined}>{formatBRL(s.balance)}</span>}
          icon={Wallet}
          hint={s.balance < 0 ? "passou da verba" : "ainda para investir"}
        />
        <StatCard label="Campanhas ativas" value={s.active} icon={Megaphone} hint={`${list.length} no mês`} />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha planejada"
            description="Cadastre as campanhas de cada cliente com período e verba. O investido você atualiza aqui mesmo."
            action={
              canEdit &&
              clients.length > 0 && (
                <Button onClick={() => setModal("new")}>
                  <Plus /> Planejar a primeira
                </Button>
              )
            }
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Target} title="Nada neste mês" description="Nenhuma campanha roda no mês e cliente escolhidos." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <CampaignItem key={c.id} c={c} clientName={clientName(c.client_id)} showClient={!client} today={today} canEdit={canEdit} onEdit={() => setModal(c)} />
          ))}
        </ul>
      )}

      {modal && <CampaignModal campaign={modal === "new" ? null : modal} clients={clients} defaultClient={client} onClose={() => setModal(null)} />}
    </>
  );
}

function CampaignItem({
  c,
  clientName,
  showClient,
  today,
  canEdit,
  onEdit,
}: {
  c: CampaignRow;
  clientName: string;
  showClient: boolean;
  today: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.spent.toFixed(2).replace(".", ","));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pct = c.planned_budget > 0 ? Math.round((c.spent / c.planned_budget) * 100) : 0;
  const time = elapsedPct(c, today);
  // gastando bem mais rápido (ou mais devagar) que o tempo da campanha
  const pace = c.status === "ativa" && time > 0 && time < 100 ? pct - time : 0;

  return (
    <li className="rounded-card bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {c.name}
            <Badge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</Badge>
          </p>
          <p className="text-xs text-muted">
            {showClient && `${clientName} · `}
            {PLATFORMS[c.platform]} · {OBJECTIVES[c.objective]} · {shortDate(c.start_date)} a {shortDate(c.end_date)}
          </p>
        </div>
        {canEdit && (
          <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
        )}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs">
          <span className="text-muted">
            Investido {formatBRL(c.spent)} de {formatBRL(c.planned_budget)} · {pct}%
            {c.status === "ativa" && time > 0 && time < 100 && ` · ${time}% do período`}
          </span>
          {pace > 15 && <span className="font-medium text-danger">gastando mais rápido que o previsto</span>}
          {pace < -25 && <span className="font-medium text-muted">gastando mais devagar que o previsto</span>}
        </div>
        <div className="relative h-2 rounded-full bg-surface-2">
          <div className={cn("h-2 rounded-full", pct > 100 ? "bg-danger" : "bg-brand")} style={{ width: `${Math.min(100, pct)}%` }} />
          {c.status === "ativa" && time > 0 && time < 100 && (
            <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/40" style={{ left: `${time}%` }} title="Hoje" aria-hidden />
          )}
        </div>
      </div>
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {editing ? (
            <>
              <Input aria-label={`Investido em ${c.name}`} inputMode="decimal" className="h-8 w-36" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              <Button
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await updateSpent(c.id, value);
                    if (!r.ok) return setError(r.error);
                    setEditing(false);
                    setError("");
                    router.refresh();
                  })
                }
              >
                <Check /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              {error && <span className="text-danger">{error}</span>}
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Atualizar investido
              </Button>
              {c.spent_updated_at && (
                <span className="text-muted-2">
                  atualizado em{" "}
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
                    new Date(c.spent_updated_at),
                  )}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function CampaignModal({
  campaign,
  clients,
  defaultClient,
  onClose,
}: {
  campaign: CampaignRow | null;
  clients: { id: string; name: string }[];
  defaultClient: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const today = todayIso();
  const brl = (n: number) => n.toFixed(2).replace(".", ",");
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CampaignInput, unknown, CampaignData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      client_id: campaign?.client_id ?? defaultClient ?? "",
      name: campaign?.name ?? "",
      platform: campaign?.platform ?? "meta",
      objective: campaign?.objective ?? "mensagens",
      status: campaign?.status ?? "planejada",
      start_date: campaign?.start_date ?? today,
      end_date: campaign?.end_date ?? today,
      planned_budget: campaign ? brl(campaign.planned_budget) : "",
      spent: campaign ? brl(campaign.spent) : "0",
      notes: campaign?.notes ?? "",
    },
  });

  const onSubmit = handleSubmit(() =>
    start(async () => {
      const r = await saveCampaign(campaign?.id ?? null, getValues());
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    }),
  );

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={campaign ? "Editar" : "Nova"}
      accent="campanha"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {campaign &&
            (confirmDelete ? (
              <Button
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteCampaign(campaign.id);
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
          <Button type="submit" form="form-campanha" loading={pending}>
            Salvar
          </Button>
        </div>
      }
    >
      <form id="form-campanha" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {error && <Alert className="sm:col-span-2">{error}</Alert>}
        <Field label="Cliente" htmlFor="mc-client" error={errors.client_id?.message} required>
          <Select id="mc-client" {...register("client_id")}>
            <option value="">Escolha…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome da campanha" htmlFor="mc-name" error={errors.name?.message} required>
          <Input id="mc-name" placeholder="Ex.: Lançamento do cardápio" {...register("name")} />
        </Field>
        <Field label="Plataforma" htmlFor="mc-plat" error={errors.platform?.message}>
          <Select id="mc-plat" {...register("platform")}>
            {(Object.keys(PLATFORMS) as Platform[]).map((k) => (
              <option key={k} value={k}>
                {PLATFORMS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Objetivo" htmlFor="mc-obj" error={errors.objective?.message}>
          <Select id="mc-obj" {...register("objective")}>
            {(Object.keys(OBJECTIVES) as Objective[]).map((k) => (
              <option key={k} value={k}>
                {OBJECTIVES[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Início" htmlFor="mc-start" error={errors.start_date?.message} required>
          <Input id="mc-start" type="date" {...register("start_date")} />
        </Field>
        <Field label="Fim" htmlFor="mc-end" error={errors.end_date?.message} required>
          <Input id="mc-end" type="date" {...register("end_date")} />
        </Field>
        <Field label="Verba planejada (R$)" htmlFor="mc-budget" error={errors.planned_budget?.message} required>
          <Input id="mc-budget" inputMode="decimal" placeholder="0,00" {...register("planned_budget")} />
        </Field>
        <Field label="Investido até agora (R$)" htmlFor="mc-spent" error={errors.spent?.message}>
          <Input id="mc-spent" inputMode="decimal" {...register("spent")} />
        </Field>
        <Field label="Status" htmlFor="mc-status" error={errors.status?.message}>
          <Select id="mc-status" {...register("status")}>
            {(Object.keys(CAMPAIGN_STATUS) as CampaignStatus[]).map((k) => (
              <option key={k} value={k}>
                {CAMPAIGN_STATUS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações" htmlFor="mc-notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="mc-notes" rows={3} placeholder="Público, criativos, link de destino…" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
