import { Lock, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { loadFinanceBase } from "@/features/financeiro/data";
import { FinanceShell } from "./finance-shell";

/** Moldura do Financeiro: abas, botões de novo lançamento e cadastros (contas e categorias). */
export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "financeiro")) {
    return (
      <>
        <PageHeader title="Financeiro" icon={Wallet} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Financeiro." />
        </Card>
      </>
    );
  }
  const base = await loadFinanceBase(ctx);
  return (
    <FinanceShell base={base} canEdit={memberCan(ctx, "financeiro", "editar")}>
      {children}
    </FinanceShell>
  );
}
