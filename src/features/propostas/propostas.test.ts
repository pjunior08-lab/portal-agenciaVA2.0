import { describe, expect, it } from "vitest";
import { decisionSchema, firstCycleValue, investment, isExpired, proposalIndicators, proposalSchema } from "./schemas";

const base = {
  title: "Gestão de redes",
  number: "",
  template_id: "",
  cover: "#FEB800" as const,
  status: "rascunho" as const,
  valid_until: "",
  client_id: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  items: [{ service: "Social media", quantity: "1", unit_price: "2.500,00", cadence: "mensal" as const, scope_html: "" }],
  payment: { installments: "3", down_payment: "", methods: ["Pix" as const], details: "" },
  notes: "",
};

describe("propostas", () => {
  it("converte valores em reais e campos vazios em nulo", () => {
    const r = proposalSchema.parse(base);
    expect(r.items[0]).toMatchObject({ quantity: 1, unit_price: 2500 });
    expect(r.payment).toMatchObject({ installments: 3, down_payment: null });
    expect(r).toMatchObject({ client_id: null, valid_until: null, template_id: null });
  });

  it("exige ao menos um item e valores válidos", () => {
    expect(proposalSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: "0" }] }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, items: [{ ...base.items[0], unit_price: "abc" }] }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, contact_email: "nao-e-email" }).success).toBe(false);
  });

  it("calcula o investimento por cadência", () => {
    const items = [
      { quantity: 1, unit_price: 2500, cadence: "mensal" as const },
      { quantity: 2, unit_price: 300, cadence: "mensal" as const },
      { quantity: 1, unit_price: 3000, cadence: "unica" as const },
    ];
    expect(investment(items)).toEqual([
      { cadence: "unica", total: 3000 },
      { cadence: "mensal", total: 3100 },
    ]);
    expect(firstCycleValue(items)).toBe(6100);
  });

  it("vencida: em aberto e com validade passada", () => {
    expect(isExpired({ status: "enviada", valid_until: "2026-11-05" }, "2026-11-06")).toBe(true);
    expect(isExpired({ status: "enviada", valid_until: "2026-11-06" }, "2026-11-06")).toBe(false);
    expect(isExpired({ status: "aceita", valid_until: "2026-01-01" }, "2026-11-06")).toBe(false);
  });

  it("indicadores do painel", () => {
    const list = [
      { status: "enviada" as const, valid_until: "2026-11-10", value: 1000 },
      { status: "em_negociacao" as const, valid_until: null, value: 2000 },
      { status: "enviada" as const, valid_until: "2026-11-01", value: 500 },
      { status: "aceita" as const, valid_until: null, value: 3000 },
      { status: "recusada" as const, valid_until: null, value: 100 },
      { status: "rascunho" as const, valid_until: null, value: 50 },
    ];
    expect(proposalIndicators(list, "2026-11-06", "2026-11-13")).toEqual({
      openValue: 3000,
      accepted: 1,
      negotiating: 1,
      sent: 2,
      dueIn7: 1,
      refused: 1,
      expired: 1,
    });
  });

  it("aceite pelo link exige nome completo", () => {
    expect(decisionSchema.safeParse({ token: "x".repeat(48), decision: "aceita", name: "Al", comment: "" }).success).toBe(false);
    expect(decisionSchema.safeParse({ token: "x".repeat(48), decision: "aceita", name: "Ana Souza", comment: "" }).success).toBe(true);
  });
});
