"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { availabilitySchema, checklistSchema, eventSchema, eventTimes } from "./schemas";

const uuid = z.string().uuid();

function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: authErrorMessage(error as { message?: string }) };
}

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/meu-dia");
}

// ---------- Atividades ----------
export async function saveEvent(eventId: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  if (!memberCan(ctx, "agenda")) return { ok: false, error: "Você não tem acesso à Agenda." };
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;
  const { starts_at, ends_at } = eventTimes(v);
  const fields = {
    title: v.title,
    starts_at,
    ends_at,
    all_day: v.all_day,
    client_id: v.client_id,
    visibility: v.visibility,
    location: v.location || null,
    description: v.description,
  };
  const supabase = await createClient();
  let id = eventId;
  if (id) {
    if (!uuid.safeParse(id).success) return { ok: false, error: "Atividade inválida." };
    const { data, error } = await supabase.from("events").update(fields).eq("id", id).select("id, owner_id");
    if (error) return fail(error);
    if (!data?.length) return { ok: false, error: "Você não pode editar esta atividade." };
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...fields, agency_id: ctx.agency.id, owner_id: ctx.userId })
      .select("id")
      .single();
    if (error || !data) return fail(error);
    id = data.id;
  }
  // participantes: substitui a lista (o dono não precisa estar nela)
  const attendees = v.attendees.filter((u) => u !== ctx.userId);
  await supabase.from("event_attendees").delete().eq("event_id", id);
  if (attendees.length) {
    const { error } = await supabase
      .from("event_attendees")
      .insert(attendees.map((u) => ({ event_id: id!, user_id: u, agency_id: ctx.agency.id })));
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function setEventDone(eventId: string, done: boolean): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(eventId).success) return { ok: false, error: "Atividade inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", eventId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Você não pode alterar esta atividade." };
  refresh();
  return { ok: true };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(eventId).success) return { ok: false, error: "Atividade inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Você não pode excluir esta atividade." };
  refresh();
  return { ok: true };
}

// ---------- Disponibilidade (a própria) ----------
export async function saveAvailability(input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Horários inválidos." };
  const supabase = await createClient();
  const { error: delErr } = await supabase.from("availability_rules").delete().eq("user_id", ctx.userId);
  if (delErr) return fail(delErr);
  if (parsed.data.length) {
    const { error } = await supabase
      .from("availability_rules")
      .insert(parsed.data.map((r) => ({ ...r, agency_id: ctx.agency.id, user_id: ctx.userId })));
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}

// ---------- Checklist pessoal ----------
export async function addChecklistItem(input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  const parsed = checklistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .insert({ ...parsed.data, agency_id: ctx.agency.id, user_id: ctx.userId, position: Date.now() });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteChecklistItem(id: string): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}
