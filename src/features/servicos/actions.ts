"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { cleanHtml } from "@/lib/html";
import type { ActionResult } from "@/features/configuracoes/actions";
import { serviceSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar a Tabela de Serviços." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "servicos", "editar") ? ctx : null;
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505") return { ok: false, error: "Já existe um serviço com esse nome." };
  return { ok: false, error: authErrorMessage(error) };
}

function refresh() {
  revalidatePath("/servicos");
  revalidatePath("/propostas", "layout");
}

export async function saveService(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Serviço inválido." };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const row = { ...parsed.data, scope_html: cleanHtml(parsed.data.scope_html) };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("services").update(row).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    refresh();
    return { ok: true, data: { id } };
  }
  const { count } = await supabase.from("services").select("id", { count: "exact", head: true }).eq("agency_id", ctx.agency.id);
  const { data, error } = await supabase
    .from("services")
    .insert({ ...row, agency_id: ctx.agency.id, created_by: ctx.userId, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Serviço inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

/** Nova ordem da tabela (lista de ids na ordem desejada). */
export async function reorderServices(ids: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = z.array(uuid).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Ordem inválida." };
  const supabase = await createClient();
  for (const [position, id] of parsed.data.entries()) {
    const { error } = await supabase.from("services").update({ position }).eq("id", id).eq("agency_id", ctx.agency.id);
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}
