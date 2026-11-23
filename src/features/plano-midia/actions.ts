"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { campaignSchema, spentSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar o Plano de Mídia." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "plano-de-midia", "editar") ? ctx : null;
}

export async function saveCampaign(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Campanha inválida." };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("media_campaigns").update(parsed.data).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return { ok: false, error: authErrorMessage(error) };
    if (!data?.length) return NO_PERMISSION;
    revalidatePath("/plano-de-midia");
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase
    .from("media_campaigns")
    .insert({ ...parsed.data, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/plano-de-midia");
  return { ok: true, data: { id: data.id } };
}

/** Atualiza só o investido (o uso mais comum no dia a dia). */
export async function updateSpent(id: string, value: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = spentSchema.safeParse(value);
  if (!uuid.safeParse(id).success || !parsed.success) return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_campaigns").update({ spent: parsed.data }).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/plano-de-midia");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Campanha inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_campaigns").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/plano-de-midia");
  return { ok: true };
}
