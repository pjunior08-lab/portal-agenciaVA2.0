import type { Metadata } from "next";
import { Lock, Tags } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ServicesApp } from "./services-app";

export const metadata: Metadata = { title: "Tabela de Serviços" };

export default async function ServicosPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "servicos")) {
    return (
      <>
        <PageHeader title="Tabela de Serviços" icon={Tags} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar a Tabela de Serviços." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, cadence, unit_price, scope_html, active, position")
    .eq("agency_id", ctx.agency.id)
    .order("position")
    .order("name");
  if (error) return <ErrorState description="Não foi possível carregar a tabela de serviços. Recarregue a página." />;
  return <ServicesApp services={(data ?? []).map((s) => ({ ...s, unit_price: Number(s.unit_price) }))} canEdit={memberCan(ctx, "servicos", "editar")} />;
}
