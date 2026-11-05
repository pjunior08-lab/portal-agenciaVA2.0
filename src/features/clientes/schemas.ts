import { z } from "zod";
import { email as emailSchema } from "@/features/auth/schemas";
import type { ClientStatusT } from "@/lib/supabase/database.types";

export const CLIENT_STATUS: Record<ClientStatusT, { label: string; tone: "success-soft" | "brand" | "neutral" | "danger" }> = {
  ativo: { label: "Ativo", tone: "success-soft" },
  pausado: { label: "Pausado", tone: "brand" },
  inativo: { label: "Inativo", tone: "neutral" },
  arquivado: { label: "Arquivado", tone: "danger" },
};

/** Cores de capa sugeridas (o campo aceita qualquer #RRGGBB). */
export const COVER_COLORS = ["#feb800", "#16171b", "#2f7be5", "#1f9d55", "#d0342c", "#8b5cf6", "#ec4899", "#0ea5e9"];

/** Seções que podem ser liberadas no Portal do Cliente e a fase em que o conteúdo chega. */
export const PORTAL_SECTIONS: { id: string; label: string; phase: number }[] = [
  { id: "arquivos", label: "Arquivos", phase: 2 },
  { id: "anotacoes", label: "Anotações", phase: 2 },
  { id: "aprovacoes", label: "Aprovações", phase: 4 },
  { id: "calendario", label: "Calendário", phase: 4 },
  { id: "em-andamento", label: "Em andamento", phase: 3 },
  { id: "mensagens", label: "Mensagens", phase: 8 },
  { id: "metricas", label: "Métricas", phase: 9 },
  { id: "relatorio", label: "Relatório", phase: 9 },
  { id: "servicos", label: "Serviços", phase: 5 },
  { id: "faturas", label: "Faturas", phase: 6 },
  { id: "acessos", label: "Acessos", phase: 9 },
];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const digits = (v: string) => v.replace(/\D/g, "");

/** Converte "1.500,50" ou "1500.5" em número; vazio vira nulo. */
export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/[R$\s]/g, "");
  if (!s) return null;
  // "1.500,50" → vírgula decimal; "2.000" (só pontos em grupos de 3) → milhar; "1500.5" → ponto decimal
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, "")
      : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  status: z.enum(["ativo", "pausado", "inativo", "arquivado"]),
  segment_icon: optionalText(40),
  cover_color: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), "Cor inválida."),
  client_since: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Data inválida."),
  notes: optionalText(5000),
  auto_reminders: z.boolean(),
  contact_name: optionalText(120),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .refine((v) => v === null || emailSchema.safeParse(v).success, "E-mail inválido."),
  phone: optionalText(20).refine((v) => !v || digits(v).length >= 10, "Telefone com DDD."),
  document: optionalText(18).refine(
    (v) => !v || [11, 14].includes(digits(v).length),
    "CPF (11 números) ou CNPJ (14 números).",
  ),
  address: optionalText(240),
  monthly_fee: z
    .union([z.string(), z.number(), z.null()])
    .transform(parseMoney)
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), "Valor inválido."),
  billing_day: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31), "Dia entre 1 e 31."),
});

export type ClientFormValues = z.input<typeof clientSchema>;

export const noteSchema = z.object({
  clientId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva a anotação.").max(5000),
  shared: z.boolean().default(false),
});

export const strategySchema = z.object({
  clientId: z.string().uuid(),
  persona: z.string().max(10000),
  profile_audit: z.string().max(10000),
  competitors: z.string().max(10000),
  positioning: z.string().max(10000),
  visual_identity: z.string().max(10000),
});

export const STRATEGY_FIELDS = [
  { key: "persona", label: "Persona", hint: "Quem é o público: idade, rotina, dores, desejos." },
  { key: "profile_audit", label: "Raio-x do perfil", hint: "Como o perfil está hoje: bio, destaques, frequência, o que funciona." },
  { key: "competitors", label: "Concorrentes", hint: "Quem disputa a mesma atenção e o que fazem bem ou mal." },
  { key: "positioning", label: "Posicionamento", hint: "Como a marca quer ser lembrada e o que a diferencia." },
  { key: "visual_identity", label: "Identidade visual", hint: "Cores, fontes, estilo de foto e referências." },
] as const;

export const portalSchema = z.object({
  clientId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$/, "Use de 3 a 60 letras minúsculas, números e hífens."),
  enabled: z.boolean(),
  sections: z.array(z.enum(PORTAL_SECTIONS.map((s) => s.id) as [string, ...string[]])),
});

export const clientInviteSchema = z.object({ clientId: z.string().uuid(), email: emailSchema });

/** Sugere um endereço de portal a partir do nome do cliente. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Nome de arquivo seguro para o Storage (sem acentos, espaços ou barras). */
export function safeFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return clean || "arquivo";
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
