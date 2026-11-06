import Link from "next/link";
import { FileSignature, FileText, Plus } from "lucide-react";
import { Badge, SectionCard, buttonVariants } from "@/components/ui";
import { CONTRACT_STATUS } from "@/features/contratos/schemas";
import { PROPOSAL_STATUS } from "@/features/propostas/schemas";
import type { ContractStatusT, ProposalStatusT } from "@/lib/supabase/database.types";

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export interface ClientDocument {
  kind: "contrato" | "proposta";
  id: string;
  title: string;
  status: ContractStatusT | ProposalStatusT;
  /** data mais relevante: assinatura, envio ou criação */
  date: string;
  dateLabel: string;
}

/**
 * Contratos e propostas do cliente, listados automaticamente a partir dos módulos
 * (sem cópia: o que muda lá aparece aqui). Abrir leva ao documento, com impressão em PDF.
 */
export function DocumentsPanel({
  clientId,
  documents,
  canCreateContract,
  showContracts,
  showProposals,
}: {
  clientId: string;
  documents: ClientDocument[];
  canCreateContract: boolean;
  showContracts: boolean;
  showProposals: boolean;
}) {
  const what = [showContracts && "contratos", showProposals && "propostas"].filter(Boolean).join(" e ");
  return (
    <SectionCard
      title="Contratos e propostas"
      icon={FileSignature}
      description={`Entram aqui automaticamente: ${what} deste cliente.`}
      action={
        canCreateContract && (
          <Link href={`/contratos/novo?cliente=${clientId}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <Plus /> Novo contrato
          </Link>
        )
      }
    >
      {documents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nenhum {what.replace(" e ", " ou ").replace(/s\b/g, "")} para este cliente ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {documents.map((d) => {
            const st = d.kind === "contrato" ? CONTRACT_STATUS[d.status as ContractStatusT] : PROPOSAL_STATUS[d.status as ProposalStatusT];
            const Icon = d.kind === "contrato" ? FileSignature : FileText;
            return (
              <li key={`${d.kind}-${d.id}`}>
                <Link href={d.kind === "contrato" ? `/contratos/${d.id}` : `/propostas/${d.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2 sm:px-2">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className="block text-[11px] text-muted">
                      {d.kind === "contrato" ? "Contrato" : "Proposta"} · {d.dateLabel} {when.format(new Date(d.date))}
                    </span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="text-xs text-muted underline-offset-2 hover:underline">Abrir</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
