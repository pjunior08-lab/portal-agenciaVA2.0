export interface PerfRow {
  user_id: string;
  full_name: string | null;
  delivered: number;
  with_due: number;
  on_time: number;
  open_overdue: number;
  posts_decided: number;
  approved_first: number;
  avg_approval_hours: number | null;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** Totais da equipe: soma das pessoas (uma demanda com 2 responsáveis conta para os dois). */
export function teamTotals(rows: PerfRow[]) {
  const s = (k: keyof PerfRow) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const withHours = rows.filter((r) => r.avg_approval_hours != null && r.posts_decided > 0);
  const hours = withHours.length
    ? Math.round((withHours.reduce((t, r) => t + Number(r.avg_approval_hours) * r.posts_decided, 0) / withHours.reduce((t, r) => t + r.posts_decided, 0)) * 10) / 10
    : null;
  return {
    delivered: s("delivered"),
    onTimePct: pct(s("on_time"), s("with_due")),
    firstPct: pct(s("approved_first"), s("posts_decided")),
    avgHours: hours,
    overdue: s("open_overdue"),
  };
}

export const rowPct = { onTime: (r: PerfRow) => pct(r.on_time, r.with_due), first: (r: PerfRow) => pct(r.approved_first, r.posts_decided) };

/** "1,6 dia" ou "5 h". */
export function formatHours(h: number | null) {
  if (h == null) return "—";
  if (h >= 24) return `${(Math.round((h / 24) * 10) / 10).toLocaleString("pt-BR")} dia${h >= 48 ? "s" : ""}`;
  return `${Math.round(h).toLocaleString("pt-BR")} h`;
}
