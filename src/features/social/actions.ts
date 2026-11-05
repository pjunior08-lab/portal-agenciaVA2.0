"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { accountSchema, publicationSchema } from "@/features/aprovacoes/schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar o Social." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "social", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505") return { ok: false, error: "Esta conta já está cadastrada para o cliente." };
  return { ok: false, error: authErrorMessage(error) };
}

function refresh() {
  revalidatePath("/social");
  revalidatePath("/aprovacoes");
  revalidatePath("/portal", "layout");
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
    ? await supabase.from("social_accounts").update(parsed.data).eq("id", id).eq("agency_id", ctx.agency.id)
    : await supabase.from("social_accounts").insert({ agency_id: ctx.agency.id, created_by: ctx.userId, ...parsed.data });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Conta inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_accounts").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

// ---------- Agendamentos ----------
export async function savePublication(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Agendamento inválido." };
  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("social_publications").update(parsed.data).eq("id", id).eq("agency_id", ctx.agency.id).select("id")
    : await supabase
        .from("social_publications")
        .insert({ agency_id: ctx.agency.id, created_by: ctx.userId, ...parsed.data })
        .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function setPublicationStatus(id: string, status: "agendado" | "publicado" | "cancelado"): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success || !["agendado", "publicado", "cancelado"].includes(status)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_publications").update({ status }).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function deletePublication(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Agendamento inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_publications").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}
