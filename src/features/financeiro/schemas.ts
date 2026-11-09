import { z } from "zod";
import type { FinAccountKindT, FinKindT, FinSubtypeT } from "@/lib/supabase/database.types";
import { parseMoney } from "@/features/clientes/schemas";

export const SUBTYPES: Record<FinSubtypeT, string> = {
  fixa: "Despesa fixa",
  variavel: "Despesa variável",
  imposto: "Imposto",
  pessoa: "Pessoa",
};
export const SUBTYPE_IDS = Object.keys(SUBTYPES) as FinSubtypeT[];

/** Abas da lista de lançamentos. */
export const TABS = [
  { id: "todas", label: "Todas" },
  { id: "receita", label: "Recebimentos" },
  { id: "fixa", label: "Despesas fixas" },
  { id: "variavel", label: "Despesas variáveis" },
  { id: "imposto", label: "Impostos" },
  { id: "pessoa", label: "Pessoas" },
  { id: "transferencia", label: "Transferências" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

export const ACCOUNT_KINDS: Record<FinAccountKindT, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  caixa: "Caixa (dinheiro)",
  investimento: "Investimento",
  outro: "Outra",
};

export const REPEATS = {
  nao: { label: "Não repete", hint: "O lançamento acontece uma vez só." },
  semanal: { label: "Toda semana", hint: "Cria os lançamentos das próximas 26 semanas." },
  mensal: { label: "Todo mês", hint: "Cria os lançamentos dos próximos 12 meses." },
  anual: { label: "Todo ano", hint: "Cria os lançamentos dos próximos 3 anos." },
  parcelado: { label: "Parcelado", hint: "Divide o valor total em parcelas mensais." },
} as const;
export type RepeatId = keyof typeof REPEATS;

/** Categorias sugeridas, criadas só quando a pessoa pede. */
export const SUGGESTED_CATEGORIES: { kind: "receita" | "despesa"; subtype: FinSubtypeT | null; name: string }[] = [
  { kind: "receita", subtype: null, name: "Mensalidades" },
  { kind: "receita", subtype: null, name: "Projetos avulsos" },
  { kind: "receita", subtype: null, name: "Outras receitas" },
  { kind: "despesa", subtype: "fixa", name: "Ferramentas e software" },
  { kind: "despesa", subtype: "fixa", name: "Aluguel e contas" },
  { kind: "despesa", subtype: "variavel", name: "Mídia paga" },
  { kind: "despesa", subtype: "variavel", name: "Produção e materiais" },
  { kind: "despesa", subtype: "imposto", name: "Impostos" },
  { kind: "despesa", subtype: "pessoa", name: "Freelancers" },
  { kind: "despesa", subtype: "pessoa", name: "Salários e pró-labore" },
];

// ---------- Formulários ----------
const money = (msg = "Informe o valor.") =>
  z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .refine((v) => v !== null && !Number.isNaN(v) && v > 0 && v <= 999_999_999, msg)
    .transform((v) => v as number);
const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Valor inválido.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const transactionSchema = z
  .object({
    kind: z.enum(["receita", "despesa", "transferencia"]),
    subtype: z.enum(["fixa", "variavel", "imposto", "pessoa", ""]),
    amount: money(),
    description: z.string().trim().min(1, "Descreva o lançamento.").max(200),
    account_id: optionalUuid,
    to_account_id: optionalUuid,
    category_id: optionalUuid,
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    paid: z.boolean(),
    repeat: z.enum(["nao", "semanal", "mensal", "anual", "parcelado"]),
    installments: z.coerce.number().int(),
    client_id: optionalUuid,
    person: optionalText(120),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "despesa" && !v.subtype) ctx.addIssue({ code: "custom", path: ["subtype"], message: "Escolha o tipo da despesa." });
    if (v.kind === "transferencia") {
      if (!v.account_id) ctx.addIssue({ code: "custom", path: ["account_id"], message: "Escolha a conta de origem." });
      if (!v.to_account_id) ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Escolha a conta de destino." });
      if (v.account_id && v.account_id === v.to_account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Escolha uma conta diferente da origem." });
    }
    if (v.repeat === "parcelado" && (v.installments < 2 || v.installments > 120))
      ctx.addIssue({ code: "custom", path: ["installments"], message: "De 2 a 120 parcelas." });
  })
  .transform((v) => ({
    ...v,
    subtype: v.kind === "despesa" ? (v.subtype as FinSubtypeT) : null,
    to_account_id: v.kind === "transferencia" ? v.to_account_id : null,
    category_id: v.kind === "transferencia" ? null : v.category_id,
    paid: v.kind === "transferencia" ? true : v.paid,
  }));
export type TransactionFormValues = z.input<typeof transactionSchema>;
export type TransactionData = z.output<typeof transactionSchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à conta.").max(80),
  kind: z.enum(["corrente", "poupanca", "caixa", "investimento", "outro"]),
  initial_balance: z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" ? 0 : parseMoney(v)))
    .refine((v) => v !== null && !Number.isNaN(v) && Math.abs(v) <= 999_999_999, "Valor inválido.")
    .transform((v) => v as number),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const categorySchema = z.object({
  kind: z.enum(["receita", "despesa"]),
  subtype: z
    .enum(["fixa", "variavel", "imposto", "pessoa", ""])
    .transform((v) => (v === "" ? null : (v as FinSubtypeT))),
  name: z.string().trim().min(1, "Dê um nome à categoria.").max(60),
  monthly_goal: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null || v === "" ? null : parseMoney(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v > 0 && v <= 999_999_999), "Meta inválida."),
});

// ---------- Datas ----------
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Soma meses a uma data AAAA-MM-DD mantendo o dia (ajustado ao fim do mês). */
export function addMonthsKeepDay(day: string, n: number, originalDay = Number(day.slice(8))): string {
  const [y, m] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(originalDay, daysIn(ny, nm)))}`;
}

export function addDaysStr(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const monthKey = (day: string) => day.slice(0, 7);
export const monthStart = (key: string) => `${key}-01`;
export const monthEnd = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${pad(daysIn(y, m))}`;
};
export const shiftMonth = (key: string, n: number) => addMonthsKeepDay(`${key}-01`, n).slice(0, 7);

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShortFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
export const monthName = (key: string) => {
  const s = monthFmt.format(new Date(`${key}-15T12:00:00Z`)).replace(" de ", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const monthShort = (key: string) => monthShortFmt.format(new Date(`${key}-15T12:00:00Z`)).replace(".", "");

/**
 * Lançamentos gerados pela repetição. Parcelado divide o valor total
 * (os centavos que sobram vão na primeira parcela).
 */
export function expandOccurrences(v: { amount: number; description: string; due_date: string; repeat: RepeatId; installments: number }) {
  if (v.repeat === "nao") return [{ amount: v.amount, description: v.description, due_date: v.due_date, installment: null, installments: null }];
  if (v.repeat === "parcelado") {
    const n = v.installments;
    const cents = Math.round(v.amount * 100);
    const base = Math.floor(cents / n);
    return Array.from({ length: n }, (_, i) => ({
      amount: (base + (i === 0 ? cents - base * n : 0)) / 100,
      description: `${v.description} (${i + 1}/${n})`,
      due_date: addMonthsKeepDay(v.due_date, i),
      installment: i + 1,
      installments: n,
    }));
  }
  const count = v.repeat === "semanal" ? 26 : v.repeat === "mensal" ? 12 : 3;
  return Array.from({ length: count }, (_, i) => ({
    amount: v.amount,
    description: v.description,
    due_date: v.repeat === "semanal" ? addDaysStr(v.due_date, 7 * i) : addMonthsKeepDay(v.due_date, v.repeat === "mensal" ? i : 12 * i),
    installment: null,
    installments: null,
  }));
}

// ---------- Cálculos ----------
export interface Tx {
  id: string;
  kind: FinKindT;
  subtype: FinSubtypeT | null;
  amount: number;
  description: string;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  client_id: string | null;
  person: string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (list: Tx[]) => round(list.reduce((s, t) => s + Number(t.amount), 0));
const inMonth = (t: Tx, key: string) => t.due_date.startsWith(key);

export function matchesTab(t: Tx, tab: TabId) {
  if (tab === "todas") return true;
  if (tab === "receita" || tab === "transferencia") return t.kind === tab;
  return t.kind === "despesa" && t.subtype === tab;
}

/** Resumo do mês pela data de vencimento. Transferências não entram em receitas nem despesas. */
export function monthSummary(list: Tx[], key: string) {
  const m = list.filter((t) => inMonth(t, key));
  const rec = m.filter((t) => t.kind === "receita");
  const des = m.filter((t) => t.kind === "despesa");
  const recebido = sum(rec.filter((t) => t.paid));
  const pago = sum(des.filter((t) => t.paid));
  const receitas = sum(rec);
  const despesas = sum(des);
  return {
    receitas,
    despesas,
    resultado: round(receitas - despesas),
    recebido,
    aReceber: round(receitas - recebido),
    pago,
    aPagar: round(despesas - pago),
    resultadoRealizado: round(recebido - pago),
    count: m.length,
  };
}

/** Totais por categoria (despesa ou receita) no mês, do maior para o menor. */
export function byCategory(list: Tx[], key: string, kind: "receita" | "despesa", names: Map<string, string>) {
  const acc = new Map<string, number>();
  for (const t of list) if (t.kind === kind && inMonth(t, key)) {
    const k = t.category_id ?? "";
    acc.set(k, round((acc.get(k) ?? 0) + Number(t.amount)));
  }
  return [...acc]
    .map(([id, total]) => ({ id, name: id ? (names.get(id) ?? "Categoria") : "Sem categoria", total }))
    .sort((a, b) => b.total - a.total);
}

/** Receitas e despesas por mês (passado realizado + futuro previsto). */
export function cashflow(list: Tx[], keys: string[]) {
  return keys.map((key) => {
    const s = monthSummary(list, key);
    return { key, receitas: s.receitas, despesas: s.despesas, resultado: s.resultado };
  });
}

/** Comparação por categoria de despesa entre o mês e o anterior. */
export function changesVsLastMonth(list: Tx[], key: string, names: Map<string, string>) {
  const prev = shiftMonth(key, -1);
  const now = new Map(byCategory(list, key, "despesa", names).map((c) => [c.id, c]));
  const before = new Map(byCategory(list, prev, "despesa", names).map((c) => [c.id, c]));
  const ids = new Set([...now.keys(), ...before.keys()]);
  return [...ids]
    .map((id) => {
      const a = now.get(id)?.total ?? 0;
      const b = before.get(id)?.total ?? 0;
      return { id, name: now.get(id)?.name ?? before.get(id)?.name ?? "", now: a, before: b, delta: round(a - b) };
    })
    .filter((c) => c.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

/** Contas em aberto: atrasadas (antes de hoje) e a vencer (hoje até +30 dias). */
export function upcoming<T extends Tx>(list: T[], today: string) {
  const open = list.filter((t) => !t.paid && t.kind !== "transferencia").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const limit = addDaysStr(today, 30);
  return {
    overdue: open.filter((t) => t.due_date < today),
    next: open.filter((t) => t.due_date >= today && t.due_date <= limit),
  };
}

/** Gasto do mês por categoria com meta. */
export function goals(list: Tx[], key: string, categories: { id: string; name: string; kind: FinKindT; monthly_goal: number | null }[]) {
  return categories
    .filter((c) => c.monthly_goal)
    .map((c) => {
      const spent = sum(list.filter((t) => t.category_id === c.id && inMonth(t, key)));
      return { id: c.id, name: c.name, kind: c.kind, goal: Number(c.monthly_goal), spent, pct: Math.round((spent / Number(c.monthly_goal)) * 100) };
    });
}

/** Despesas do tipo "Pessoa" agrupadas por quem recebeu. */
export function byPerson(list: Tx[], key: string) {
  const acc = new Map<string, number>();
  for (const t of list)
    if (t.kind === "despesa" && t.subtype === "pessoa" && inMonth(t, key)) {
      const k = t.person?.trim() || "Sem nome";
      acc.set(k, round((acc.get(k) ?? 0) + Number(t.amount)));
    }
  return [...acc].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

/** Receitas do mês por cliente. */
export function revenueByClient(list: Tx[], key: string, names: Map<string, string>) {
  const acc = new Map<string, number>();
  for (const t of list)
    if (t.kind === "receita" && inMonth(t, key)) {
      const k = t.client_id ?? "";
      acc.set(k, round((acc.get(k) ?? 0) + Number(t.amount)));
    }
  return [...acc]
    .map(([id, total]) => ({ id, name: id ? (names.get(id) ?? "Cliente") : "Sem cliente", total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Saldo de todas as contas ao fim de cada dia do mês, a partir do saldo de hoje:
 * dias passados desfazem o que foi pago depois; dias futuros somam o previsto.
 */
export function balanceEvolution(list: Tx[], key: string, currentBalance: number, today: string) {
  const days: string[] = [];
  for (let d = monthStart(key); d <= monthEnd(key); d = addDaysStr(d, 1)) days.push(d);
  const effect = (t: Tx) => (t.kind === "receita" ? Number(t.amount) : t.kind === "despesa" ? -Number(t.amount) : 0);
  return days.map((day) => {
    let b = currentBalance;
    if (day < today) {
      for (const t of list) if (t.paid && t.paid_at && t.paid_at > day && t.paid_at <= today) b -= effect(t);
    } else {
      for (const t of list) if (!t.paid && t.due_date >= today && t.due_date <= day) b += effect(t);
    }
    return { day, balance: round(b), projected: day > today };
  });
}

/** As 3 maiores categorias de despesa dos últimos meses e seu total mês a mês. */
export function topExpenseTrend(list: Tx[], keys: string[], names: Map<string, string>) {
  const totals = new Map<string, number>();
  for (const t of list) if (t.kind === "despesa" && keys.some((k) => inMonth(t, k))) {
    const id = t.category_id ?? "";
    totals.set(id, (totals.get(id) ?? 0) + Number(t.amount));
  }
  const top = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  return top.map((id) => ({
    id,
    name: id ? (names.get(id) ?? "Categoria") : "Sem categoria",
    points: keys.map((k) => ({ key: k, total: sum(list.filter((t) => t.kind === "despesa" && (t.category_id ?? "") === id && inMonth(t, k))) })),
  }));
}
