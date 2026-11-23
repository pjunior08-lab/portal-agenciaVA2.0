import { z } from "zod";
import { parseMoney } from "@/features/clientes/schemas";

export const PLATFORMS = { meta: "Meta Ads", google: "Google Ads", tiktok: "TikTok Ads", linkedin: "LinkedIn Ads", outra: "Outra" } as const;
export const OBJECTIVES = {
  reconhecimento: "Reconhecimento",
  alcance: "Alcance",
  trafego: "Tráfego",
  engajamento: "Engajamento",
  mensagens: "Mensagens",
  leads: "Cadastros (leads)",
  vendas: "Vendas",
  outro: "Outro",
} as const;
export const CAMPAIGN_STATUS = {
  planejada: { label: "Planejada", tone: "neutral" },
  ativa: { label: "Ativa", tone: "success-soft" },
  pausada: { label: "Pausada", tone: "brand" },
  encerrada: { label: "Encerrada", tone: "info" },
} as const;
export type Platform = keyof typeof PLATFORMS;
export type Objective = keyof typeof OBJECTIVES;
export type CampaignStatus = keyof typeof CAMPAIGN_STATUS;

const money = (msg: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" ? 0 : parseMoney(v)))
    .refine((v): v is number => v !== null && !Number.isNaN(v) && v >= 0 && v <= 99999999, msg);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const campaignSchema = z
  .object({
    client_id: z.string().uuid("Escolha o cliente."),
    name: z.string().trim().min(1, "Dê um nome à campanha.").max(120, "Nome muito longo."),
    platform: z.enum(["meta", "google", "tiktok", "linkedin", "outra"]),
    objective: z.enum(["reconhecimento", "alcance", "trafego", "engajamento", "mensagens", "leads", "vendas", "outro"]),
    status: z.enum(["planejada", "ativa", "pausada", "encerrada"]),
    start_date: date,
    end_date: date,
    planned_budget: money("Verba inválida."),
    spent: money("Valor inválido."),
    notes: z.string().trim().max(2000, "Observação muito longa."),
  })
  .refine((v) => v.start_date <= v.end_date, { path: ["end_date"], message: "O fim precisa ser depois do início." });
export type CampaignInput = z.input<typeof campaignSchema>;
export type CampaignData = z.output<typeof campaignSchema>;

export const spentSchema = money("Valor inválido.");

export interface CampaignRow {
  id: string;
  client_id: string;
  name: string;
  platform: Platform;
  objective: Objective;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  planned_budget: number;
  spent: number;
  spent_updated_at: string | null;
  notes: string;
}

/** Primeiro e último dia do mês "AAAA-MM". */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Campanha que roda em algum dia do mês. */
export const overlapsMonth = (c: Pick<CampaignRow, "start_date" | "end_date">, month: string) => {
  const { from, to } = monthRange(month);
  return c.start_date <= to && c.end_date >= from;
};

export function summarize(list: Pick<CampaignRow, "planned_budget" | "spent" | "status">[]) {
  const planned = round(list.reduce((s, c) => s + c.planned_budget, 0));
  const spent = round(list.reduce((s, c) => s + c.spent, 0));
  return {
    planned,
    spent,
    balance: round(planned - spent),
    pct: planned > 0 ? Math.round((spent / planned) * 100) : 0,
    active: list.filter((c) => c.status === "ativa").length,
  };
}

/** Quanto do período já passou (0–100), para comparar com o quanto da verba já foi usada. */
export function elapsedPct(c: Pick<CampaignRow, "start_date" | "end_date">, today: string) {
  if (today < c.start_date) return 0;
  if (today >= c.end_date) return 100;
  const d = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const total = d(c.end_date) - d(c.start_date) + 86400000;
  return Math.round(((d(today) - d(c.start_date) + 86400000) / total) * 100);
}

const round = (n: number) => Math.round(n * 100) / 100;
