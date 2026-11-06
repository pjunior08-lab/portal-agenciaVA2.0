import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, today } from "@/lib/dates";
import { COVERS } from "@/features/propostas/schemas";
import { loadEditorData } from "../editor-data";
import { ProposalEditor, emptyItem, type EditorInitial } from "../proposal-editor";

export const metadata: Metadata = { title: "Nova proposta" };

export default async function NovaPropostaPage({ searchParams }: { searchParams: Promise<{ modelo?: string; cliente?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "propostas", "editar")) redirect("/propostas");
  const { modelo, cliente } = await searchParams;
  const data = await loadEditorData(ctx);
  const template = data.templates.find((t) => t.id === modelo);
  const client = data.clients.find((c) => c.id === cliente);

  const initial: EditorInitial = {
    title: template?.title ?? "",
    number: "",
    template_id: template?.id ?? "",
    cover: (template?.cover as (typeof COVERS)[number]) ?? COVERS[0],
    status: "rascunho",
    valid_until: addDays(today(), 15),
    client_id: client?.id ?? "",
    contact_name: client?.contact_name ?? "",
    contact_email: client?.email ?? "",
    contact_phone: client?.phone ?? "",
    items: template && Array.isArray(template.items) && template.items.length ? (template.items as EditorInitial["items"]) : [emptyItem()],
    payment: {
      installments: 1,
      down_payment: "",
      methods: ["Pix"],
      details: "",
      ...((template?.payment as object) ?? {}),
    } as EditorInitial["payment"],
    notes: template?.notes ?? "",
  };

  return <ProposalEditor proposalId={null} initial={initial} {...data} canEdit canContract={memberCan(ctx, "contratos", "editar")} meta={null} />;
}
