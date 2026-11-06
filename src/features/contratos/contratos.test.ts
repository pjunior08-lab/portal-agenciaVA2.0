import { describe, expect, it } from "vitest";
import {
  contractIndicators,
  contractSchema,
  formatDocument,
  isValidCnpj,
  isValidCpf,
  missingVariables,
  renderVariables,
  signSchema,
  variableValues,
} from "./schemas";

describe("contratos", () => {
  const values = variableValues({
    client: { name: "Loja <Teste>", document: "11144477735", address: null, email: "a@b.com", contact_name: "Ana" },
    agency: { name: "Agência", legal_name: "Agência Ltda", cnpj: "11222333000181", address: "Rua 1", email: null },
    proposal: { number: "2026-001", title: "Redes" },
    contract: { service_description: "Gestão de redes", value: 2500, starts_on: "2026-12-01", ends_on: "2027-11-30" },
    today: "2026-11-06",
  });

  it("troca variáveis, escapa HTML e deixa linha em branco no que falta", () => {
    const out = renderVariables("<p>{{contratante.nome}} contrata {{contratada.nome}} por {{valor}}. End.: {{contratante.endereco}}</p>", values);
    expect(out).toContain("Loja &lt;Teste&gt;");
    expect(out).toContain("Agência Ltda");
    expect(out).toMatch(/R\$\s?2\.500,00/);
    expect(out).toContain("__________");
    expect(out).not.toContain("{{");
  });

  it("formata documentos e datas por extenso", () => {
    expect(values["contratante.documento"]).toBe("111.444.777-35");
    expect(values["contratada.cnpj"]).toBe("11.222.333/0001-81");
    expect(values["vigencia.inicio"]).toBe("1 de dezembro de 2026");
    expect(formatDocument("123")).toBe("123");
  });

  it("aponta variáveis sem valor antes do envio", () => {
    expect(missingVariables("{{contratante.endereco}} {{contratante.nome}} {{contratada.email}}", values)).toEqual(["contratante.endereco", "contratada.email"]);
  });

  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("111.444.777-36")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("assinatura exige nome, documento válido e concordância", () => {
    expect(signSchema.safeParse({ name: "Maria Silva", document: "111.444.777-35", email: "", accept: true }).success).toBe(true);
    expect(signSchema.safeParse({ name: "Maria Silva", document: "111.444.777-35", email: "", accept: false }).success).toBe(false);
    expect(signSchema.safeParse({ name: "Maria Silva", document: "123", email: "", accept: true }).success).toBe(false);
  });

  it("vigência: fim não pode vir antes do início", () => {
    const base = {
      title: "C",
      client_id: "00000000-0000-4000-8000-000000000001",
      template_id: "",
      proposal_id: "",
      service_description: "",
      body_html: "",
      header_text: "",
      footer_text: "",
      watermark: "",
      value: "1.500,00",
      renewal_on: "",
    };
    expect(contractSchema.safeParse({ ...base, starts_on: "2026-12-01", ends_on: "2026-11-01" }).success).toBe(false);
    const ok = contractSchema.parse({ ...base, starts_on: "2026-12-01", ends_on: "" });
    expect(ok).toMatchObject({ value: 1500, ends_on: null, template_id: null });
  });

  it("indicadores: valor assinado, quem falta assinar e renovações", () => {
    const list = [
      { status: "assinado" as const, value: 1000, renewal_on: "2026-11-20", ends_on: null, parties: ["contratante", "contratada"] },
      { status: "assinado" as const, value: 500, renewal_on: null, ends_on: "2026-10-01", parties: ["contratante", "contratada"] },
      { status: "aguardando" as const, value: 300, renewal_on: null, ends_on: null, parties: ["contratante"] },
      { status: "aguardando" as const, value: 300, renewal_on: null, ends_on: null, parties: [] },
      { status: "rascunho" as const, value: null, renewal_on: null, ends_on: null, parties: [] },
    ];
    expect(contractIndicators(list, "2026-11-06", "2026-12-06")).toEqual({
      signedValue: 1500,
      signed: 2,
      awaitingClient: 1,
      awaitingYou: 2,
      drafts: 1,
      renewIn30: 1,
      renewalOverdue: 1,
    });
  });
});
