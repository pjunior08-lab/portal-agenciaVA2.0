import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { cleanHtml } from "@/lib/html";
import { loadContractData } from "../contract-data";
import { ContractEditor } from "../contract-editor";
import { ContractView } from "./contract-view";

export const metadata: Metadata = { title: "Contrato" };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireMember();
  if (!memberCan(ctx, "contratos")) redirect("/contratos");
  const canEdit = memberCan(ctx, "contratos", "editar");
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contracts")
    .select("*, clients(name, document), proposals(id, number, title), contract_signatures(party, signer_name, signer_document, signed_at, ip)")
    .eq("id", id)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  if (!c) notFound();

  if (c.status === "rascunho" && canEdit) {
    const data = await loadContractData(ctx);
    return (
      <ContractEditor
        contractId={c.id}
        data={data}
        initial={{
          title: c.title,
          client_id: c.client_id,
          template_id: c.template_id ?? "",
          proposal_id: c.proposal_id ?? "",
          service_description: c.service_description,
          body_html: c.body_html,
          header_text: c.header_text,
          footer_text: c.footer_text,
          watermark: c.watermark,
          value: c.value == null ? "" : String(c.value),
          starts_on: c.starts_on ?? "",
          ends_on: c.ends_on ?? "",
          renewal_on: c.renewal_on ?? "",
        }}
      />
    );
  }

  const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
  const proposal = Array.isArray(c.proposals) ? c.proposals[0] : c.proposals;
  return (
    <ContractView
      contract={{
        id: c.id,
        title: c.title,
        status: c.status,
        html: cleanHtml(c.rendered_html ?? c.body_html),
        header: c.header_text,
        footer: c.footer_text,
        watermark: c.watermark,
        value: c.value,
        starts_on: c.starts_on,
        ends_on: c.ends_on,
        renewal_on: c.renewal_on,
        document_hash: c.document_hash,
        sent_at: c.sent_at,
        signed_at: c.signed_at,
        hasLink: !!c.share_token_hash,
        proposal: proposal ? { id: proposal.id, number: proposal.number, title: proposal.title } : null,
      }}
      contratante={{ name: client?.name ?? "—", document: client?.document ?? null }}
      contratada={{ name: ctx.agency.legal_name || ctx.agency.name, document: ctx.agency.cnpj }}
      signatures={(c.contract_signatures ?? []).map((s) => ({
        party: s.party,
        name: s.signer_name,
        document: `***${s.signer_document.slice(-4)}`,
        signed_at: s.signed_at,
        ip: s.ip,
      }))}
      canEdit={canEdit}
      isAdmin={ctx.role === "admin"}
      userName={ctx.profile.full_name}
    />
  );
}
