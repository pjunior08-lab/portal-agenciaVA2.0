"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { SUGGESTED_CATEGORIES, accountSchema, categorySchema, expandOccurrences, transactionSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar o Financeiro." };
const scopeSchema = z.enum(["um", "proximos"]);

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "financeiro", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23503") return { ok: false, error: "Está em uso por lançamentos e não pode ser excluído." };
  if (error?.code === "23505") return { ok: false, error: "Já existe um cadastro com este nome." };
  return { ok: false, error: authErrorMessage(error) };
}

function refresh() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/clientes", "layout");
  revalidatePath("/portal", "layout");
}

// ---------- Lançamentos ----------
export async function createTransaction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { repeat, installments, amount, description, due_date, ...v } = parsed.data;
  const occurrences = expandOccurrences({ amount, description, due_date, repeat, installments });
  const recurrence_id = occurrences.length > 1 ? crypto.randomUUID() : null;
  const supabase = await createClient();
  const { error } = await supabase.from("fin_transactions").insert(
    occurrences.map((o, i) => ({
      ...v,
      ...o,
      // só o primeiro herda o "já foi pago"; os seguintes nascem em aberto
      paid: v.kind === "transferencia" ? true : i === 0 ? v.paid : false,
      recurrence_id,
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
    })),
  );
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { count: occurrences.length } };
}

/** Edita um lançamento; com "proximos", aplica os mesmos dados (menos a data) aos seguintes da série. */
export async function updateTransaction(id: string, input: unknown, scope: unknown = "um"): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const sc = scopeSchema.safeParse(scope);
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success || !sc.success) return parsed.success ? { ok: false, error: "Dados inválidos." } : invalid(parsed.error);
  const { repeat: _r, installments: _i, ...v } = parsed.data;
  void _r;
  void _i;
  const supabase = await createClient();
  const { data: cur } = await supabase.from("fin_transactions").select("recurrence_id, due_date, installment").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "Lançamento não encontrado." };

  const { data, error } = await supabase.from("fin_transactions").update(v).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;

  if (sc.data === "proximos" && cur.recurrence_id) {
    // parcelas mantêm a própria descrição numerada e o valor; o resto acompanha
    const { amount, description, due_date: _d, paid: _p, ...shared } = v;
    void _d;
    void _p;
    const rest = cur.installment ? shared : { ...shared, amount, description };
    const { error: e2 } = await supabase
      .from("fin_transactions")
      .update(rest)
      .eq("recurrence_id", cur.recurrence_id)
      .gt("due_date", cur.due_date)
      .eq("paid", false);
    if (e2) return fail(e2);
  }
  refresh();
  return { ok: true };
}

export async function deleteTransaction(id: string, scope: unknown = "um"): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const sc = scopeSchema.safeParse(scope);
  if (!sc.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("fin_transactions").select("recurrence_id, due_date").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "Lançamento não encontrado." };
  const { error } = await supabase.from("fin_transactions").delete().eq("id", id).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  if (sc.data === "proximos" && cur.recurrence_id) {
    // apaga os seguintes ainda em aberto (os já pagos ficam como registro)
    const { error: e2 } = await supabase
      .from("fin_transactions")
      .delete()
      .eq("recurrence_id", cur.recurrence_id)
      .gt("due_date", cur.due_date)
      .eq("paid", false);
    if (e2) return fail(e2);
  }
  refresh();
  return { ok: true };
}

export async function setPaid(id: string, paid: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success || typeof paid !== "boolean") return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fin_transactions")
    .update({ paid, paid_at: null })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .neq("kind", "transferencia")
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

/** Lança as mensalidades do mês dos clientes ativos (sem duplicar). */
export async function generateMonthlyFees(month: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Mês inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_fees", { a: ctx.agency.id, month: `${month}-01` });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { count: data ?? 0 } };
}

// ---------- Contas ----------
export async function saveAccount(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Conta inválida." };
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("fin_accounts").update(parsed.data).eq("id", id).eq("agency_id", ctx.agency.id)
    : await supabase.from("fin_accounts").insert({ ...parsed.data, agency_id: ctx.agency.id, created_by: ctx.userId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Conta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("fin_accounts").delete().eq("id", id).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------- Categorias ----------
export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Categoria inválida." };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = { ...parsed.data, subtype: parsed.data.kind === "despesa" ? parsed.data.subtype : null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("fin_categories").update(row).eq("id", id).eq("agency_id", ctx.agency.id)
    : await supabase.from("fin_categories").insert({ ...row, agency_id: ctx.agency.id });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Categoria inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("fin_categories").delete().eq("id", id).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Cria as categorias sugeridas que ainda não existem. */
export async function createSuggestedCategories(): Promise<ActionResult<{ count: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("fin_categories").select("kind, name").eq("agency_id", ctx.agency.id);
  const has = new Set((existing ?? []).map((c) => `${c.kind}:${c.name.toLowerCase()}`));
  const rows = SUGGESTED_CATEGORIES.filter((c) => !has.has(`${c.kind}:${c.name.toLowerCase()}`)).map((c) => ({ ...c, agency_id: ctx.agency.id }));
  if (rows.length) {
    const { error } = await supabase.from("fin_categories").insert(rows);
    if (error) return fail(error);
  }
  refresh();
  return { ok: true, data: { count: rows.length } };
}
