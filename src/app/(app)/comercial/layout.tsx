import { Lock, Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { today } from "@/lib/dates";
import { loadCrmBase } from "@/features/comercial/data";
import { CrmShell } from "./crm-shell";

/** Moldura do Comercial: abas, botão de nova oportunidade e a ficha (modal) compartilhada. */
export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial")) {
    return (
      <>
        <PageHeader title="Comercial" icon={Target} />
        <Card>
          <EmptyState
            icon={Lock}
            title="Sem acesso"
            description="Peça a um administrador para liberar o módulo Comercial."
          />
        </Card>
      </>
    );
  }
  const now = today();
  const base = await loadCrmBase(ctx, now.slice(0, 7));
  if (base.error) {
    return (
      <>
        <PageHeader title="Comercial" icon={Target} />
        <ErrorState description="Não foi possível carregar o Comercial. Recarregue a página." />
      </>
    );
  }
  return (
    <CrmShell base={base} canEdit={memberCan(ctx, "comercial", "editar")} userId={ctx.userId} today={now}>
      {children}
    </CrmShell>
  );
}
