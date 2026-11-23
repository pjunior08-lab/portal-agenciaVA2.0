import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, ErrorState, SectionCard } from "@/components/ui";
import { requireMember } from "@/lib/auth/session";
import { formatBRL } from "@/lib/utils";
import { loadFinanceBase, loadTransactions } from "@/features/financeiro/data";
import { monthEnd, monthName, monthReport, monthStart, shiftMonth } from "@/features/financeiro/schemas";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Relatório do mês · Financeiro" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function RelatorioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const ctx = await requireMember();
  const { mes } = await searchParams;
  const key = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : today().slice(0, 7);
  const [base, tx] = await Promise.all([loadFinanceBase(ctx), loadTransactions(ctx, monthStart(key), monthEnd(key))]);
  if (tx.error) return <ErrorState description="Não foi possível carregar os lançamentos do mês. Recarregue a página." />;
  const r = monthReport(tx.data, today());
  const client = (id: string) => (id ? (base.clients.find((c) => c.id === id)?.name ?? "Cliente arquivado") : "Sem cliente");
  const category = (id: string) => (id ? (base.categories.find((c) => c.id === id)?.name ?? "Categoria") : "Sem categoria");

  return (
    <div className="flex flex-col gap-4 print:gap-3 print:text-[12px]">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`?mes=${shiftMonth(key, -1)}`} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-40 text-center text-sm font-medium capitalize">{monthName(key)}</span>
        <Link href={`?mes=${shiftMonth(key, 1)}`} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Link>
        <span className="flex-1" />
        <PrintButton />
      </div>

      <header className="hidden print:block">
        <p className="text-xs text-muted">{ctx.agency.name}</p>
        <h1 className="text-xl font-semibold capitalize">Relatório financeiro · {monthName(key)}</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        {(
          [
            ["Receitas", r.receitas, "text-success"],
            ["Despesas", r.despesas, "text-danger"],
            ["Resultado", r.resultado, r.resultado.realizado < 0 ? "text-danger" : ""],
          ] as const
        ).map(([label, v, tone]) => (
          <SectionCard key={label} title={label}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Realizado</dt>
                <dd className={`text-lg font-medium tabular-nums ${tone}`}>{formatBRL(v.realizado)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Previsto</dt>
                <dd className="text-lg tabular-nums">{formatBRL(v.previsto)}</dd>
              </div>
            </dl>
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <SectionCard title="Receitas por cliente">
          <Rows rows={r.porCliente.map((x) => ({ label: client(x.id), ...x }))} empty="Nenhuma receita no mês." />
        </SectionCard>
        <SectionCard title="Despesas por categoria">
          <Rows rows={r.porCategoria.map((x) => ({ label: category(x.id), ...x }))} empty="Nenhuma despesa no mês." />
        </SectionCard>
      </div>

      <SectionCard title="Em aberto" description="Lançamentos do mês ainda não marcados como pagos ou recebidos.">
        {r.emAberto.length === 0 ? (
          <p className="py-3 text-sm text-muted">Tudo quitado neste mês.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">Vencimento</th>
                <th className="py-1 font-normal">Descrição</th>
                <th className="py-1 font-normal">Tipo</th>
                <th className="py-1 text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {r.emAberto.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2 tabular-nums">
                    {br(t.due_date)} {t.atrasado && <Badge tone="danger">atrasado</Badge>}
                  </td>
                  <td className="py-2">{t.description}</td>
                  <td className="py-2 text-muted">{t.kind === "receita" ? "A receber" : "A pagar"}</td>
                  <td className={`py-2 text-right tabular-nums ${t.kind === "receita" ? "text-success" : "text-danger"}`}>{formatBRL(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function Rows({ rows, empty }: { rows: { id: string; label: string; previsto: number; realizado: number }[]; empty: string }) {
  if (!rows.length) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1 font-normal" />
          <th className="py-1 text-right font-normal">Realizado</th>
          <th className="py-1 text-right font-normal">Previsto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={x.id || "nenhum"} className="border-t border-line">
            <td className="py-2">{x.label}</td>
            <td className="py-2 text-right tabular-nums">{formatBRL(x.realizado)}</td>
            <td className="py-2 text-right text-muted tabular-nums">{formatBRL(x.previsto)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
