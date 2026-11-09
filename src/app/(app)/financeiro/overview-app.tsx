"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChartColumn,
  ChartLine,
  Eye,
  EyeOff,
  Flag,
  Landmark,
  ListOrdered,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, BarRows, Button, GoalBar, GroupedBars, LineChart, SectionCard } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate, weekdayDate } from "@/lib/dates";
import {
  ACCOUNT_KINDS,
  balanceEvolution,
  byCategory,
  byPerson,
  cashflow,
  changesVsLastMonth,
  goals,
  monthShort,
  monthSummary,
  revenueByClient,
  shiftMonth,
  topExpenseTrend,
  upcoming,
} from "@/features/financeiro/schemas";
import type { TxView } from "@/features/financeiro/data";
import { useFinance } from "./finance-shell";

const SERIES = [
  { name: "Receitas", color: "var(--info)" },
  { name: "Despesas", color: "var(--danger)" },
];

function pctChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

export function OverviewApp({
  transactions,
  month,
  today,
  name,
  agencyName,
  renewals,
}: {
  transactions: TxView[];
  month: string;
  today: string;
  name: string;
  agencyName: string;
  renewals: { id: string; title: string; client: string; value: number | null; date: string }[];
}) {
  const { base, canEdit, openAccounts, openCategories, openEdit } = useFinance();
  // ocultar valores: preferência só deste navegador
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("fin-hide") === "1");
    } catch {}
  }, []);
  const toggleHidden = () => {
    setHidden((h) => {
      try {
        localStorage.setItem("fin-hide", h ? "0" : "1");
      } catch {}
      return !h;
    });
  };
  const money = (n: number) => (hidden ? "R$ •••" : formatBRL(n));

  const catNames = useMemo(() => new Map(base.categories.map((c) => [c.id, c.name])), [base.categories]);
  const clientNames = useMemo(() => new Map(base.clients.map((c) => [c.id, c.name])), [base.clients]);
  const s = monthSummary(transactions, month);
  const prev = monthSummary(transactions, shiftMonth(month, -1));
  const balance = base.accounts.reduce((acc, a) => acc + a.balance, 0);
  // o que ainda entra e sai neste mês
  const forecast = balance + s.aReceber - s.aPagar;
  const keys = Array.from({ length: 9 }, (_, i) => shiftMonth(month, i - 5));
  const flow = cashflow(transactions, keys);
  const trend = topExpenseTrend(transactions, keys.slice(0, 6), catNames);
  const changes = changesVsLastMonth(transactions, month, catNames).slice(0, 5);
  const next = upcoming(transactions, today);
  const [nextTab, setNextTab] = useState<"overdue" | "next">(next.overdue.length ? "overdue" : "next");
  const evo = balanceEvolution(transactions, month, balance, today);
  const monthTx = transactions.filter((t) => t.due_date.startsWith(month));
  const biggest = monthTx.filter((t) => t.kind === "despesa").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const latest = transactions
    .filter((t) => t.paid && t.paid_at && t.kind !== "transferencia")
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
    .slice(0, 8);
  const goalRows = goals(transactions, month, base.categories);
  const people = byPerson(transactions, month);
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const empty = transactions.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* saudação e números do mês */}
      <section className="rounded-card bg-brand-soft p-5">
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted capitalize">{weekdayDate(today)}</p>
            <h2 className="text-2xl font-normal tracking-tight">
              {greeting}, {name}
            </h2>
            <Badge tone="brand" className="mt-1">
              {agencyName}
            </Badge>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={toggleHidden} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} aria-pressed={hidden}>
            {hidden ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Wallet} label="Saldo geral" value={money(balance)} hint={base.accounts.length ? "Somando todas as contas" : "Cadastre suas contas"} />
          <Stat icon={TrendingUp} label="Receitas do mês" value={money(s.receitas)} tone="text-success" hint={compare(s.receitas, prev.receitas)} />
          <Stat icon={TrendingDown} label="Despesas do mês" value={money(s.despesas)} tone="text-danger" hint={compare(s.despesas, prev.despesas)} />
          <Stat icon={Scale} label="Resultado do mês" value={money(s.resultado)} tone={s.resultado < 0 ? "text-danger" : undefined} hint={s.resultado === 0 ? "No zero a zero" : s.resultado > 0 ? "Sobrando" : "Faltando"} />
        </div>
      </section>

      {empty && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 text-sm">
          <span className="flex-1">Ainda não há lançamentos. Comece cadastrando suas contas e categorias, depois lance receitas e despesas.</span>
          {canEdit && (
            <>
              <Button size="sm" variant="secondary" onClick={openAccounts}>
                Contas
              </Button>
              <Button size="sm" variant="secondary" onClick={openCategories}>
                Categorias
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Resultado previsto do mês" icon={Target}>
          <p className={cn("mb-3 text-2xl font-medium tabular-nums", s.resultado < 0 && "text-danger")}>{money(s.resultado)}</p>
          <Breakdown title="Recebimentos" rows={[["Recebido", s.recebido], ["Falta", s.aReceber], ["Previsto", s.receitas]]} money={money} tone="text-success" />
          <Breakdown title="Despesas" rows={[["Pago", s.pago], ["Falta", s.aPagar], ["Previsto", s.despesas]]} money={money} tone="text-danger" />
        </SectionCard>
        <SectionCard title="Comparativo com projeção" icon={ChartColumn} description="O que já aconteceu frente ao previsto no mês.">
          <GroupedBars
            groups={[
              { key: "prev", label: "Previsto", values: [s.receitas, s.despesas] },
              { key: "real", label: "Realizado", values: [s.recebido, s.pago] },
            ]}
            series={SERIES}
            format={money}
          />
        </SectionCard>
        <SectionCard title="Saldo e fechamento" icon={PiggyBank}>
          <p className="text-[11px] text-muted">Saldo atual</p>
          <p className="mb-3 text-2xl font-medium tabular-nums">{money(balance)}</p>
          <div className="rounded-xl bg-surface-2 p-3 text-xs">
            <p className="text-muted">Previsão de fechamento do mês</p>
            <p className="mb-1 text-lg font-medium tabular-nums">{money(forecast)}</p>
            <p className="mb-2 text-[11px] text-muted">Saldo atual somado ao que ainda falta receber e pagar neste mês.</p>
            <Line label="Falta receber" value={money(s.aReceber)} tone="text-success" />
            <Line label="Falta pagar" value={money(s.aPagar)} tone="text-danger" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <SectionCard title="Fluxo de caixa, com projeção" icon={ChartColumn} description="Últimos 5 meses, este e os 3 próximos (previsto).">
          {flow.every((f) => !f.receitas && !f.despesas) ? (
            <p className="py-10 text-center text-xs text-muted">Nenhum lançamento nestes meses. O gráfico aparece quando houver receitas ou despesas.</p>
          ) : (
            <GroupedBars
              groups={flow.map((f) => ({ key: f.key, label: monthShort(f.key), values: [f.receitas, f.despesas], projected: f.key > month }))}
              series={SERIES}
              format={money}
            />
          )}
        </SectionCard>
        <SectionCard title="Minhas contas" icon={Landmark} action={<span className="text-[11px] text-muted">{base.accounts.length} contas</span>}>
          {base.accounts.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Nenhuma conta cadastrada ainda.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5">
              {base.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {a.name} <span className="text-[11px] text-muted">· {ACCOUNT_KINDS[a.kind]}</span>
                  </span>
                  <span className={cn("tabular-nums", a.balance < 0 && "text-danger")}>{money(a.balance)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mb-2 flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Saldo total</span>
            <span className="font-medium tabular-nums">{money(balance)}</span>
          </div>
          {canEdit && (
            <Button size="sm" variant="secondary" className="w-full" onClick={openAccounts}>
              <Plus /> Nova conta
            </Button>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Despesas por categoria" icon={ChartColumn} action={<OpenLink />}>
          <BarRows rows={byCategory(transactions, month, "despesa", catNames).map((c) => ({ id: c.id, label: c.name, value: c.total }))} format={money} color="var(--danger)" />
        </SectionCard>
        <SectionCard title="Onde mais gastei" icon={ListOrdered} description="As maiores despesas do mês.">
          {biggest.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Sem despesas registradas neste mês.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {biggest.map((t, i) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openEdit(t)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm hover:bg-surface-2">
                    <span className="w-4 text-xs text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{t.description}</span>
                    <span className="tabular-nums">{money(t.amount)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
        <SectionCard title="Tendência das maiores despesas" icon={ChartLine} description="As 3 categorias que mais pesaram nos últimos 6 meses.">
          {trend.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Sem despesas nos últimos meses.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {trend.map((c) => {
                const max = Math.max(1, ...c.points.map((p) => p.total));
                return (
                  <li key={c.id}>
                    <p className="mb-1 text-xs font-medium">{c.name}</p>
                    <div className="flex h-10 items-end gap-1">
                      {c.points.map((p) => (
                        <div key={p.key} className="flex h-full flex-1 items-end justify-center" title={`${monthShort(p.key)}: ${money(p.total)}`}>
                          <div className="w-full max-w-6 rounded-t bg-danger" style={{ height: `${Math.max(p.total ? 6 : 0, (p.total / max) * 100)}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {c.points.map((p) => (
                        <span key={p.key} className="flex-1 text-center text-[9px] text-muted">
                          {monthShort(p.key)}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="O que mudou vs. mês passado" icon={Scale} description="Categorias de despesa com maior diferença.">
          {changes.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Sem diferença entre este mês e o anterior.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {changes.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  {c.delta > 0 ? <ArrowUpRight className="size-4 text-danger" aria-label="Aumentou" /> : <ArrowDownRight className="size-4 text-success" aria-label="Diminuiu" />}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {money(c.before)} → {money(c.now)}
                  </span>
                  <span className={cn("w-24 text-right tabular-nums", c.delta > 0 ? "text-danger" : "text-success")}>
                    {c.delta > 0 ? "+" : "−"}
                    {money(Math.abs(c.delta))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="De onde veio a receita" icon={Users} description="Receitas do mês por cliente.">
          <BarRows rows={revenueByClient(transactions, month, clientNames).map((c) => ({ id: c.id, label: c.name, value: c.total }))} format={money} empty="Sem faturamento registrado neste mês." />
        </SectionCard>
        <SectionCard
          title="Próximas contas"
          icon={CalendarClock}
          action={
            <Link href="/financeiro/lancamentos?status=aberto" className="text-xs underline-offset-2 hover:underline">
              Ver todas
            </Link>
          }
        >
          <div role="tablist" aria-label="Próximas contas" className="mb-3 flex gap-1 rounded-full bg-surface-2 p-1">
            {(
              [
                ["overdue", `Atrasadas ${next.overdue.length}`],
                ["next", `A vencer ${next.next.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={nextTab === id}
                onClick={() => setNextTab(id)}
                className={cn("h-7 flex-1 rounded-full text-xs font-medium", nextTab === id ? (id === "overdue" ? "bg-danger text-white" : "bg-brand text-brand-ink") : "text-muted")}
              >
                {label}
              </button>
            ))}
          </div>
          {(nextTab === "overdue" ? next.overdue : next.next).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">{nextTab === "overdue" ? "Nada atrasado." : "Nenhum vencimento nos próximos 30 dias."}</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {(nextTab === "overdue" ? next.overdue : next.next).slice(0, 12).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openEdit(t)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs hover:bg-surface-2">
                    <span className={cn("w-12 shrink-0", nextTab === "overdue" ? "text-danger" : "text-muted")}>{shortDate(t.due_date)}</span>
                    <span className="min-w-0 flex-1 truncate">{t.description}</span>
                    <span className={cn("tabular-nums", t.kind === "receita" ? "text-success" : "text-danger")}>
                      {t.kind === "receita" ? "+" : "−"}
                      {money(t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Previsão do mês" icon={Flag}>
          <p className="text-[11px] text-muted">Saldo previsto para o fim do mês</p>
          <p className="mb-3 text-2xl font-medium tabular-nums">{money(forecast)}</p>
          <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-xs">
            <Line label="Já recebido" value={money(s.recebido)} tone="text-success" />
            <Line label="Ainda a receber" value={money(s.aReceber)} />
            <Line label="Já gasto" value={money(s.pago)} tone="text-danger" />
            <Line label="Ainda a pagar" value={money(s.aPagar)} />
            <div className="mt-1 border-t border-line pt-1.5">
              <Line label="Resultado previsto" value={money(s.resultado)} />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Metas do mês"
          icon={Target}
          action={
            canEdit && (
              <button type="button" onClick={openCategories} className="text-xs underline-offset-2 hover:underline">
                Definir metas
              </button>
            )
          }
        >
          {goalRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Nenhuma categoria tem meta mensal ainda. Defina em Categorias para acompanhar aqui.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {goalRows.map((g) => (
                <GoalBar
                  key={g.id}
                  label={`${g.name}${g.kind === "receita" ? " (receita)" : ""}`}
                  value={g.spent}
                  goal={g.goal}
                  format={money}
                  higherIsBetter={g.kind === "receita"}
                />
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Receitas por categoria" icon={ChartColumn}>
          <BarRows rows={byCategory(transactions, month, "receita", catNames).map((c) => ({ id: c.id, label: c.name, value: c.total }))} format={money} />
        </SectionCard>
      </div>

      <SectionCard title="Evolução do saldo" icon={ChartLine} description="Saldo de todas as contas dia a dia neste mês (tracejado: previsto).">
        {base.accounts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Cadastre suas contas para acompanhar o saldo.</p>
        ) : (
          <LineChart points={evo.map((d) => ({ key: d.day, label: shortDate(d.day), value: d.balance, projected: d.projected }))} format={money} />
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Últimas transações" icon={Receipt} action={<OpenLink />}>
          {latest.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Nada pago ou recebido ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {latest.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openEdit(t)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs hover:bg-surface-2">
                    <span className="w-12 shrink-0 text-muted">{shortDate(t.paid_at!)}</span>
                    <span className="min-w-0 flex-1 truncate">{t.description}</span>
                    <span className={cn("tabular-nums", t.kind === "receita" ? "text-success" : "text-danger")}>
                      {t.kind === "receita" ? "+" : "−"}
                      {money(t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Gastos por pessoa" icon={Users} description="Despesas do tipo Pessoa neste mês.">
          <BarRows rows={people.map((p) => ({ id: p.name, label: p.name, value: p.total }))} format={money} color="var(--danger)" empty="Nenhum pagamento a pessoas neste mês." />
        </SectionCard>
        <SectionCard title="Renovações próximas" icon={CalendarClock} description="Contratos assinados que renovam em até 60 dias.">
          {renewals.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Nenhuma renovação nos próximos 60 dias.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {renewals.map((r) => (
                <li key={r.id}>
                  <Link href={`/contratos/${r.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs hover:bg-surface-2">
                    <span className={cn("w-12 shrink-0", r.date < today ? "text-danger" : "text-muted")}>{shortDate(r.date)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.title}
                      <span className="text-muted"> · {r.client}</span>
                    </span>
                    {r.value != null && <span className="tabular-nums">{money(r.value)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function compare(now: number, before: number) {
  const p = pctChange(now, before);
  return p === null ? "Sem mês anterior para comparar" : `${p > 0 ? "+" : ""}${p}% vs. mês passado`;
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Wallet; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-card bg-surface p-4">
      <p className="mb-2 flex items-center gap-2 text-xs text-muted">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-brand-ink">
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </p>
      <p className={cn("text-xl font-medium tabular-nums", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows, money, tone }: { title: string; rows: [string, number][]; money: (n: number) => string; tone: string }) {
  return (
    <div className="mb-2 rounded-xl bg-surface-2 p-3 text-xs">
      <p className={cn("mb-1 font-medium", tone)}>{title}</p>
      {rows.map(([l, v], i) => (
        <Line key={l} label={l} value={money(v)} tone={i === rows.length - 1 ? tone : undefined} />
      ))}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={cn("tabular-nums", tone)}>{value}</span>
    </p>
  );
}

function OpenLink() {
  return (
    <Link href="/financeiro/lancamentos" className="text-xs underline-offset-2 hover:underline">
      Abrir lançamentos
    </Link>
  );
}
