import type { Metadata } from "next";
import Image from "next/image";
import { LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cleanHtml } from "@/lib/html";
import { EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { today } from "@/lib/dates";
import { CADENCES, investment, isExpired } from "@/features/propostas/schemas";
import type { ItemCadenceT, ProposalStatusT } from "@/lib/supabase/database.types";
import { DecisionForm, PrintButton } from "./decision";

export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

interface PublicProposal {
  number: string;
  title: string;
  cover: string;
  status: ProposalStatusT;
  valid_until: string | null;
  sent_at: string | null;
  decided_at: string | null;
  decision_name: string | null;
  payment: { installments?: number; down_payment?: number | null; methods?: string[]; details?: string };
  notes: string;
  contact_name: string | null;
  client_name: string | null;
  agency: { name: string; legal_name: string | null; email: string | null; phone: string | null };
  items: { service: string; quantity: number; unit_price: number; cadence: ItemCadenceT; scope_html: string }[];
}

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const fmtDay = (d: string) => longDate.format(new Date(`${d}T12:00:00Z`));
const fmtWhen = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Proposta aberta pelo link (sem login). O banco só entrega este documento. */
export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_proposal", { token });
  const p = data as PublicProposal | null;

  if (!p) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
        <div className="rounded-card bg-surface">
          <EmptyState icon={LinkIcon} title="Link inválido" description="Este link foi trocado ou desativado. Peça um novo à agência." />
        </div>
      </div>
    );
  }

  const expired = isExpired(p, today());
  const totals = investment(p.items);
  const canDecide = (p.status === "enviada" || p.status === "em_negociacao") && !expired;
  const pay = p.payment ?? {};

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <article className="print-sheet overflow-hidden rounded-card bg-surface shadow-sm">
        <header className="px-6 pt-8 pb-6 sm:px-10" style={{ borderTop: `10px solid ${p.cover}` }}>
          <div className="mb-6 flex items-center gap-3">
            <Image src="/brand/simbolo-amarelo.png" alt="" width={36} height={36} className="size-9 rounded-xl" />
            <div className="text-sm">
              <p className="font-medium">{p.agency.name}</p>
              <p className="text-xs text-muted">{[p.agency.email, p.agency.phone].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <p className="text-xs text-muted">Proposta nº {p.number}</p>
          <h1 className="mt-1 text-3xl font-normal tracking-tight">{p.title}</h1>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {p.client_name && (
              <div>
                <dt className="inline text-muted">Para: </dt>
                <dd className="inline">{p.client_name}</dd>
              </div>
            )}
            {p.contact_name && (
              <div>
                <dt className="inline text-muted">A/C: </dt>
                <dd className="inline">{p.contact_name}</dd>
              </div>
            )}
            {p.valid_until && (
              <div>
                <dt className="inline text-muted">Válida até: </dt>
                <dd className={expired ? "inline text-danger" : "inline"}>
                  {fmtDay(p.valid_until)}
                  {expired && " (vencida)"}
                </dd>
              </div>
            )}
          </dl>
        </header>

        <section aria-label="Itens" className="border-t border-line px-6 py-6 sm:px-10">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">O que está incluído</h2>
          <ol className="flex flex-col gap-5">
            {p.items.map((i, n) => (
              <li key={n}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">
                    {i.service}
                    {Number(i.quantity) !== 1 && <span className="text-muted"> × {Number(i.quantity).toLocaleString("pt-BR")}</span>}
                  </h3>
                  <span className="tabular-nums">
                    {formatBRL(Math.round(Number(i.quantity) * Number(i.unit_price) * 100) / 100)}
                    <span className="text-xs text-muted">{CADENCES[i.cadence].suffix}</span>
                  </span>
                </div>
                {i.scope_html && <div className="rich-text mt-2 text-sm text-ink/85" dangerouslySetInnerHTML={{ __html: cleanHtml(i.scope_html) }} />}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Investimento" className="border-t border-line bg-surface-2 px-6 py-6 sm:px-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Investimento</h2>
          <ul className="flex flex-col gap-1">
            {totals.map((t) => (
              <li key={t.cadence} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted">{CADENCES[t.cadence].label}</span>
                <span className="text-2xl font-medium tabular-nums">
                  {formatBRL(t.total)}
                  <span className="text-sm text-muted">{CADENCES[t.cadence].suffix}</span>
                </span>
              </li>
            ))}
          </ul>
          {(pay.installments || pay.methods?.length || pay.down_payment || pay.details) && (
            <div className="mt-4 text-sm">
              <h3 className="mb-1 font-medium">Condições de pagamento</h3>
              <ul className="list-disc pl-5 text-ink/85">
                {pay.down_payment ? <li>Entrada de {formatBRL(Number(pay.down_payment))}</li> : null}
                {pay.installments && pay.installments > 1 ? <li>Em até {pay.installments} parcelas</li> : null}
                {pay.methods?.length ? <li>Formas: {pay.methods.join(", ")}</li> : null}
                {pay.details ? <li className="whitespace-pre-wrap">{pay.details}</li> : null}
              </ul>
            </div>
          )}
        </section>

        {p.notes && (
          <section aria-label="Observações" className="border-t border-line px-6 py-6 sm:px-10">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Observações</h2>
            <p className="text-sm whitespace-pre-wrap text-ink/85">{p.notes}</p>
          </section>
        )}
      </article>

      <div className="no-print flex flex-col gap-4">
        {p.status === "aceita" && p.decided_at && (
          <p className="rounded-card bg-success-soft p-4 text-sm">
            Proposta aceita por {p.decision_name} em {fmtWhen(p.decided_at)}. A agência vai entrar em contato com os próximos passos.
          </p>
        )}
        {p.status === "recusada" && p.decided_at && (
          <p className="rounded-card bg-surface p-4 text-sm text-muted">Proposta recusada em {fmtWhen(p.decided_at)}.</p>
        )}
        {expired && <p className="rounded-card bg-surface p-4 text-sm text-muted">Esta proposta venceu. Fale com a agência para receber uma nova.</p>}
        {canDecide && <DecisionForm token={token} />}
        <PrintButton />
      </div>
    </div>
  );
}
