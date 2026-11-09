import { z } from "zod";
import type { CrmStageT } from "@/lib/supabase/database.types";
import { STAGES, splitList } from "./schemas";

// ---------- Regras ----------
export const TRIGGERS = {
  lead_criado: {
    label: "Lead criado",
    hint: "Quando uma oportunidade entra no Comercial (cadastro, importação, API ou formulário).",
  },
  etapa_alterada: { label: "Mudou de etapa", hint: "Quando a oportunidade chega a uma etapa." },
  sem_contato: {
    label: "Sem contato há N dias",
    hint: "Conferido a cada hora; dispara uma vez por período sem contato.",
  },
} as const;
export type TriggerT = keyof typeof TRIGGERS;

export const ACTIONS = {
  mover_etapa: "Mover para a etapa",
  definir_responsavel: "Definir responsável",
  distribuir: "Distribuir no rodízio",
  adicionar_tag: "Adicionar tag",
  proximo_passo: "Definir próximo passo",
} as const;
export type ActionT = keyof typeof ACTIONS;

export const SOURCES = {
  manual: "Cadastro manual",
  importacao: "Importação",
  api: "API",
  formulario: "Formulário",
} as const;

/** Etapas que uma regra pode definir (perder exige motivo, então fica de fora). */
export const RULE_STAGES = (Object.keys(STAGES) as CrmStageT[]).filter((s) => s !== "perdido");

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("mover_etapa"),
    stage: z.enum(["novo_lead", "contato_feito", "orcamento", "proposta", "negociacao", "fechado"]),
  }),
  z.object({ type: z.literal("definir_responsavel"), user_id: z.string().uuid("Escolha o responsável.") }),
  z.object({ type: z.literal("distribuir") }),
  z.object({ type: z.literal("adicionar_tag"), tag: z.string().trim().min(1, "Informe a tag.").max(40) }),
  z.object({
    type: z.literal("proximo_passo"),
    text: z.string().trim().min(1, "Descreva o próximo passo.").max(200),
    days: z.coerce.number().int().min(0, "Mínimo 0.").max(365, "Máximo 365."),
  }),
]);
export type RuleAction = z.infer<typeof actionSchema>;

export const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à regra.").max(80),
    active: z.boolean(),
    trigger: z.enum(["lead_criado", "etapa_alterada", "sem_contato"]),
    stage: z.string(),
    origin: z.string().trim().max(60),
    source: z.enum(["", "manual", "importacao", "api", "formulario"]),
    days: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365, "Máximo 365 dias."),
    actions: z.array(actionSchema).min(1, "Adicione ao menos uma ação.").max(5, "Até 5 ações."),
  })
  .superRefine((v, ctx) => {
    if (v.stage && !(v.stage in STAGES))
      ctx.addIssue({ code: "custom", path: ["stage"], message: "Etapa inválida." });
    if (v.trigger === "etapa_alterada" && !v.stage)
      ctx.addIssue({ code: "custom", path: ["stage"], message: "Escolha a etapa." });
    // regra de etapa que manda para a mesma etapa não faz nada
    if (
      v.trigger === "etapa_alterada" &&
      v.actions.some((a) => a.type === "mover_etapa" && a.stage === v.stage)
    )
      ctx.addIssue({ code: "custom", path: ["actions"], message: "A regra moveria para a mesma etapa." });
  })
  .transform((v) => ({
    name: v.name,
    active: v.active,
    trigger: v.trigger,
    conditions: {
      ...(v.stage ? { stage: v.stage } : {}),
      ...(v.origin ? { origin: v.origin } : {}),
      ...(v.source ? { source: v.source } : {}),
      ...(v.trigger === "sem_contato" ? { days: v.days } : {}),
    },
    actions: v.actions,
  }));
export type RuleFormValues = z.input<typeof ruleSchema>;

export interface RuleConditions {
  stage?: string;
  origin?: string;
  source?: string;
  days?: number;
}

/** Frase curta que descreve a regra ("Quando… e… então…"). */
export function describeRule(
  trigger: TriggerT,
  c: RuleConditions,
  actions: RuleAction[],
  personName: (id: string) => string,
) {
  const when =
    trigger === "lead_criado"
      ? "Quando um lead for criado"
      : trigger === "etapa_alterada"
        ? `Quando chegar em ${STAGES[c.stage as CrmStageT]?.label ?? "?"}`
        : `Quando ficar ${c.days} dia(s) sem contato`;
  const ifs = [
    trigger !== "etapa_alterada" && c.stage ? `na etapa ${STAGES[c.stage as CrmStageT]?.label}` : "",
    c.origin ? `com origem "${c.origin}"` : "",
    c.source ? `vindo de ${SOURCES[c.source as keyof typeof SOURCES]}` : "",
  ].filter(Boolean);
  const then = actions.map((a) => {
    switch (a.type) {
      case "mover_etapa":
        return `mover para ${STAGES[a.stage].label}`;
      case "definir_responsavel":
        return `passar para ${personName(a.user_id)}`;
      case "distribuir":
        return "distribuir no rodízio";
      case "adicionar_tag":
        return `adicionar a tag "${a.tag}"`;
      case "proximo_passo":
        return `próximo passo "${a.text}" ${a.days ? `em ${a.days} dia(s)` : "para hoje"}`;
    }
  });
  return `${when}${ifs.length ? ` ${ifs.join(" e ")}` : ""}, ${then.join(", ")}.`;
}

/** Lê ações gravadas no banco, descartando o que não for reconhecido. */
export function parseActions(raw: unknown): RuleAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((a) => {
    const r = actionSchema.safeParse(a);
    return r.success ? [r.data] : [];
  });
}

export const distributionSchema = z.object({
  members: z.array(z.string().uuid()).max(100),
  auto_new: z.boolean(),
});

// ---------- Webhooks ----------
export const WEBHOOK_EVENTS = {
  lead_criado: "Lead criado",
  etapa_alterada: "Mudou de etapa",
  fechado: "Venda fechada",
  perdido: "Venda perdida",
} as const;

/** Só endereços https públicos (nada de localhost ou rede interna). */
export function isPublicHttpsUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") && !h.includes(":")) return false;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal"))
    return false;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    )
      return false;
  }
  if (h.includes(":")) {
    // IPv6 literal: bloqueia loopback, link-local e rede privada
    if (h === "::1" || h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd") || h === "::")
      return false;
  }
  return true;
}

export const webhookSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome.").max(60),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(isPublicHttpsUrl, "Use um endereço https público (ex.: o webhook do Make ou do Zapier)."),
  events: z
    .array(z.enum(["lead_criado", "etapa_alterada", "fechado", "perdido"]))
    .min(1, "Escolha ao menos um evento."),
  active: z.boolean(),
});

// ---------- Chaves de API ----------
export const apiKeySchema = z.object({ name: z.string().trim().min(1, "Dê um nome à chave.").max(60) });

// ---------- Formulários ----------
export const FORM_FIELDS = {
  company: { label: "Empresa", payload: "empresa" },
  email: { label: "E-mail", payload: "email" },
  phone: { label: "Telefone / WhatsApp", payload: "telefone" },
  document: { label: "CNPJ ou CPF", payload: "documento" },
  segment: { label: "Segmento", payload: "segmento" },
  message: { label: "Mensagem", payload: "mensagem" },
} as const;
export type FormFieldKey = keyof typeof FORM_FIELDS;
export const FORM_FIELD_KEYS = Object.keys(FORM_FIELDS) as FormFieldKey[];

const formFieldSchema = z.object({
  key: z.enum(["company", "email", "phone", "document", "segment", "message"]),
  required: z.boolean(),
});

export const formSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome interno.").max(80),
  title: z.string().trim().min(1, "Informe o título que o visitante vê.").max(120),
  description: z
    .string()
    .trim()
    .max(600)
    .transform((v) => v || null),
  fields: z.array(formFieldSchema).max(6),
  stage: z.enum(["novo_lead", "contato_feito", "orcamento", "proposta", "negociacao"]),
  owner_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Responsável inválido."),
  distribute: z.boolean(),
  origin: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  tags: z
    .string()
    .max(400)
    .transform((v) => splitList(v).map((t) => t.slice(0, 40)))
    .refine((v) => v.length <= 10, "Até 10 tags."),
  success_message: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
  active: z.boolean(),
});
export type FormFormValues = z.input<typeof formSchema>;

/** Envio do visitante: nome obrigatório, os demais conforme o formulário. */
export function publicSubmissionSchema(fields: { key: FormFieldKey; required: boolean }[]) {
  const shape: Record<string, z.ZodType<string>> = {
    nome: z.string().trim().min(1, "Informe seu nome.").max(120),
  };
  for (const f of fields) {
    const name = FORM_FIELDS[f.key].payload;
    let s: z.ZodType<string> = z
      .string()
      .trim()
      .max(f.key === "message" ? 2000 : 200);
    if (f.key === "email")
      s = z
        .string()
        .trim()
        .max(200)
        .refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido.");
    if (f.key === "document")
      s = z
        .string()
        .trim()
        .refine((v) => {
          const d = v.replace(/\D/g, "");
          return !v || d.length === 11 || d.length === 14;
        }, "CPF (11 dígitos) ou CNPJ (14).");
    const field = f.required ? s.refine((v) => v.trim() !== "", "Campo obrigatório.") : s;
    // campo ausente vale como vazio
    shape[name] = z.preprocess((v) => (v === undefined || v === null ? "" : v), field) as z.ZodType<string>;
  }
  return z.object(shape);
}
