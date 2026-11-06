"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { cleanHtml, htmlToText } from "@/lib/html";
import { clientIp, siteUrl, userAgent } from "@/lib/request";
import { today } from "@/lib/dates";
import type { ActionResult } from "@/features/configuracoes/actions";
import { STARTER_TEMPLATE, contractSchema, renderVariables, signSchema, templateSchema, variableValues } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar contratos." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "contratos", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23503") return { ok: false, error: "Este registro está em uso e não pode ser excluído." };
  return { ok: false, error: authErrorMessage(error) };
}

function refresh(id?: string) {
  revalidatePath("/contratos");
  if (id) revalidatePath(`/contratos/${id}`);
  revalidatePath("/portal", "layout");
}

// ---------- Contratos ----------
export async function saveContract(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Contrato inválido." };
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = { ...parsed.data, body_html: cleanHtml(parsed.data.body_html) };
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("contracts").update(row).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    refresh(id);
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase
    .from("contracts")
    .insert({ ...row, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteContract(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Só rascunhos e cancelados sem assinatura podem ser excluídos." };
  refresh();
  return { ok: true };
}

/** Cancelar (a qualquer momento) ou voltar para rascunho (só sem assinaturas). */
export async function setContractStatus(id: string, status: "cancelado" | "rascunho"): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success || !["cancelado", "rascunho"].includes(status)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").update({ status }).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh(id);
  return { ok: true };
}

/**
 * Envia para assinatura: troca as variáveis pelos dados de hoje, congela o texto
 * (o banco calcula o hash) e devolve o link do cliente. Se já foi enviado, só troca o link.
 */
export async function sendContract(id: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contracts")
    .select("*, clients(name, document, address, email, contact_name), proposals(number, title)")
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  if (!c) return { ok: false, error: "Contrato não encontrado." };

  let rendered = c.rendered_html ?? "";
  if (c.status === "rascunho") {
    const { data: agency } = await supabase.from("agencies").select("name, legal_name, cnpj, address, email").eq("id", ctx.agency.id).single();
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
    const proposal = Array.isArray(c.proposals) ? c.proposals[0] : c.proposals;
    const values = variableValues({ client: client ?? null, agency: agency!, proposal: proposal ?? null, contract: c, today: today() });
    rendered = cleanHtml(renderVariables(c.body_html, values));
    if (htmlToText(rendered).length < 20) return { ok: false, error: "Escreva o texto do contrato antes de enviar." };
    // cabeçalho e rodapé também saem com os dados preenchidos
    const strip = (s: string) => htmlToText(renderVariables(s, values));
    const { error: upErr } = await supabase
      .from("contracts")
      .update({ header_text: strip(c.header_text), footer_text: strip(c.footer_text) })
      .eq("id", id);
    if (upErr) return fail(upErr);
  }
  const { data: token, error } = await supabase.rpc("send_contract", { c: id, rendered });
  if (error || !token) return fail(error);
  refresh(id);
  return { ok: true, data: { url: `${await siteUrl()}/contrato/${token}` } };
}

/** Assinatura da agência (administrador). */
export async function signAsAgency(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  if (ctx.role !== "admin") return { ok: false, error: "Só um administrador assina pela agência." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Contrato inválido." };
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_contract_as_agency", {
    c: id,
    signer_name: parsed.data.name,
    signer_document: parsed.data.document,
    ip: await clientIp(),
    user_agent: await userAgent(),
  });
  if (error) return fail(error);
  refresh(id);
  return { ok: true };
}

/** Assinatura do cliente pelo link (sem login). */
export async function signAsClient(token: string, input: unknown): Promise<ActionResult> {
  if (typeof token !== "string" || token.length < 16 || token.length > 200) return { ok: false, error: "Link inválido." };
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_contract_sign", {
    token,
    signer_name: parsed.data.name,
    signer_document: parsed.data.document,
    signer_email: parsed.data.email || null,
    ip: await clientIp(),
    user_agent: await userAgent(),
  });
  if (error) return fail(error);
  revalidatePath(`/contrato/${token}`);
  return { ok: true };
}

// ---------- Modelos ----------
export async function saveContractTemplate(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = { ...parsed.data, body_html: cleanHtml(parsed.data.body_html) };
  const supabase = await createClient();
  // só um modelo padrão por agência
  if (row.is_default) {
    let q = supabase.from("contract_templates").update({ is_default: false }).eq("agency_id", ctx.agency.id).eq("is_default", true);
    if (id) q = q.neq("id", id);
    const { error } = await q;
    if (error) return fail(error);
  }
  if (id) {
    const { data, error } = await supabase.from("contract_templates").update(row).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
    refresh();
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({ ...row, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteContractTemplate(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("contract_templates").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  refresh();
  return { ok: true };
}

/** Cria o esqueleto inicial (estrutura de cláusulas) como modelo da agência. */
export async function createStarterTemplate(): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const supabase = await createClient();
  const { count } = await supabase.from("contract_templates").select("id", { count: "exact", head: true }).eq("agency_id", ctx.agency.id);
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({ ...STARTER_TEMPLATE, is_default: !count, agency_id: ctx.agency.id, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}
