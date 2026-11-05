"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, GanttChart } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDays, diffDays, shortDate, startOfWeek, today, weekday } from "@/lib/dates";
import { isOverdue } from "@/features/demandas/schemas";
import type { ColumnRow } from "@/lib/supabase/database.types";
import type { TaskView } from "@/features/demandas/types";

const DAYS = 28;
const DAY_W = 32;

/** Linha do tempo de 4 semanas: barra do início ao prazo (sem início, só o dia do prazo). */
export function GanttView({ tasks, columns, onOpen }: { tasks: TaskView[]; columns: ColumnRow[]; onOpen: (t: TaskView) => void }) {
  const [from, setFrom] = useState(() => startOfWeek(today()));
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const to = days[days.length - 1];
  const colColor = new Map(columns.map((c) => [c.id, c.color]));
  const now = today();

  const rows = tasks
    .filter((t) => t.due_date || t.start_date)
    .map((t) => {
      const start = t.start_date ?? t.due_date!;
      const end = t.due_date ?? t.start_date!;
      return { t, start, end };
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
          <EmptyState icon={GanttChart} title="Nenhuma demanda com datas neste período" description="Defina início e prazo nas demandas para vê-las aqui." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface p-3">
          <div style={{ width: 220 + DAYS * DAY_W }}>
            <div className="flex border-b border-line pb-1 text-[10px] text-muted">
              <div className="w-[220px] shrink-0" />
              {days.map((d) => (
                <div
                  key={d}
                  style={{ width: DAY_W }}
                  className={cn("text-center", weekday(d) === 0 || weekday(d) === 6 ? "text-muted-2" : "", d === now && "font-bold text-ink")}
                >
                  {Number(d.slice(8))}
                </div>
              ))}
            </div>
            <ul>
              {rows.map(({ t, start, end }) => {
                const left = Math.max(0, diffDays(from, start));
                const right = Math.min(DAYS - 1, diffDays(from, end));
                const color = colColor.get(t.column_id) ?? "var(--muted)";
                return (
                  <li key={t.id} className="relative flex h-9 items-center border-b border-line/60">
                    <button type="button" onClick={() => onOpen(t)} className="w-[220px] shrink-0 truncate pr-2 text-left text-xs hover:underline">
                      {t.clientName ? <span className="text-muted">{t.clientName} · </span> : null}
                      {t.title}
                    </button>
                    <div className="relative h-full" style={{ width: DAYS * DAY_W }}>
                      {now >= from && now <= to && (
                        <span className="absolute inset-y-0 w-px bg-brand" style={{ left: diffDays(from, now) * DAY_W + DAY_W / 2 }} aria-hidden />
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen(t)}
                        aria-label={`${t.title}: ${shortDate(start)} a ${shortDate(end)}`}
                        className={cn("absolute top-2 h-5 rounded-full", isOverdue(t) && "ring-2 ring-danger", t.completed_at && "opacity-50")}
                        style={{ left: left * DAY_W + 3, width: (right - left + 1) * DAY_W - 6, background: color }}
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
