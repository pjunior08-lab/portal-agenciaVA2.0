import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activitySchema,
  buildImportRows,
  byLostReason,
  byWeek,
  cutBy,
  fieldKey,
  fillTemplate,
  filterOpps,
  formatHours,
  funnelReport,
  guessMapping,
  monthSummary,
  opportunitySchema,
  reportKpis,
  sellersReport,
  staleLeads,
  toCsv,
  todayBuckets,
  weekStart,
  type ActivityRow,
  type HistoryRow,
  type Opp,
} from "./schemas";

const opp = (p: Partial<Opp>): Opp => ({
  id: Math.random().toString(36).slice(2),
  name: "Maria Silva",
  company: null,
  document: null,
  email: null,
  phone: null,
  segment: null,
  origin: null,
  tags: [],
  owner_id: null,
  stage: "novo_lead",
  position: 0,
  value: null,
  next_step: null,
  next_step_at: null,
  last_contact_at: null,
  attempts: 0,
  lost_reason: null,
  closed_at: null,
  lost_at: null,
  stage_changed_at: "2026-11-01T12:00:00Z",
  created_at: "2026-11-01T12:00:00Z",
  client_id: null,
  ...p,
});
const P = { from: "2026-11-01", to: "2026-11-30" };

describe("comercial: formulários", () => {
  const base = {
    name: "Ana",
    company: "",
    document: "",
    email: "",
    phone: "",
    segment: "",
    origin: "",
    tags: [],
    owner_id: "",
    stage: "novo_lead" as const,
    value: "",
    next_step: "",
    next_step_at: "",
    lost_reason: "",
    notes: "",
    custom: {},
  };

  it("limpa o documento, aceita valor em reais e exige motivo ao perder", () => {
    const ok = opportunitySchema.parse({ ...base, document: "12.345.678/0001-99", value: "1.500,50" });
    expect(ok.document).toBe("12345678000199");
    expect(ok.value).toBe(1500.5);
    expect(ok.company).toBeNull();
    expect(opportunitySchema.safeParse({ ...base, document: "123" }).success).toBe(false);
    const lost = opportunitySchema.safeParse({ ...base, stage: "perdido" });
    expect(lost.success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, stage: "perdido", lost_reason: "Preço" }).success).toBe(
      true,
    );
  });

  it("contato exige canal e resultado; anotação exige texto", () => {
    expect(activitySchema.safeParse({ kind: "contato", channel: "", result: "", note: "" }).success).toBe(
      false,
    );
    expect(
      activitySchema.parse({ kind: "contato", channel: "whatsapp", result: "respondeu", note: "" }),
    ).toEqual({ kind: "contato", channel: "whatsapp", result: "respondeu", note: null });
    expect(activitySchema.safeParse({ kind: "nota", channel: "", result: "", note: "" }).success).toBe(false);
    expect(
      activitySchema.parse({ kind: "nota", channel: "email", result: "respondeu", note: "x" }).channel,
    ).toBeNull();
  });

  it("gera chave de campo e preenche modelo de mensagem", () => {
    expect(fieldKey("Número de Funcionários")).toBe("numero_de_funcionarios");
    expect(
      fillTemplate(
        "Oi {{nome}}, tudo bem na {{ empresa }}? — {{responsavel}}",
        { name: "Maria Silva", company: "Loja X" },
        "Paulo",
      ),
    ).toBe("Oi Maria, tudo bem na Loja X? — Paulo");
  });
});

describe("comercial: filtros e visão Hoje", () => {
  const list = [
    opp({
      id: "a",
      name: "Maria",
      company: "Padaria Sol",
      phone: "(27) 99999-1234",
      owner_id: "u1",
      segment: "Food",
      next_step_at: "2026-11-05",
    }),
    opp({
      id: "b",
      name: "João",
      document: "12345678000199",
      owner_id: "u2",
      next_step_at: "2026-11-09",
      last_contact_at: "2026-11-08T12:00:00Z",
    }),
    opp({ id: "c", name: "Ana", tags: ["quente"], next_step_at: "2026-11-12", origin: "Instagram" }),
    opp({ id: "d", name: "Zé" }),
    opp({ id: "e", name: "Fechado", stage: "fechado", next_step_at: "2026-11-01" }),
  ];
  const ids = (l: Opp[]) => l.map((o) => o.id);

  it("busca por nome, empresa, CNPJ e telefone", () => {
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, q: "padaria" }, "2026-11-09"))).toEqual(["a"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, q: "12.345" }, "2026-11-09"))).toEqual(["b"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, q: "99999" }, "2026-11-09"))).toEqual(["a"]);
  });

  it("filtra responsável, atrasados, sem próximo passo, tag e último contato", () => {
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, owner: "none" }, "2026-11-09"))).toEqual(["c", "d", "e"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, overdue: true }, "2026-11-09"))).toEqual(["a", "e"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, noNextStep: true }, "2026-11-09"))).toEqual(["d"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, tag: "quente" }, "2026-11-09"))).toEqual(["c"]);
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, lastContact: "nunca" }, "2026-11-09"))).toEqual([
      "a",
      "c",
      "d",
      "e",
    ]);
    // há 7+ dias sem contato: quem nunca teve contato entra; quem falou ontem não
    expect(ids(filterOpps(list, { ...EMPTY_FILTERS, lastContact: "7" }, "2026-11-09"))).not.toContain("b");
  });

  it("separa atrasadas, hoje, próximos 7 dias e sem próximo passo (só abertas)", () => {
    const b = todayBuckets(list, "2026-11-09", "2026-11-16");
    expect(ids(b.overdue)).toEqual(["a"]);
    expect(ids(b.today)).toEqual(["b"]);
    expect(ids(b.next7)).toEqual(["c"]);
    expect(ids(b.noNext)).toEqual(["d"]);
  });
});

describe("comercial: resumo e relatórios", () => {
  const opps = [
    opp({
      id: "1",
      stage: "fechado",
      value: 1500,
      closed_at: "2026-11-10T15:00:00Z",
      owner_id: "u1",
      segment: "Food",
      origin: "Indicação",
    }),
    opp({
      id: "2",
      stage: "perdido",
      value: 800,
      lost_at: "2026-11-12T15:00:00Z",
      lost_reason: "Preço",
      segment: "Food",
    }),
    opp({
      id: "3",
      stage: "proposta",
      value: 2000,
      owner_id: "u2",
      stage_changed_at: "2026-11-05T12:00:00Z",
    }),
    opp({ id: "4", stage: "novo_lead", value: null, created_at: "2026-10-20T12:00:00Z", owner_id: "u1" }),
    // fechado em 31/10 às 23h de São Paulo (02h UTC de 01/11): conta em outubro
    opp({ id: "5", stage: "fechado", value: 999, closed_at: "2026-11-01T02:00:00Z" }),
  ];

  it("resumo do mês usa o fuso de São Paulo", () => {
    expect(monthSummary(opps, "2026-11")).toEqual({
      newRevenue: 1500,
      closedCount: 1,
      pipeline: 2000,
      lost: 800,
      openLeads: 2,
    });
    expect(monthSummary(opps, "2026-10").newRevenue).toBe(999);
  });

  const history: HistoryRow[] = [
    {
      opportunity_id: "1",
      from_stage: null,
      to_stage: "novo_lead",
      changed_by: "u1",
      changed_at: "2026-11-01T12:00:00Z",
    },
    {
      opportunity_id: "1",
      from_stage: "novo_lead",
      to_stage: "proposta",
      changed_by: "u1",
      changed_at: "2026-11-03T12:00:00Z",
    },
    {
      opportunity_id: "1",
      from_stage: "proposta",
      to_stage: "fechado",
      changed_by: "u2",
      changed_at: "2026-11-10T15:00:00Z",
    },
    {
      opportunity_id: "2",
      from_stage: null,
      to_stage: "novo_lead",
      changed_by: null,
      changed_at: "2026-11-01T12:00:00Z",
    },
    {
      opportunity_id: "2",
      from_stage: "novo_lead",
      to_stage: "perdido",
      changed_by: null,
      changed_at: "2026-11-12T15:00:00Z",
    },
    {
      opportunity_id: "3",
      from_stage: null,
      to_stage: "novo_lead",
      changed_by: null,
      changed_at: "2026-11-01T12:00:00Z",
    },
    {
      opportunity_id: "3",
      from_stage: "novo_lead",
      to_stage: "proposta",
      changed_by: null,
      changed_at: "2026-11-05T12:00:00Z",
    },
  ];
  const acts: ActivityRow[] = [
    {
      opportunity_id: "1",
      kind: "contato",
      result: "sem_resposta",
      author_id: "u1",
      happened_at: "2026-11-02T12:00:00Z",
    },
    {
      opportunity_id: "1",
      kind: "contato",
      result: "reuniao_marcada",
      author_id: "u1",
      happened_at: "2026-11-03T12:00:00Z",
    },
    {
      opportunity_id: "3",
      kind: "contato",
      result: "respondeu",
      author_id: "u2",
      happened_at: "2026-11-05T12:00:00Z",
    },
    { opportunity_id: "3", kind: "nota", result: null, author_id: "u2", happened_at: "2026-11-05T12:00:00Z" },
  ];

  it("indicadores do período", () => {
    expect(reportKpis(opps, acts, P)).toEqual({
      created: 4,
      contacts: 3,
      answers: 2,
      meetings: 1,
      closed: 1,
      closedValue: 1500,
      lost: 1,
      lostValue: 800,
    });
  });

  it("funil: entradas, avanços, fechamentos, perdas e tempo na etapa", () => {
    const f = funnelReport(opps, history, P, "2026-11-09T12:00:00Z");
    const novo = f.find((r) => r.stage === "novo_lead")!;
    expect(novo).toMatchObject({ entered: 3, advanced: 2, closed: 1, lost: 1, now: 1 });
    expect(novo.conversion).toBeCloseTo(2 / 3);
    // 1→proposta em 48h, 2→perdido em 267h, 3→proposta em 96h
    expect(novo.avgHours).toBeCloseTo((48 + 267 + 96) / 3);
    expect(novo.medianHours).toBe(96);
    const prop = f.find((r) => r.stage === "proposta")!;
    expect(prop).toMatchObject({ entered: 2, closed: 1, now: 1 });
    expect(prop.openHours).toBe(96);
    expect(f.find((r) => r.stage === "fechado")!.conversion).toBeNull();
  });

  it("vendedores: contatos pelo autor e fechamento por quem moveu", () => {
    const s = sellersReport(opps, acts, history, P);
    expect(s.find((r) => r.id === "u1")).toMatchObject({
      contacts: 2,
      answers: 1,
      meetings: 1,
      closed: 0,
      open: 1,
    });
    expect(s.find((r) => r.id === "u2")).toMatchObject({
      contacts: 1,
      answers: 1,
      closed: 1,
      closedValue: 1500,
      open: 1,
    });
  });

  it("cortes, semanas, motivos de perda e leads parados", () => {
    const seg = cutBy(opps, P, "segment");
    expect(seg.find((r) => r.name === "Food")).toMatchObject({
      leads: 2,
      closed: 1,
      lost: 1,
      closeRate: 0.5,
    });
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(byWeek(opps, P).find((w) => w.week === "2026-11-09")).toMatchObject({ closed: 1, lost: 1 });
    expect(byLostReason(opps, P)).toEqual([{ reason: "Preço", count: 1, value: 800 }]);
    expect(staleLeads(opps, 14, "2026-11-09").map((x) => x.o.id)).toEqual(["4"]);
  });

  it("formata horas e gera CSV com ponto e vírgula", () => {
    expect(formatHours(5)).toBe("5 h");
    expect(formatHours(36)).toBe("1,5 d");
    expect(formatHours(null)).toBe("—");
    expect(
      toCsv([
        ["Nome", "Obs"],
        ["Ana", 'disse "sim"; ok'],
      ]),
    ).toBe('﻿Nome;Obs\r\nAna;"disse ""sim""; ok"');
  });
});

describe("comercial: importação", () => {
  it("sugere colunas e valida cada linha", () => {
    const map = guessMapping(
      ["Nome", "Razão Social", "CNPJ", "E-mail", "WhatsApp", "Valor mensal", "Tags", "Porte"],
      [{ key: "porte", label: "Porte" }],
    );
    expect(map).toMatchObject({
      name: 0,
      company: 1,
      document: 2,
      email: 3,
      phone: 4,
      value: 5,
      tags: 6,
      "custom:porte": 7,
    });
    const rows = buildImportRows(
      [
        ["Ana", "Loja", "12.345.678/0001-99", "ana@x.com", "27 9999", "1.200,00", "quente, novo", "Pequeno"],
        ["", "Sem nome", "", "", "", "", "", ""],
        ["Beto", "", "123", "nao-email", "", "abc", "", ""],
      ],
      map,
    );
    expect(rows[0].data).toMatchObject({
      name: "Ana",
      document: "12345678000199",
      value: 1200,
      tags: ["quente", "novo"],
      custom: { porte: "Pequeno" },
    });
    expect(rows[1]).toMatchObject({ line: 3, data: null, errors: ["Sem nome do contato."] });
    expect(rows[2].errors).toEqual(["CNPJ/CPF inválido.", "E-mail inválido.", "Valor inválido."]);
  });
});
