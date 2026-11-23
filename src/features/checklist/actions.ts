"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import type { Json } from "@/lib/supabase/database.types";
import { linesToItems, newItems, parseItems, SUGGESTED_TEMPLATES, templateSchema, type ChecklistItem } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para isso." };

async function templateEditor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "checklist", "editar") ? ctx : null;
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505") return { ok: false, error: "Já existe um modelo com esse nome." };
  if (error?.code === "42501") return NO_PERMISSION;
  return { ok: false, error: authErrorMessage(error) };
}

// ---------- Modelos ----------
export async function saveTemplate(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await templateEditor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { items_text, ...v } = parsed.data;
  const row = { ...v, items: items_text as unknown as Json };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("checklist_templates").update(row).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    revalidatePath("/checklist");
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ ...row, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  revalidatePath("/checklist");
  return { ok: true, data: { id: data.id } };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const ctx = await templateEditor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_templates").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/checklist");
  return { ok: true };
}

/** Cria os modelos sugeridos que ainda não existem (pelo nome). */
export async function createSuggestedTemplates(): Promise<ActionResult<{ created: number }>> {
  const ctx = await templateEditor();
  if (!ctx) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("checklist_templates").select("name").eq("agency_id", ctx.agency.id);
  const have = new Set((existing ?? []).map((t) => t.name.trim().toLowerCase()));
  const rows = SUGGESTED_TEMPLATES.filter((t) => !have.has(t.name.toLowerCase())).map((t) => ({
    agency_id: ctx.agency.id,
    created_by: ctx.userId,
    name: t.name,
    description: t.description,
    applies_to: t.applies_to,
    items: t.items as unknown as Json,
  }));
  if (rows.length) {
    const { error } = await supabase.from("checklist_templates").insert(rows);
    if (error) return fail(error);
  }
  revalidatePath("/checklist");
  return { ok: true, data: { created: rows.length } };
}

// ---------- Checklists aplicados ----------
const targetSchema = z.union([z.object({ task_id: uuid }), z.object({ client_id: uuid })]);

export interface ChecklistView {
  id: string;
  name: string;
  items: ChecklistItem[];
}

/** Checklists de uma demanda ou de um cliente, mais os modelos disponíveis para aplicar. */
export async function loadChecklists(target: unknown): Promise<
  ActionResult<{ lists: ChecklistView[]; templates: { id: string; name: string; applies_to: string }[]; people: Record<string, string> }>
> {
  const ctx = await requireMember();
  const t = targetSchema.safeParse(target);
  if (!t.success) return { ok: false, error: "Destino inválido." };
  const supabase = await createClient();
  const q = supabase.from("checklists").select("id, name, items, created_at").eq("agency_id", ctx.agency.id).order("created_at");
  const [lists, templates] = await Promise.all([
    "task_id" in t.data ? q.eq("task_id", t.data.task_id) : q.eq("client_id", t.data.client_id),
    supabase.from("checklist_templates").select("id, name, applies_to").eq("agency_id", ctx.agency.id).order("name"),
  ]);
  if (lists.error) return fail(lists.error);
  const views = (lists.data ?? []).map((l) => ({ id: l.id, name: l.name, items: parseItems(l.items) }));
  // nomes de quem marcou, para mostrar "feito por"
  const ids = [...new Set(views.flatMap((v) => v.items.map((i) => i.done_by)).filter((x): x is string => !!x))];
  const people: Record<string, string> = {};
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of data ?? []) people[p.id] = p.full_name ?? "";
  }
  return { ok: true, data: { lists: views, templates: templates.data ?? [], people } };
}

export async function applyChecklist(target: unknown, templateId: string): Promise<ActionResult> {
  const ctx = await requireMember();
  const t = targetSchema.safeParse(target);
  if (!t.success || !uuid.safeParse(templateId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: tpl } = await supabase.from("checklist_templates").select("id, name, items").eq("id", templateId).eq("agency_id", ctx.agency.id).maybeSingle();
  if (!tpl) return { ok: false, error: "Modelo não encontrado." };
  const texts = Array.isArray(tpl.items) ? (tpl.items as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const { error } = await supabase.from("checklists").insert({
    agency_id: ctx.agency.id,
    template_id: tpl.id,
    name: tpl.name,
    ...t.data,
    items: newItems(texts) as unknown as Json,
    created_by: ctx.userId,
  });
  if (error) return fail(error);
  return { ok: true };
}

/** Checklist avulso (sem modelo), um item por linha. */
export async function createChecklist(target: unknown, name: string, itemsText: string): Promise<ActionResult> {
  const ctx = await requireMember();
  const t = targetSchema.safeParse(target);
  const n = z.string().trim().min(1, "Dê um nome.").max(120).safeParse(name);
  const texts = linesToItems(itemsText).map((x) => x.slice(0, 200)).slice(0, 60);
  if (!t.success) return { ok: false, error: "Destino inválido." };
  if (!n.success) return { ok: false, error: "Dê um nome ao checklist." };
  if (!texts.length) return { ok: false, error: "Escreva ao menos um item." };
  const supabase = await createClient();
  const { error } = await supabase.from("checklists").insert({
    agency_id: ctx.agency.id,
    name: n.data,
    ...t.data,
    items: newItems(texts) as unknown as Json,
    created_by: ctx.userId,
  });
  if (error) return fail(error);
  return { ok: true };
}

/** Marca ou desmarca um item (lê a versão atual antes, para não perder marcações de outra pessoa). */
export async function toggleChecklistItem(id: string, index: number, done: boolean): Promise<ActionResult<{ items: ChecklistItem[] }>> {
  const ctx = await requireMember();
  if (!uuid.safeParse(id).success || !Number.isInteger(index) || index < 0 || index >= 60) return { ok: false, error: "Item inválido." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("checklists").select("items").eq("id", id).eq("agency_id", ctx.agency.id).maybeSingle();
  if (!row) return NO_PERMISSION;
  const items = parseItems(row.items);
  if (!items[index]) return { ok: false, error: "Item não encontrado." };
  items[index] = done
    ? { ...items[index], done: true, done_by: ctx.userId, done_at: new Date().toISOString() }
    : { ...items[index], done: false, done_by: null, done_at: null };
  const { data, error } = await supabase
    .from("checklists")
    .update({ items: items as unknown as Json })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  return { ok: true, data: { items } };
}

export async function deleteChecklist(id: string): Promise<ActionResult> {
  const ctx = await requireMember();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Checklist inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklists").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  return { ok: true };
}
