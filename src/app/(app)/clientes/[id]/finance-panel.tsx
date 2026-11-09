import Link from "next/link";
import { Receipt, Wallet } from "lucide-react";
import { Badge, SectionCard, StatCard, buttonVariants } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate } from "@/lib/dates";

export interface ClientTx {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
}

/** Aba Financeiro da ficha: mensalidade e recebimentos do cliente. */
export function FinancePanel({
  monthlyFee,
  billingDay,
  status,
  receipts,
  today,
}: {
  monthlyFee: number | null;
  billingDay: number | null;
  status: string;
  receipts: ClientTx[];
  today: string;
}) {
  const year = today.slice(0, 4);
  const received = receipts.filter((t) => t.paid && (t.paid_at ?? "").startsWith(year)).reduce((s, t) => s + t.amount, 0);
  const open = receipts.filter((t) => !t.paid);
  const late = open.filter((t) => t.due_date < today);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Mensalidade"
          value={monthlyFee ? formatBRL(monthlyFee) : "—"}
          icon={Wallet}
          hint={monthlyFee ? (billingDay ? `Vence todo dia ${billingDay}` : "Sem dia de cobrança: vence dia 1") : "Defina em Editar"}
        />
        <StatCard label={`Recebido em ${year}`} value={formatBRL(received)} icon={Receipt} />
        <StatCard label="Em aberto" value={formatBRL(open.reduce((s, t) => s + t.amount, 0))} icon={Receipt} hint={`${open.length} lançamento(s)`} />
        <StatCard label="Atrasado" value={formatBRL(late.reduce((s, t) => s + t.amount, 0))} icon={Receipt} hint={late.length ? `${late.length} em atraso` : "Nada em atraso"} />
      </div>
      {monthlyFee && status !== "ativo" && (
        <p className="rounded-card bg-brand-soft p-3 text-xs">A mensalidade só é lançada para clientes com status Ativo.</p>
      )}
      <SectionCard
        title="Recebimentos"
        icon={Receipt}
        description="Receitas lançadas no Financeiro para este cliente."
        action={
          <Link href="/financeiro/lancamentos" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            Abrir Financeiro
          </Link>
        }
      >
        {receipts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum recebimento lançado para este cliente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {receipts.map((t) => {
              const isLate = !t.paid && t.due_date < today;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className={cn("w-14 text-xs", isLate ? "text-danger" : "text-muted")}>{shortDate(t.due_date)}</span>
                  <span className="min-w-0 flex-1 truncate">{t.description}</span>
                  <Badge tone={t.paid ? "success-soft" : isLate ? "danger" : "neutral"}>
                    {t.paid ? `Recebido ${t.paid_at ? shortDate(t.paid_at) : ""}` : isLate ? "Atrasado" : "A receber"}
                  </Badge>
                  <span className="w-28 text-right tabular-nums">{formatBRL(t.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
