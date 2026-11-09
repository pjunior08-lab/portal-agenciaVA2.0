"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox, Minus, Plus, Receipt, Repeat, Search } from "lucide-react";
import { Alert, Button, Card, EmptyState, FilterMenu, Input } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate, today } from "@/lib/dates";
import { SUBTYPES, TABS, byCategory, matchesTab, monthName, monthSummary, shiftMonth, type TabId } from "@/features/financeiro/schemas";
import { generateMonthlyFees, setPaid } from "@/features/financeiro/actions";
import type { TxView } from "@/features/financeiro/data";
import { useFinance } from "../finance-shell";

export function TransactionsApp({ month, openMode, transactions, missingFees }: { month: string; openMode: boolean; transactions: TxView[]; missingFees: number }) {
  const router = useRouter();
  const { base, canEdit, openNew, openEdit } = useFinance();
  const now = today();
  const [tab, setTab] = useState<TabId>("todas");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [showTotals, setShowTotals] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();

  const catName = useMemo(() => new Map(base.categories.map((c) => [c.id, c.name])), [base.categories]);
  const accName = useMemo(() => new Map(base.accounts.map((a) => [a.id, a.name])), [base.accounts]);
  const clientName = useMemo(() => new Map(base.clients.map((c) => [c.id, c.name])), [base.clients]);

  // filtros (menos a aba) definem as contagens das abas
  const filtered = transactions.filter((t) => {
    const term = q.trim().toLowerCase();
    if (term && !`${t.description} ${t.person ?? ""} ${t.client_id ? clientName.get(t.client_id) : ""}`.toLowerCase().includes(term)) return false;
    if (category && t.category_id !== category) return false;
    if (account && t.account_id !== account && t.to_account_id !== account) return false;
    if (status === "pagos" && !t.paid) return false;
    if (status === "abertos" && t.paid) return false;
    if (status === "atrasados" && (t.paid || t.due_date >= now)) return false;
    return true;
  });
  const visible = filtered.filter((t) => matchesTab(t, tab)).sort((a, b) => (sortAsc ? 1 : -1) * a.due_date.localeCompare(b.due_date));
  const summary = monthSummary(visible, openMode ? "" : month);

  const go = (m: string) => router.push(`/financeiro/lancamentos?mes=${m}`);

  return (
    <div className="flex flex-col gap-4">
      {/* mês, busca e filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {openMode ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-panel px-3.5 py-1.5 text-xs font-medium text-panel-ink">A pagar e receber</span>
            <Link href="/financeiro/lancamentos" className="text-xs text-muted underline-offset-2 hover:underline">
              Ver por mês
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-surface p-1">
            <Button size="icon-sm" variant="ghost" aria-label="Mês anterior" onClick={() => go(shiftMonth(month, -1))}>
              <ChevronLeft />
            </Button>
            <span className="min-w-36 rounded-full bg-panel px-3 py-1 text-center text-xs font-medium text-panel-ink">{monthName(month)}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Próximo mês" onClick={() => go(shiftMonth(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
        )}
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar lançamento" placeholder="Buscar lançamento" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 pl-9" />
        </div>
        <FilterMenu
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={[{ value: "", label: "Todas as categorias" }, ...base.categories.map((c) => ({ value: c.id, label: `${c.name} (${c.kind === "receita" ? "receita" : "despesa"})` }))]}
        />
        <FilterMenu
          label="Situação"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Todas as situações" },
            { value: "pagos", label: "Pagos / recebidos" },
            { value: "abertos", label: "Em aberto" },
            { value: "atrasados", label: "Atrasados" },
          ]}
        />
        <FilterMenu label="Conta" value={account} onChange={setAccount} options={[{ value: "", label: "Todas as contas" }, ...base.accounts.map((a) => ({ value: a.id, label: a.name }))]} />
      </div>

      {/* abas por tipo */}
      <div role="tablist" aria-label="Tipo" className="flex flex-wrap gap-1">
        {TABS.map((t) => {
          const n = filtered.filter((x) => matchesTab(x, t.id)).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium",
                tab === t.id ? "bg-panel text-panel-ink" : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              {t.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
      {missingFees > 0 && canEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-brand-soft p-3 text-sm">
          <Receipt className="size-4" aria-hidden />
          <span className="flex-1">
            {missingFees} {missingFees === 1 ? "mensalidade de cliente ativo ainda não foi lançada" : "mensalidades de clientes ativos ainda não foram lançadas"} em {monthName(month)}.
          </span>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await generateMonthlyFees(month);
                if (!r.ok) return setError(r.error);
                setInfo(`${r.data!.count} ${r.data!.count === 1 ? "mensalidade lançada" : "mensalidades lançadas"}.`);
                router.refresh();
              })
            }
          >
            Lançar mensalidades
          </Button>
        </div>
      )}

      {/* totais */}
      <Card className="flex flex-wrap items-end gap-x-8 gap-y-2 p-4">
        <Total label="Receitas" value={summary.receitas} className="text-success" />
        <Total label="Despesas" value={summary.despesas} className="text-danger" />
        <Total label="Saldo" value={summary.resultado} />
        <span className="flex-1" />
        <span className="text-right">
          <span className="block text-[11px] text-muted">Lançamentos</span>
          <span className="text-lg font-medium tabular-nums">{visible.length}</span>
        </span>
      </Card>

      {/* lista */}
      <Card className="p-0">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <span className="text-xs text-muted">Lançamento rápido</span>
            <Button size="sm" variant="secondary" className="text-success" onClick={() => openNew("receita", { due_date: openMode ? undefined : defaultDay(month) })}>
              <Plus /> Recebimento
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-danger"
              onClick={() =>
                openNew("despesa", {
                  subtype: tab !== "todas" && tab !== "receita" && tab !== "transferencia" ? tab : undefined,
                  due_date: openMode ? undefined : defaultDay(month),
                })
              }
            >
              <Minus /> Despesa
            </Button>
          </div>
        )}
        {visible.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhum lançamento encontrado" description={transactions.length ? "Ajuste os filtros ou a aba." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted uppercase">
                  <th className="px-4 py-2.5 font-medium">
                    <button type="button" onClick={() => setSortAsc(!sortAsc)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                      Vencimento {sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Descrição</th>
                  <th className="px-3 py-2.5 font-medium">Categoria</th>
                  <th className="px-3 py-2.5 font-medium">Conta</th>
                  <th className="px-3 py-2.5 font-medium">Pago?</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const late = !t.paid && t.due_date < now && t.kind !== "transferencia";
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                      <td className={cn("px-4 py-2.5 text-xs whitespace-nowrap", late ? "font-medium text-danger" : "text-muted")}>
                        {shortDate(t.due_date)}
                        {late && " · atrasado"}
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => openEdit(t)} className="flex flex-col text-left hover:underline">
                          <span className="flex items-center gap-1.5">
                            {t.description}
                            {t.recurrence_id && <Repeat className="size-3 text-muted" aria-label="Repete" />}
                          </span>
                          <span className="text-[11px] text-muted">
                            {t.kind === "despesa" && t.subtype ? SUBTYPES[t.subtype] : t.kind === "receita" ? "Recebimento" : "Transferência"}
                            {t.client_id && ` · ${clientName.get(t.client_id) ?? "Cliente"}`}
                            {t.person && ` · ${t.person}`}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">{t.category_id ? catName.get(t.category_id) : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {t.account_id ? accName.get(t.account_id) : "—"}
                        {t.to_account_id && ` → ${accName.get(t.to_account_id)}`}
                      </td>
                      <td className="px-3 py-2.5">
                        {t.kind === "transferencia" ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--brand)]"
                            checked={t.paid}
                            disabled={!canEdit || pending}
                            aria-label={`${t.description}: ${t.kind === "receita" ? "recebido" : "pago"}`}
                            onChange={(e) =>
                              start(async () => {
                                const r = await setPaid(t.id, e.target.checked);
                                if (!r.ok) return setError(r.error);
                                router.refresh();
                              })
                            }
                          />
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums",
                          t.kind === "receita" ? "text-success" : t.kind === "despesa" ? "text-danger" : "text-muted",
                        )}
                      >
                        {t.kind === "despesa" ? "− " : t.kind === "receita" ? "+ " : ""}
                        {formatBRL(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!openMode && (
        <>
          <button type="button" onClick={() => setShowTotals(!showTotals)} className="inline-flex items-center gap-1 self-start rounded-full bg-surface px-3 py-1.5 text-xs" aria-expanded={showTotals}>
            Ver totais por tipo e categoria {showTotals ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {showTotals && <TotalsByType transactions={filtered} month={month} catName={catName} />}
        </>
      )}
    </div>
  );
}

const defaultDay = (month: string) => (today().startsWith(month) ? today() : `${month}-01`);

function Total({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <span>
      <span className="block text-[11px] text-muted">{label}</span>
      <span className={cn("text-lg font-medium tabular-nums", className)}>{formatBRL(value)}</span>
    </span>
  );
}

function TotalsByType({ transactions, month, catName }: { transactions: TxView[]; month: string; catName: Map<string, string> }) {
  const rows = TABS.filter((t) => t.id !== "todas").map((t) => {
    const list = transactions.filter((x) => matchesTab(x, t.id));
    return { ...t, total: list.reduce((s, x) => s + x.amount, 0), count: list.length };
  });
  const cats = byCategory(transactions, month, "despesa", catName);
  const max = Math.max(1, ...cats.map((c) => c.total));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Por tipo</h3>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right text-xs text-muted">{r.count}</td>
                <td className="py-2 text-right tabular-nums">{formatBRL(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Despesas por categoria</h3>
        {cats.length === 0 ? (
          <p className="text-xs text-muted">Nada neste mês.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {cats.map((c) => (
              <li key={c.id} title={`${c.name}: ${formatBRL(c.total)}`}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{c.name}</span>
                  <span className="tabular-nums">{formatBRL(c.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-danger" style={{ width: `${(c.total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
