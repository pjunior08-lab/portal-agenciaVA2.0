import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { today } from "@/lib/dates";
import { addDaysStr, monthEnd, monthStart } from "@/features/financeiro/schemas";
import { loadTransactions } from "@/features/financeiro/data";
import { TransactionsApp } from "./transactions-app";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function LancamentosPage({ searchParams }: { searchParams: Promise<{ mes?: string; status?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "financeiro")) return null;
  const { mes, status } = await searchParams;
  const now = today();
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : now.slice(0, 7);
  const openMode = status === "aberto";

  // "A pagar e receber": tudo em aberto até 60 dias à frente; senão, o mês escolhido
  const { data, error } = openMode
    ? await loadTransactions(ctx, "2000-01-01", addDaysStr(now, 60))
    : await loadTransactions(ctx, monthStart(month), monthEnd(month));
  if (error) return <ErrorState description="Não foi possível carregar os lançamentos. Recarregue a página." />;

  // mensalidades de clientes ativos ainda não lançadas no mês
  let missingFees = 0;
  if (!openMode && memberCan(ctx, "financeiro", "editar")) {
    const supabase = await createClient();
    const { data: fees } = await supabase.from("clients").select("id").eq("agency_id", ctx.agency.id).eq("status", "ativo").gt("monthly_fee", 0);
    const launched = new Set(data.filter((t) => t.source === "mensalidade").map((t) => t.client_id));
    missingFees = (fees ?? []).filter((c) => !launched.has(c.id)).length;
  }

  return <TransactionsApp month={month} openMode={openMode} transactions={openMode ? data.filter((t) => !t.paid && t.kind !== "transferencia") : data} missingFees={missingFees} />;
}
