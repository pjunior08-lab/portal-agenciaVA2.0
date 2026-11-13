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
  revalidatePath("/clientes", "layout");
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

// ---------- Conexão com a Meta ----------
const linksSchema = z
  .array(z.object({ key: z.string().regex(/^[0-9a-f]{24}$/), client_id: z.union([z.literal(""), z.string().uuid()]) }))
  .max(300);

/** Liga as contas encontradas na Meta aos clientes escolhidos (as sem cliente ficam de fora). */
export async function linkMetaAccounts(input: unknown): Promise<ActionResult<{ linked: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = linksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const links = parsed.data.filter((l) => l.client_id);
  if (!links.length) return { ok: false, error: "Escolha o cliente de pelo menos uma conta." };
  const supabase = await createClient();
  // uma conta que já é de um cliente não muda de dono por aqui (evita post saindo no perfil errado)
  const { data: pending } = await supabase.rpc("social_pending_list", { a: ctx.agency.id });
  for (const l of links) {
    const p = (pending ?? []).find((x) => x.key === l.key);
    if (p?.suggested_client && p.suggested_client !== l.client_id) {
      return { ok: false, error: `“${p.username}” já está ligada a outro cliente. Desconecte no perfil dele antes de trocar.` };
    }
  }
  const { data, error } = await supabase.rpc("social_link_accounts", { a: ctx.agency.id, links });
  if (error) return fail(error);
  if (!data) return { ok: false, error: "A conexão expirou (vale 1 hora). Conecte com a Meta de novo." };
  refresh();
  return { ok: true, data: { linked: data } };
}

export async function disconnectAccount(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Conta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("social_disconnect", { acc: id });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

const clientLinkSchema = z.object({
  client_id: z.string().uuid(),
  instagram: z.union([z.literal(""), z.string().regex(/^[0-9a-f]{24}$/)]),
  facebook: z.union([z.literal(""), z.string().regex(/^[0-9a-f]{24}$/)]),
});

/**
 * Conexão feita no perfil do cliente: no máximo um Instagram e um Facebook, sempre deste cliente.
 * Recusa conta que já é de outro cliente e desliga a conta antiga da mesma rede.
 */
export async function linkClientAccounts(input: unknown): Promise<ActionResult<{ linked: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = clientLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { client_id, instagram, facebook } = parsed.data;
  if (!instagram && !facebook) return { ok: false, error: "Escolha o Instagram ou o Facebook do cliente." };
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("id").eq("id", client_id).eq("agency_id", ctx.agency.id).maybeSingle();
  if (!client) return { ok: false, error: "Cliente não encontrado." };

  const { data: pending, error: listError } = await supabase.rpc("social_pending_list", { a: ctx.agency.id });
  if (listError) return fail(listError);
  const chosen = [
    { key: instagram, network: "instagram" as const },
    { key: facebook, network: "facebook" as const },
  ].filter((c) => c.key);
  for (const c of chosen) {
    const p = (pending ?? []).find((x) => x.key === c.key);
    if (!p) return { ok: false, error: "A conexão expirou (vale 1 hora). Conecte com a Meta de novo." };
    if (p.network !== c.network) return { ok: false, error: "Conta escolhida não é da rede certa." };
    // a mesma conta não pode trocar de cliente sem querer
    if (p.suggested_client && p.suggested_client !== client_id) {
      const { data: other } = await supabase.from("clients").select("name").eq("id", p.suggested_client).maybeSingle();
      return { ok: false, error: `“${p.username}” já está ligada ao cliente ${other?.name ?? "outro cliente"}. Desconecte lá antes.` };
    }
  }

  const { data: linked, error } = await supabase.rpc("social_link_accounts", {
    a: ctx.agency.id,
    links: chosen.map((c) => ({ key: c.key, client_id })),
  });
  if (error) return fail(error);
  if (!linked) return { ok: false, error: "A conexão expirou (vale 1 hora). Conecte com a Meta de novo." };

  // fica só a conta recém-ligada em cada rede: as antigas do mesmo cliente são desconectadas
  for (const c of chosen) {
    const { data: conn } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("client_id", client_id)
      .eq("network", c.network)
      .neq("connection", "manual")
      .order("connected_at", { ascending: false });
    for (const old of (conn ?? []).slice(1)) await supabase.rpc("social_disconnect", { acc: old.id });
  }
  refresh();
  revalidatePath(`/clientes/${client_id}`);
  return { ok: true, data: { linked } };
}
