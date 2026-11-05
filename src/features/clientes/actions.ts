"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireAdmin, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import {
  clientInviteSchema,
  clientSchema,
  noteSchema,
  portalSchema,
  strategySchema,
} from "./schemas";

const uuid = z.string().uuid();

async function requireEditor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "clientes", "editar") ? ctx : null;
}

const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar clientes." };

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function refresh(clientId?: string) {
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

/** Confere que o cliente pertence à agência de quem chama (o banco também confere). */
async function ownClient(ctx: MemberContext, clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("agency_id", ctx.agency.id).maybeSingle();
  return !!data;
}

export async function createClientAction(input: unknown): Promise<ActionResult<{ id: string; agencyId: string }>> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: authErrorMessage(error) };
  refresh();
  return { ok: true, data: { id: data.id, agencyId: ctx.agency.id } };
}

export async function updateClientAction(clientId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(clientId).success) return NO_PERMISSION;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", clientId).eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

/** Exclui o cliente e tudo dele (anotações, arquivos, portal). Só administradores. */
export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!uuid.safeParse(clientId).success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  // remove os arquivos do Storage antes de apagar as linhas
  for (const folder of ["arquivos", "logo"]) {
    const prefix = `${ctx.agency.id}/${clientId}/${folder}`;
    const { data: objs } = await supabase.storage.from("clientes").list(prefix, { limit: 1000 });
    if (objs?.length) await supabase.storage.from("clientes").remove(objs.map((o) => `${prefix}/${o.name}`));
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh();
  return { ok: true };
}

const logoSchema = z.object({
  clientId: uuid,
  variant: z.enum(["light", "dark"]),
  path: z.string().nullable(),
});

/** Grava o caminho do logo (o arquivo já foi enviado pelo navegador) e apaga o anterior. */
export async function setClientLogo(input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = logoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { clientId, variant, path } = parsed.data;
  if (path && !path.startsWith(`${ctx.agency.id}/${clientId}/logo/`)) return { ok: false, error: "Caminho inválido." };
  const supabase = await createClient();
  const column = variant === "light" ? "logo_light_path" : "logo_dark_path";
  const { data: before } = await supabase.from("clients").select(column).eq("id", clientId).maybeSingle();
  const patch = variant === "light" ? { logo_light_path: path } : { logo_dark_path: path };
  const { error } = await supabase.from("clients").update(patch).eq("id", clientId).eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  const old = (before as Record<string, string | null> | null)?.[column];
  if (old && old !== path) await supabase.storage.from("clientes").remove([old]);
  refresh(clientId);
  return { ok: true };
}

// ---------- Anotações ----------
export async function addNote(input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({
    agency_id: ctx.agency.id,
    client_id: parsed.data.clientId,
    body: parsed.data.body,
    shared_with_client: parsed.data.shared,
    author_id: ctx.userId,
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(parsed.data.clientId);
  return { ok: true };
}

export async function setNoteShared(noteId: string, clientId: string, shared: boolean): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(noteId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_notes")
    .update({ shared_with_client: shared })
    .eq("id", noteId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

export async function deleteNote(noteId: string, clientId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(noteId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").delete().eq("id", noteId).eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

// ---------- Arquivos ----------
const fileSchema = z.object({
  clientId: uuid,
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().max(120).nullable(),
});

/** Registra um arquivo que o navegador já enviou ao Storage. */
export async function registerFile(input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { clientId, path, name, size, mime } = parsed.data;
  if (!path.startsWith(`${ctx.agency.id}/${clientId}/arquivos/`)) return { ok: false, error: "Caminho inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_files").insert({
    agency_id: ctx.agency.id,
    client_id: clientId,
    path,
    name,
    size_bytes: size,
    mime_type: mime,
    uploaded_by: ctx.userId,
  });
  if (error) {
    await supabase.storage.from("clientes").remove([path]);
    return { ok: false, error: authErrorMessage(error) };
  }
  refresh(clientId);
  return { ok: true };
}

export async function setFileShared(fileId: string, clientId: string, shared: boolean): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(fileId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_files")
    .update({ shared_with_client: shared })
    .eq("id", fileId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

export async function deleteFile(fileId: string, clientId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(fileId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: file } = await supabase.from("client_files").select("path").eq("id", fileId).maybeSingle();
  if (!file) return { ok: false, error: "Arquivo não encontrado." };
  const { error: sErr } = await supabase.storage.from("clientes").remove([file.path]);
  if (sErr) return { ok: false, error: authErrorMessage(sErr) };
  const { error } = await supabase.from("client_files").delete().eq("id", fileId);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

// ---------- Central Estratégica ----------
export async function saveStrategy(input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = strategySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { clientId, ...fields } = parsed.data;
  if (!(await ownClient(ctx, clientId))) return { ok: false, error: "Cliente não encontrado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_strategy")
    .upsert({ client_id: clientId, agency_id: ctx.agency.id, ...fields, updated_by: ctx.userId }, { onConflict: "client_id" });
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function shareStrategy(clientId: string): Promise<ActionResult<{ link: string }>> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(clientId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_client_strategy", { c: clientId });
  if (error || !data) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true, data: { link: `${await origin()}/e/${data}` } };
}

export async function unshareStrategy(clientId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(clientId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase.rpc("unshare_client_strategy", { c: clientId });
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

// ---------- Portal do Cliente ----------
export async function savePortal(input: unknown): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = portalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { clientId, ...fields } = parsed.data;
  if (!(await ownClient(ctx, clientId))) return { ok: false, error: "Cliente não encontrado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_portal")
    .upsert({ client_id: clientId, agency_id: ctx.agency.id, ...fields }, { onConflict: "client_id" });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esse endereço já está em uso por outro cliente.", fieldErrors: { slug: ["Endereço em uso."] } };
    return { ok: false, error: authErrorMessage(error) };
  }
  refresh(clientId);
  return { ok: true };
}

export async function inviteClientUser(input: unknown): Promise<ActionResult<{ link: string }>> {
  const ctx = await requireEditor();
  if (!ctx) return NO_PERMISSION;
  const parsed = clientInviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_client_invitation", {
    c: parsed.data.clientId,
    invite_email: parsed.data.email,
  });
  if (error || !data) return { ok: false, error: authErrorMessage(error) };
  refresh(parsed.data.clientId);
  return { ok: true, data: { link: `${await origin()}/portal-convite/${data}` } };
}

export async function revokeClientInvitation(id: string, clientId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(id).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}

export async function setClientUserStatus(clientId: string, userId: string, status: "ativo" | "desativado"): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx || !uuid.safeParse(userId).success || !uuid.safeParse(clientId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_users")
    .update({ status })
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh(clientId);
  return { ok: true };
}
