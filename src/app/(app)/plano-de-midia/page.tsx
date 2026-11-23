import type { Metadata } from "next";
import { Lock, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MediaPlanApp } from "./media-plan-app";

export const metadata: Metadata = { title: "Plano de Mídia" };

export default async function PlanoDeMidiaPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "plano-de-midia")) {
    return (
      <>
        <PageHeader title="Plano de Mídia" icon={Megaphone} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o Plano de Mídia." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [campaigns, clients] = await Promise.all([
    supabase
      .from("media_campaigns")
      .select("id, client_id, name, platform, objective, status, start_date, end_date, planned_budget, spent, spent_updated_at, notes")
      .eq("agency_id", ctx.agency.id)
      .order("start_date", { ascending: false }),
    supabase.from("clients").select("id, name").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
  ]);
  if (campaigns.error) return <ErrorState description="Não foi possível carregar o Plano de Mídia. Recarregue a página." />;
  return (
    <MediaPlanApp
      campaigns={(campaigns.data ?? []).map((c) => ({ ...c, planned_budget: Number(c.planned_budget), spent: Number(c.spent) }))}
      clients={clients.data ?? []}
      canEdit={memberCan(ctx, "plano-de-midia", "editar")}
    />
  );
}
