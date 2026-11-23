import { z } from "zod";

export const APPLIES_TO = {
  demanda: "Demandas",
  cliente: "Perfil do cliente",
} as const;
export type AppliesTo = keyof typeof APPLIES_TO;

/** Um item por linha; linhas vazias e espaços sobrando são ignorados. */
export function linesToItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo.").max(120, "Nome muito longo."),
  description: z.string().trim().max(500, "Descrição muito longa."),
  applies_to: z.enum(["demanda", "cliente"]),
  items_text: z
    .string()
    .transform(linesToItems)
    .pipe(
      z
        .array(z.string().max(200, "Cada item pode ter até 200 caracteres."))
        .min(1, "Escreva ao menos um item (um por linha).")
        .max(60, "No máximo 60 itens."),
    ),
});
export type TemplateInput = z.input<typeof templateSchema>;
export type TemplateData = z.output<typeof templateSchema>;

export interface ChecklistItem {
  text: string;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
}

export const newItems = (texts: string[]): ChecklistItem[] => texts.map((text) => ({ text, done: false, done_by: null, done_at: null }));

/** Lê o JSON salvo no banco sem confiar no formato. */
export function parseItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as { text?: unknown }).text === "string")
    .map((i) => ({
      text: String(i.text).slice(0, 200),
      done: i.done === true,
      done_by: typeof i.done_by === "string" ? i.done_by : null,
      done_at: typeof i.done_at === "string" ? i.done_at : null,
    }));
}

export function progress(items: ChecklistItem[]) {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, complete: items.length > 0 && done === items.length };
}

/** Modelos sugeridos para começar (a agência edita ou apaga à vontade). */
export const SUGGESTED_TEMPLATES: { name: string; description: string; applies_to: AppliesTo; items: string[] }[] = [
  {
    name: "Antes de publicar um post",
    description: "Conferência final antes de mandar para aprovação ou publicar.",
    applies_to: "demanda",
    items: [
      "Legenda revisada (ortografia e tom do cliente)",
      "Arte no tamanho certo (1080×1350 feed ou 1080×1920 stories/reels)",
      "Imagem em JPG (exigência do Instagram para publicação automática)",
      "Dias e horário de funcionamento corretos na legenda",
      "Hashtags e marcações conferidas",
      "Data e horário de postagem definidos",
    ],
  },
  {
    name: "Cliente novo",
    description: "Tudo que precisa acontecer quando um cliente entra.",
    applies_to: "cliente",
    items: [
      "Contrato assinado",
      "Instagram e Facebook conectados (aba Redes sociais)",
      "Acesso ao Gerenciador de Anúncios",
      "Logo e manual da marca em Arquivos",
      "Briefing respondido",
      "Tom de voz e regras de legenda anotados",
      "Reunião de alinhamento feita",
      "Portal do cliente liberado",
    ],
  },
  {
    name: "Fechamento do mês",
    description: "Rotina do fim de mês de cada cliente.",
    applies_to: "cliente",
    items: [
      "Relatório de resultados enviado",
      "Planejamento do próximo mês aprovado",
      "Cobrança do mês conferida",
      "Pendências do mês anotadas",
    ],
  },
];
