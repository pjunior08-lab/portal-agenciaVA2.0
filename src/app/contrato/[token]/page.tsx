import type { Metadata } from "next";
import Image from "next/image";
import { LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cleanHtml } from "@/lib/html";
import { Badge, EmptyState } from "@/components/ui";
import { today } from "@/lib/dates";
import { ContractSheet, PartiesCard, SignaturesCard, TermTimeline } from "@/features/contratos/document";
import { CONTRACT_STATUS } from "@/features/contratos/schemas";
import type { ContractStatusT } from "@/lib/supabase/database.types";
import { ClientSign } from "./client-sign";
import { PrintButton } from "../../proposta/[token]/decision";

export const metadata: Metadata = { title: "Contrato", robots: { index: false, follow: false } };

interface PublicContract {
  title: string;
  status: ContractStatusT;
  rendered_html: string | null;
  header_text: string;
  footer_text: string;
  watermark: string;
  document_hash: string | null;
  value: number | null;
  starts_on: string | null;
  ends_on: string | null;
  renewal_on: string | null;
  contratante: { name: string; document: string | null };
  contratada: { name: string; document: string | null };
  signatures: { party: "contratante" | "contratada"; name: string; document: string; signed_at: string; ip: string | null }[];
}

/** Contrato aberto pelo link (sem login): leitura e assinatura do cliente. */
export default async function PublicContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_contract", { token });
  const c = data as PublicContract | null;

  if (!c) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
        <div className="rounded-card bg-surface">
          <EmptyState icon={LinkIcon} title="Link inválido" description="Este link foi trocado ou desativado. Peça um novo à agência." />
        </div>
      </div>
    );
  }
  const clientSigned = c.signatures.some((s) => s.party === "contratante");

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="no-print flex flex-wrap items-center gap-3">
        <Image src="/brand/simbolo-amarelo.png" alt="" width={36} height={36} className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{c.contratada.name}</p>
          <h1 className="truncate text-xl font-normal tracking-tight">{c.title}</h1>
        </div>
        <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ContractSheet html={cleanHtml(c.rendered_html)} header={c.header_text} footer={c.footer_text} watermark={c.watermark} />
        <aside className="flex flex-col gap-4">
          <PartiesCard contratante={c.contratante} contratada={c.contratada} />
          <TermTimeline startsOn={c.starts_on} endsOn={c.ends_on} renewalOn={c.renewal_on} value={c.value} today={today()} />
          <SignaturesCard signatures={c.signatures} documentHash={c.document_hash} />
        </aside>
      </div>

      <div className="no-print flex flex-col gap-4">
        {c.status === "aguardando" && !clientSigned && <ClientSign token={token} />}
        {c.status === "aguardando" && clientSigned && (
          <p className="rounded-card bg-surface p-4 text-sm">Sua assinatura foi registrada. Falta a assinatura da agência; você pode voltar a este link para ver o andamento.</p>
        )}
        {c.status === "assinado" && <p className="rounded-card bg-success-soft p-4 text-sm">Contrato assinado pelas duas partes.</p>}
        {c.status === "cancelado" && <p className="rounded-card bg-surface p-4 text-sm text-muted">Este contrato foi cancelado pela agência.</p>}
        <PrintButton />
      </div>
    </div>
  );
}
