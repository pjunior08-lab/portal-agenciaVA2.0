"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import type { Json } from "@/lib/supabase/database.types";
import {
  buildFunnel,
  canvasSchema,
  folderSchema,
  funnelMetaSchema,
  funnelSchema,
} from "@/features/canvas/schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = {
  ok: false,
  error: "Você não tem permissão para editar os Funis.",
};

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "funil", "editar") ? ctx : null;
}
function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505") return { ok: false, error: "Já existe uma pasta com esse nome." };
  return { ok: false, error: authErrorMessage(error) };
}
const refresh = () => revalidatePath("/funil", "layout");

export async function createFunnel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = funnelSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const canvas = buildFunnel(parsed.data.template);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .insert({
      ...parsed.data,
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
      nodes: canvas.nodes as unknown as Json,
      edges: canvas.edges as unknown as Json,
    })
    .select("id")
    .single();
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function updateFunnelMeta(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Funil inválido." };
  const parsed = funnelMetaSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .update(parsed.data)
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

/** Salvamento automático do desenho (funil na lixeira não é alterado). */
export async function saveFunnelCanvas(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Funil inválido." };
  const parsed = canvasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Desenho inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .update({ nodes: parsed.data.nodes as unknown as Json, edges: parsed.data.edges as unknown as Json })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Funil na lixeira ou sem permissão." };
  return { ok: true };
}

async function setTrash(id: string, trashed: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Funil inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .update({ deleted_at: trashed ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}
export async function trashFunnel(id: string) {
  return setTrash(id, true);
}
export async function restoreFunnel(id: string) {
  return setTrash(id, false);
}

/** Exclui de vez — só o que já está na lixeira. */
export async function deleteFunnelForever(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Funil inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Mande para a lixeira antes de excluir de vez." };
  refresh();
  return { ok: true };
}

export async function emptyTrash(): Promise<ActionResult<{ count: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .delete()
    .eq("agency_id", ctx.agency.id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { count: data?.length ?? 0 } };
}

export async function saveFolder(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Pasta inválida." };
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nome inválido." };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("funnel_folders")
        .update(parsed.data)
        .eq("id", id)
        .eq("agency_id", ctx.agency.id)
        .select("id")
    : await supabase
        .from("funnel_folders")
        .insert({ ...parsed.data, agency_id: ctx.agency.id })
        .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true, data: { id: data[0].id } };
}

/** Apaga a pasta; os funis dela ficam "Sem pasta". */
export async function deleteFolder(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Pasta inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnel_folders")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}
