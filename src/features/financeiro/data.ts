import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberContext } from "@/lib/auth/session";
import type { Tx } from "./schemas";

export interface FinAccount {
  id: string;
  name: string;
  kind: "corrente" | "poupanca" | "caixa" | "investimento" | "outro";
  initial_balance: number;
  color: string;
  balance: number;
}
export interface FinCategory {
  id: string;
  name: string;
  kind: "receita" | "despesa" | "transferencia";
  subtype: "fixa" | "variavel" | "imposto" | "pessoa" | null;
  monthly_goal: number | null;
}
export interface FinBase {
  accounts: FinAccount[];
  categories: FinCategory[];
  clients: { id: string; name: string }[];
}

/** Contas (com saldo), categorias e clientes: usados em todas as telas do Financeiro. */
export async function loadFinanceBase(ctx: MemberContext): Promise<FinBase> {
  const supabase = await createClient();
  const [accounts, balances, categories, clients] = await Promise.all([
    supabase.from("fin_accounts").select("id, name, kind, initial_balance, color").eq("agency_id", ctx.agency.id).is("archived_at", null).order("name"),
    supabase.from("fin_account_balances").select("account_id, balance").eq("agency_id", ctx.agency.id),
    supabase.from("fin_categories").select("id, name, kind, subtype, monthly_goal").eq("agency_id", ctx.agency.id).order("name"),
    supabase.from("clients").select("id, name").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
  ]);
  const bal = new Map((balances.data ?? []).map((b) => [b.account_id, Number(b.balance)]));
  return {
    accounts: (accounts.data ?? []).map((a) => ({ ...a, initial_balance: Number(a.initial_balance), balance: bal.get(a.id) ?? Number(a.initial_balance) })),
    categories: (categories.data ?? []).map((c) => ({ ...c, monthly_goal: c.monthly_goal == null ? null : Number(c.monthly_goal) })),
    clients: clients.data ?? [],
  };
}

export interface TxView extends Tx {
  notes: string | null;
  recurrence_id: string | null;
  installment: number | null;
  installments: number | null;
  source: "manual" | "mensalidade";
}

/** Lançamentos com vencimento no intervalo [from, to]. */
export async function loadTransactions(ctx: MemberContext, from: string, to: string): Promise<{ data: TxView[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fin_transactions")
    .select("id, kind, subtype, amount, description, due_date, paid, paid_at, category_id, account_id, to_account_id, client_id, person, notes, recurrence_id, installment, installments, source")
    .eq("agency_id", ctx.agency.id)
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date")
    .limit(5000);
  return { data: (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })), error: !!error };
}
