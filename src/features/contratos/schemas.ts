import { z } from "zod";
import type { ContractStatusT } from "@/lib/supabase/database.types";
import { parseMoney } from "@/features/clientes/schemas";
import { formatBRL } from "@/lib/utils";

export const CONTRACT_STATUS: Record<ContractStatusT, { label: string; tone: "neutral" | "info" | "success-soft" | "danger" }> = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  aguardando: { label: "Aguardando assinatura", tone: "info" },
  assinado: { label: "Assinado", tone: "success-soft" },
  cancelado: { label: "Cancelado", tone: "danger" },
};
export const CONTRACT_STATUS_IDS = Object.keys(CONTRACT_STATUS) as ContractStatusT[];

/** Variáveis do texto do contrato: {{chave}}. Trocadas pelo valor no envio. */
export const VARIABLES: { key: string; label: string }[] = [
  { key: "contratante.nome", label: "Contratante: nome" },
  { key: "contratante.documento", label: "Contratante: CPF/CNPJ" },
  { key: "contratante.endereco", label: "Contratante: endereço" },
  { key: "contratante.email", label: "Contratante: e-mail" },
  { key: "contratante.responsavel", label: "Contratante: responsável" },
  { key: "contratada.nome", label: "Contratada: razão social" },
  { key: "contratada.cnpj", label: "Contratada: CNPJ" },
  { key: "contratada.endereco", label: "Contratada: endereço" },
  { key: "contratada.email", label: "Contratada: e-mail" },
  { key: "servico", label: "Serviço contratado" },
  { key: "valor", label: "Valor" },
  { key: "proposta.numero", label: "Proposta: número" },
  { key: "proposta.titulo", label: "Proposta: título" },
  { key: "vigencia.inicio", label: "Vigência: início" },
  { key: "vigencia.fim", label: "Vigência: fim" },
  { key: "data", label: "Data de hoje (por extenso)" },
];

const BLANK = "__________";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Troca {{chave}} pelos valores (escapados). Variável sem valor vira uma linha em branco. */
export function renderVariables(html: string, values: Record<string, string | null | undefined>): string {
  return html.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, key: string) => {
    const v = values[key.toLowerCase()];
    return v && v.trim() ? escapeHtml(v.trim()) : BLANK;
  });
}

/** Variáveis usadas no texto que estão sem valor (aviso antes de enviar). */
export function missingVariables(html: string, values: Record<string, string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const m of html.matchAll(/\{\{\s*([a-z_.]+)\s*\}\}/gi)) {
    const k = m[1].toLowerCase();
    if (!values[k]?.trim()) keys.add(k);
  }
  return [...keys];
}

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
export const fmtDay = (d: string | null | undefined) => (d ? longDate.format(new Date(`${d}T12:00:00Z`)) : "");

export function formatDocument(doc: string | null | undefined): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc ?? "";
}

export function variableValues(input: {
  client: { name: string; document: string | null; address: string | null; email: string | null; contact_name: string | null } | null;
  agency: { name: string; legal_name: string | null; cnpj: string | null; address: string | null; email: string | null };
  proposal: { number: string; title: string } | null;
  contract: { service_description: string; value: number | null; starts_on: string | null; ends_on: string | null };
  today: string;
}): Record<string, string> {
  const { client, agency, proposal, contract } = input;
  return {
    "contratante.nome": client?.name ?? "",
    "contratante.documento": formatDocument(client?.document),
    "contratante.endereco": client?.address ?? "",
    "contratante.email": client?.email ?? "",
    "contratante.responsavel": client?.contact_name ?? "",
    "contratada.nome": agency.legal_name || agency.name,
    "contratada.cnpj": formatDocument(agency.cnpj),
    "contratada.endereco": agency.address ?? "",
    "contratada.email": agency.email ?? "",
    servico: contract.service_description,
    valor: contract.value != null ? formatBRL(contract.value) : "",
    "proposta.numero": proposal?.number ?? "",
    "proposta.titulo": proposal?.title ?? "",
    "vigencia.inicio": fmtDay(contract.starts_on),
    "vigencia.fim": fmtDay(contract.ends_on),
    data: fmtDay(input.today),
  };
}

// ---------- CPF / CNPJ ----------
export function isValidCpf(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(d[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const isValidDocument = (v: string) => isValidCpf(v) || isValidCnpj(v);

// ---------- Formulários ----------
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Valor inválido.");

export const contractSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(200),
    client_id: z.string().uuid("Escolha o cliente (contratante)."),
    template_id: optionalUuid,
    proposal_id: optionalUuid,
    service_description: z.string().trim().max(2000),
    body_html: z.string().max(200000, "Texto muito longo."),
    header_text: z.string().trim().max(300),
    footer_text: z.string().trim().max(300),
    watermark: z.string().trim().max(40),
    value: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === null || v === "" ? null : parseMoney(v)))
      .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 999_999_999), "Valor inválido."),
    starts_on: optionalDate,
    ends_on: optionalDate,
    renewal_on: optionalDate,
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ["ends_on"], message: "O fim vem depois do início." });
export type ContractFormValues = z.input<typeof contractSchema>;
export type ContractData = z.output<typeof contractSchema>;

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo.").max(120),
  description: z.string().trim().max(300),
  body_html: z.string().max(200000, "Texto muito longo."),
  header_text: z.string().trim().max(300),
  footer_text: z.string().trim().max(300),
  watermark: z.string().trim().max(40),
  is_default: z.boolean(),
});
export type TemplateFormValues = z.input<typeof templateSchema>;

export const signSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  document: z.string().trim().refine(isValidDocument, "CPF ou CNPJ inválido."),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail inválido."),
  accept: z.literal(true, { message: "Confirme que leu e concorda." }),
});

// ---------- Indicadores ----------
/** Data de referência da renovação: a informada ou, sem ela, o fim da vigência. */
export const renewalDate = (c: { renewal_on: string | null; ends_on: string | null }) => c.renewal_on ?? c.ends_on;

export function contractIndicators(
  list: { status: ContractStatusT; value: number | null; renewal_on: string | null; ends_on: string | null; parties: string[] }[],
  today: string,
  in30: string,
) {
  const signed = list.filter((c) => c.status === "assinado");
  const waiting = list.filter((c) => c.status === "aguardando");
  return {
    signedValue: Math.round(signed.reduce((s, c) => s + (c.value ?? 0), 0) * 100) / 100,
    signed: signed.length,
    awaitingClient: waiting.filter((c) => !c.parties.includes("contratante")).length,
    awaitingYou: waiting.filter((c) => !c.parties.includes("contratada")).length,
    drafts: list.filter((c) => c.status === "rascunho").length,
    renewIn30: signed.filter((c) => {
      const d = renewalDate(c);
      return !!d && d >= today && d <= in30;
    }).length,
    renewalOverdue: signed.filter((c) => {
      const d = renewalDate(c);
      return !!d && d < today;
    }).length,
  };
}

/**
 * Esqueleto inicial de contrato (estrutura de cláusulas com variáveis).
 * Texto próprio deste sistema, só como ponto de partida: precisa ser
 * completado e revisado por um advogado antes de usar.
 */
export const STARTER_TEMPLATE = {
  name: "Prestação de serviços (esqueleto)",
  description: "Estrutura de cláusulas com variáveis. Complete e revise com um advogado.",
  header_text: "Contrato de prestação de serviços",
  footer_text: "{{contratada.nome}} · CNPJ {{contratada.cnpj}}",
  watermark: "",
  body_html: [
    "<h2>Partes</h2>",
    "<p><strong>CONTRATANTE:</strong> {{contratante.nome}}, inscrito(a) no CPF/CNPJ sob o nº {{contratante.documento}}, com endereço em {{contratante.endereco}}.</p>",
    "<p><strong>CONTRATADA:</strong> {{contratada.nome}}, inscrita no CNPJ sob o nº {{contratada.cnpj}}, com endereço em {{contratada.endereco}}.</p>",
    "<h2>1. Objeto</h2>",
    "<p>{{servico}}</p>",
    "<p>[Detalhe as entregas, a frequência e o que não está incluído.]</p>",
    "<h2>2. Valor e pagamento</h2>",
    "<p>Pelos serviços, a CONTRATANTE pagará {{valor}}. [Descreva vencimento, forma de pagamento e consequências do atraso.]</p>",
    "<h2>3. Vigência</h2>",
    "<p>Este contrato vale de {{vigencia.inicio}} a {{vigencia.fim}}. [Descreva as regras de renovação.]</p>",
    "<h2>4. Obrigações das partes</h2>",
    "<p>[Liste as obrigações da CONTRATADA e da CONTRATANTE.]</p>",
    "<h2>5. Rescisão</h2>",
    "<p>[Descreva aviso prévio, multas e como encerrar o contrato.]</p>",
    "<h2>6. Disposições gerais</h2>",
    "<p>[Foro, confidencialidade, proteção de dados e demais cláusulas.]</p>",
    "<p>As partes concordam em assinar este contrato eletronicamente.</p>",
    "<p>{{data}}.</p>",
  ].join(""),
};
