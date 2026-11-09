import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { today } from "@/lib/dates";
import { addDaysStr, monthEnd, monthStart, shiftMonth } from "@/features/financeiro/schemas";
import { loadTransactions } from "@/features/financeiro/data";
import { OverviewApp } from "./overview-app";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinanceiroPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "financeiro")) return null;
  const now = today();
  const month = now.slice(0, 7);
  // 5 meses para trás e 3 à frente (fluxo de caixa e tendências); em aberto antigos entram em "atrasadas"
  const [tx, overdue, renewals] = await Promise.all([
    loadTransactions(ctx, monthStart(shiftMonth(month, -5)), monthEnd(shiftMonth(month, 3))),
    createClient().then((s) =>
      s
        .from("fin_transactions")
        .select("id, kind, subtype, amount, description, due_date, paid, paid_at, category_id, account_id, to_account_id, client_id, person, notes, recurrence_id, installment, installments, source")
        .eq("agency_id", ctx.agency.id)
        .eq("paid", false)
        .neq("kind", "transferencia")
        .lt("due_date", monthStart(shiftMonth(month, -5)))
        .limit(500),
    ),
    memberCan(ctx, "contratos")
      ? createClient().then((s) =>
          s
            .from("contracts")
            .select("id, title, value, renewal_on, ends_on, clients(name)")
            .eq("agency_id", ctx.agency.id)
            .eq("status", "assinado")
            .or(`renewal_on.lte.${addDaysStr(now, 60)},and(renewal_on.is.null,ends_on.lte.${addDaysStr(now, 60)})`)
            .limit(50),
        )
      : Promise.resolve({ data: [] }),
  ]);
  if (tx.error) return <ErrorState description="Não foi possível carregar o Financeiro. Recarregue a página." />;

  const older = (overdue.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  return (
    <OverviewApp
      transactions={[...older, ...tx.data]}
      month={month}
      today={now}
      name={(ctx.profile.full_name || ctx.email).split(/\s+/)[0]}
      agencyName={ctx.agency.name}
      renewals={(renewals.data ?? [])
        .map((c) => {
          const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
          return { id: c.id, title: c.title, client: client?.name ?? "", value: c.value == null ? null : Number(c.value), date: (c.renewal_on ?? c.ends_on) as string };
        })
        .filter((c) => !!c.date)
        .sort((a, b) => a.date.localeCompare(b.date))}
    />
  );
}
