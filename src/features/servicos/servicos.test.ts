import { describe, expect, it } from "vitest";
import { filterServices, serviceSchema, serviceToProposalItem } from "./schemas";

describe("Tabela de Serviços", () => {
  it("aceita preço em reais com vírgula e recusa negativo", () => {
    const ok = serviceSchema.safeParse({ name: "Gestão de redes", description: "", cadence: "mensal", unit_price: "1.800,00", scope_html: "", active: true });
    expect(ok.success && ok.data.unit_price).toBe(1800);
    const bad = serviceSchema.safeParse({ name: "X", description: "", cadence: "mensal", unit_price: "-5", scope_html: "", active: true });
    expect(bad.success).toBe(false);
  });

  it("exige nome", () => {
    expect(serviceSchema.safeParse({ name: "  ", description: "", cadence: "unica", unit_price: "10", scope_html: "", active: true }).success).toBe(false);
  });

  it("busca sem acento e esconde inativos", () => {
    const list = [
      { name: "Produção de conteúdo", description: "", active: true },
      { name: "Tráfego pago", description: "Meta e Google", active: true },
      { name: "Cardápio digital", description: "", active: false },
    ];
    expect(filterServices(list, "producao", false).map((s) => s.name)).toEqual(["Produção de conteúdo"]);
    expect(filterServices(list, "google", false)).toHaveLength(1);
    expect(filterServices(list, "", false)).toHaveLength(2);
    expect(filterServices(list, "", true)).toHaveLength(3);
  });

  it("vira item de proposta com preço formatado", () => {
    expect(serviceToProposalItem({ name: "Tráfego", cadence: "mensal", unit_price: 1200.5, scope_html: "<p>x</p>" })).toEqual({
      service: "Tráfego",
      quantity: "1",
      unit_price: "1200,50",
      cadence: "mensal",
      scope_html: "<p>x</p>",
    });
  });
});
