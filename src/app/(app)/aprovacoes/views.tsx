"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Images, Inbox } from "lucide-react";
import { Button, Card, EmptyState, MediaThumb, MonthCalendar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDays, dayOf, diffDays, shortDate, startOfWeek, timeOf, today, weekday } from "@/lib/dates";
import { NETWORKS, STATUS, STATUS_ORDER } from "@/features/aprovacoes/schemas";
import { ApprovalStatusBadge, formatDateTime } from "@/features/aprovacoes/ui";
import type { PostView } from "@/features/aprovacoes/types";

type ViewProps = { posts: PostView[]; onOpen: (p: PostView) => void };

function Empty({ title = "Nenhum envio encontrado", description }: { title?: string; description?: string }) {
  return (
    <Card>
      <EmptyState
        icon={Inbox}
        title={title}
        description={description ?? "Envie um post ou uma demanda para o cliente aprovar, ou ajuste os filtros."}
      />
    </Card>
  );
}

function ClientLine({ p }: { p: PostView }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
      <span className="size-2 shrink-0 rounded-full" style={{ background: p.clientColor ?? "var(--muted-2)" }} aria-hidden />
      <span className="truncate">{p.clientName}</span>
    </span>
  );
}

/** Grade: cartões com a primeira mídia, tema, cliente e status. */
export function GridView({ posts, onOpen }: ViewProps) {
  if (!posts.length) return <Empty />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen(p)} className="flex w-full flex-col overflow-hidden rounded-card bg-surface text-left hover:ring-2 hover:ring-brand">
            {p.kind === "post" && (
              <div className="relative">
                <MediaThumb media={p.media[0]} className="aspect-[4/3] w-full" />
                {p.media.length > 1 && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    <Images className="size-3" aria-hidden /> {p.media.length}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5 p-3">
              <ClientLine p={p} />
              <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
              {p.caption && <p className="line-clamp-2 text-xs text-muted">{p.caption}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ApprovalStatusBadge status={p.status} />
                {p.round > 1 && <span className="text-[10px] text-muted">{p.round}ª rodada</span>}
                {p.scheduled_at && <span className="text-[10px] text-muted">· {formatDateTime(p.scheduled_at)}</span>}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Quadro: uma coluna por status. A coluna muda com a decisão do cliente, não arrastando. */
export function BoardView({ posts, onOpen }: ViewProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map((s) => {
        const list = posts.filter((p) => p.status === s);
        return (
          <section key={s} aria-label={STATUS[s].label} className="flex w-72 shrink-0 flex-col gap-2 rounded-card bg-surface p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: STATUS[s].color }} aria-hidden />
              {STATUS[s].label}
              <span className="text-xs font-normal text-muted">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-2">Vazio</p>
            ) : (
              list.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p)} className="flex gap-2.5 rounded-xl bg-surface-2 p-2.5 text-left hover:bg-surface-3">
                  {p.kind === "post" && <MediaThumb media={p.media[0]} className="size-12 shrink-0 rounded-lg" />}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <ClientLine p={p} />
                    <span className="line-clamp-2 text-xs font-medium">{p.title}</span>
                    {p.scheduled_at && <span className="text-[10px] text-muted">{formatDateTime(p.scheduled_at)}</span>}
                  </span>
                </button>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Feed: prévia em quadrados, como o perfil vai ficar. Mais recentes (pela data agendada) primeiro. */
export function FeedView({ posts, onOpen }: ViewProps) {
  const ordered = useMemo(
    () => [...posts].sort((a, b) => (b.scheduled_at ?? b.sent_at).localeCompare(a.scheduled_at ?? a.sent_at)),
    [posts],
  );
  if (!ordered.length) return <Empty />;
  return (
    <div className="mx-auto max-w-xl rounded-card bg-surface p-2">
      <ul className="grid grid-cols-3 gap-1">
        {ordered.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p)} className="group relative block aspect-square w-full overflow-hidden" aria-label={`${p.title} (${STATUS[p.status].label})`}>
              <MediaThumb media={p.media[0]} className="size-full" />
              <span className="absolute top-1.5 left-1.5 size-2.5 rounded-full ring-2 ring-white" style={{ background: STATUS[p.status].color }} aria-hidden />
              <span className="absolute inset-0 hidden items-end bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-white group-hover:flex">
                {p.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ListView({ posts, onOpen, empty }: ViewProps & { empty?: string }) {
  if (!posts.length) return empty ? <Empty title={empty} description="Quando o cliente aprovar, o envio aparece aqui." /> : <Empty />;
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] text-muted uppercase">
            <th className="px-4 py-2.5 font-medium">Tema</th>
            <th className="px-3 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Enviado</th>
            <th className="px-3 py-2.5 font-medium">Publicação</th>
            <th className="px-3 py-2.5 font-medium">Redes</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
              <td className="px-4 py-2.5">
                <button type="button" onClick={() => onOpen(p)} className="flex items-center gap-2.5 text-left font-medium hover:underline">
                  {p.kind === "post" && <MediaThumb media={p.media[0]} className="size-8 shrink-0 rounded-md" />}
                  <span className="line-clamp-1">{p.title}</span>
                </button>
              </td>
              <td className="px-3 py-2.5">
                <ClientLine p={p} />
              </td>
              <td className="px-3 py-2.5">
                <ApprovalStatusBadge status={p.status} />
              </td>
              <td className="px-3 py-2.5 text-xs text-muted">{formatDateTime(p.sent_at)}</td>
              <td className="px-3 py-2.5 text-xs text-muted">{p.scheduled_at ? formatDateTime(p.scheduled_at) : "—"}</td>
              <td className="px-3 py-2.5 text-xs text-muted">{p.networks.map((n) => NETWORKS[n]).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Calendário pela data de publicação (sem data: pelo dia do envio). */
export function CalendarView({ posts, onOpen }: ViewProps) {
  const [month, setMonth] = useState(today());
  return (
    <div className="flex flex-col gap-2">
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        items={posts.map((p) => ({
          id: p.id,
          day: dayOf(p.scheduled_at ?? p.sent_at),
          label: `${p.scheduled_at ? timeOf(p.scheduled_at) + " " : ""}${p.title}`,
          color: STATUS[p.status].color,
          muted: !p.scheduled_at,
          onClick: () => onOpen(p),
        }))}
      />
      <p className="text-[11px] text-muted">Itens apagados ainda não têm data de publicação e aparecem no dia do envio.</p>
    </div>
  );
}

const DAYS = 28;
const DAY_W = 32;

/** Linha do tempo: do envio até a publicação (ou até a decisão, se não houver data). */
export function GanttView({ posts, onOpen }: ViewProps) {
  const [from, setFrom] = useState(() => startOfWeek(today()));
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const to = days[days.length - 1];
  const now = today();
  const rows = posts
    .map((p) => {
      const start = dayOf(p.sent_at);
      const endIso = p.scheduled_at ?? p.decided_at ?? null;
      const end = endIso ? dayOf(endIso) : now;
      return { p, start, end: end < start ? start : end };
    })
    .filter((r) => r.end >= from && r.start <= to)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Semanas anteriores" onClick={() => setFrom(addDays(from, -14))}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">
          {shortDate(from)} – {shortDate(to)}
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="Próximas semanas" onClick={() => setFrom(addDays(from, 14))}>
          <ChevronRight />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setFrom(startOfWeek(today()))}>
          Hoje
        </Button>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="Nenhum envio neste período" />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface p-3">
          <div style={{ width: 220 + DAYS * DAY_W }}>
            <div className="flex border-b border-line pb-1 text-[10px] text-muted">
              <div className="w-[220px] shrink-0" />
              {days.map((d) => (
                <div key={d} style={{ width: DAY_W }} className={cn("text-center", (weekday(d) === 0 || weekday(d) === 6) && "text-muted-2", d === now && "font-bold text-ink")}>
                  {Number(d.slice(8))}
                </div>
              ))}
            </div>
            <ul>
              {rows.map(({ p, start, end }) => {
                const left = Math.max(0, diffDays(from, start));
                const right = Math.min(DAYS - 1, diffDays(from, end));
                return (
                  <li key={p.id} className="relative flex h-9 items-center border-b border-line/60">
                    <button type="button" onClick={() => onOpen(p)} className="w-[220px] shrink-0 truncate pr-2 text-left text-xs hover:underline">
                      <span className="text-muted">{p.clientName} · </span>
                      {p.title}
                    </button>
                    <div className="relative h-full" style={{ width: DAYS * DAY_W }}>
                      {now >= from && now <= to && (
                        <span className="absolute inset-y-0 w-px bg-brand" style={{ left: diffDays(from, now) * DAY_W + DAY_W / 2 }} aria-hidden />
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen(p)}
                        aria-label={`${p.title}: ${shortDate(start)} a ${shortDate(end)}, ${STATUS[p.status].label}`}
                        className="absolute top-2 h-5 rounded-full"
                        style={{ left: left * DAY_W + 3, width: (right - left + 1) * DAY_W - 6, background: STATUS[p.status].color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
