"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlarmClock, CheckCircle2, FileText, Handshake, LayoutTemplate, Plus, Search, Send, Trash2, Wallet, XCircle, CalendarX } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, buttonVariants, Card, EmptyState, FilterMenu, HeroStatCard, Input, Modal, StatCard } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { shortDate, today } from "@/lib/dates";
import { CADENCES, PROPOSAL_STATUS, PROPOSAL_STATUS_IDS, investment, isExpired } from "@/features/propostas/schemas";
import { deleteProposalTemplate } from "@/features/propostas/actions";
import type { ItemCadenceT, ProposalStatusT } from "@/lib/supabase/database.types";

export interface ProposalListItem {
  id: string;
  number: string;
  title: string;
  status: ProposalStatusT;
  valid_until: string | null;
  client_id: string | null;
  clientName: string | null;
  cover: string;
  created_at: string;
  value: number;
  items: { quantity: number; unit_price: number; cadence: ItemCadenceT }[];
}

export function PropostasApp({
  proposals,
  indicators,
  templates,
  canEdit,
}: {
  proposals: ProposalListItem[];
  indicators: { openValue: number; accepted: number; negotiating: number; sent: number; dueIn7: number; refused: number; expired: number };
  templates: { id: string; name: string; title: string; cover: string; itemCount: number }[];
  canEdit: boolean;
}) {
  const now = today();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proposals) if (p.client_id && p.clientName) m.set(p.client_id, p.clientName);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [proposals]);

  const visible = proposals.filter((p) => {
    const term = q.trim().toLowerCase();
    if (term && !`${p.number} ${p.title} ${p.clientName ?? ""}`.toLowerCase().includes(term)) return false;
    if (client && p.client_id !== client) return false;
    if (status === "vencida") return isExpired(p, now);
    return !status || p.status === status;
  });

  return (
    <>
      <PageHeader
        title="Propostas"
        icon={FileText}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowTemplates(true)}>
              <LayoutTemplate /> Modelos
            </Button>
            {canEdit && (
              <Link href="/propostas/nova" className={buttonVariants()}>
                <Plus /> Nova proposta
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)]">
        <HeroStatCard label="Valor em aberto" value={formatBRL(indicators.openValue)} icon={Wallet} hint="enviadas e em negociação" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Aceitas" value={indicators.accepted} icon={CheckCircle2} />
          <StatCard label="Em negociação" value={indicators.negotiating} icon={Handshake} />
          <StatCard label="Enviadas" value={indicators.sent} icon={Send} />
          <StatCard label="Vencem em 7 dias" value={indicators.dueIn7} icon={AlarmClock} />
          <StatCard label="Recusadas" value={indicators.refused} icon={XCircle} />
          <StatCard label="Vencidas" value={indicators.expired} icon={CalendarX} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar" placeholder="Buscar por número, título ou cliente" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 pl-9" />
        </div>
        <FilterMenu
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Todos os status" },
            ...PROPOSAL_STATUS_IDS.map((s) => ({ value: s, label: PROPOSAL_STATUS[s].label })),
            { value: "vencida", label: "Vencidas" },
          ]}
        />
        <FilterMenu label="Cliente" value={client} onChange={setClient} options={[{ value: "", label: "Todos os clientes" }, ...clients.map(([id, n]) => ({ value: id, label: n }))]} />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={proposals.length ? "Nenhuma proposta com esses filtros" : "Nenhuma proposta ainda"}
            description={proposals.length ? undefined : "Monte a primeira proposta com itens, valores e condições de pagamento."}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => {
            const expired = isExpired(p, now);
            const inv = investment(p.items);
            return (
              <li key={p.id}>
                <Link href={`/propostas/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 lift rounded-card bg-surface p-4 hover:ring-2 hover:ring-brand">
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: p.cover }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-muted">
                      Nº {p.number} · {p.clientName ?? "Sem cliente"}
                    </span>
                    <span className="block truncate font-medium">{p.title}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {inv.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      inv.map((x) => (
                        <span key={x.cadence} className="block">
                          {formatBRL(x.total)}
                          <span className="text-xs text-muted">{CADENCES[x.cadence].suffix}</span>
                        </span>
                      ))
                    )}
                  </span>
                  <span className="flex w-40 flex-col items-end gap-1">
                    <span className="flex gap-1">
                      <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
                      {expired && <Badge tone="danger">Vencida</Badge>}
                    </span>
                    {p.valid_until && <span className="text-[11px] text-muted">Válida até {shortDate(p.valid_until)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showTemplates && <TemplatesModal templates={templates} canEdit={canEdit} onClose={() => setShowTemplates(false)} />}
    </>
  );
}

function TemplatesModal({
  templates,
  canEdit,
  onClose,
}: {
  templates: { id: string; name: string; title: string; cover: string; itemCount: number }[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Modelos" accent="de proposta" size="lg">
      {error && <Alert className="mb-3">{error}</Alert>}
      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nenhum modelo ainda"
          description="Abra uma proposta e use “Salvar como modelo” para reaproveitar itens, escopo, condições e observações."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
              <span className="h-1.5 w-12 rounded-full" style={{ background: t.cover }} aria-hidden />
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted">
                  {t.title || "Sem título"} · {t.itemCount} {t.itemCount === 1 ? "item" : "itens"}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Link href={`/propostas/nova?modelo=${t.id}`} className={buttonVariants({ size: "sm" })}>
                    Usar modelo
                  </Link>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Excluir modelo ${t.name}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteProposalTemplate(t.id);
                        if (!r.ok) return setError(r.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
