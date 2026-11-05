"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { captionTemplateSchema, decisionSchema, postSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar aprovações." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "aprovacoes", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: authErrorMessage(error as { message?: string }) };
}

function refresh() {
  revalidatePath("/aprovacoes");
  revalidatePath("/meu-dia");
  revalidatePath("/social");
  revalidatePath("/portal", "layout");
}

// ---------- Envios ----------
export async function savePost(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Envio inválido." };
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("posts")
      .update({
        client_id: v.client_id,
        task_id: v.task_id,
        title: v.title,
        caption: v.caption,
        mode: v.mode,
        publish_mode: v.publish_mode,
        networks: v.networks,
        scheduled_at: v.scheduled_at,
      })
      .eq("id", id)
      .eq("agency_id", ctx.agency.id)
      .select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    refresh();
    return { ok: true, data: { id } };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ agency_id: ctx.agency.id, created_by: ctx.userId, ...v })
    .select("id, round")
    .single();
  if (error || !data) return fail(error);
  await supabase.from("approval_events").insert({
    agency_id: ctx.agency.id,
    post_id: data.id,
    actor_id: ctx.userId,
    actor_side: "equipe",
    event: "enviado",
    round: data.round,
  });
  refresh();
  return { ok: true, data: { id: data.id } };
}

/** Depois da decisão do cliente, reenvia o mesmo envio numa nova rodada. */
export async function resendPost(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Envio inválido." };
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("status, round").eq("id", id).maybeSingle();
  if (!post) return { ok: false, error: "Envio não encontrado." };
  if (post.status === "enviado" || post.status === "em_analise") return { ok: false, error: "O cliente ainda não decidiu este envio." };
  const round = post.round + 1;
  const { error } = await supabase
    .from("posts")
    .update({ status: "enviado", theme_decision: null, media_decision: null, caption_decision: null, decided_at: null, round })
    .eq("id", id);
  if (error) return fail(error);
  await supabase.from("approval_events").insert({
    agency_id: ctx.agency.id,
    post_id: id,
    actor_id: ctx.userId,
    actor_side: "equipe",
    event: "reenviado",
    round,
  });
  refresh();
  return { ok: true };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Envio inválido." };
  const supabase = await createClient();
  const { data: media } = await supabase.from("post_media").select("path").eq("post_id", id);
  const { data, error } = await supabase.from("posts").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  const paths = (media ?? []).map((m) => m.path);
  if (paths.length) await supabase.storage.from("aprovacoes").remove(paths);
  refresh();
  return { ok: true };
}

// ---------- Mídias (o navegador envia o arquivo; aqui só registra) ----------
const mediaSchema = z.object({
  postId: uuid,
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0),
  mime: z.string().max(200).nullable(),
});

export async function registerPostMedia(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { postId, path, name, size, mime } = parsed.data;
  if (!path.startsWith(`${ctx.agency.id}/${postId}/`)) return { ok: false, error: "Caminho inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("post_media").insert({
    agency_id: ctx.agency.id,
    post_id: postId,
    path,
    name,
    size_bytes: size,
    mime_type: mime,
    position: Date.now(),
  });
  if (error) {
    await supabase.storage.from("aprovacoes").remove([path]);
    return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function deletePostMedia(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Arquivo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("post_media").delete().eq("id", id).select("path");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  await supabase.storage.from("aprovacoes").remove(data.map((d) => d.path));
  refresh();
  return { ok: true };
}

/** Programação "a equipe agenda": leva o post aprovado para o calendário do Social. */
export async function schedulePost(id: string): Promise<ActionResult> {
  const ctx = await requireMember();
  if (!memberCan(ctx, "social", "editar")) return { ok: false, error: "Você não tem permissão para agendar no Social." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Envio inválido." };
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("posts")
    .select("client_id, title, caption, networks, scheduled_at, status, kind")
    .eq("id", id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Envio não encontrado." };
  if (p.kind !== "post" || p.status !== "aprovado") return { ok: false, error: "Só posts aprovados vão para o calendário." };
  if (!p.scheduled_at || !p.networks.length) return { ok: false, error: "Defina a data e a rede no post antes de agendar." };
  const { error } = await supabase.from("social_publications").insert({
    agency_id: ctx.agency.id,
    client_id: p.client_id,
    post_id: id,
    network: p.networks[0],
    title: p.title,
    caption: p.caption,
    scheduled_at: p.scheduled_at,
    created_by: ctx.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Este post já está no calendário." };
    return fail(error);
  }
  refresh();
  return { ok: true };
}

// ---------- Legendas padrão ----------
export async function createCaptionTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = captionTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("caption_templates")
    .insert({ agency_id: ctx.agency.id, created_by: ctx.userId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  revalidatePath("/aprovacoes");
  return { ok: true, data: { id: data.id } };
}

export async function deleteCaptionTemplate(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Legenda inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("caption_templates").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/aprovacoes");
  return { ok: true };
}

// ---------- Cliente no portal ----------
/** Registra que o cliente abriu o envio ("Cliente analisando"). O banco confere o acesso. */
export async function clientOpenPost(id: string): Promise<ActionResult> {
  if (!(await getUser())) return { ok: false, error: "Entre novamente." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Envio inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_open_post", { p: id });
  if (error) return fail(error);
  return { ok: true };
}

export async function clientDecide(input: unknown): Promise<ActionResult> {
  if (!(await getUser())) return { ok: false, error: "Entre novamente." };
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { postId, part, decision, comment } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_decide_post", { p: postId, part, decision, comment: comment || null });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}
