import { describe, expect, it } from "vitest";
import {
  describeRule,
  formSchema,
  isPublicHttpsUrl,
  parseActions,
  publicSubmissionSchema,
  ruleSchema,
  webhookSchema,
} from "./automations";

const baseRule = {
  name: "Instagram",
  active: true,
  trigger: "lead_criado" as const,
  stage: "",
  origin: "Instagram",
  source: "" as const,
  days: "7",
  actions: [{ type: "adicionar_tag", tag: "insta" }],
};

describe("automações: regras", () => {
  it("monta as condições só com o que foi escolhido", () => {
    const r = ruleSchema.parse(baseRule);
    expect(r.conditions).toEqual({ origin: "Instagram" });
    const idle = ruleSchema.parse({ ...baseRule, trigger: "sem_contato", origin: "", days: "3" });
    expect(idle.conditions).toEqual({ days: 3 });
  });

  it("exige etapa no gatilho de etapa e não deixa mover para a mesma etapa", () => {
    expect(ruleSchema.safeParse({ ...baseRule, trigger: "etapa_alterada" }).success).toBe(false);
    const same = ruleSchema.safeParse({
      ...baseRule,
      trigger: "etapa_alterada",
      stage: "proposta",
      actions: [{ type: "mover_etapa", stage: "proposta" }],
    });
    expect(same.success).toBe(false);
    expect(
      ruleSchema.safeParse({ ...baseRule, actions: [{ type: "mover_etapa", stage: "perdido" }] }).success,
    ).toBe(false);
    expect(ruleSchema.safeParse({ ...baseRule, actions: [] }).success).toBe(false);
  });

  it("descreve a regra em uma frase e ignora ações desconhecidas", () => {
    const actions = parseActions([
      { type: "adicionar_tag", tag: "insta" },
      { type: "proximo_passo", text: "Ligar", days: 2 },
      { type: "apagar_tudo" },
    ]);
    expect(actions).toHaveLength(2);
    expect(describeRule("lead_criado", { origin: "Instagram" }, actions, () => "")).toBe(
      'Quando um lead for criado com origem "Instagram", adicionar a tag "insta", próximo passo "Ligar" em 2 dia(s).',
    );
    expect(describeRule("sem_contato", { days: 5 }, [{ type: "distribuir" }], () => "")).toBe(
      "Quando ficar 5 dia(s) sem contato, distribuir no rodízio.",
    );
  });
});

describe("automações: webhooks", () => {
  it("aceita só https público", () => {
    expect(isPublicHttpsUrl("https://hook.us1.make.com/abc")).toBe(true);
    for (const bad of [
      "http://hook.make.com",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.0.0.5/x",
      "https://192.168.1.1",
      "https://169.254.169.254/latest",
      "https://[::1]/",
      "https://intranet/x",
      "https://user:pw@site.com",
      "nada",
    ])
      expect(isPublicHttpsUrl(bad)).toBe(false);
    expect(
      webhookSchema.safeParse({ name: "x", url: "https://site.com/h", events: [], active: true }).success,
    ).toBe(false);
  });
});

describe("automações: formulários", () => {
  it("converte tags e textos vazios", () => {
    const f = formSchema.parse({
      name: "Site",
      title: "Fale",
      description: "",
      fields: [{ key: "phone", required: true }],
      stage: "novo_lead",
      owner_id: "",
      distribute: false,
      origin: "",
      tags: "site, quente, site",
      success_message: "",
      active: true,
    });
    expect(f).toMatchObject({
      description: null,
      owner_id: null,
      origin: null,
      tags: ["site", "quente"],
      success_message: null,
    });
  });

  it("valida o envio do visitante conforme os campos", () => {
    const s = publicSubmissionSchema([
      { key: "phone", required: true },
      { key: "email", required: false },
      { key: "document", required: false },
    ]);
    expect(s.safeParse({ nome: "Ana", telefone: "27 9999" }).success).toBe(true);
    expect(s.safeParse({ nome: "Ana", telefone: "" }).success).toBe(false);
    expect(s.safeParse({ nome: "", telefone: "1" }).success).toBe(false);
    expect(s.safeParse({ nome: "Ana", telefone: "1", email: "x" }).success).toBe(false);
    expect(s.safeParse({ nome: "Ana", telefone: "1", documento: "123" }).success).toBe(false);
    // campos que o formulário não pede são descartados
    expect(s.parse({ nome: "Ana", telefone: "1", etapa: "fechado" })).toEqual({
      nome: "Ana",
      telefone: "1",
      email: "",
      documento: "",
    });
  });
});
