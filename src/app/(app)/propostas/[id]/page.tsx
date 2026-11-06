import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { COVERS, PAYMENT_METHODS } from "@/features/propostas/schemas";
import { loadEditorData } from "../editor-data";
import { ProposalEditor, type EditorInitial } from "../proposal-editor";

export const metadata: Metadata = { title: "Proposta" };

export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireMember();
  if (!memberCan(ctx, "propostas")) redirect("/propostas");
  const supabase = await createClient();
  const [{ data: p }, data, contracts] = await Promise.all([
    supabase.from("proposals").select("*, proposal_items(*)").eq("id", id).eq("agency_id", ctx.agency.id).maybeSingle(),
    loadEditorData(ctx),
    supabase.from("contracts").select("id, title, status").eq("proposal_id", id),
  ]);
  if (!p) notFound();

  const pay = (p.payment ?? {}) as Record<string, unknown>;
  const initial: EditorInitial = {
    title: p.title,
    number: p.number,
    template_id: p.template_id ?? "",
    cover: (COVERS as readonly string[]).includes(p.cover) ? (p.cover as (typeof COVERS)[number]) : COVERS[0],
    status: p.status,
    valid_until: p.valid_until ?? "",
    client_id: p.client_id ?? "",
    contact_name: p.contact_name ?? "",
    contact_email: p.contact_email ?? "",
    contact_phone: p.contact_phone ?? "",
    items: [...(p.proposal_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ service: i.service, quantity: String(i.quantity), unit_price: String(i.unit_price), cadence: i.cadence, scope_html: i.scope_html })),
    payment: {
      installments: Number(pay.installments ?? 1) || 1,
      down_payment: pay.down_payment == null ? "" : String(pay.down_payment),
      methods: Array.isArray(pay.methods) ? (pay.methods as string[]).filter((m): m is (typeof PAYMENT_METHODS)[number] => (PAYMENT_METHODS as readonly string[]).includes(m)) : [],
      details: typeof pay.details === "string" ? pay.details : "",
    },
    notes: p.notes,
  };

  return (
    <ProposalEditor
      proposalId={p.id}
      initial={initial}
      {...data}
      canEdit={memberCan(ctx, "propostas", "editar")}
      canContract={memberCan(ctx, "contratos", "editar")}
      meta={{
        sent_at: p.sent_at,
        decided_at: p.decided_at,
        decision_name: p.decision_name,
        decision_comment: p.decision_comment,
        hasLink: !!p.share_token_hash,
        contracts: contracts.data ?? [],
      }}
    />
  );
}
