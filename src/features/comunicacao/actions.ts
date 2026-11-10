"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireMember, requireUser } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { groupSchema, messageSchema, type ChatMessage } from "./schemas";

const uuid = z.string().uuid();
const MSG_COLUMNS = "id, conversation_id, author_id, author_name, body, created_at, deleted_at";

/** Envia mensagem. Serve para a equipe e para o cliente no Portal (o banco confere quem pode escrever). */
export async function sendMessage(
  conversationId: string,
  input: unknown,
): Promise<ActionResult<ChatMessage>> {
  const user = await requireUser();
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: "Conversa inválida." };
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: conversationId, author_id: user.id, body: parsed.data.body })
    .select(MSG_COLUMNS)
    .single();
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true, data };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Mensagem inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("author_id", user.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Só dá para apagar as próprias mensagens." };
  return { ok: true };
}

export async function markRead(conversationId: string): Promise<void> {
  // chamada em segundo plano: sem sessão, só não marca (não redireciona)
  if (!(await getUser()) || !uuid.safeParse(conversationId).success) return;
  const supabase = await createClient();
  await supabase.rpc("chat_mark_read", { conv: conversationId });
}

/** Mensagens anteriores a uma data (para "carregar mais"). */
export async function loadOlder(
  conversationId: string,
  before: string,
): Promise<ActionResult<ChatMessage[]>> {
  await requireUser();
  if (!uuid.safeParse(conversationId).success || Number.isNaN(Date.parse(before)))
    return { ok: false, error: "Pedido inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select(MSG_COLUMNS)
    .eq("conversation_id", conversationId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true, data: (data ?? []).reverse() };
}

export async function openDirect(otherId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();
  if (!uuid.safeParse(otherId).success) return { ok: false, error: "Pessoa inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_open_direct", { a: ctx.agency.id, other: otherId });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/comunicacao");
  return { ok: true, data: { id: data } };
}

export async function saveGroup(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Grupo inválido." };
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_save_group", {
    a: ctx.agency.id,
    conv: id,
    group_name: parsed.data.name,
    members: parsed.data.members,
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/comunicacao");
  return { ok: true, data: { id: data } };
}

export async function leaveGroup(id: string): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Grupo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_leave_group", { conv: id });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/comunicacao");
  return { ok: true };
}

export async function openClientConversation(clientId: string): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  if (!uuid.safeParse(clientId).success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_client_conversation", { c: clientId });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/comunicacao");
  return { ok: true, data: { id: data } };
}
