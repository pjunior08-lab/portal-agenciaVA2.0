import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { memberCan, requireMember } from "@/lib/auth/session";
import { CADENCES, firstCycleValue } from "@/features/propostas/schemas";
import { loadContractData } from "../contract-data";
import { ContractEditor } from "../contract-editor";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function NovoContratoPage({ searchParams }: { searchParams: Promise<{ modelo?: string; proposta?: string; cliente?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "contratos", "editar")) redirect("/contratos");
  const { modelo, proposta, cliente } = await searchParams;
  const data = await loadContractData(ctx);
  const template = data.templates.find((t) => t.id === modelo) ?? data.templates.find((t) => t.is_default) ?? null;
  const proposal = data.proposals.find((p) => p.id === proposta) ?? null;
  const items = proposal?.items ?? [];

  return (
    <ContractEditor
      contractId={null}
      initial={{
        title: proposal ? proposal.title : "",
        client_id: proposal?.client_id ?? (data.clients.some((c) => c.id === cliente) ? (cliente as string) : ""),
        template_id: template?.id ?? "",
        proposal_id: proposal?.id ?? "",
        service_description: items.map((i) => `${i.service} (${CADENCES[i.cadence].label.toLowerCase()})`).join("; "),
        body_html: template?.body_html ?? "",
        header_text: template?.header_text ?? "",
        footer_text: template?.footer_text ?? "",
        watermark: template?.watermark ?? "",
        value: items.length ? String(firstCycleValue(items)) : "",
        starts_on: "",
        ends_on: "",
        renewal_on: "",
      }}
      data={data}
    />
  );
}
