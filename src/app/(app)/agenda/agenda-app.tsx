"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, MapPin, Plus, AlertTriangle, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Button, Card, EmptyState, MonthCalendar, StatCard, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDays, dayOf, diffDays, startOfWeek, timeOf, today, weekdayDate, WEEKDAYS_SHORT, shortDate } from "@/lib/dates";
import { commemorativeBetween } from "@/lib/commemorative";
import type { EventRow } from "@/lib/supabase/database.types";
import { EventModal } from "./event-modal";
import { AvailabilityModal } from "./availability-modal";

export interface AgendaEvent extends EventRow {
  attendees: string[];
  ownerName: string;
}

interface Props {
  day: string;
  events: AgendaEvent[];
  people: { id: string; name: string }[];
  clients: { id: string; name: string; color: string | null }[];
  availability: { user_id: string; weekday: number; start_time: string; end_time: string }[];
  userId: string;
  canEditAll: boolean;
}

type View = "mes" | "semana" | "dia" | "lista";
const VIEWS: { id: View; label: string }[] = [
  { id: "mes", label: "Mês" },
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Dia" },
  { id: "lista", label: "Lista" },
];

/** Dias cobertos por uma atividade (para atividades de vários dias). */
function daysOf(e: AgendaEvent): string[] {
  const a = dayOf(e.starts_at);
  const b = dayOf(e.ends_at);
  const n = Math.max(0, Math.min(diffDays(a, b), 62));
  return Array.from({ length: n + 1 }, (_, i) => addDays(a, i));
}

export function AgendaApp({ day, events, people, clients, availability, userId, canEditAll }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("mes");
  const [scope, setScope] = useState<"minha" | "agencia">("agencia");
  const [showDates, setShowDates] = useState(true);
  const [editing, setEditing] = useState<AgendaEvent | { newDay: string } | null>(null);
  const [availOpen, setAvailOpen] = useState(false);
  const now = today();

  const go = (d: string) => router.push(`/agenda?dia=${d}`, { scroll: false });

  const visible = useMemo(
    () => (scope === "minha" ? events.filter((e) => e.owner_id === userId || e.attendees.includes(userId)) : events),
    [events, scope, userId],
  );
  const nowIso = new Date().toISOString();
  const overdue = visible.filter((e) => !e.done_at && e.ends_at < nowIso).length;
  const done = visible.filter((e) => e.done_at).length;

  const range = view === "semana" ? [startOfWeek(day), addDays(startOfWeek(day), 6)] : view === "dia" ? [day, day] : view === "lista" ? [day, addDays(day, 30)] : [addDays(day.slice(0, 8) + "01", -7), addDays(day.slice(0, 8) + "01", 42)];
  const dates = showDates ? commemorativeBetween(range[0], range[1]) : [];

  const canEdit = (e: AgendaEvent) => e.owner_id === userId || (e.visibility === "agencia" && canEditAll);
  const open = (e: AgendaEvent) => setEditing(e);

  const step = view === "semana" ? 7 : view === "dia" ? 1 : view === "lista" ? 30 : 0;
  const prev = () => (step ? go(addDays(day, -step)) : go(addDays(day.slice(0, 8) + "01", -1)));
  const next = () => (step ? go(addDays(day, step)) : go(addDays(day.slice(0, 8) + "01", 40)));

  return (
    <>
      <PageHeader
        title="Agenda"
        icon={CalendarDays}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAvailOpen(true)}>
              <Clock /> Disponibilidade
            </Button>
            <Button onClick={() => setEditing({ newDay: day < now ? now : day })}>
              <Plus /> Nova atividade
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Agenda" className="flex gap-1 rounded-full bg-surface p-1">
          {(["minha", "agencia"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={cn("h-7 rounded-full px-3 text-xs font-medium", scope === s ? "bg-brand text-brand-ink" : "text-muted hover:text-ink")}
            >
              {s === "minha" ? "Minha agenda" : "Agência"}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label="Concluídas no período" value={done} icon={CheckCircle2} />
        <StatCard label="Atrasadas" value={overdue} icon={AlertTriangle} hint={overdue ? "Já passaram e não foram concluídas" : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visão" className="flex gap-1 rounded-full bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn("h-7 rounded-full px-3 text-xs font-medium", view === v.id ? "bg-brand text-brand-ink" : "text-muted hover:text-ink")}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view !== "mes" && (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Anterior" onClick={prev}>
              <ChevronLeft />
            </Button>
            <span className="text-sm font-medium">
              {view === "dia" ? weekdayDate(day) : `${shortDate(range[0])} – ${shortDate(range[1])}`}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Próximo" onClick={next}>
              <ChevronRight />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => go(now)}>
              Hoje
            </Button>
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <Switch checked={showDates} onCheckedChange={setShowDates} aria-label="Mostrar datas comemorativas" />
          Datas comemorativas
        </label>
      </div>

      {view === "mes" && (
        <MonthCalendar
          month={day}
          onMonthChange={go}
          onDayClick={(d) => setEditing({ newDay: d })}
          items={[
            ...dates.map((c) => ({ id: `c-${c.day}-${c.name}`, day: c.day, label: c.name, color: "var(--brand)" })),
            ...visible.flatMap((e) =>
              daysOf(e).map((d) => ({
                id: `${e.id}-${d}`,
                day: d,
                label: `${e.all_day ? "" : `${timeOf(e.starts_at)} `}${e.title}`,
                muted: !!e.done_at,
                danger: !e.done_at && e.ends_at < nowIso,
                color: e.visibility === "privado" ? "var(--muted)" : "var(--info)",
                onClick: () => open(e),
              })),
            ),
          ]}
        />
      )}

      {(view === "semana" || view === "dia") && (
        <div className={cn("grid gap-2", view === "semana" ? "md:grid-cols-7" : "grid-cols-1")}>
          {Array.from({ length: view === "semana" ? 7 : 1 }, (_, i) => addDays(range[0], i)).map((d) => (
            <DayColumn
              key={d}
              day={d}
              events={visible.filter((e) => daysOf(e).includes(d))}
              dates={dates.filter((c) => c.day === d)}
              onOpen={open}
              onNew={() => setEditing({ newDay: d })}
              compact={view === "semana"}
            />
          ))}
        </div>
      )}

      {view === "lista" && (
        <ListAgenda
          from={range[0]}
          to={range[1]}
          events={visible}
          dates={dates}
          onOpen={open}
        />
      )}

      {editing && (
        <EventModal
          event={"newDay" in editing ? null : editing}
          defaultDay={"newDay" in editing ? editing.newDay : day}
          people={people}
          clients={clients}
          userId={userId}
          canEdit={"newDay" in editing ? true : canEdit(editing)}
          onClose={() => setEditing(null)}
        />
      )}
      {availOpen && <AvailabilityModal rules={availability} people={people} userId={userId} onClose={() => setAvailOpen(false)} />}
    </>
  );
}

function EventLine({ e, onOpen }: { e: AgendaEvent; onOpen: (e: AgendaEvent) => void }) {
  const late = !e.done_at && e.ends_at < new Date().toISOString();
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-xl p-2 text-left text-xs",
        late ? "bg-danger-soft" : "bg-surface-2 hover:bg-surface-3",
      )}
    >
      <span className={cn("font-medium", e.done_at && "text-muted line-through")}>
        {e.visibility === "privado" && <Lock className="mr-1 inline size-3" aria-label="Privada" />}
        {e.title}
      </span>
      <span className="text-[11px] text-muted">
        {e.all_day ? "Dia inteiro" : `${timeOf(e.starts_at)} – ${timeOf(e.ends_at)}`}
        {e.location ? ` · ${e.location}` : ""}
      </span>
    </button>
  );
}

function DayColumn({
  day,
  events,
  dates,
  onOpen,
  onNew,
  compact,
}: {
  day: string;
  events: AgendaEvent[];
  dates: { name: string }[];
  onOpen: (e: AgendaEvent) => void;
  onNew: () => void;
  compact: boolean;
}) {
  const isToday = day === today();
  return (
    <section className={cn("flex min-h-40 flex-col gap-2 rounded-card bg-surface p-3", isToday && "ring-2 ring-brand")} aria-label={weekdayDate(day)}>
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold">
          {compact ? `${WEEKDAYS_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${Number(day.slice(8))}` : weekdayDate(day)}
        </h3>
        <button type="button" onClick={onNew} className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Nova atividade em ${weekdayDate(day)}`}>
          <Plus className="size-3.5" />
        </button>
      </header>
      {dates.map((c) => (
        <Badge key={c.name} tone="brand" className="self-start">
          <PartyPopper className="size-3" aria-hidden /> {c.name}
        </Badge>
      ))}
      {events.length === 0 && dates.length === 0 && <p className="text-[11px] text-muted-2">Livre</p>}
      {events.map((e) => (
        <EventLine key={e.id} e={e} onOpen={onOpen} />
      ))}
    </section>
  );
}

function ListAgenda({
  from,
  to,
  events,
  dates,
  onOpen,
}: {
  from: string;
  to: string;
  events: AgendaEvent[];
  dates: { day: string; name: string }[];
  onOpen: (e: AgendaEvent) => void;
}) {
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i)).filter(
    (d) => events.some((e) => daysOf(e).includes(d)) || dates.some((c) => c.day === d),
  );
  if (!days.length) {
    return (
      <Card>
        <EmptyState icon={MapPin} title="Nada marcado nos próximos 30 dias" />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => (
        <section key={d} className="rounded-card bg-surface p-4" aria-label={weekdayDate(d)}>
          <h3 className={cn("mb-2 text-sm font-semibold capitalize", d === today() && "text-brand-strong")}>{weekdayDate(d)}</h3>
          <div className="flex flex-col gap-2">
            {dates
              .filter((c) => c.day === d)
              .map((c) => (
                <Badge key={c.name} tone="brand" className="self-start">
                  <PartyPopper className="size-3" aria-hidden /> {c.name}
                </Badge>
              ))}
            {events
              .filter((e) => daysOf(e).includes(d))
              .map((e) => (
                <EventLine key={e.id} e={e} onOpen={onOpen} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
