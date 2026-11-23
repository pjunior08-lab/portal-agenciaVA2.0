import { z } from "zod";
import { parseMoney } from "@/features/clientes/schemas";
import { CADENCE_IDS, CADENCES } from "@/features/propostas/schemas";

export { CADENCES, CADENCE_IDS };

/** Serviço da tabela: o mesmo esquema valida no formulário e na ação do servidor. */
export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço.").max(120, "Nome muito longo."),
  description: z.string().trim().max(500, "Descrição muito longa."),
  cadence: z.enum(["unica", "mensal", "trimestral", "semestral", "anual"]),
  unit_price: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .refine((v): v is number => v !== null && !Number.isNaN(v) && v >= 0 && v <= 99999999, "Valor inválido."),
  scope_html: z.string().max(20000, "Escopo muito longo."),
  active: z.boolean(),
});
export type ServiceInput = z.input<typeof serviceSchema>;
export type ServiceData = z.output<typeof serviceSchema>;

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  cadence: (typeof CADENCE_IDS)[number];
  unit_price: number;
  scope_html: string;
  active: boolean;
  position: number;
}

/** Busca por nome ou descrição, sem diferenciar acento e maiúscula. */
export function filterServices<T extends { name: string; description: string; active: boolean }>(
  list: T[],
  q: string,
  showInactive: boolean,
): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const term = norm(q.trim());
  return list.filter((s) => (showInactive || s.active) && (!term || norm(`${s.name} ${s.description}`).includes(term)));
}

/** Item de proposta criado a partir de um serviço da tabela (o preço pode ser ajustado depois). */
export function serviceToProposalItem(s: Pick<ServiceRow, "name" | "cadence" | "unit_price" | "scope_html">) {
  return {
    service: s.name,
    quantity: "1",
    unit_price: s.unit_price.toFixed(2).replace(".", ","),
    cadence: s.cadence,
    scope_html: s.scope_html,
  };
}
