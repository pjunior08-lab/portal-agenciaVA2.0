"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Ban, Link2, PenLine, Printer, Trash2, Undo2 } from "lucide-react";
import { Alert, Badge, Button, Modal } from "@/components/ui";
import { ContractSheet, PartiesCard, SignaturesCard, TermTimeline } from "@/features/contratos/document";
import { SignForm } from "@/features/contratos/sign-form";
import { CONTRACT_STATUS } from "@/features/contratos/schemas";
import { deleteContract, sendContract, setContractStatus, signAsAgency } from "@/features/contratos/actions";
import { today } from "@/lib/dates";
import type { ContractStatusT } from "@/lib/supabase/database.types";
import { CopyLink } from "../contract-editor";

type Sig = { party: "contratante" | "contratada"; name: string; document: string; signed_at: string; ip: string | null };

/** Contrato enviado, assinado ou cancelado: só leitura, com as ações do fluxo. */
export function ContractView({
  contract: c,
  contratante,
  contratada,
  signatures,
  canEdit,
  isAdmin,
  userName,
}: {
  contract: {
    id: string;
    title: string;
    status: ContractStatusT;
    html: string;
    header: string;
    footer: string;
    watermark: string;
    value: number | null;
    starts_on: string | null;
    ends_on: string | null;
    renewal_on: string | null;
    document_hash: string | null;
    sent_at: string | null;
    signed_at: string | null;
    hasLink: boolean;
    proposal: { id: string; number: string; title: string } | null;
  };
  contratante: { name: string; document: string | null };
  contratada: { name: string; document: string | null };
  signatures: Sig[];
  canEdit: boolean;
  isAdmin: boolean;
  userName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [confirm, setConfirm] = useState<"cancelar" | "rascunho" | "excluir" | null>(null);
  const [pending, start] = useTransition();
  const agencySigned = signatures.some((s) => s.party === "contratada");
  const anySigned = signatures.length > 0;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível concluir.");
      setError("");
      setConfirm(null);
      if (after) after();
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href="/contratos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Contratos
        </Link>
        <h1 className="min-w-0 truncate text-2xl font-normal tracking-tight">{c.title}</h1>
        <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="no-print flex flex-wrap gap-2">
        {c.status === "aguardando" && canEdit && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendContract(c.id);
                if (!r.ok) return setError(r.error);
                setLink(r.data!.url);
              })
            }
          >
            <Link2 /> {c.hasLink ? "Gerar novo link de assinatura" : "Gerar link de assinatura"}
          </Button>
        )}
        {c.status === "aguardando" && isAdmin && !agencySigned && (
          <Button size="sm" onClick={() => setSigning(true)}>
            <PenLine /> Assinar pela agência
          </Button>
        )}
        {c.status === "aguardando" && canEdit && !anySigned && (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("rascunho")}>
            <Undo2 /> Voltar para rascunho
          </Button>
        )}
        {(c.status === "aguardando" || c.status === "assinado") && canEdit && (
          <Button size="sm" variant="danger-outline" onClick={() => setConfirm("cancelar")}>
            <Ban /> Cancelar contrato
          </Button>
        )}
        {c.status === "cancelado" && canEdit && !anySigned && (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("rascunho")}>
            <Undo2 /> Reabrir como rascunho
          </Button>
        )}
        {c.status === "cancelado" && canEdit && !anySigned && (
          <Button size="sm" variant="danger-outline" onClick={() => setConfirm("excluir")}>
            <Trash2 /> Excluir
          </Button>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => window.print()}>
          <Printer /> Imprimir ou PDF
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ContractSheet html={c.html} header={c.header} footer={c.footer} watermark={c.watermark} />
        <aside className="flex flex-col gap-4">
          <PartiesCard contratante={contratante} contratada={contratada} />
          <TermTimeline startsOn={c.starts_on} endsOn={c.ends_on} renewalOn={c.renewal_on} value={c.value} today={today()} />
          <SignaturesCard signatures={signatures} documentHash={c.document_hash} />
          {c.proposal && (
            <Link href={`/propostas/${c.proposal.id}`} className="no-print rounded-card bg-surface p-4 text-xs hover:ring-2 hover:ring-brand">
              <span className="text-muted">Proposta de origem</span>
              <span className="block font-medium">
                Nº {c.proposal.number} · {c.proposal.title}
              </span>
            </Link>
          )}
        </aside>
      </div>

      {link && (
        <Modal open onOpenChange={(o) => !o && (setLink(null), router.refresh())} title="Link de" accent="assinatura">
          <CopyLink url={link} />
        </Modal>
      )}

      {signing && (
        <Modal open onOpenChange={(o) => !o && setSigning(false)} title="Assinar pela" accent="agência" size="lg">
          <p className="mb-4 text-sm text-muted">Você assina como representante de {contratada.name}.</p>
          <SignForm
            askEmail={false}
            defaultName={userName}
            submitLabel="Assinar pela agência"
            onSign={async (v) => {
              const r = await signAsAgency(c.id, v);
              if (r.ok) {
                setSigning(false);
                router.refresh();
              }
              return r;
            }}
          />
        </Modal>
      )}

      {confirm && (
        <Modal
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm === "cancelar" ? "Cancelar" : confirm === "excluir" ? "Excluir" : "Voltar para"}
          accent={confirm === "rascunho" ? "rascunho" : "contrato"}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Voltar
              </Button>
              <Button
                variant={confirm === "rascunho" ? "primary" : "danger"}
                loading={pending}
                onClick={() =>
                  confirm === "excluir"
                    ? act(() => deleteContract(c.id), () => router.push("/contratos"))
                    : act(() => setContractStatus(c.id, confirm === "cancelar" ? "cancelado" : "rascunho"))
                }
              >
                Confirmar
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {confirm === "cancelar" &&
              (anySigned
                ? "O contrato fica marcado como cancelado. As assinaturas e o texto continuam guardados como registro."
                : "O link de assinatura deixa de funcionar e o contrato fica marcado como cancelado.")}
            {confirm === "rascunho" && "O link de assinatura deixa de funcionar e o texto volta a ser editável."}
            {confirm === "excluir" && "O contrato será excluído definitivamente."}
          </p>
        </Modal>
      )}
    </div>
  );
}
