"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { apiKeySchema, distributionSchema, formSchema, ruleSchema, webhookSchema } from "./automations";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = {
  ok: false,
  error: "Você não tem permissão para editar o Comercial.",
};
const ADMIN_ONLY: ActionResult<never> = {
  ok: false,
  error: "Só administradores gerenciam chaves de API e webhooks.",
};

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "comercial", "editar") ? ctx : null;
}
async function admin(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return ctx.role === "admin" ? ctx : null;
}
function invalid(err: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: err.issues[0]?.message ?? "Confira os campos destacados.",
    fieldErrors: err.flatten().fieldErrors,
  };
}
function refresh() {
  revalidatePath("/comercial", "layout");
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- Regras ----------
export async function saveRule(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Regra inválida." };
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("crm_rules")
        .update(parsed.data)
        .eq("id", id)
        .eq("agency_id", ctx.agency.id)
        .select("id")
    : await supabase
        .from("crm_rules")
        .insert({
          ...parsed.data,
          agency_id: ctx.agency.id,
          created_by: ctx.userId,
          position: Math.floor(Date.now() / 1000),
        })
        .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function toggleRule(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success || typeof active !== "boolean")
    return { ok: false, error: "Regra inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_rules")
    .update({ active })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Regra inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_rules")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function saveDistribution(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = distributionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.auto_new && parsed.data.members.length === 0)
    return { ok: false, error: "Escolha quem entra no rodízio antes de ligar a distribuição automática." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_distribution")
    .upsert(
      { agency_id: ctx.agency.id, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "agency_id" },
    );
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh();
  return { ok: true };
}

// ---------- Chaves de API ----------
/** Cria a chave e devolve o texto completo uma única vez; o banco guarda só o hash. */
export async function createApiKey(input: unknown): Promise<ActionResult<{ key: string }>> {
  const ctx = await admin();
  if (!ctx) return ADMIN_ONLY;
  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const key = `va_${randomBytes(24).toString("base64url")}`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_api_keys")
    .insert({
      agency_id: ctx.agency.id,
      name: parsed.data.name,
      prefix: key.slice(0, 10),
      key_hash: sha256(key),
      created_by: ctx.userId,
    });
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh();
  return { ok: true, data: { key } };
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return ADMIN_ONLY;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Chave inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .is("revoked_at", null)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Chave não encontrada ou já revogada." };
  refresh();
  return { ok: true };
}

// ---------- Webhooks ----------
export async function saveWebhook(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ secret?: string }>> {
  const ctx = await admin();
  if (!ctx) return ADMIN_ONLY;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Webhook inválido." };
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase
      .from("crm_webhooks")
      .update(parsed.data)
      .eq("id", id)
      .eq("agency_id", ctx.agency.id)
      .select("id");
    if (error) return { ok: false, error: authErrorMessage(error) };
    if (!data?.length) return ADMIN_ONLY;
    refresh();
    return { ok: true, data: {} };
  }
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const { error } = await supabase
    .from("crm_webhooks")
    .insert({ ...parsed.data, secret, agency_id: ctx.agency.id });
  if (error) return { ok: false, error: authErrorMessage(error) };
  refresh();
  return { ok: true, data: { secret } };
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const ctx = await admin();
  if (!ctx) return ADMIN_ONLY;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Webhook inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_webhooks")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return ADMIN_ONLY;
  refresh();
  return { ok: true };
}

// ---------- Formulários ----------
export async function saveForm(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Formulário inválido." };
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("crm_forms")
        .update(parsed.data)
        .eq("id", id)
        .eq("agency_id", ctx.agency.id)
        .select("id")
    : await supabase
        .from("crm_forms")
        .insert({ ...parsed.data, agency_id: ctx.agency.id })
        .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

export async function deleteForm(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Formulário inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_forms")
    .delete()
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .select("id");
  if (error) return { ok: false, error: authErrorMessage(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}
