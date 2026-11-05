"use client";

import { CalendarClock, Image as ImageIcon, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import { PRIORITIES, isOverdue } from "@/features/demandas/schemas";
import type { CardImageT } from "@/lib/supabase/database.types";
import type { Person, TaskView } from "@/features/demandas/types";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function Avatars({ ids, people, max = 3 }: { ids: string[]; people: Person[]; max?: number }) {
  if (!ids.length) return null;
  const names = ids.map((id) => people.find((p) => p.id === id)?.name ?? "?");
  return (
    <span className="flex -space-x-1.5" title={names.join(", ")} aria-label={`Responsáveis: ${names.join(", ")}`}>
      {names.slice(0, max).map((n, i) => (
        <span key={i} className="inline-flex size-6 items-center justify-center rounded-full bg-panel text-[9px] font-semibold text-panel-ink ring-2 ring-surface">
          {initials(n)}
        </span>
      ))}
      {names.length > max && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-3 text-[9px] ring-2 ring-surface">
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

export function TaskCardBody({
  task,
  people,
  cardImage,
  labelName,
  labelColor,
}: {
  task: TaskView;
  people: Person[];
  cardImage: CardImageT;
  labelName?: string | null;
  labelColor?: string | null;
}) {
  const overdue = isOverdue(task);
  const prio = PRIORITIES.find((p) => p.value === task.priority);
  return (
    <>
      {cardImage === "capa" && task.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage
        <img src={task.coverUrl} alt="" className="-mx-3 -mt-3 mb-2 h-28 w-[calc(100%+1.5rem)] rounded-t-xl object-cover" />
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {(task.clientName || labelName) && (
            <div className="mb-1 flex flex-wrap items-center gap-1">
              {task.clientName && (
                <span className="inline-flex items-center gap-1 truncate text-[10px] font-medium text-muted">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: task.clientColor ?? "var(--muted-2)" }} aria-hidden />
                  {task.clientName}
                </span>
              )}
              {labelName && (
                <span className="rounded-full px-1.5 py-px text-[10px] font-medium text-white" style={{ background: labelColor ?? "var(--muted)" }}>
                  {labelName}
                </span>
              )}
            </div>
          )}
          <p className={cn("text-[13px] leading-snug", task.completed_at && "text-muted line-through")}>
            {task.type === "post" && <ImageIcon className="mr-1 inline size-3.5 -translate-y-px text-brand-strong" aria-label="Post" />}
            {task.title}
          </p>
        </div>
        {cardImage === "miniatura" && task.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={task.coverUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        {prio && <span className={cn("size-2 rounded-full", prio.dot)} title={`Prioridade ${prio.label}`} aria-label={`Prioridade ${prio.label}`} />}
        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger")}>
            <CalendarClock className="size-3" aria-hidden />
            {shortDate(task.due_date)}
            {overdue && <span className="sr-only">(atrasada)</span>}
          </span>
        )}
        {task.attachments.length > 0 && (
          <span className="inline-flex items-center gap-0.5" aria-label={`${task.attachments.length} anexos`}>
            <Paperclip className="size-3" aria-hidden />
            {task.attachments.length}
          </span>
        )}
        <span className="ml-auto">
          <Avatars ids={task.assignees} people={people} />
        </span>
      </div>
    </>
  );
}
