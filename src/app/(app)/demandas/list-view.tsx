"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArchiveRestore, Image as ImageIcon } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import { PRIORITIES, isOverdue } from "@/features/demandas/schemas";
import { setTaskArchived } from "@/features/demandas/actions";
import type { DemandasData, TaskView } from "@/features/demandas/types";
import { Avatars } from "./task-card";

export function ListView({
  data,
  tasks,
  archived,
  onOpen,
}: {
  data: DemandasData;
  tasks: TaskView[];
  archived: boolean;
  onOpen: (t: TaskView) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const columns = new Map(data.columns.map((c) => [c.id, c]));

  if (!tasks.length) {
    return (
      <Card>
        <EmptyState icon={Archive} title={archived ? "Nenhuma demanda arquivada" : "Nenhuma demanda encontrada"} />
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Demanda</th>
            <th className="px-3 py-3 font-medium">Cliente</th>
            <th className="px-3 py-3 font-medium">Coluna</th>
            <th className="px-3 py-3 font-medium">Prioridade</th>
            <th className="px-3 py-3 font-medium">Prazo</th>
            <th className="px-3 py-3 font-medium">Responsáveis</th>
            {archived && data.canEdit && <th className="px-3 py-3" />}
          </tr>
        </thead>
        <tbody aria-busy={pending}>
          {tasks.map((t) => {
            const col = columns.get(t.column_id);
            const prio = PRIORITIES.find((p) => p.value === t.priority);
            const overdue = isOverdue(t);
            return (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => onOpen(t)} className="text-left font-medium hover:underline">
                    {t.type === "post" && <ImageIcon className="mr-1 inline size-3.5 text-brand-strong" aria-label="Post" />}
                    {t.title}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">{t.clientName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {col && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ background: col.color }} aria-hidden />
                      {col.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {prio ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", prio.dot)} aria-hidden />
                      {prio.label}
                    </span>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
                <td className={cn("px-3 py-2.5 text-xs tabular-nums", overdue && "font-medium text-danger")}>
                  {t.due_date ? shortDate(t.due_date) : "—"}
                  {overdue && <Badge tone="danger" className="ml-1.5">Atrasada</Badge>}
                </td>
                <td className="px-3 py-2.5">
                  <Avatars ids={t.assignees} people={data.people} />
                </td>
                {archived && data.canEdit && (
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await setTaskArchived(t.id, false);
                          router.refresh();
                        })
                      }
                    >
                      <ArchiveRestore /> Restaurar
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
