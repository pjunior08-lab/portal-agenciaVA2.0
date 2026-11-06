import { z } from "zod";
import type { ItemCadenceT, ProposalStatusT } from "@/lib/supabase/database.types";
import { parseMoney } from "@/features/clientes/schemas";

export const PROPOSAL_STATUS: Record<ProposalStatusT, { label: string; tone: "neutral" | "info" | "brand" | "success-soft" | "danger" }> = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  enviada: { label: "Enviada", tone: "info" },
  em_negociacao: { label: "Em negociação", tone: "brand" },
  aceita: { label: "Aceita", tone: "success-soft" },
  recusada: { label: "Recusada", tone: "danger" },
};
export const PROPOSAL_STATUS_IDS = Object.keys(PROPOSAL_STATUS) as ProposalStatusT[];

export const CADENCES: Record<ItemCadenceT, { label: string; suffix: string }> = {
  unica: { label: "Pagamento único", suffix: "" },
  mensal: { label: "Mensal", suffix: "/mês" },
  trimestral: { label: "Trimestral", suffix: "/trimestre" },
  semestral: { label: "Semestral", suffix: "/semestre" },
  anual: { label: "Anual", suffix: "/ano" },
};
export const CADENCE_IDS = Object.keys(CADENCES) as ItemCadenceT[];

export const PAYMENT_METHODS = ["Pix", "Boleto", "Cartão de crédito", "Transferência"] as const;

/** Cores de capa (tokens da marca e neutros). */
export const COVERS = ["#FEB800", "#111111", "#2563EB", "#16A34A", "#DB2777", "#7C3AED"] as const;

/**
 * Textos prontos de observações. Escritos para este sistema como ponto de partida:
 * revise com o seu jurídico antes de usar.
 */
export const NOTE_SNIPPETS: { id: string; label: string; text: string }[] = [
  {
    id: "midia",
    label: "Mídia paga",
    text: "O investimento em anúncios (mídia paga) não está incluído nos valores desta proposta e é pago pelo cliente diretamente às plataformas.",
  },
  {
    id: "inicio",
    label: "Início do trabalho",
    text: "O trabalho começa após o aceite desta proposta, a assinatura do contrato e o envio dos acessos e materiais combinados.",
  },
  {
    id: "prazo",
    label: "Prazo do contrato",
    text: "Os serviços mensais têm prazo mínimo de contratação a ser definido no contrato.",
  },
  {
    id: "reajuste",
    label: "Reajuste anual",
    text: "Os valores mensais podem ser reajustados uma vez a cada 12 meses, conforme índice definido no contrato.",
  },
  {
    id: "cancelamento",
    label: "Cancelamento",
    text: "O cancelamento deve ser comunicado por escrito com a antecedência prevista no contrato.",
  },
  {
    id: "ajustes",
    label: "Rodadas de ajuste",
    text: "Cada peça inclui até 2 rodadas de ajuste. Pedidos adicionais podem ser orçados à parte.",
  },
];

// ---------- Valores ----------
const money = z
  .union([z.string(), z.number()])
  .transform((v) => parseMoney(v))
  .refine((v) => v !== null && !Number.isNaN(v) && v >= 0 && v <= 999_999_999, "Valor inválido.");
const optionalMoney = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === "" ? null : parseMoney(v)))
  .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 999_999_999), "Valor inválido.");

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const itemSchema = z.object({
  service: z.string().trim().min(1, "Informe o serviço.").max(200),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .refine((v) => v !== null && !Number.isNaN(v) && v > 0 && v <= 99999, "Quantidade inválida."),
  unit_price: money,
  cadence: z.enum(["unica", "mensal", "trimestral", "semestral", "anual"]),
  scope_html: z.string().max(20000, "Escopo muito longo."),
});

export const paymentSchema = z.object({
  installments: z.coerce.number().int().min(1, "Mínimo 1.").max(60, "Máximo 60."),
  down_payment: optionalMoney,
  methods: z.array(z.enum(PAYMENT_METHODS)).max(PAYMENT_METHODS.length),
  details: z.string().trim().max(1000),
});

export const proposalSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200),
  number: z.string().trim().max(30, "Máximo de 30 caracteres."),
  template_id: optional(36).refine((v) => v === null || z.string().uuid().safeParse(v).success, "Modelo inválido."),
  cover: z.enum(COVERS),
  status: z.enum(["rascunho", "enviada", "em_negociacao", "aceita", "recusada"]),
  valid_until: optional(10).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida."),
  client_id: optional(36).refine((v) => v === null || z.string().uuid().safeParse(v).success, "Cliente inválido."),
  contact_name: optional(120),
  contact_email: optional(200).refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail inválido."),
  contact_phone: optional(40),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item.").max(50),
  payment: paymentSchema,
  notes: z.string().max(10000),
});
export type ProposalFormValues = z.input<typeof proposalSchema>;
export type ProposalData = z.output<typeof proposalSchema>;

export const templateNameSchema = z.string().trim().min(1, "Dê um nome ao modelo.").max(120);

export const decisionSchema = z.object({
  token: z.string().min(16).max(200),
  decision: z.enum(["aceita", "recusada"]),
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120),
  comment: z.string().trim().max(2000),
});

// ---------- Cálculos ----------
export interface ItemLike {
  quantity: number;
  unit_price: number;
  cadence: ItemCadenceT;
}

export const itemTotal = (i: ItemLike) => Math.round(i.quantity * i.unit_price * 100) / 100;

/** Investimento por cadência (ex.: R$ 2.500/mês + R$ 3.000 único). */
export function investment(items: ItemLike[]) {
  const by = new Map<ItemCadenceT, number>();
  for (const i of items) by.set(i.cadence, Math.round(((by.get(i.cadence) ?? 0) + itemTotal(i)) * 100) / 100);
  return CADENCE_IDS.filter((c) => by.has(c)).map((c) => ({ cadence: c, total: by.get(c)! }));
}

/**
 * Valor de referência de uma proposta para os indicadores: o primeiro ciclo
 * (itens únicos + uma parcela de cada item recorrente).
 */
export const firstCycleValue = (items: ItemLike[]) => Math.round(items.reduce((s, i) => s + itemTotal(i), 0) * 100) / 100;

export const isOpen = (s: ProposalStatusT) => s === "enviada" || s === "em_negociacao";

/** Vencida: em aberto e com validade antes de hoje. */
export const isExpired = (p: { status: ProposalStatusT; valid_until: string | null }, today: string) =>
  isOpen(p.status) && !!p.valid_until && p.valid_until < today;

export function proposalIndicators(
  list: { status: ProposalStatusT; valid_until: string | null; value: number }[],
  today: string,
  in7days: string,
) {
  const open = list.filter((p) => isOpen(p.status) && !isExpired(p, today));
  return {
    openValue: Math.round(open.reduce((s, p) => s + p.value, 0) * 100) / 100,
    accepted: list.filter((p) => p.status === "aceita").length,
    negotiating: list.filter((p) => p.status === "em_negociacao").length,
    sent: list.filter((p) => p.status === "enviada").length,
    dueIn7: open.filter((p) => p.valid_until && p.valid_until <= in7days).length,
    refused: list.filter((p) => p.status === "recusada").length,
    expired: list.filter((p) => isExpired(p, today)).length,
  };
}
