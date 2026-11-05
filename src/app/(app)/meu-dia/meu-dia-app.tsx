"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, KanbanSquare, ListChecks, Search, Sun, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Button, EmptyState, FilterMenu, Input, SectionCard, StatCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDays, shortDate, timeOf, today, weekdayDate } from "@/lib/dates";
import { PRIORITIES } from "@/features/demandas/schemas";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/features/agenda/actions";
import { needsWork } from "@/features/aprovacoes/schemas";
import { ApprovalStatusBadge } from "@/features/aprovacoes/ui";
import type { ApprovalStatusT } from "@/lib/supabase/database.types";

interface MyTask {
  id: string;
  title: string;
  type: "post" | "demanda";
  priority: "alta" | "media" | "baixa" | null;
  due_date: string | null;
  board_id: string;
  client_id: string | null;
  clientName: string | null;
  clientColor: string | null;
  columnName: string;
  columnColor: string;
}

interface Props {
  name: string;
  tasks: MyTask[];
  events: { id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; done: boolean; location: string | null }[];
  checklist: { id: string; title: string; due_date: string | null; done_at: string | null }[];
  agendaAllowed: boolean;
  approvalsAllowed: boolean;
  approvals: { id: string; title: string; status: ApprovalStatusT; kind: "post" | "demanda"; clientName: string }[];
}

export function MeuDiaApp({ name, tasks, events, checklist, agendaAllowed, approvalsAllowed, approvals }: Props) {
  const now = today();
  const [period, setPeriod] = useState<"hoje" | "semana">("hoje");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const [client, setClient] = useState("");

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) if (t.client_id && t.clientName) m.set(t.client_id, t.clientName);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [tasks]);

  const overdue = tasks.filter((t) => t.due_date && t.due_date < now);
  const visible = tasks
    .filter((t) => (period === "hoje" ? !!t.due_date && t.due_date <= now : true))
    .filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((t) => !priority || (priority === "none" ? !t.priority : t.priority === priority))
    .filter((t) => !client || t.client_id === client)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const dueToday = tasks.filter((t) => t.due_date && t.due_date <= now).length;
  const openItems = checklist.filter((c) => !c.done_at).length;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      <PageHeader title="Meu Dia" icon={Sun}>
        <span className="text-sm text-muted capitalize">
          {greeting}, {name} · {weekdayDate(now)}
        </span>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Demandas para hoje" value={dueToday} icon={KanbanSquare} hint={overdue.length ? `${overdue.length} atrasada(s)` : "Nenhuma atrasada"} />
        <StatCard label="Na agenda hoje" value={agendaAllowed ? events.length : "—"} icon={CalendarDays} hint={agendaAllowed ? undefined : "Sem acesso à Agenda"} />
        <StatCard label="Checklist" value={openItems} icon={ListChecks} hint="itens em aberto" />
        <StatCard label="Próximos 7 dias" value={tasks.filter((t) => t.due_date && t.due_date > now).length} icon={CheckCircle2} hint="demandas com prazo" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <SectionCard
          title="Minhas demandas"
          icon={KanbanSquare}
          description="Demandas em que você é responsável e que ainda não foram concluídas."
          action={
            <div role="radiogroup" aria-label="Período" className="flex gap-1 rounded-full bg-surface-2 p-1">
              {(["hoje", "semana"] as const).map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn("h-7 rounded-full px-3 text-xs font-medium", period === p ? "bg-brand text-brand-ink" : "text-muted")}
                >
                  {p === "hoje" ? "Hoje" : "Próximos 7 dias"}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Buscar" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 pl-9" />
            </div>
            <FilterMenu
              label="Prioridade"
              value={priority}
              onChange={setPriority}
              options={[{ value: "", label: "Toda prioridade" }, ...PRIORITIES.map((p) => ({ value: p.value, label: p.label })), { value: "none", label: "Sem prioridade" }]}
            />
            <FilterMenu label="Cliente" value={client} onChange={setClient} options={[{ value: "", label: "Todos os clientes" }, ...clients.map(([id, n]) => ({ value: id, label: n }))]} />
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={period === "hoje" ? "Nada para hoje" : "Nada nos próximos 7 dias"}
              description={period === "hoje" ? "Sem demandas com prazo até hoje. Veja os próximos 7 dias." : undefined}
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visible.map((t) => {
                const late = t.due_date && t.due_date < now;
                const prio = PRIORITIES.find((p) => p.value === t.priority);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/demandas?quadro=${t.board_id}`}
                      className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-surface-3"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.columnColor }} title={t.columnName} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{t.title}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {t.clientName ?? "Sem cliente"} · {t.columnName}
                        </span>
                      </span>
                      {prio && <span className={cn("size-2 shrink-0 rounded-full", prio.dot)} aria-label={`Prioridade ${prio.label}`} />}
                      {t.due_date ? (
                        <Badge tone={late ? "danger" : t.due_date === now ? "brand" : "neutral"}>
                          {late ? "Atrasada · " : t.due_date === now ? "Hoje · " : ""}
                          {shortDate(t.due_date)}
                        </Badge>
                      ) : (
                        <Badge>Sem prazo</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title="Agenda de hoje" icon={CalendarDays} action={agendaAllowed && <Link href="/agenda" className="text-xs underline-offset-2 hover:underline">Abrir agenda</Link>}>
            {!agendaAllowed ? (
              <p className="text-xs text-muted">Você não tem acesso à Agenda.</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-muted">Nada marcado para hoje.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {events.map((e) => (
                  <li key={e.id} className="rounded-xl bg-surface-2 px-3 py-2 text-xs">
                    <p className={cn("font-medium", e.done && "text-muted line-through")}>{e.title}</p>
                    <p className="text-muted">
                      {e.all_day ? "Dia inteiro" : `${timeOf(e.starts_at)} – ${timeOf(e.ends_at)}`}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <Checklist items={checklist} />
          <SectionCard
            title="Aprovações"
            icon={ClipboardCheck}
            description="Seus envios ainda não aprovados."
            action={approvalsAllowed && <Link href="/aprovacoes" className="text-xs underline-offset-2 hover:underline">Abrir</Link>}
          >
            {!approvalsAllowed ? (
              <p className="text-xs text-muted">Você não tem acesso à Aprovação.</p>
            ) : approvals.length === 0 ? (
              <p className="text-xs text-muted">Nada aguardando.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {[...approvals]
                  .sort((a, b) => Number(needsWork(b.status)) - Number(needsWork(a.status)))
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={`/aprovacoes?envio=${a.id}`} className="flex flex-col gap-1 rounded-xl bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
                        <span className="truncate font-medium">{a.title}</span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-muted">{a.clientName}</span>
                          <ApprovalStatusBadge status={a.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Checklist({ items }: { items: Props["checklist"] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const now = today();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      setError("");
      after?.();
      router.refresh();
    });

  return (
    <SectionCard title="Checklist" icon={ListChecks} description="Só você vê.">
      <form
        className="mb-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addChecklistItem({ title, due_date: due }), () => {
            setTitle("");
            setDue("");
          });
        }}
      >
        <div className="flex gap-2">
          <Input aria-label="Novo item" placeholder="Novo item" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
          <Button type="submit" size="sm" loading={pending} disabled={!title.trim()}>
            Adicionar
          </Button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted">
          Para o dia
          <Input type="date" value={due} min={now} max={addDays(now, 365)} onChange={(e) => setDue(e.target.value)} className="h-7 w-36 text-xs" />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>
      {items.length === 0 ? (
        <p className="text-xs text-muted">Nenhum item.</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-busy={pending}>
          {items.map((i) => (
            <li key={i.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={!!i.done_at}
                onChange={(e) => run(() => toggleChecklistItem(i.id, e.target.checked))}
                aria-label={i.title}
              />
              <span className={cn("flex-1 text-xs", i.done_at && "text-muted line-through")}>{i.title}</span>
              {i.due_date && (
                <span className={cn("text-[10px]", !i.done_at && i.due_date < now ? "text-danger" : "text-muted")}>{shortDate(i.due_date)}</span>
              )}
              <button
                type="button"
                onClick={() => run(() => deleteChecklistItem(i.id))}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-3"
                aria-label={`Excluir ${i.title}`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
