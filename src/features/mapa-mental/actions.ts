"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import type { Json } from "@/lib/supabase/database.types";
import { buildMindMap, canvasSchema, mapMetaSchema, mapSchema } from "@/features/canvas/schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = {
  ok: false,
  error: "Você não tem permissão para editar o Mapa Mental.",
};

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "mapa-mental", "editar") ? ctx : null;
}

export async function createMap(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = mapSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const canvas = buildMindMap(parsed.data.template, parsed.data.title);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mind_maps")
    .insert({
      ...parsed.data,
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
      nodes: canvas.nodes as unknown as Json,
      edges: canvas.edges as unknown as Json,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/mapa-mental");
  return { ok: true, data: { id: data.id } };
}

export async function updateMapMeta(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Mapa inválido." };
  const parsed = mapMetaSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mind_maps")
    .update(parsed.data)
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/mapa-mental", "layout");
  return { ok: true };
}

/** Salvamento automático do desenho. */
export async function saveMapCanvas(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Mapa inválido." };
  const parsed = canvasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Desenho inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mind_maps")
    .update({ nodes: parsed.data.nodes as unknown as Json, edges: parsed.data.edges as unknown as Json })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  return { ok: true };
}

export async function deleteMap(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Mapa inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mind_maps")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/mapa-mental");
  return { ok: true };
}
