import { describe, expect, it } from "vitest";
import { greeting, pendingSteps, portfolioHealth, upcomingDeadlines } from "./schemas";

describe("início", () => {
  it("classifica a saúde dos clientes", () => {
    const clients = [
      { id: "a", name: "Ana" },
      { id: "b", name: "Beto" },
      { id: "c", name: "Caio" },
      { id: "d", name: "Duda" },
    ];
    const rows = portfolioHealth(
      clients,
      [
        { client_id: "b", due_date: "2026-11-01" },
        { client_id: "d", due_date: "2026-11-01" },
        { client_id: "d", due_date: "2026-11-02" },
        { client_id: "d", due_date: "2026-11-03" },
        { client_id: "a", due_date: "2026-11-20" },
      ],
      [
        { client_id: "c", status: "enviado", sent_at: "2026-11-01T12:00:00Z" },
        { client_id: "a", status: "enviado", sent_at: "2026-11-08T12:00:00Z" },
      ],
      [{ client_id: "a", due_date: "2026-11-05", amount: 1500 }],
      "2026-11-09",
    );
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.a).toMatchObject({ status: "critico", overdueAmount: 1500, waiting: 0, lateTasks: 0 });
    expect(by.b).toMatchObject({ status: "atencao", lateTasks: 1 });
    expect(by.c).toMatchObject({ status: "atencao", waiting: 1 });
    expect(by.d).toMatchObject({ status: "critico", lateTasks: 3 });
    expect(rows[rows.length - 1].status).toBe("atencao");
  });

  it("lista prazos próximos e atrasados em ordem", () => {
    const d = upcomingDeadlines(
      [
        { kind: "demanda", title: "B", date: "2026-11-12", href: "" },
        { kind: "contrato", title: "A", date: "2026-11-08", href: "" },
        { kind: "proposta", title: "C", date: "2026-11-30", href: "" },
      ],
      "2026-11-09",
      7,
    );
    expect(d.map((x) => [x.title, x.late, x.inDays])).toEqual([
      ["A", true, -1],
      ["B", false, 3],
    ]);
  });

  it("primeiros passos conforme o papel", () => {
    const s = { agencyData: true, team: false, client: true, task: false, portal: false };
    expect(pendingSteps(s, true)).toMatchObject({ done: 2, total: 5, complete: false });
    expect(pendingSteps(s, false)).toMatchObject({ done: 1, total: 3 });
    expect(
      pendingSteps({ agencyData: true, team: true, client: true, task: true, portal: true }, true).complete,
    ).toBe(true);
  });

  it("saudação no horário de Brasília", () => {
    expect(greeting("2026-11-09T11:00:00Z")).toBe("Bom dia");
    expect(greeting("2026-11-09T18:00:00Z")).toBe("Boa tarde");
    expect(greeting("2026-11-10T00:30:00Z")).toBe("Boa noite");
  });
});
