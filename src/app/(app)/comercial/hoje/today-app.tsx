"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarCheck, CalendarDays, CircleDashed } from "lucide-react";
import { Card, EmptyState, Select } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { addDays, weekdayDate } from "@/lib/dates";
import { todayBuckets } from "@/features/comercial/schemas";
import type { OppView } from "@/features/comercial/data";
import { useCrm } from "../crm-shell";
import { StageDot } from "../opportunity-modal";

type Bucket = "overdue" | "today" | "next7" | "noNext";
const BUCKETS: { id: Bucket; label: string; icon: typeof AlertCircle; empty: string }[] = [
  { id: "overdue", label: "Atrasadas", icon: AlertCircle, empty: "Nenhum próximo passo atrasado." },
  { id: "today", label: "Hoje", icon: CalendarCheck, empty: "Nada marcado para hoje." },
  { id: "next7", label: "Próximos 7 dias", icon: CalendarDays, empty: "Nada nos próximos 7 dias." },
  {
    id: "noNext",
    label: "Sem próximo passo",
    icon: CircleDashed,
    empty: "Todas as oportunidades abertas têm próximo passo.",
  },
];

export function TodayApp() {
  const { base, today, userId, personName, openOpp } = useCrm();
  const [owner, setOwner] = useState(base.people.some((p) => p.id === userId) ? userId : "");
  const [bucket, setBucket] = useState<Bucket>("overdue");
  const list = useMemo(
    () => base.opps.filter((o) => !owner || (owner === "none" ? !o.owner_id : o.owner_id === owner)),
    [base.opps, owner],
  );
  const buckets = useMemo(() => todayBuckets(list, today, addDays(today, 7)), [list, today]);
  const rows: OppView[] = buckets[bucket];
  const current = BUCKETS.find((b) => b.id === bucket)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Responsável"
          className="h-9 w-auto"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          <option value="none">Sem responsável</option>
          {base.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === userId ? `${p.name} (eu)` : p.name}
            </option>
          ))}
        </Select>
      </div>

      <div role="tablist" aria-label="Agenda comercial" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={bucket === b.id}
            onClick={() => setBucket(b.id)}
            className={cn(
              "flex flex-col gap-1 rounded-2xl bg-surface p-4 text-left ring-brand transition-shadow",
              bucket === b.id && "ring-2",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                b.id === "overdue" && buckets.overdue.length ? "text-danger" : "text-muted",
              )}
            >
              <b.icon className="size-3.5" aria-hidden /> {b.label}
            </span>
            <span className="text-2xl font-semibold tabular-nums">{buckets[b.id].length}</span>
          </button>
        ))}
      </div>

      <Card className="p-0" role="tabpanel" aria-label={current.label}>
        {rows.length === 0 ? (
          <EmptyState icon={current.icon} title={current.empty} />
        ) : (
          <ul>
            {rows.map((o) => (
              <li key={o.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => openOpp(o)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <span className="min-w-40 flex-1">
                    <span className="block text-sm font-medium">{o.company || o.name}</span>
                    <span className="block text-xs text-muted">
                      {o.next_step || "Sem próximo passo definido"}
                      {o.phone && ` · ${o.phone}`}
                    </span>
                  </span>
                  <StageDot stage={o.stage} />
                  <span className="w-28 text-xs tabular-nums">
                    {o.value == null ? "—" : `${formatBRL(o.value)}/mês`}
                  </span>
                  <span className="w-32 truncate text-xs text-muted">{personName(o.owner_id)}</span>
                  <span
                    className={cn(
                      "w-28 text-xs",
                      bucket === "overdue" ? "font-medium text-danger" : "text-muted",
                    )}
                  >
                    {o.next_step_at ? weekdayDate(o.next_step_at) : `${o.attempts} tentativa(s)`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
