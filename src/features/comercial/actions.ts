"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import type { Database } from "@/lib/supabase/database.types";
import {
  activitySchema,
  fieldKey,
  fieldSchema,
  importSchema,
  opportunitySchema,
  settingsSchema,
  templateSchema,
} from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = {
  ok: false,
  error: "Você não tem permissão para editar o Comercial.",
};
const stageSchema = z.enum([
  "novo_lead",
  "contato_feito",
  "orcamento",
  "proposta",
  "negociacao",
  "fechado",
  "perdido",
]);

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "comercial", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505")
    return { ok: false, error: "Já existe uma oportunidade com este CNPJ/CPF ou um cadastro com este nome." };
  return { ok: false, error: authErrorMessage(error) };
}

function refresh() {
  revalidatePath("/comercial", "layout");
}

/** Próxima posição no fim da coluna. */
async function nextPosition(agencyId: string, stage: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_opportunities")
    .select("position")
    .eq("agency_id", agencyId)
    .eq("stage", stage as never)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? 0) + 1024;
}

// ---------- Oportunidades ----------
export async function saveOpportunity(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Oportunidade inválida." };
  const parsed = opportunitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = { ...parsed.data, lost_reason: parsed.data.stage === "perdido" ? parsed.data.lost_reason : null };
  const supabase = await createClient();

  if (id) {
    const { data: cur } = await supabase.from("crm_opportunities").select("stage").eq("id", id).maybeSingle();
    if (!cur) return { ok: false, error: "Oportunidade não encontrada." };
    const position = cur.stage === v.stage ? undefined : await nextPosition(ctx.agency.id, v.stage);
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update({ ...v, ...(position === undefined ? {} : { position }) })
      .eq("id", id)
      .eq("agency_id", ctx.agency.id)
      .select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    refresh();
    return { ok: true, data: { id } };
  }

  const { data, error } = await supabase
    .from("crm_opportunities")
    .insert({
      ...v,
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
      position: await nextPosition(ctx.agency.id, v.stage),
    })
    .select("id")
    .single();
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

/** Arrastar no quadro: troca de etapa e/ou posição. Perder exige motivo. */
export async function moveOpportunity(
  id: string,
  stage: unknown,
  position: unknown,
  lostReason?: unknown,
): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const s = stageSchema.safeParse(stage);
  const p = z.number().finite().safeParse(position);
  const r = z
    .string()
    .trim()
    .max(200)
    .optional()
    .safeParse(lostReason ?? undefined);
  if (!uuid.safeParse(id).success || !s.success || !p.success || !r.success)
    return { ok: false, error: "Movimento inválido." };
  if (s.data === "perdido" && !r.data) return { ok: false, error: "Informe o motivo da perda." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_opportunities")
    .update({ stage: s.data, position: p.data, ...(s.data === "perdido" ? { lost_reason: r.data } : {}) })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Oportunidade inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_opportunities")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

/** Registra contato ou anotação; o banco atualiza último contato, tentativas e cadência. */
export async function addActivity(opportunityId: string, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(opportunityId).success) return { ok: false, error: "Oportunidade inválida." };
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("crm_activities").insert({
    ...parsed.data,
    opportunity_id: opportunityId,
    agency_id: ctx.agency.id,
    author_id: ctx.userId,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------- Meta e configurações ----------
export async function saveGoal(month: unknown, newClients: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const m = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .safeParse(month);
  const n = z.coerce.number().int().min(1, "Mínimo 1.").max(10000).safeParse(newClients);
  if (!m.success) return { ok: false, error: "Mês inválido." };
  if (!n.success)
    return {
      ok: false,
      error: "Informe um número entre 1 e 10.000.",
      fieldErrors: { new_clients: ["Informe um número entre 1 e 10.000."] },
    };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_goals")
    .upsert(
      { agency_id: ctx.agency.id, month: `${m.data}-01`, new_clients: n.data },
      { onConflict: "agency_id,month" },
    );
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_settings")
    .upsert({ agency_id: ctx.agency.id, ...parsed.data }, { onConflict: "agency_id" });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function saveField(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Campo inválido." };
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = { ...parsed.data, options: parsed.data.type === "opcoes" ? parsed.data.options : [] };
  const supabase = await createClient();
  if (id) {
    // a chave não muda, para não perder os valores já preenchidos
    const { data, error } = await supabase
      .from("crm_custom_fields")
      .update(v)
      .eq("id", id)
      .eq("agency_id", ctx.agency.id)
      .select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
  } else {
    const { count } = await supabase
      .from("crm_custom_fields")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", ctx.agency.id);
    const { error } = await supabase
      .from("crm_custom_fields")
      .insert({ ...v, key: fieldKey(v.label), agency_id: ctx.agency.id, position: count ?? 0 });
    if (error)
      return error.code === "23505" ? { ok: false, error: "Já existe um campo com este nome." } : fail(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteField(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Campo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_custom_fields")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function saveTemplate(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("crm_message_templates")
        .update(parsed.data)
        .eq("id", id)
        .eq("agency_id", ctx.agency.id)
        .select("id")
    : await supabase
        .from("crm_message_templates")
        .insert({ ...parsed.data, agency_id: ctx.agency.id })
        .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_message_templates")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

// ---------- Importação ----------
/** Grava as linhas válidas; com o mesmo CNPJ/CPF, pula ou atualiza conforme escolhido. */
export async function importOpportunities(
  input: unknown,
): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Arquivo inválido." };
  const { rows, stage, owner_id, duplicates, extraTags } = parsed.data;
  const supabase = await createClient();

  // documentos repetidos dentro do próprio arquivo: vale a primeira linha
  const seen = new Set<string>();
  const unique = rows.filter((r) => !r.document || (!seen.has(r.document) && !!seen.add(r.document)));
  let skipped = rows.length - unique.length;

  const docs = unique.flatMap((r) => (r.document ? [r.document] : []));
  const existing = new Map<string, { id: string; custom: Record<string, unknown> }>();
  for (let i = 0; i < docs.length; i += 500) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .select("id, document, custom")
      .eq("agency_id", ctx.agency.id)
      .in("document", docs.slice(i, i + 500));
    if (error) return fail(error);
    for (const d of data ?? [])
      if (d.document)
        existing.set(d.document, { id: d.id, custom: (d.custom ?? {}) as Record<string, unknown> });
  }

  const withTags = (tags: string[]) => [...new Set([...tags, ...extraTags])].slice(0, 20);
  const toInsert = unique.filter((r) => !(r.document && existing.has(r.document)));
  const toUpdate = unique.filter((r) => r.document && existing.has(r.document));

  let updated = 0;
  if (duplicates === "pular") skipped += toUpdate.length;
  else
    for (const r of toUpdate) {
      // só sobrescreve o que veio preenchido no arquivo
      const cur = existing.get(r.document!)!;
      const patch = Object.fromEntries(
        Object.entries({
          ...r,
          tags: r.tags.length || extraTags.length ? withTags(r.tags) : undefined,
          custom: Object.keys(r.custom).length ? { ...cur.custom, ...r.custom } : undefined,
        }).filter(([, v]) => v !== null && v !== undefined),
      ) as Database["public"]["Tables"]["crm_opportunities"]["Update"];
      const { error } = await supabase
        .from("crm_opportunities")
        .update(patch)
        .eq("id", cur.id)
        .eq("agency_id", ctx.agency.id);
      if (error) return { ok: false, error: `Parou ao atualizar "${r.name}": ${authErrorMessage(error)}` };
      updated++;
    }

  let position = await nextPosition(ctx.agency.id, stage);
  let created = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500).map((r) => ({
      ...r,
      tags: withTags(r.tags),
      stage,
      owner_id,
      position: (position += 1024),
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
      source: "importacao" as const,
    }));
    const { error } = await supabase.from("crm_opportunities").insert(chunk);
    if (error) {
      refresh();
      return {
        ok: false,
        error: `Importadas ${created} oportunidades; o restante falhou: ${authErrorMessage(error)}`,
      };
    }
    created += chunk.length;
  }
  refresh();
  return { ok: true, data: { created, updated, skipped } };
}

// ---------- Leitura da ficha ----------
export interface OppDetails {
  activities: {
    id: string;
    kind: "contato" | "nota";
    channel: string | null;
    result: string | null;
    note: string | null;
    author_id: string | null;
    happened_at: string;
  }[];
  history: {
    id: string;
    from_stage: string | null;
    to_stage: string;
    changed_by: string | null;
    changed_at: string;
  }[];
}

/** Contatos, anotações e mudanças de etapa de uma oportunidade (respeita as permissões do banco). */
export async function loadOpportunityDetails(id: string): Promise<ActionResult<OppDetails>> {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial")) return { ok: false, error: "Você não tem acesso ao Comercial." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Oportunidade inválida." };
  const supabase = await createClient();
  const [acts, hist] = await Promise.all([
    supabase
      .from("crm_activities")
      .select("id, kind, channel, result, note, author_id, happened_at")
      .eq("opportunity_id", id)
      .order("happened_at", { ascending: false })
      .limit(200),
    supabase
      .from("crm_stage_history")
      .select("id, from_stage, to_stage, changed_by, changed_at")
      .eq("opportunity_id", id)
      .order("changed_at", { ascending: false })
      .limit(200),
  ]);
  if (acts.error || hist.error) return { ok: false, error: authErrorMessage(acts.error ?? hist.error) };
  return { ok: true, data: { activities: acts.data ?? [], history: hist.data ?? [] } };
}
