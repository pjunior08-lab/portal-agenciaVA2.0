"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireAdmin, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { boardNameSchema, columnSchema, labelSchema, linkName, linkSchema, taskSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar demandas." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "demandas", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: authErrorMessage(error as { message?: string }) };
}

function refresh() {
  revalidatePath("/demandas");
  revalidatePath("/meu-dia");
}

// ---------- Quadros ----------
export async function createBoard(name: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = boardNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_board", { a: ctx.agency.id, board_name: parsed.data });
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data } };
}

const boardUpdate = z.object({
  boardId: uuid,
  name: boardNameSchema.optional(),
  card_image: z.enum(["miniatura", "capa", "sem"]).optional(),
});

export async function updateBoard(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = boardUpdate.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { boardId, ...patch } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("boards").update(patch).eq("id", boardId).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Exclui o quadro com todas as demandas. Só administradores. */
export async function deleteBoard(boardId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!uuid.safeParse(boardId).success) return { ok: false, error: "Quadro inválido." };
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("task_attachments")
    .select("path, tasks!inner(board_id)")
    .eq("tasks.board_id", boardId)
    .not("path", "is", null);
  const paths = (files ?? []).map((f) => f.path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("demandas").remove(paths);
  // colunas usam "restrict": apaga as demandas antes do quadro
  const { error: tErr } = await supabase.from("tasks").delete().eq("board_id", boardId).eq("agency_id", ctx.agency.id);
  if (tErr) return fail(tErr);
  const { error } = await supabase.from("boards").delete().eq("id", boardId).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------- Colunas ----------
export async function addColumn(boardId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(boardId).success) return NO_PERMISSION;
  const parsed = columnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("board_columns")
    .insert({ ...parsed.data, board_id: boardId, agency_id: ctx.agency.id, position: (last?.position ?? 0) + 1 });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function updateColumn(columnId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(columnId).success) return NO_PERMISSION;
  const parsed = columnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("board_columns").update(parsed.data).eq("id", columnId).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  // recalcula "concluída" das demandas da coluna (o gatilho roda ao mudar column_id)
  if (parsed.data.is_done) {
    await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("column_id", columnId).is("completed_at", null);
  } else {
    await supabase.from("tasks").update({ completed_at: null }).eq("column_id", columnId);
  }
  refresh();
  return { ok: true };
}

/** Troca a coluna de lugar com a vizinha (esquerda ou direita). */
export async function moveColumn(columnId: string, direction: "left" | "right"): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(columnId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: col } = await supabase.from("board_columns").select("id, board_id, position").eq("id", columnId).single();
  if (!col) return { ok: false, error: "Coluna não encontrada." };
  const q = supabase.from("board_columns").select("id, position").eq("board_id", col.board_id);
  const { data: neighbor } = await (direction === "left"
    ? q.lt("position", col.position).order("position", { ascending: false })
    : q.gt("position", col.position).order("position", { ascending: true })
  )
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };
  const a = await supabase.from("board_columns").update({ position: neighbor.position }).eq("id", col.id);
  const b = await supabase.from("board_columns").update({ position: col.position }).eq("id", neighbor.id);
  if (a.error || b.error) return fail(a.error ?? b.error);
  refresh();
  return { ok: true };
}

export async function deleteColumn(columnId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(columnId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("column_id", columnId);
  if (count) return { ok: false, error: `Esta coluna tem ${count} demanda(s), inclusive arquivadas. Mova-as antes de excluir.` };
  const { error } = await supabase.from("board_columns").delete().eq("id", columnId).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------- Etiquetas ----------
export async function createLabel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = labelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labels")
    .insert({ ...parsed.data, agency_id: ctx.agency.id })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Já existe uma etiqueta com esse nome." };
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

// ---------- Demandas ----------
export async function createTask(boardId: string, input: unknown): Promise<ActionResult<{ id: string; agencyId: string }>> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(boardId).success) return NO_PERMISSION;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { assignees, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", fields.column_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, board_id: boardId, agency_id: ctx.agency.id, created_by: ctx.userId, position: (last?.position ?? 0) + 1000 })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  if (assignees.length) {
    const { error: aErr } = await supabase
      .from("task_assignees")
      .insert(assignees.map((u) => ({ task_id: data.id, user_id: u, agency_id: ctx.agency.id })));
    if (aErr) return fail(aErr);
  }
  refresh();
  return { ok: true, data: { id: data.id, agencyId: ctx.agency.id } };
}

export async function updateTask(taskId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  if (!uuid.safeParse(taskId).success) return NO_PERMISSION;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { assignees, ...fields } = parsed.data;
  const supabase = await createClient();
  // o banco decide: editor do módulo ou responsável pela demanda
  const { data, error } = await supabase.from("tasks").update(fields).eq("id", taskId).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;

  if (memberCan(ctx, "demandas", "editar")) {
    const { data: current } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
    const now = new Set((current ?? []).map((a) => a.user_id));
    const want = new Set(assignees);
    const add = assignees.filter((u) => !now.has(u));
    const remove = [...now].filter((u) => !want.has(u));
    if (remove.length) await supabase.from("task_assignees").delete().eq("task_id", taskId).in("user_id", remove);
    if (add.length) {
      const { error: aErr } = await supabase
        .from("task_assignees")
        .insert(add.map((u) => ({ task_id: taskId, user_id: u, agency_id: ctx.agency.id })));
      if (aErr) return fail(aErr);
    }
  }
  refresh();
  return { ok: true };
}

const moveSchema = z.object({ taskId: uuid, columnId: uuid, position: z.number().finite() });

/** Arrastar no quadro: muda coluna e posição. Editores e responsáveis podem. */
export async function moveTask(input: unknown): Promise<ActionResult> {
  await requireMember();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ column_id: parsed.data.columnId, position: parsed.data.position })
    .eq("id", parsed.data.taskId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Você não pode mover esta demanda." };
  refresh();
  return { ok: true };
}

export async function setTaskArchived(taskId: string, archived: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(taskId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx || !uuid.safeParse(taskId).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: files } = await supabase.from("task_attachments").select("path").eq("task_id", taskId).not("path", "is", null);
  const paths = (files ?? []).map((f) => f.path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("demandas").remove(paths);
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("agency_id", ctx.agency.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------- Anexos ----------
export async function addLink(taskId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  if (!uuid.safeParse(taskId).success) return NO_PERMISSION;
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    agency_id: ctx.agency.id,
    task_id: taskId,
    kind: "link",
    url: parsed.data.url,
    name: parsed.data.name || linkName(parsed.data.url),
    created_by: ctx.userId,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

const fileSchema = z.object({
  taskId: uuid,
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().max(120).nullable(),
});

export async function registerTaskFile(input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { taskId, path, name, size, mime } = parsed.data;
  if (!path.startsWith(`${ctx.agency.id}/${taskId}/`)) return { ok: false, error: "Caminho inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    agency_id: ctx.agency.id,
    task_id: taskId,
    kind: "arquivo",
    path,
    name,
    size_bytes: size,
    mime_type: mime,
    created_by: ctx.userId,
  });
  if (error) {
    await supabase.storage.from("demandas").remove([path]);
    return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  await requireMember();
  if (!uuid.safeParse(id).success) return NO_PERMISSION;
  const supabase = await createClient();
  const { data: att } = await supabase.from("task_attachments").select("path").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("task_attachments").delete().eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Você não pode excluir este anexo." };
  if (att?.path) await supabase.storage.from("demandas").remove([att.path]);
  refresh();
  return { ok: true };
}
