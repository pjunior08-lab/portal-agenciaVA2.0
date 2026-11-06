import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberContext } from "@/lib/auth/session";

export interface EditorTemplate {
  id: string;
  name: string;
  title: string;
  cover: string;
  items: unknown;
  payment: unknown;
  notes: string;
}

/** Dados de apoio do editor de proposta: clientes, modelos e serviços já usados. */
export async function loadEditorData(ctx: MemberContext) {
  const supabase = await createClient();
  const [clients, templates, services] = await Promise.all([
    supabase.from("clients").select("id, name, contact_name, email, phone").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
    supabase.from("proposal_templates").select("id, name, title, cover, items, payment, notes").eq("agency_id", ctx.agency.id).order("name"),
    supabase.from("proposal_items").select("service").eq("agency_id", ctx.agency.id).limit(1000),
  ]);
  return {
    clients: clients.data ?? [],
    templates: (templates.data ?? []) as EditorTemplate[],
    services: [...new Set((services.data ?? []).map((s) => s.service))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
