import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, ThumbsUp, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState, HeroStatCard, SectionCard, StatCard } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { monthName, shiftMonth } from "@/features/financeiro/schemas";
import { formatHours, rowPct, teamTotals } from "@/features/desempenho/schemas";

export const metadata: Metadata = { title: "Desempenho" };

const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const show = (n: number | null) => (n == null ? "—" : `${n}%`);

export default async function DesempenhoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "desempenho")) {
    return (
      <>
        <PageHeader title="Desempenho" icon={BarChart3} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o Desempenho." />
        </Card>
      </>
    );
  }
  const { mes } = await searchParams;
  const key = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : thisMonth();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("performance_report", { a: ctx.agency.id, month: `${key}-01` });
  if (error) return <ErrorState description="Não foi possível calcular o desempenho. Recarregue a página." />;
  const rows = (data ?? []).map((r) => ({ ...r, avg_approval_hours: r.avg_approval_hours == null ? null : Number(r.avg_approval_hours) }));
  const t = teamTotals(rows);
  const team = ctx.role === "admin";

  return (
    <>
      <PageHeader title="Desempenho" icon={BarChart3}>
        <div className="flex items-center gap-1">
          <Link href={`?mes=${shiftMonth(key, -1)}`} aria-label="Mês anterior" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{monthName(key)}</span>
          <Link href={`?mes=${shiftMonth(key, 1)}`} aria-label="Próximo mês" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </PageHeader>
      <p className="-mt-2 mb-4 text-sm text-muted">
        {team ? "Números da equipe" : "Seus números"}, calculados das Demandas e das Aprovações. Ninguém precisa preencher nada.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroStatCard label="Demandas entregues" value={t.delivered} icon={CheckCircle2} hint="concluídas no mês" />
        <StatCard label="Entregues no prazo" value={show(t.onTimePct)} icon={Clock} hint="das que tinham prazo" />
        <StatCard label="Aprovadas de primeira" value={show(t.firstPct)} icon={ThumbsUp} hint="posts sem pedido de alteração" />
        <StatCard label="Tempo de aprovação" value={formatHours(t.avgHours)} icon={Clock} hint="do envio à resposta do cliente" />
      </div>
      {t.overdue > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm">
          <TriangleAlert className="size-4 text-danger" aria-hidden /> {t.overdue} demanda(s) em aberto com prazo vencido hoje.
        </p>
      )}

      <SectionCard title={team ? "Por pessoa" : "Você"} icon={BarChart3}>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted">Nada para mostrar neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 font-normal">Pessoa</th>
                  <th className="py-2 text-right font-normal">Entregues</th>
                  <th className="py-2 text-right font-normal">No prazo</th>
                  <th className="py-2 text-right font-normal">Atrasadas abertas</th>
                  <th className="py-2 text-right font-normal">Posts decididos</th>
                  <th className="py-2 text-right font-normal">Aprovados de primeira</th>
                  <th className="py-2 text-right font-normal">Tempo de aprovação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-line">
                    <td className="py-2.5 font-medium">{r.full_name || "Sem nome"}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.delivered}</td>
                    <td className="py-2.5 text-right tabular-nums">{show(rowPct.onTime(r))}</td>
                    <td className={`py-2.5 text-right tabular-nums ${r.open_overdue ? "text-danger" : ""}`}>{r.open_overdue}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.posts_decided}</td>
                    <td className="py-2.5 text-right tabular-nums">{show(rowPct.first(r))}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatHours(r.avg_approval_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
