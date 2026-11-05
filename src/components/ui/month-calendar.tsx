"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS_SHORT, addMonths, monthGrid, monthLabel, today } from "@/lib/dates";
import { Button } from "./button";

export interface CalendarItem {
  id: string;
  day: string; // AAAA-MM-DD
  label: string;
  color?: string | null;
  muted?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

/** Grade de mês (domingo a sábado) com itens por dia. Usada em Demandas e Agenda. */
export function MonthCalendar({
  month,
  onMonthChange,
  items,
  onDayClick,
  maxPerDay = 3,
}: {
  month: string;
  onMonthChange: (m: string) => void;
  items: CalendarItem[];
  onDayClick?: (day: string) => void;
  maxPerDay?: number;
}) {
  const days = monthGrid(month);
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  const now = today();
  const currentMonth = month.slice(0, 7);

  return (
    <div className="rounded-card bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold capitalize">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onMonthChange(now)}>
            Hoje
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Mês anterior" onClick={() => onMonthChange(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Próximo mês" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line text-xs">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="bg-surface px-2 py-1.5 text-center text-[10px] font-medium text-muted uppercase">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const outside = d.slice(0, 7) !== currentMonth;
          return (
            <div key={d} className={cn("flex min-h-24 flex-col gap-1 bg-surface p-1.5", outside && "bg-surface-2/60")}>
              <button
                type="button"
                onClick={() => onDayClick?.(d)}
                disabled={!onDayClick}
                aria-label={`Dia ${Number(d.slice(8))}${list.length ? `, ${list.length} itens` : ""}`}
                className={cn(
                  "inline-flex size-6 items-center justify-center self-end rounded-full text-[11px]",
                  d === now ? "bg-brand font-semibold text-brand-ink" : outside ? "text-muted-2" : "text-muted",
                  onDayClick && "hover:bg-surface-3",
                )}
              >
                {Number(d.slice(8))}
              </button>
              {list.slice(0, maxPerDay).map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={it.onClick}
                  title={it.label}
                  className={cn(
                    "truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight",
                    it.danger ? "bg-danger-soft text-danger" : "bg-surface-2 hover:bg-surface-3",
                    it.muted && "text-muted line-through",
                  )}
                  style={it.color && !it.danger ? { boxShadow: `inset 2px 0 0 ${it.color}` } : undefined}
                >
                  {it.label}
                </button>
              ))}
              {list.length > maxPerDay && <span className="px-1.5 text-[10px] text-muted">+{list.length - maxPerDay} mais</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
