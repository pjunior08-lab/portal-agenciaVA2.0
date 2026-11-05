"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  agencySchema,
  inviteSchema,
  memberAccessSchema,
  memberRoleSchema,
  memberStatusSchema,
  profileSchema,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

/** Atualiza os dados do próprio usuário. */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", ctx.userId);
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Atualiza os dados da agência (só administradores; o banco também confere). */
export async function updateAgency(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = agencySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("agencies").update(parsed.data).eq("id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cria convite e devolve o link para o administrador copiar e enviar. */
export async function createInvitation(input: unknown): Promise<ActionResult<{ link: string }>> {
  const ctx = await requireAdmin();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    a: ctx.agency.id,
    invite_email: parsed.data.email,
    invite_role: parsed.data.role,
    access: parsed.data.role === "admin" ? [] : parsed.data.access,
  });
  if (error || !token) return { ok: false, error: authErrorMessage(error) };
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  revalidatePath("/configuracoes");
  return { ok: true, data: { link: `${origin}/convite/${token}` } };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function updateMemberRole(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_members")
    .update({ role: parsed.data.role })
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateMemberStatus(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = memberStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_members")
    .update({ status: parsed.data.status })
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Substitui todos os acessos por módulo de um colaborador. */
export async function setMemberAccess(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = memberAccessSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { userId, access } = parsed.data;
  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("member_module_access")
    .delete()
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  if (delError) return { ok: false, error: authErrorMessage(delError) };

  if (access.length) {
    const { error } = await supabase
      .from("member_module_access")
      .insert(access.map((a) => ({ agency_id: ctx.agency.id, user_id: userId, module: a.module, level: a.level })));
    if (error) return { ok: false, error: authErrorMessage(error) };
  }
  revalidatePath("/configuracoes");
  return { ok: true };
}
