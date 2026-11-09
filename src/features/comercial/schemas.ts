import { z } from "zod";
import type { CrmChannelT, CrmResultT, CrmStageT } from "@/lib/supabase/database.types";
import { parseMoney } from "@/features/clientes/schemas";

/** Etapas na ordem do funil. Fechado e Perdido ficam fora do quadro e aparecem nos relatórios. */
export const STAGES: Record<CrmStageT, { label: string; color: string; open: boolean }> = {
  novo_lead: { label: "Novo Lead", color: "var(--info)", open: true },
  contato_feito: { label: "Contato Feito", color: "var(--muted-2)", open: true },
  orcamento: { label: "Orçamento", color: "var(--warning)", open: true },
  proposta: { label: "Proposta", color: "var(--brand)", open: true },
  negociacao: { label: "Negociação", color: "var(--ink)", open: true },
  fechado: { label: "Fechado", color: "var(--success)", open: false },
  perdido: { label: "Perdido", color: "var(--danger)", open: false },
};
export const STAGE_IDS = Object.keys(STAGES) as CrmStageT[];
export const OPEN_STAGES = STAGE_IDS.filter((s) => STAGES[s].open);
export const stageIndex = (s: CrmStageT) => STAGE_IDS.indexOf(s);

export const CHANNELS: Record<CrmChannelT, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  presencial: "Presencial",
  outro: "Outro",
};
export const RESULTS: Record<CrmResultT, string> = {
  sem_resposta: "Sem resposta",
  respondeu: "Respondeu",
  pediu_retorno: "Pediu retorno",
  reuniao_marcada: "Reunião marcada",
  sem_interesse: "Sem interesse",
};
/** Resultados que contam como resposta nos relatórios. */
export const ANSWERED: CrmResultT[] = ["respondeu", "pediu_retorno", "reuniao_marcada"];

// ---------- Formulários ----------
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const documentField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || v.length === 11 || v.length === 14, "CPF (11 dígitos) ou CNPJ (14).")
  .transform((v) => (v === "" ? null : v));

export const opportunitySchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do contato.").max(120),
    company: optional(160),
    document: documentField,
    email: optional(200).refine(
      (v) => v === null || z.string().email().safeParse(v).success,
      "E-mail inválido.",
    ),
    phone: optional(40),
    segment: optional(60),
    origin: optional(60),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    owner_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Responsável inválido."),
    stage: z.enum([
      "novo_lead",
      "contato_feito",
      "orcamento",
      "proposta",
      "negociacao",
      "fechado",
      "perdido",
    ]),
    value: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === null || v === "" ? null : parseMoney(v)))
      .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 999_999_999), "Valor inválido."),
    next_step: optional(200),
    next_step_at: optional(10).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida."),
    lost_reason: optional(200),
    notes: optional(4000),
    custom: z.record(z.string(), z.union([z.string().max(500), z.number(), z.null()])),
  })
  .superRefine((v, ctx) => {
    if (v.stage === "perdido" && !v.lost_reason)
      ctx.addIssue({ code: "custom", path: ["lost_reason"], message: "Informe o motivo da perda." });
  });
export type OpportunityFormValues = z.input<typeof opportunitySchema>;
export type OpportunityData = z.output<typeof opportunitySchema>;

export const activitySchema = z
  .object({
    kind: z.enum(["contato", "nota"]),
    channel: z.enum(["whatsapp", "ligacao", "email", "presencial", "outro", ""]),
    result: z.enum(["sem_resposta", "respondeu", "pediu_retorno", "reuniao_marcada", "sem_interesse", ""]),
    note: z.string().trim().max(4000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "contato" && !v.channel)
      ctx.addIssue({ code: "custom", path: ["channel"], message: "Escolha o canal." });
    if (v.kind === "contato" && !v.result)
      ctx.addIssue({ code: "custom", path: ["result"], message: "Escolha o resultado." });
    if (v.kind === "nota" && !v.note)
      ctx.addIssue({ code: "custom", path: ["note"], message: "Escreva a anotação." });
  })
  .transform((v) => ({
    kind: v.kind,
    channel: v.kind === "contato" ? (v.channel as CrmChannelT) : null,
    result: v.kind === "contato" ? (v.result as CrmResultT) : null,
    note: v.note || null,
  }));

export const settingsSchema = z.object({
  segments: z.array(z.string().trim().min(1).max(60)).max(100),
  tags: z.array(z.string().trim().min(1).max(40)).max(100),
  cadence_days: z
    .array(z.coerce.number().int().min(1, "Mínimo 1 dia.").max(90, "Máximo 90 dias."))
    .min(1)
    .max(10),
  cadence_paused: z.boolean(),
  stale_days: z.coerce.number().int().min(1).max(365),
});

export const fieldSchema = z
  .object({
    label: z.string().trim().min(1, "Dê um nome ao campo.").max(60),
    type: z.enum(["texto", "numero", "data", "opcoes"]),
    options: z.array(z.string().trim().min(1).max(60)).max(50),
  })
  .refine((v) => v.type !== "opcoes" || v.options.length >= 2, {
    path: ["options"],
    message: "Informe ao menos 2 opções.",
  });

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo.").max(80),
  channel: z.enum(["whatsapp", "ligacao", "email", "presencial", "outro"]),
  body: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
});

/** Chave do campo personalizado a partir do nome (sem acento, minúsculas). */
export const fieldKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "campo";

/** Separa uma lista digitada com vírgulas (sem repetir). */
export const splitList = (s: string) => [
  ...new Set(
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];

/** Troca {{nome}}, {{empresa}} e {{responsavel}} no modelo de mensagem. */
export const fillTemplate = (body: string, o: { name: string; company: string | null }, owner: string) =>
  body
    .replace(/\{\{\s*nome\s*\}\}/gi, o.name.split(/\s+/)[0])
    .replace(/\{\{\s*empresa\s*\}\}/gi, o.company ?? "")
    .replace(/\{\{\s*responsavel\s*\}\}/gi, owner);

// ---------- Filtros ----------
export interface Opp {
  id: string;
  name: string;
  company: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  origin: string | null;
  tags: string[];
  owner_id: string | null;
  stage: CrmStageT;
  position: number;
  value: number | null;
  next_step: string | null;
  next_step_at: string | null;
  last_contact_at: string | null;
  attempts: number;
  lost_reason: string | null;
  closed_at: string | null;
  lost_at: string | null;
  stage_changed_at: string;
  created_at: string;
  client_id: string | null;
}

export interface OppFilters {
  q: string;
  owner: string;
  segment: string;
  lastContact: "" | "7" | "14" | "30" | "nunca";
  overdue: boolean;
  noNextStep: boolean;
  origin: string;
  tag: string;
}
export const EMPTY_FILTERS: OppFilters = {
  q: "",
  owner: "",
  segment: "",
  lastContact: "",
  overdue: false,
  noNextStep: false,
  origin: "",
  tag: "",
};

const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

export function filterOpps<T extends Opp>(list: T[], f: OppFilters, today: string): T[] {
  const q = f.q.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  return list.filter((o) => {
    if (q) {
      const text = `${o.name} ${o.company ?? ""} ${o.email ?? ""}`.toLowerCase();
      const digits = `${o.document ?? ""} ${(o.phone ?? "").replace(/\D/g, "")}`;
      if (!text.includes(q) && !(qDigits.length >= 3 && digits.includes(qDigits))) return false;
    }
    if (f.owner && (f.owner === "none" ? o.owner_id : o.owner_id !== f.owner)) return false;
    if (f.segment && o.segment !== f.segment) return false;
    if (f.origin && o.origin !== f.origin) return false;
    if (f.tag && !o.tags.includes(f.tag)) return false;
    if (f.overdue && !(o.next_step_at && o.next_step_at < today)) return false;
    if (f.noNextStep && o.next_step_at) return false;
    if (f.lastContact === "nunca" && o.last_contact_at) return false;
    if (f.lastContact && f.lastContact !== "nunca") {
      if (!o.last_contact_at) return true;
      if (daysBetween(o.last_contact_at, today) < Number(f.lastContact)) return false;
    }
    return true;
  });
}

/** Visão Hoje: atrasadas, hoje, próximos 7 dias e sem próximo passo (só abertas). */
export function todayBuckets<T extends Opp>(list: T[], today: string, in7: string) {
  const open = list
    .filter((o) => STAGES[o.stage].open)
    .sort((a, b) => (a.next_step_at ?? "").localeCompare(b.next_step_at ?? ""));
  return {
    overdue: open.filter((o) => o.next_step_at && o.next_step_at < today),
    today: open.filter((o) => o.next_step_at === today),
    next7: open.filter((o) => o.next_step_at && o.next_step_at > today && o.next_step_at <= in7),
    noNext: open.filter((o) => !o.next_step_at),
  };
}

/** Resumo do mês: novas contas (fechadas no mês), pipeline aberto, perdas do mês e total de leads abertos. */
export function monthSummary(list: Opp[], month: string) {
  const inMonth = (iso: string | null) => !!iso && toLocalDay(iso).startsWith(month);
  const sum = (l: Opp[]) => Math.round(l.reduce((s, o) => s + (o.value ?? 0), 0) * 100) / 100;
  const closed = list.filter((o) => o.stage === "fechado" && inMonth(o.closed_at));
  return {
    newRevenue: sum(closed),
    closedCount: closed.length,
    pipeline: sum(list.filter((o) => STAGES[o.stage].open)),
    lost: sum(list.filter((o) => o.stage === "perdido" && inMonth(o.lost_at))),
    openLeads: list.filter((o) => STAGES[o.stage].open).length,
  };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
/** Dia (AAAA-MM-DD) em São Paulo de um instante ISO. */
export const toLocalDay = (iso: string) => (iso.length === 10 ? iso : dayFmt.format(new Date(iso)));

// ---------- Relatórios ----------
export interface HistoryRow {
  opportunity_id: string;
  from_stage: CrmStageT | null;
  to_stage: CrmStageT;
  changed_by: string | null;
  changed_at: string;
}
export interface ActivityRow {
  opportunity_id: string;
  kind: "contato" | "nota";
  result: CrmResultT | null;
  author_id: string | null;
  happened_at: string;
}
export interface Period {
  from: string;
  to: string;
}
const inPeriod = (iso: string | null, p: Period) => {
  if (!iso) return false;
  const d = toLocalDay(iso);
  return d >= p.from && d <= p.to;
};
const ratio = (a: number, b: number) => (b ? a / b : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function reportKpis(opps: Opp[], acts: ActivityRow[], p: Period) {
  const contacts = acts.filter((a) => a.kind === "contato" && inPeriod(a.happened_at, p));
  const closed = opps.filter((o) => o.stage === "fechado" && inPeriod(o.closed_at, p));
  const lost = opps.filter((o) => o.stage === "perdido" && inPeriod(o.lost_at, p));
  const v = (l: Opp[]) => Math.round(l.reduce((s, o) => s + (o.value ?? 0), 0) * 100) / 100;
  return {
    created: opps.filter((o) => inPeriod(o.created_at, p)).length,
    contacts: contacts.length,
    answers: contacts.filter((a) => a.result && ANSWERED.includes(a.result)).length,
    meetings: contacts.filter((a) => a.result === "reuniao_marcada").length,
    closed: closed.length,
    closedValue: v(closed),
    lost: lost.length,
    lostValue: v(lost),
  };
}

/**
 * Funil: para cada etapa, quantos entraram no período e, desses, quantos depois
 * avançaram (chegaram a uma etapa mais à frente), fecharam ou perderam.
 * Tempo: média das passagens que terminaram no período; "abertos agora" é o tempo de quem está na etapa hoje.
 */
export function funnelReport(opps: Opp[], history: HistoryRow[], p: Period, nowIso: string) {
  const byOpp = new Map<string, HistoryRow[]>();
  for (const h of [...history].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    if (!byOpp.has(h.opportunity_id)) byOpp.set(h.opportunity_id, []);
    byOpp.get(h.opportunity_id)!.push(h);
  }
  const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
  return STAGE_IDS.map((stage) => {
    let entered = 0,
      advanced = 0,
      closed = 0,
      lost = 0;
    const durations: number[] = [];
    for (const rows of byOpp.values()) {
      rows.forEach((h, i) => {
        if (h.to_stage !== stage) return;
        const next = rows[i + 1];
        if (next && inPeriod(next.changed_at, p)) durations.push(hours(h.changed_at, next.changed_at));
        if (!inPeriod(h.changed_at, p)) return;
        entered++;
        const later = rows.slice(i + 1);
        if (later.some((x) => x.to_stage === "fechado")) closed++;
        if (later.some((x) => x.to_stage === "perdido")) lost++;
        if (later.some((x) => x.to_stage !== "perdido" && stageIndex(x.to_stage) > stageIndex(stage)))
          advanced++;
      });
    }
    const current = opps.filter((o) => o.stage === stage);
    const openTimes = current.map((o) => hours(o.stage_changed_at, nowIso));
    return {
      stage,
      now: current.length,
      entered,
      advanced: STAGES[stage].open ? advanced : null,
      closed: STAGES[stage].open ? closed : null,
      lost: STAGES[stage].open ? lost : null,
      conversion: STAGES[stage].open ? ratio(advanced, entered) : null,
      avgHours:
        STAGES[stage].open && durations.length
          ? durations.reduce((s, x) => s + x, 0) / durations.length
          : null,
      medianHours: STAGES[stage].open ? median(durations) : null,
      openHours:
        STAGES[stage].open && openTimes.length
          ? openTimes.reduce((s, x) => s + x, 0) / openTimes.length
          : null,
    };
  });
}

/** Leads abertos sem contato (ou sem criação recente) há mais de N dias. */
export function staleLeads<T extends Opp>(opps: T[], days: number, today: string) {
  return opps
    .filter((o) => STAGES[o.stage].open)
    .map((o) => ({ o, idle: daysBetween(o.last_contact_at ?? o.created_at, today) }))
    .filter((x) => x.idle > days)
    .sort((a, b) => b.idle - a.idle);
}

/** Vendedores: contatos e respostas por autor; fechamento para quem moveu para Fechado (sem autor, o responsável). */
export function sellersReport(opps: Opp[], acts: ActivityRow[], history: HistoryRow[], p: Period) {
  const rows = new Map<
    string,
    { contacts: number; answers: number; meetings: number; closed: number; closedValue: number; open: number }
  >();
  const get = (id: string) => {
    if (!rows.has(id))
      rows.set(id, { contacts: 0, answers: 0, meetings: 0, closed: 0, closedValue: 0, open: 0 });
    return rows.get(id)!;
  };
  for (const a of acts) {
    if (a.kind !== "contato" || !inPeriod(a.happened_at, p)) continue;
    const r = get(a.author_id ?? "");
    r.contacts++;
    if (a.result && ANSWERED.includes(a.result)) r.answers++;
    if (a.result === "reuniao_marcada") r.meetings++;
  }
  const oppById = new Map(opps.map((o) => [o.id, o]));
  for (const o of opps) {
    if (STAGES[o.stage].open) get(o.owner_id ?? "").open++;
    if (o.stage === "fechado" && inPeriod(o.closed_at, p)) {
      const h = [...history].reverse().find((x) => x.opportunity_id === o.id && x.to_stage === "fechado");
      const r = get(h?.changed_by ?? o.owner_id ?? "");
      r.closed++;
      r.closedValue = Math.round((r.closedValue + (oppById.get(o.id)?.value ?? 0)) * 100) / 100;
    }
  }
  return [...rows].map(([id, r]) => ({ id, ...r, answerRate: ratio(r.answers, r.contacts) }));
}

/** Cortes por segmento ou origem. */
export function cutBy(opps: Opp[], p: Period, key: "segment" | "origin") {
  const rows = new Map<string, { leads: number; closed: number; lost: number; closedValue: number }>();
  const get = (k: string) => {
    if (!rows.has(k)) rows.set(k, { leads: 0, closed: 0, lost: 0, closedValue: 0 });
    return rows.get(k)!;
  };
  for (const o of opps) {
    const k = o[key] ?? "";
    if (inPeriod(o.created_at, p)) get(k).leads++;
    if (o.stage === "fechado" && inPeriod(o.closed_at, p)) {
      get(k).closed++;
      get(k).closedValue = Math.round((get(k).closedValue + (o.value ?? 0)) * 100) / 100;
    }
    if (o.stage === "perdido" && inPeriod(o.lost_at, p)) get(k).lost++;
  }
  return [...rows]
    .map(([name, r]) => ({
      name: name || "Não informado",
      ...r,
      closeRate: ratio(r.closed, r.closed + r.lost),
    }))
    .sort((a, b) => b.leads - a.leads);
}

/** Semana (segunda-feira) de um dia. */
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const w = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - w);
  return d.toISOString().slice(0, 10);
}

export function byWeek(opps: Opp[], p: Period) {
  const rows = new Map<string, { created: number; closed: number; lost: number }>();
  const add = (iso: string | null, field: "created" | "closed" | "lost") => {
    if (!iso || !inPeriod(iso, p)) return;
    const k = weekStart(toLocalDay(iso));
    if (!rows.has(k)) rows.set(k, { created: 0, closed: 0, lost: 0 });
    rows.get(k)![field]++;
  };
  for (const o of opps) {
    add(o.created_at, "created");
    if (o.stage === "fechado") add(o.closed_at, "closed");
    if (o.stage === "perdido") add(o.lost_at, "lost");
  }
  return [...rows].map(([week, r]) => ({ week, ...r })).sort((a, b) => a.week.localeCompare(b.week));
}

export function byLostReason(opps: Opp[], p: Period) {
  const rows = new Map<string, { count: number; value: number }>();
  for (const o of opps)
    if (o.stage === "perdido" && inPeriod(o.lost_at, p)) {
      const k = o.lost_reason?.trim() || "Sem motivo";
      const r = rows.get(k) ?? { count: 0, value: 0 };
      rows.set(k, { count: r.count + 1, value: Math.round((r.value + (o.value ?? 0)) * 100) / 100 });
    }
  return [...rows].map(([reason, r]) => ({ reason, ...r })).sort((a, b) => b.count - a.count);
}

export function formatHours(h: number | null) {
  if (h === null) return "—";
  if (h < 24) return `${Math.max(1, Math.round(h))} h`;
  const d = h / 24;
  return d < 10 ? `${d.toFixed(1).replace(".", ",")} d` : `${Math.round(d)} d`;
}

/** CSV com ponto e vírgula (abre certo no Excel em português). */
export function toCsv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

// ---------- Importação ----------
export const IMPORT_LIMIT_ROWS = 5000;
export const IMPORT_LIMIT_BYTES = 5 * 1024 * 1024;

export const IMPORT_FIELDS = [
  { key: "name", label: "Nome do contato", required: true },
  { key: "company", label: "Empresa" },
  { key: "document", label: "CNPJ/CPF" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "segment", label: "Segmento" },
  { key: "origin", label: "Origem" },
  { key: "value", label: "Valor mensal" },
  { key: "tags", label: "Tags (separadas por vírgula)" },
  { key: "notes", label: "Observações" },
] as const;
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"] | `custom:${string}`;

/** Sugere a coluna de cada campo pelo nome do cabeçalho. */
export function guessMapping(
  headers: string[],
  custom: { key: string; label: string }[],
): Record<string, number | null> {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string[]> = {
    name: ["nome", "contato", "nomedocontato", "name", "lead", "responsavel"],
    company: ["empresa", "company", "razaosocial", "nomefantasia", "cliente"],
    document: ["cnpj", "cpf", "cnpjcpf", "cpfcnpj", "documento"],
    email: ["email", "mail"],
    phone: ["telefone", "celular", "whatsapp", "fone", "phone"],
    segment: ["segmento", "setor", "ramo"],
    origin: ["origem", "fonte", "canal", "source"],
    value: ["valor", "valormensal", "mensalidade", "ticket"],
    tags: ["tags", "etiquetas"],
    notes: ["observacoes", "observacao", "obs", "notas", "notes"],
  };
  const h = headers.map(norm);
  const out: Record<string, number | null> = {};
  for (const f of IMPORT_FIELDS) {
    const i = h.findIndex((x) => aliases[f.key].includes(x));
    out[f.key] = i >= 0 ? i : null;
  }
  for (const c of custom) {
    const i = h.findIndex((x) => x === norm(c.label) || x === norm(c.key));
    out[`custom:${c.key}`] = i >= 0 ? i : null;
  }
  return out;
}

export interface ImportRow {
  line: number;
  data: {
    name: string;
    company: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
    segment: string | null;
    origin: string | null;
    value: number | null;
    tags: string[];
    notes: string | null;
    custom: Record<string, string>;
  } | null;
  errors: string[];
}

/** Aplica o mapeamento e valida cada linha (mesmas regras do cadastro). */
export function buildImportRows(rows: string[][], mapping: Record<string, number | null>): ImportRow[] {
  const at = (r: string[], k: string) => {
    const i = mapping[k];
    return i === null || i === undefined ? "" : String(r[i] ?? "").trim();
  };
  return rows.map((r, n) => {
    const errors: string[] = [];
    const name = at(r, "name");
    if (!name) errors.push("Sem nome do contato.");
    const doc = at(r, "document").replace(/\D/g, "");
    if (doc && doc.length !== 11 && doc.length !== 14) errors.push("CNPJ/CPF inválido.");
    const email = at(r, "email");
    if (email && !z.string().email().safeParse(email).success) errors.push("E-mail inválido.");
    const rawValue = at(r, "value");
    const value = rawValue ? parseMoney(rawValue) : null;
    if (rawValue && (value === null || Number.isNaN(value) || value < 0)) errors.push("Valor inválido.");
    const custom: Record<string, string> = {};
    for (const k of Object.keys(mapping))
      if (k.startsWith("custom:") && at(r, k)) custom[k.slice(7)] = at(r, k).slice(0, 500);
    const cut = (s: string, max: number) => (s ? s.slice(0, max) : null);
    return {
      line: n + 2,
      errors,
      data: errors.length
        ? null
        : {
            name: name.slice(0, 120),
            company: cut(at(r, "company"), 160),
            document: doc || null,
            email: email || null,
            phone: cut(at(r, "phone"), 40),
            segment: cut(at(r, "segment"), 60),
            origin: cut(at(r, "origin"), 60),
            value: value ?? null,
            tags: splitList(at(r, "tags"))
              .slice(0, 20)
              .map((t) => t.slice(0, 40)),
            notes: cut(at(r, "notes"), 4000),
            custom,
          },
    };
  });
}

export const importRowSchema = z.object({
  name: z.string().min(1).max(120),
  company: z.string().max(160).nullable(),
  document: z
    .string()
    .regex(/^(\d{11}|\d{14})$/)
    .nullable(),
  email: z.string().email().max(200).nullable(),
  phone: z.string().max(40).nullable(),
  segment: z.string().max(60).nullable(),
  origin: z.string().max(60).nullable(),
  value: z.number().min(0).max(999_999_999).nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  notes: z.string().max(4000).nullable(),
  custom: z.record(z.string(), z.string().max(500)),
});
export const importSchema = z.object({
  rows: z.array(importRowSchema).min(1, "Nenhuma linha válida.").max(IMPORT_LIMIT_ROWS),
  stage: z.enum(["novo_lead", "contato_feito", "orcamento", "proposta", "negociacao"]),
  owner_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success),
  duplicates: z.enum(["pular", "atualizar"]),
  extraTags: z.array(z.string().min(1).max(40)).max(10),
});
