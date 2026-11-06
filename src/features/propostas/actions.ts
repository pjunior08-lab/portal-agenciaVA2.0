"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember, type MemberContext } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { cleanHtml } from "@/lib/html";
import { clientIp, siteUrl } from "@/lib/request";
import type { ActionResult } from "@/features/configuracoes/actions";
import { decisionSchema, proposalSchema, templateNameSchema } from "./schemas";

const uuid = z.string().uuid();
const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem permissão para editar propostas." };

async function editor(): Promise<MemberContext | null> {
  const ctx = await requireMember();
  return memberCan(ctx, "propostas", "editar") ? ctx : null;
}

function invalid(err: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Confira os campos destacados.", fieldErrors: err.flatten().fieldErrors };
}

function fail(error: { message?: string; code?: string } | null): ActionResult<never> {
  if (error?.code === "23505") return { ok: false, error: "Já existe uma proposta com este número." };
  return { ok: false, error: authErrorMessage(error) };
}

export async function saveProposal(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Proposta inválida." };
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { items, ...v } = parsed.data;
  const supabase = await createClient();

  const row = { ...v, notes: v.notes.trim() };
  let proposalId = id;
  if (id) {
    const { data, error } = await supabase.from("proposals").update(row).eq("id", id).eq("agency_id", ctx.agency.id).select("id");
    if (error) return fail(error);
    if (!data?.length) return NO_PERMISSION;
  } else {
    const { data, error } = await supabase
      .from("proposals")
      .insert({ ...row, agency_id: ctx.agency.id, created_by: ctx.userId })
      .select("id")
      .single();
    if (error || !data) return fail(error);
    proposalId = data.id;
  }

  // itens: troca a lista inteira (a proposta é editada como um documento)
  const { error: delErr } = await supabase.from("proposal_items").delete().eq("proposal_id", proposalId!);
  if (delErr) return fail(delErr);
  const { error: insErr } = await supabase.from("proposal_items").insert(
    items.map((i, n) => ({
      agency_id: ctx.agency.id,
      proposal_id: proposalId!,
      position: n,
      service: i.service,
      quantity: i.quantity as number,
      unit_price: i.unit_price as number,
      cadence: i.cadence,
      scope_html: cleanHtml(i.scope_html),
    })),
  );
  if (insErr) return fail(insErr);

  revalidatePath("/propostas");
  return { ok: true, data: { id: proposalId! } };
}

export async function deleteProposal(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Proposta inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Só rascunhos e recusadas podem ser excluídas (ou por um administrador)." };
  revalidatePath("/propostas");
  return { ok: true };
}

/** Gera o link do cliente (e marca como enviada). Chamar de novo troca o link e desativa o anterior. */
export async function shareProposal(id: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Proposta inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_proposal", { p: id });
  if (error || !data) return fail(error);
  revalidatePath("/propostas");
  return { ok: true, data: { url: `${await siteUrl()}/proposta/${data}` } };
}

// ---------- Modelos ----------
export async function saveProposalTemplate(name: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const n = templateNameSchema.safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  // o modelo guarda o conteúdo reaproveitável, sem cliente nem contato
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_templates")
    .insert({
      agency_id: ctx.agency.id,
      created_by: ctx.userId,
      name: n.data,
      title: v.title,
      cover: v.cover,
      items: v.items.map((i) => ({ ...i, scope_html: cleanHtml(i.scope_html) })),
      payment: v.payment,
      notes: v.notes,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  revalidatePath("/propostas");
  return { ok: true, data: { id: data.id } };
}

export async function deleteProposalTemplate(id: string): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Modelo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposal_templates").delete().eq("id", id).eq("agency_id", ctx.agency.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO_PERMISSION;
  revalidatePath("/propostas");
  return { ok: true };
}

// ---------- Cliente pelo link (sem login) ----------
export async function decideProposal(input: unknown): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { token, decision, name, comment } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_proposal_decide", {
    token,
    decision,
    signer_name: name,
    comment: comment || null,
    ip: await clientIp(),
  });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath(`/proposta/${token}`);
  return { ok: true };
}
