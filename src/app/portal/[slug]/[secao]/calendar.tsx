"use client";

import { useState } from "react";
import { MonthCalendar } from "@/components/ui";
import { dayOf, timeOf, today } from "@/lib/dates";

export interface PortalCalendarItem {
  id: string;
  title: string;
  network: string;
  at: string;
  published: boolean;
}

/** Calendário de publicações do cliente (agendadas e já publicadas). */
export function PortalCalendar({ items }: { items: PortalCalendarItem[] }) {
  const [month, setMonth] = useState(today());
  const [selected, setSelected] = useState<PortalCalendarItem | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        items={items.map((i) => ({
          id: i.id,
          day: dayOf(i.at),
          label: `${timeOf(i.at)} ${i.title}`,
          muted: i.published,
          onClick: () => setSelected(i),
        }))}
      />
      {selected && (
        <p className="rounded-card bg-surface p-4 text-sm" role="status">
          <span className="font-medium">{selected.title}</span>
          <span className="text-muted">
            {" "}
            · {selected.network} · {dayOf(selected.at).split("-").reverse().join("/")} às {timeOf(selected.at)} ·{" "}
            {selected.published ? "Publicado" : "Agendado"}
          </span>
        </p>
      )}
    </div>
  );
}
