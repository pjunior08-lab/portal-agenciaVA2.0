"use client";

import { useState } from "react";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { today } from "@/lib/dates";
import { isOverdue } from "@/features/demandas/schemas";
import type { ColumnRow } from "@/lib/supabase/database.types";
import type { TaskView } from "@/features/demandas/types";

/** Demandas no calendário pelo prazo; as sem prazo aparecem listadas abaixo. */
export function CalendarView({ tasks, columns, onOpen }: { tasks: TaskView[]; columns: ColumnRow[]; onOpen: (t: TaskView) => void }) {
  const [month, setMonth] = useState(today());
  const colColor = new Map(columns.map((c) => [c.id, c.color]));
  const withDate = tasks.filter((t) => t.due_date);
  const without = tasks.filter((t) => !t.due_date);

  return (
    <div className="flex flex-col gap-3">
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        items={withDate.map((t) => ({
          id: t.id,
          day: t.due_date!,
          label: t.clientName ? `${t.clientName} · ${t.title}` : t.title,
          color: colColor.get(t.column_id),
          muted: !!t.completed_at,
          danger: isOverdue(t),
          onClick: () => onOpen(t),
        }))}
      />
      {without.length > 0 && (
        <p className="text-xs text-muted">
          {without.length} demanda(s) sem prazo não aparecem no calendário. Veja na visão Lista.
        </p>
      )}
    </div>
  );
}
