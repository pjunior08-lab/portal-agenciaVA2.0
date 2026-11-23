import { describe, expect, it } from "vitest";
import { campaignSchema, elapsedPct, monthRange, overlapsMonth, summarize } from "./schemas";

const base = {
  client_id: "6f1b3c2a-1111-4c3b-9a2e-0d7a1b2c3d4e",
  name: "Lançamento",
  platform: "meta",
  objective: "mensagens",
  status: "ativa",
  start_date: "2026-11-10",
  end_date: "2026-11-24",
  planned_budget: "900,00",
  spent: "",
  notes: "",
} as const;

describe("Plano de Mídia", () => {
  it("valida verba em reais e período", () => {
    const ok = campaignSchema.safeParse(base);
    expect(ok.success && ok.data.planned_budget).toBe(900);
    expect(ok.success && ok.data.spent).toBe(0);
    expect(campaignSchema.safeParse({ ...base, end_date: "2026-11-01" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, planned_budget: "-1" }).success).toBe(false);
  });

  it("acha as campanhas que rodam no mês", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(overlapsMonth({ start_date: "2026-10-20", end_date: "2026-11-05" }, "2026-11")).toBe(true);
    expect(overlapsMonth({ start_date: "2026-10-01", end_date: "2026-10-31" }, "2026-11")).toBe(false);
  });

  it("resume verba, investido e saldo", () => {
    expect(
      summarize([
        { planned_budget: 900, spent: 520, status: "ativa" },
        { planned_budget: 600, spent: 610.5, status: "encerrada" },
      ]),
    ).toEqual({ planned: 1500, spent: 1130.5, balance: 369.5, pct: 75, active: 1 });
    expect(summarize([]).pct).toBe(0);
  });

  it("calcula quanto do período já passou", () => {
    const c = { start_date: "2026-11-01", end_date: "2026-11-10" };
    expect(elapsedPct(c, "2026-10-30")).toBe(0);
    expect(elapsedPct(c, "2026-11-05")).toBe(50);
    expect(elapsedPct(c, "2026-11-10")).toBe(100);
  });
});
