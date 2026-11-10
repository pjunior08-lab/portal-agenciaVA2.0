import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileSignature,
  FileText,
  HeartPulse,
  Home,
  KanbanSquare,
  Target,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, EmptyState, SectionCard, StatCard } from "@/components/ui";
import { requireMember } from "@/lib/auth/session";
import { addDays, shortDate, startOfMonth, today, weekdayDate } from "@/lib/dates";
import { cn, formatBRL } from "@/lib/utils";
import { loadDashboard } from "@/features/inicio/data";
import {
  HEALTH,
  greeting,
  pendingSteps,
  portfolioHealth,
  upcomingDeadlines,
} from "@/features/inicio/schemas";

export const metadata: Metadata = { title: "Início" };

const KIND_LABEL = {
  demanda: "Demanda",
  contrato: "Contrato",
  proposta: "Proposta",
  financeiro: "Financeiro",
  comercial: "Comercial",
} as const;

export default async function InicioPage() {
  const ctx = await requireMember();
  const now = today();
  const d = await loadDashboard(ctx, now);
  const isAdmin = ctx.role === "admin";
  const firstName = (ctx.profile.full_name || ctx.email).split(/\s+/)[0];
  const month = startOfMonth(now);

  // ---------- números ----------
  const activeClients = d.clients.filter((c) => c.status === "ativo");
  const lateTasks = d.tasks.filter((t) => t.due_date && t.due_date < now);
  const todayTasks = d.tasks.filter((t) => t.due_date === now);
  const monthFin = d.fin.filter((t) => t.due_date >= month && t.due_date.slice(0, 7) === now.slice(0, 7));
  const received = monthFin.filter((t) => t.kind === "receita" && t.paid).reduce((s, t) => s + t.amount, 0);
  const spent = monthFin.filter((t) => t.kind === "despesa" && t.paid).reduce((s, t) => s + t.amount, 0);
  const result = Math.round((received - spent) * 100) / 100;
  const open = d.fin.filter((t) => !t.paid);
  const in7 = addDays(now, 7);
  const toReceive7 = open
    .filter((t) => t.kind === "receita" && t.due_date >= now && t.due_date <= in7)
    .reduce((s, t) => s + t.amount, 0);
  const toPay7 = open
    .filter((t) => t.kind === "despesa" && t.due_date >= now && t.due_date <= in7)
    .reduce((s, t) => s + t.amount, 0);
  const overdueIn = open.filter((t) => t.kind === "receita" && t.due_date < now);
  const overdueOut = open.filter((t) => t.kind === "despesa" && t.due_date < now);
  const openOpps = d.opps.filter((o) => !["fechado", "perdido"].includes(o.stage));
  const pipeline = openOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const closedMonth = d.opps.filter(
    (o) => o.stage === "fechado" && o.closed_at && o.closed_at.slice(0, 7) === now.slice(0, 7),
  );
  const newClientsMonth = d.clients.filter((c) => c.created_at.slice(0, 7) === now.slice(0, 7)).length;
  const byPerson = new Map<string, number>();
  for (const t of d.done) for (const u of t.assignees) byPerson.set(u, (byPerson.get(u) ?? 0) + 1);
  const ranking = [...byPerson]
    .map(([id, n]) => ({ id, n, name: d.people.find((p) => p.id === id)?.name ?? "Ex-membro" }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  const maxDone = Math.max(1, ...ranking.map((r) => r.n));

  const steps = pendingSteps(
    {
      agencyData: !!(ctx.agency.cnpj && ctx.agency.email && ctx.agency.logo_path),
      team: d.people.length > 1,
      client: d.clients.length > 0,
      task: d.taskCount > 0,
      portal: d.portalsEnabled > 0,
    },
    isAdmin,
  );
  const deadlines = upcomingDeadlines(d.deadlines, now, 7);
  const health = d.access.clientes
    ? portfolioHealth(
        activeClients,
        d.tasks,
        d.approvals,
        d.fin
          .filter((t) => t.kind === "receita" && !t.paid && t.client_id)
          .map((t) => ({ client_id: t.client_id, due_date: t.due_date, amount: t.amount })),
        now,
      )
    : [];
  const healthCount = { saudavel: 0, atencao: 0, critico: 0 };
  for (const h of health) healthCount[h.status]++;

  return (
    <>
      <PageHeader title="Início" icon={Home}>
        <span className="text-sm text-muted">
          {greeting(new Date().toISOString())}, {firstName} · {weekdayDate(now)}
        </span>
      </PageHeader>

      <div className="flex flex-col gap-4">
        {!steps.complete && (
          <SectionCard
            title="Primeiros passos"
            icon={CheckCircle2}
            description={`${steps.done} de ${steps.total} concluídos`}
          >
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {steps.steps.map((s) => (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    className={cn(
                      "flex h-full items-start gap-3 rounded-xl border border-line p-3 hover:bg-surface-2",
                      s.done && "opacity-60",
                    )}
                  >
                    {s.done ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Feito" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-label="A fazer" />
                    )}
                    <span>
                      <span className={cn("block text-sm font-medium", s.done && "line-through")}>
                        {s.title}
                      </span>
                      <span className="block text-xs text-muted">{s.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </SectionCard>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {d.access.clientes && (
            <StatCard
              label="Clientes ativos"
              value={activeClients.length}
              icon={BriefcaseBusiness}
              hint={`${d.clients.length} no total`}
            />
          )}
          <StatCard label="Equipe" value={d.people.length} icon={Users} hint="pessoas ativas" />
          {d.access.demandas && (
            <StatCard
              label="Demandas abertas"
              value={d.tasks.length}
              icon={KanbanSquare}
              hint={
                lateTasks.length ? (
                  <span className="text-danger">{lateTasks.length} atrasada(s)</span>
                ) : (
                  "nenhuma atrasada"
                )
              }
            />
          )}
          {d.access.aprovacoes && (
            <StatCard
              label="Aprovações pendentes"
              value={d.approvals.length}
              icon={ClipboardCheck}
              hint="aguardando o cliente"
            />
          )}
          {d.access.propostas && (
            <StatCard
              label="Propostas em aberto"
              value={d.proposals.length}
              icon={FileText}
              hint="enviadas ou em negociação"
            />
          )}
          {d.access.contratos && (
            <StatCard
              label="Contratos a assinar"
              value={d.contracts.filter((c) => c.status === "aguardando").length}
              icon={FileSignature}
              hint={`${d.contracts.filter((c) => c.status === "assinado").length} assinados em vigor`}
            />
          )}
          {d.access.financeiro && (
            <StatCard
              label="Resultado do mês"
              value={<span className={result < 0 ? "text-danger" : undefined}>{formatBRL(result)}</span>}
              icon={Wallet}
              hint="recebido menos pago"
            />
          )}
          <StatCard label="Horas" value="—" icon={Timer} hint="Apontamento de horas ainda em levantamento" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          {d.access.financeiro && (
            <SectionCard title="Financeiro" icon={Wallet} action={<More href="/financeiro" />}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Num label="A receber (7 dias)" value={formatBRL(toReceive7)} />
                <Num label="A pagar (7 dias)" value={formatBRL(toPay7)} />
                <Num label="Recebido no mês" value={formatBRL(received)} />
                <Num label="Pago no mês" value={formatBRL(spent)} />
              </dl>
              {(overdueIn.length > 0 || overdueOut.length > 0) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
                  <AlertCircle className="size-3.5" aria-hidden />
                  {overdueIn.length} recebimento(s) e {overdueOut.length} pagamento(s) vencidos
                </p>
              )}
            </SectionCard>
          )}

          {d.access.demandas && (
            <SectionCard title="Demandas" icon={KanbanSquare} action={<More href="/demandas" />}>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <Num label="Atrasadas" value={lateTasks.length} danger={lateTasks.length > 0} />
                <Num label="Para hoje" value={todayTasks.length} />
                <Num label="Sem prazo" value={d.tasks.filter((t) => !t.due_date).length} />
              </dl>
              {lateTasks.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-xs">
                  {lateTasks
                    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
                    .slice(0, 4)
                    .map((t) => (
                      <li key={t.id} className="flex gap-2">
                        <span className="w-12 shrink-0 text-danger">{shortDate(t.due_date!)}</span>
                        <Link href={`/demandas?quadro=${t.board_id}`} className="truncate hover:underline">
                          {t.title}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </SectionCard>
          )}

          {d.access.comercial && (
            <SectionCard title="Comercial" icon={Target} action={<More href="/comercial" />}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Num
                  label="Pipeline aberto"
                  value={formatBRL(pipeline)}
                  hint={`${openOpps.length} oportunidade(s)`}
                />
                <Num
                  label="Fechados no mês"
                  value={closedMonth.length}
                  hint={`${formatBRL(closedMonth.reduce((s, o) => s + (o.value ?? 0), 0))}/mês`}
                />
              </dl>
              {d.goal && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-surface-2">
                    <div
                      className="h-2 rounded-full bg-brand"
                      style={{ width: `${Math.min(100, Math.max(2, (closedMonth.length / d.goal) * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Meta do mês: {closedMonth.length} de {d.goal} novos clientes
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {d.access.demandas && (
            <SectionCard
              title="Desempenho"
              icon={TrendingUp}
              description="Demandas concluídas nos últimos 30 dias"
            >
              {ranking.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Nenhuma demanda concluída no período.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ranking.map((r) => (
                    <li key={r.id} className="text-xs">
                      <div className="flex justify-between">
                        <span className="truncate">{r.name}</span>
                        <span className="font-medium tabular-nums">{r.n}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                        <div
                          className="h-1.5 rounded-full bg-info"
                          style={{ width: `${(r.n / maxDone) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {d.access.clientes && (
            <SectionCard title="Clientes" icon={BriefcaseBusiness} action={<More href="/clientes" />}>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <Num label="Ativos" value={activeClients.length} />
                <Num label="Pausados" value={d.clients.filter((c) => c.status === "pausado").length} />
                <Num label="Novos no mês" value={newClientsMonth} />
              </dl>
              <p className="mt-3 text-xs text-muted">{d.portalsEnabled} cliente(s) com Portal ativo</p>
            </SectionCard>
          )}

          <SectionCard title="Prazos" icon={CalendarClock} description="Atrasados e próximos 7 dias">
            {deadlines.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">Nenhum prazo na semana.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {deadlines.map((x, i) => (
                  <li key={`${x.href}-${i}`} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "w-14 shrink-0 tabular-nums",
                        x.late ? "font-medium text-danger" : "text-muted",
                      )}
                    >
                      {x.inDays === 0 ? "Hoje" : shortDate(x.date)}
                    </span>
                    <Badge className="shrink-0">{KIND_LABEL[x.kind]}</Badge>
                    <Link href={x.href} className="min-w-0 truncate hover:underline">
                      {x.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {d.access.clientes && (
          <SectionCard
            title="Saúde da carteira"
            icon={HeartPulse}
            description="Por cliente ativo: demandas atrasadas, aprovações paradas há mais de 3 dias e mensalidades vencidas."
            action={
              <div className="flex gap-1.5 text-[11px]">
                <Badge tone="success-soft">{healthCount.saudavel} em dia</Badge>
                <Badge tone="brand">{healthCount.atencao} atenção</Badge>
                <Badge tone="danger">{healthCount.critico} crítico</Badge>
              </div>
            }
          >
            {health.length === 0 ? (
              <EmptyState icon={BriefcaseBusiness} title="Nenhum cliente ativo" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line text-right">
                      <th scope="col" className="py-2 text-left font-medium">
                        Cliente
                      </th>
                      {d.access.demandas && (
                        <th scope="col" className="px-2 py-2 font-medium">
                          Atrasadas
                        </th>
                      )}
                      {d.access.aprovacoes && (
                        <th scope="col" className="px-2 py-2 font-medium">
                          Aprovações paradas
                        </th>
                      )}
                      {d.access.financeiro && (
                        <th scope="col" className="px-2 py-2 font-medium">
                          Vencido
                        </th>
                      )}
                      <th scope="col" className="py-2 pl-2 font-medium">
                        Situação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {health.slice(0, 15).map((h) => (
                      <tr key={h.id} className="border-b border-line text-right last:border-0">
                        <td className="py-2 text-left">
                          <Link href={`/clientes/${h.id}`} className="hover:underline">
                            {h.name}
                          </Link>
                        </td>
                        {d.access.demandas && (
                          <td className={cn("px-2 py-2", h.lateTasks && "text-danger")}>{h.lateTasks}</td>
                        )}
                        {d.access.aprovacoes && <td className="px-2 py-2">{h.waiting}</td>}
                        {d.access.financeiro && (
                          <td className={cn("px-2 py-2", h.overdueAmount && "text-danger")}>
                            {h.overdueAmount ? formatBRL(h.overdueAmount) : "—"}
                          </td>
                        )}
                        <td className="py-2 pl-2">
                          <Badge tone={HEALTH[h.status].tone}>{HEALTH[h.status].label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {health.length > 15 && (
                  <p className="mt-2 text-xs text-muted">
                    Mostrando os 15 que pedem mais atenção de {health.length}.
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}

function More({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
      Abrir <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}

function Num({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={cn("text-base font-medium tabular-nums", danger && "text-danger")}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted-2">{hint}</dd>}
    </div>
  );
}
