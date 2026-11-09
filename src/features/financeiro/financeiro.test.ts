import { describe, expect, it } from "vitest";
import {
  addMonthsKeepDay,
  balanceEvolution,
  byCategory,
  byPerson,
  changesVsLastMonth,
  expandOccurrences,
  goals,
  matchesTab,
  monthName,
  monthSummary,
  shiftMonth,
  transactionSchema,
  upcoming,
  type Tx,
} from "./schemas";

const tx = (p: Partial<Tx>): Tx => ({
  id: Math.random().toString(36),
  kind: "despesa",
  subtype: "fixa",
  amount: 100,
  description: "x",
  due_date: "2026-11-10",
  paid: false,
  paid_at: null,
  category_id: null,
  account_id: null,
  to_account_id: null,
  client_id: null,
  person: null,
  ...p,
});

describe("financeiro: datas e repetição", () => {
  it("soma meses mantendo o dia e ajustando ao fim do mês", () => {
    expect(addMonthsKeepDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKeepDay("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsKeepDay("2026-11-15", 2)).toBe("2027-01-15");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthName("2026-11")).toBe("Novembro 2026");
  });

  it("parcelado divide o total e deixa os centavos na primeira parcela", () => {
    const list = expandOccurrences({ amount: 100, description: "Notebook", due_date: "2026-11-30", repeat: "parcelado", installments: 3 });
    expect(list.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(list.map((x) => x.due_date)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30"]);
    expect(list[2].description).toBe("Notebook (3/3)");
  });

  it("mensal cria 12, semanal 26 e anual 3 lançamentos", () => {
    const base = { amount: 50, description: "Ferramenta", due_date: "2026-11-05", installments: 0 };
    expect(expandOccurrences({ ...base, repeat: "mensal" })).toHaveLength(12);
    expect(expandOccurrences({ ...base, repeat: "semanal" })[1].due_date).toBe("2026-11-12");
    expect(expandOccurrences({ ...base, repeat: "anual" })[2].due_date).toBe("2028-11-05");
    expect(expandOccurrences({ ...base, repeat: "nao" })).toHaveLength(1);
  });
});

describe("financeiro: formulário", () => {
  const base = {
    kind: "despesa" as const,
    subtype: "fixa" as const,
    amount: "1.250,90",
    description: "Aluguel",
    account_id: "",
    to_account_id: "",
    category_id: "",
    due_date: "2026-11-10",
    paid: false,
    repeat: "nao" as const,
    installments: 2,
    client_id: "",
    person: "",
    notes: "",
  };
  it("converte o valor e limpa campos vazios", () => {
    expect(transactionSchema.parse(base)).toMatchObject({ amount: 1250.9, account_id: null, person: null });
  });
  it("despesa exige tipo; transferência exige contas diferentes", () => {
    expect(transactionSchema.safeParse({ ...base, subtype: "" }).success).toBe(false);
    const a = "00000000-0000-4000-8000-000000000001";
    expect(transactionSchema.safeParse({ ...base, kind: "transferencia", subtype: "", account_id: a, to_account_id: a }).success).toBe(false);
    const ok = transactionSchema.parse({ ...base, kind: "transferencia", subtype: "", account_id: a, to_account_id: "00000000-0000-4000-8000-000000000002" });
    expect(ok).toMatchObject({ subtype: null, paid: true, category_id: null });
  });
  it("valor zero ou parcelas fora do limite são recusados", () => {
    expect(transactionSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, repeat: "parcelado", installments: 1 }).success).toBe(false);
  });
});

describe("financeiro: visão geral", () => {
  const list: Tx[] = [
    tx({ kind: "receita", subtype: null, amount: 3000, paid: true, paid_at: "2026-11-05", client_id: "c1" }),
    tx({ kind: "receita", subtype: null, amount: 1000, due_date: "2026-11-25" }),
    tx({ amount: 500, paid: true, paid_at: "2026-11-03", category_id: "k1" }),
    tx({ amount: 200, due_date: "2026-11-20", category_id: "k1" }),
    tx({ subtype: "pessoa", amount: 800, person: "Ana", category_id: "k2" }),
    tx({ amount: 300, due_date: "2026-10-10", category_id: "k1" }),
    tx({ kind: "transferencia", subtype: null, amount: 999, paid: true, paid_at: "2026-11-02" }),
  ];
  const names = new Map([
    ["k1", "Ferramentas"],
    ["k2", "Freelancers"],
  ]);

  it("resumo do mês ignora transferências", () => {
    expect(monthSummary(list, "2026-11")).toMatchObject({
      receitas: 4000,
      despesas: 1500,
      resultado: 2500,
      recebido: 3000,
      aReceber: 1000,
      pago: 500,
      aPagar: 1000,
    });
  });

  it("abas filtram pelo tipo", () => {
    expect(list.filter((t) => matchesTab(t, "pessoa"))).toHaveLength(1);
    expect(list.filter((t) => matchesTab(t, "receita"))).toHaveLength(2);
    expect(list.filter((t) => matchesTab(t, "transferencia"))).toHaveLength(1);
  });

  it("categorias, pessoas, metas e diferença para o mês passado", () => {
    expect(byCategory(list, "2026-11", "despesa", names)[0]).toMatchObject({ name: "Freelancers", total: 800 });
    expect(byPerson(list, "2026-11")).toEqual([{ name: "Ana", total: 800 }]);
    expect(goals(list, "2026-11", [{ id: "k1", name: "Ferramentas", kind: "despesa", monthly_goal: 500 }])[0]).toMatchObject({ spent: 700, pct: 140 });
    expect(changesVsLastMonth(list, "2026-11", names).find((c) => c.id === "k1")).toMatchObject({ now: 700, before: 300, delta: 400 });
  });

  it("contas atrasadas e a vencer", () => {
    const u = upcoming(list, "2026-11-15");
    expect(u.overdue.map((t) => t.amount)).toEqual([300, 800]);
    expect(u.next.map((t) => t.amount)).toEqual([200, 1000]);
  });

  it("evolução do saldo: passado desfaz o pago depois; futuro soma o previsto", () => {
    const e = balanceEvolution(list, "2026-11", 10000, "2026-11-15");
    expect(e.find((d) => d.day === "2026-11-04")!.balance).toBe(10000 - 3000);
    expect(e.find((d) => d.day === "2026-11-01")!.balance).toBe(10000 - 3000 + 500);
    expect(e.find((d) => d.day === "2026-11-30")!.balance).toBe(10000 - 200 + 1000);
  });
});
