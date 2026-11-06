import { CalendarRange, ShieldCheck, UserRound } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { diffDays } from "@/lib/dates";
import { fmtDay, formatDocument } from "./schemas";

/**
 * Folha do contrato: cabeçalho, texto, rodapé e marca d'água.
 * `html` precisa chegar já limpo (cleanHtml no servidor) ou vir do próprio editor.
 */
export function ContractSheet({
  html,
  header,
  footer,
  watermark,
  className,
}: {
  html: string;
  header: string;
  footer: string;
  watermark: string;
  className?: string;
}) {
  return (
    <article className={cn("print-sheet relative overflow-hidden rounded-card bg-surface shadow-sm", className)}>
      {watermark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-[30deg] text-[clamp(3rem,10vw,7rem)] font-semibold tracking-widest whitespace-nowrap text-ink/[0.06] uppercase">
            {watermark}
          </span>
        </div>
      )}
      {header && <header className="border-b border-line px-6 py-4 text-center text-xs tracking-wide text-muted uppercase sm:px-12">{header}</header>}
      <div className="rich-text relative px-6 py-8 text-sm sm:px-12" dangerouslySetInnerHTML={{ __html: html || "<p></p>" }} />
      {footer && <footer className="border-t border-line px-6 py-3 text-center text-[11px] text-muted sm:px-12">{footer}</footer>}
    </article>
  );
}

export function PartiesCard({
  contratante,
  contratada,
}: {
  contratante: { name: string; document: string | null };
  contratada: { name: string; document: string | null };
}) {
  return (
    <section aria-label="Partes" className="rounded-card bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserRound className="size-4 text-muted" aria-hidden /> Partes
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ["Contratante", contratante],
          ["Contratada", contratada],
        ].map(([label, p]) => {
          const party = p as { name: string; document: string | null };
          return (
            <div key={label as string} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-[11px] text-muted uppercase">{label as string}</dt>
              <dd className="font-medium">{party.name}</dd>
              <dd className="text-xs text-muted">{party.document ? formatDocument(party.document) : "Documento não informado"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Linha do tempo da vigência: início, hoje, renovação e fim. */
export function TermTimeline({
  startsOn,
  endsOn,
  renewalOn,
  value,
  today,
}: {
  startsOn: string | null;
  endsOn: string | null;
  renewalOn: string | null;
  value: number | null;
  today: string;
}) {
  const total = startsOn && endsOn ? Math.max(1, diffDays(startsOn, endsOn)) : 0;
  const pct = (d: string) => Math.min(100, Math.max(0, (diffDays(startsOn!, d) / total) * 100));
  return (
    <section aria-label="Vigência" className="rounded-card bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <CalendarRange className="size-4 text-muted" aria-hidden /> Vigência
        {value != null && <span className="ml-auto text-sm font-normal tabular-nums">{formatBRL(value)}</span>}
      </h2>
      {!startsOn || !endsOn ? (
        <p className="text-xs text-muted">
          {startsOn ? `Início em ${fmtDay(startsOn)}, sem data de fim.` : "Datas de vigência não informadas."}
          {renewalOn && ` Renovação em ${fmtDay(renewalOn)}.`}
        </p>
      ) : (
        <>
          <div className="relative mt-6 mb-2 h-2 rounded-full bg-surface-3">
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${today < startsOn ? 0 : pct(today)}%` }} />
            {today >= startsOn && today <= endsOn && (
              <span className="absolute -top-6 -translate-x-1/2 text-[10px] font-medium" style={{ left: `${pct(today)}%` }}>
                Hoje
              </span>
            )}
            {renewalOn && renewalOn >= startsOn && renewalOn <= endsOn && (
              <span
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-info"
                style={{ left: `${pct(renewalOn)}%` }}
                title={`Renovação: ${fmtDay(renewalOn)}`}
                aria-hidden
              />
            )}
          </div>
          <div className="flex justify-between text-[11px] text-muted">
            <span>{fmtDay(startsOn)}</span>
            <span>{fmtDay(endsOn)}</span>
          </div>
          {renewalOn && <p className="mt-2 text-[11px] text-muted">Renovação: {fmtDay(renewalOn)}</p>}
        </>
      )}
    </section>
  );
}

export function SignaturesCard({
  signatures,
  documentHash,
}: {
  signatures: { party: "contratante" | "contratada"; name: string; document: string; signed_at: string; ip: string | null }[];
  documentHash: string | null;
}) {
  const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });
  return (
    <section aria-label="Assinaturas" className="rounded-card bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-muted" aria-hidden /> Assinatura eletrônica
      </h2>
      <ul className="flex flex-col gap-2 text-xs">
        {(["contratante", "contratada"] as const).map((party) => {
          const s = signatures.find((x) => x.party === party);
          return (
            <li key={party} className="rounded-xl bg-surface-2 p-3">
              <p className="text-[11px] text-muted uppercase">{party === "contratante" ? "Contratante" : "Contratada"}</p>
              {s ? (
                <>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted">
                    Doc. {s.document} · {when.format(new Date(s.signed_at))}
                    {s.ip && ` · IP ${s.ip}`}
                  </p>
                </>
              ) : (
                <p className="text-muted">Aguardando assinatura</p>
              )}
            </li>
          );
        })}
      </ul>
      {documentHash && (
        <p className="mt-3 text-[10px] break-all text-muted">
          Código do documento (SHA-256): <span className="font-mono">{documentHash}</span>
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted">
        Assinatura eletrônica com registro de nome, documento, data, IP e código do documento, nos termos da MP 2.200-2/2001 (art. 10, § 2º).
      </p>
    </section>
  );
}
