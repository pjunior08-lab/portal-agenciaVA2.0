"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock, CalendarX, FilePen, FileSignature, Hourglass, LayoutTemplate, Plus, Search, ShieldCheck, Star, Trash2, UserPen, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, buttonVariants, Card, EmptyState, FilterMenu, HeroStatCard, Input, StatCard } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate, today } from "@/lib/dates";
import { CONTRACT_STATUS, CONTRACT_STATUS_IDS, renewalDate } from "@/features/contratos/schemas";
import { createStarterTemplate, deleteContractTemplate } from "@/features/contratos/actions";
import type { ContractStatusT } from "@/lib/supabase/database.types";

export interface ContractListItem {
  id: string;
  title: string;
  status: ContractStatusT;
  value: number | null;
  starts_on: string | null;
  ends_on: string | null;
  renewal_on: string | null;
  client_id: string;
  clientName: string;
  parties: string[];
}

type Template = { id: string; name: string; description: string; is_default: boolean; updated_at: string };

export function ContratosApp({
  contracts,
  indicators,
  templates,
  initialTab,
  canEdit,
}: {
  contracts: ContractListItem[];
  indicators: { signedValue: number; signed: number; awaitingClient: number; awaitingYou: number; drafts: number; renewIn30: number; renewalOverdue: number };
  templates: Template[];
  initialTab: "contratos" | "modelos";
  canEdit: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <>
      <PageHeader
        title="Contratos"
        icon={FileSignature}
        actions={
          canEdit &&
          (tab === "modelos" ? (
            <Link href="/contratos/modelos/novo" className={buttonVariants()}>
              <Plus /> Novo modelo
            </Link>
          ) : (
            <Link href="/contratos/novo" className={buttonVariants()}>
              <Plus /> Novo contrato
            </Link>
          ))
        }
      >
        <div role="tablist" aria-label="Seções" className="flex gap-1 rounded-full bg-surface p-1">
          {(
            [
              ["contratos", "Contratos", FileSignature],
              ["modelos", "Modelos", LayoutTemplate],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium", tab === id ? "bg-panel text-panel-ink" : "text-muted hover:text-ink")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </PageHeader>
      {tab === "contratos" ? <ContractsTab contracts={contracts} indicators={indicators} /> : <TemplatesTab templates={templates} canEdit={canEdit} />}
    </>
  );
}

function ContractsTab({ contracts, indicators }: { contracts: ContractListItem[]; indicators: Parameters<typeof ContratosApp>[0]["indicators"] }) {
  const now = today();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const clients = useMemo(() => [...new Map(contracts.map((c) => [c.client_id, c.clientName]))].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [contracts]);
  const visible = contracts.filter((c) => {
    if (q.trim() && !`${c.title} ${c.clientName}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (client && c.client_id !== client) return false;
    if (status === "aguardando-cliente") return c.status === "aguardando" && !c.parties.includes("contratante");
    if (status === "aguardando-voce") return c.status === "aguardando" && !c.parties.includes("contratada");
    return !status || c.status === status;
  });

  return (
    <>
      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)]">
        <HeroStatCard label="Valor em contratos assinados" value={formatBRL(indicators.signedValue)} icon={Wallet} hint={`${indicators.signed} assinados`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Assinados" value={indicators.signed} icon={ShieldCheck} />
          <StatCard label="Aguardando cliente" value={indicators.awaitingClient} icon={Hourglass} />
          <StatCard label="Sua assinatura" value={indicators.awaitingYou} icon={UserPen} hint="falta a agência assinar" />
          <StatCard label="Rascunhos" value={indicators.drafts} icon={FilePen} />
          <StatCard label="Renovam em 30 dias" value={indicators.renewIn30} icon={CalendarClock} />
          <StatCard label="Renovação vencida" value={indicators.renewalOverdue} icon={CalendarX} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar" placeholder="Buscar por título ou cliente" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 pl-9" />
        </div>
        <FilterMenu
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Todos os status" },
            ...CONTRACT_STATUS_IDS.map((s) => ({ value: s, label: CONTRACT_STATUS[s].label })),
            { value: "aguardando-cliente", label: "Aguardando cliente" },
            { value: "aguardando-voce", label: "Aguardando sua assinatura" },
          ]}
        />
        <FilterMenu label="Cliente" value={client} onChange={setClient} options={[{ value: "", label: "Todos os clientes" }, ...clients.map(([id, n]) => ({ value: id, label: n }))]} />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title={contracts.length ? "Nenhum contrato com esses filtros" : "Nenhum contrato ainda"}
            description={contracts.length ? undefined : "Crie a partir de um modelo ou de uma proposta aceita."}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((c) => {
            const renew = renewalDate(c);
            const overdue = c.status === "assinado" && renew && renew < now;
            return (
              <li key={c.id}>
                <Link href={`/contratos/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-surface p-4 hover:ring-2 hover:ring-brand">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-muted">{c.clientName}</span>
                    <span className="block truncate font-medium">{c.title}</span>
                  </span>
                  <span className="text-sm tabular-nums">{c.value != null ? formatBRL(c.value) : "—"}</span>
                  <span className="text-xs text-muted">
                    {c.starts_on ? shortDate(c.starts_on) : "—"} a {c.ends_on ? shortDate(c.ends_on) : "—"}
                  </span>
                  <span className="flex w-52 flex-col items-end gap-1">
                    <span className="flex flex-wrap justify-end gap-1">
                      <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
                      {overdue && <Badge tone="danger">Renovação vencida</Badge>}
                    </span>
                    {c.status === "aguardando" && (
                      <span className="text-[11px] text-muted">
                        {c.parties.includes("contratante") ? "Cliente assinou" : "Falta o cliente"} ·{" "}
                        {c.parties.includes("contratada") ? "agência assinou" : "falta a agência"}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function TemplatesTab({ templates, canEdit }: { templates: Template[]; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={LayoutTemplate}
            title="Nenhum modelo de contrato"
            description="Crie um modelo do zero ou comece pelo esqueleto de cláusulas com variáveis (para completar e revisar com um advogado)."
          />
          {canEdit && (
            <div className="flex justify-center pb-6">
              <Button
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await createStarterTemplate();
                    if (!r.ok) return setError(r.error);
                    router.push(`/contratos/modelos/${r.data!.id}`);
                  })
                }
              >
                Começar pelo esqueleto
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-card bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{t.name}</p>
                {t.is_default && (
                  <Badge tone="brand">
                    <Star className="size-3" aria-hidden /> Padrão
                  </Badge>
                )}
              </div>
              <p className="flex-1 text-xs text-muted">{t.description || "Sem descrição."}</p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/contratos/novo?modelo=${t.id}`} className={buttonVariants({ size: "sm" })}>
                    Usar modelo
                  </Link>
                  <Link href={`/contratos/modelos/${t.id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                    Personalizar
                  </Link>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Excluir modelo ${t.name}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteContractTemplate(t.id);
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
    </div>
  );
}
