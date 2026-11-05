import { describe, expect, it } from "vitest";
import { clientSchema, parseMoney, portalSchema, safeFileName, slugify, type ClientFormValues } from "./schemas";

const base: ClientFormValues = {
  name: "Loja Aurora",
  status: "ativo",
  segment_icon: "",
  cover_color: "#feb800",
  client_since: "",
  notes: "",
  auto_reminders: true,
  contact_name: "",
  email: "",
  phone: "",
  document: "",
  address: "",
  monthly_fee: "",
  billing_day: "",
};

describe("parseMoney", () => {
  it("entende o formato brasileiro", () => {
    expect(parseMoney("1.500,50")).toBe(1500.5);
    expect(parseMoney("R$ 2.000")).toBe(2000);
    expect(parseMoney("900")).toBe(900);
    expect(parseMoney("")).toBe(null);
    expect(Number.isNaN(parseMoney("abc"))).toBe(true);
  });
});

describe("clientSchema", () => {
  it("aceita o mínimo (só o nome) e transforma vazios em nulo", () => {
    const r = clientSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.monthly_fee).toBe(null);
      expect(r.data.email).toBe(null);
      expect(r.data.billing_day).toBe(null);
    }
  });
  it("converte mensalidade e dia de cobrança", () => {
    const r = clientSchema.safeParse({ ...base, monthly_fee: "1.200,00", billing_day: "10" });
    expect(r.success && r.data.monthly_fee).toBe(1200);
    expect(r.success && r.data.billing_day).toBe(10);
  });
  it("recusa dados inválidos", () => {
    expect(clientSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, billing_day: "32" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, monthly_fee: "-5" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, document: "123" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, cover_color: "amarelo" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, email: "nao-e-email" }).success).toBe(false);
  });
  it("aceita CPF e CNPJ formatados", () => {
    expect(clientSchema.safeParse({ ...base, document: "123.456.789-09" }).success).toBe(true);
    expect(clientSchema.safeParse({ ...base, document: "12.345.678/0001-90" }).success).toBe(true);
  });
});

describe("portal", () => {
  it("slugify gera endereço válido", () => {
    expect(slugify("Cuscuz da Bonitã!")).toBe("cuscuz-da-bonita");
    const ok = portalSchema.safeParse({
      clientId: "00000000-0000-4000-8000-000000000001",
      slug: slugify("Rick's Spettaria"),
      enabled: true,
      sections: ["arquivos"],
    });
    expect(ok.success).toBe(true);
  });
  it("recusa endereço e seção inválidos", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(portalSchema.safeParse({ clientId: id, slug: "ab", enabled: true, sections: [] }).success).toBe(false);
    expect(portalSchema.safeParse({ clientId: id, slug: "-loja", enabled: true, sections: [] }).success).toBe(false);
    expect(portalSchema.safeParse({ clientId: id, slug: "loja", enabled: true, sections: ["financeiro"] }).success).toBe(false);
  });
});

describe("safeFileName", () => {
  it("remove acentos, espaços e barras", () => {
    expect(safeFileName("Briefing março/2026 (final).pdf")).toBe("Briefing-marco-2026-final-.pdf");
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
  });
});
