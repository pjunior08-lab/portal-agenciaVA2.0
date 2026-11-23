import { describe, expect, it } from "vitest";
import { formatHours, teamTotals, type PerfRow } from "./schemas";

const r = (o: Partial<PerfRow>): PerfRow => ({
  user_id: "u",
  full_name: "A",
  delivered: 0,
  with_due: 0,
  on_time: 0,
  open_overdue: 0,
  posts_decided: 0,
  approved_first: 0,
  avg_approval_hours: null,
  ...o,
});

describe("Desempenho", () => {
  it("soma a equipe e calcula percentuais", () => {
    const t = teamTotals([
      r({ delivered: 10, with_due: 8, on_time: 6, posts_decided: 4, approved_first: 3, avg_approval_hours: 10 }),
      r({ delivered: 5, with_due: 2, on_time: 2, open_overdue: 1, posts_decided: 1, approved_first: 0, avg_approval_hours: 60 }),
    ]);
    expect(t).toEqual({ delivered: 15, onTimePct: 80, firstPct: 60, avgHours: 20, overdue: 1 });
  });

  it("sem base, sem percentual", () => {
    expect(teamTotals([r({})])).toEqual({ delivered: 0, onTimePct: null, firstPct: null, avgHours: null, overdue: 0 });
  });

  it("formata horas e dias", () => {
    expect(formatHours(null)).toBe("—");
    expect(formatHours(5.4)).toBe("5 h");
    expect(formatHours(38.4)).toBe("1,6 dia");
    expect(formatHours(72)).toBe("3 dias");
  });
});
