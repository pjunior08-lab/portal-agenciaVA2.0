import "server-only";
import { createClient } from "@/lib/supabase/server";
import { memberCan, type MemberContext } from "@/lib/auth/session";

/** Dados de apoio do editor de contrato. */
export async function loadContractData(ctx: MemberContext) {
  const supabase = await createClient();
  const [clients, proposals, templates] = await Promise.all([
    supabase.from("clients").select("id, name, document, address, email, contact_name").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
    memberCan(ctx, "propostas")
      ? supabase
          .from("proposals")
          .select("id, number, title, client_id, status, proposal_items(service, quantity, unit_price, cadence)")
          .eq("agency_id", ctx.agency.id)
          .not("client_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    supabase.from("contract_templates").select("id, name, body_html, header_text, footer_text, watermark, is_default").eq("agency_id", ctx.agency.id).order("name"),
  ]);
  return {
    clients: clients.data ?? [],
    agency: { name: ctx.agency.name, legal_name: ctx.agency.legal_name, cnpj: ctx.agency.cnpj, address: ctx.agency.address, email: ctx.agency.email },
    proposals: (proposals.data ?? []).map((p) => ({ ...p, client_id: p.client_id as string, items: p.proposal_items ?? [] })),
    templates: templates.data ?? [],
  };
}

export type ContractData = Awaited<ReturnType<typeof loadContractData>>;
