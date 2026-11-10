import type { Metadata } from "next";
import { Filter, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FunnelsApp } from "./funnels-app";

export const metadata: Metadata = { title: "Funil" };

export default async function FunilPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "funil")) {
    return (
      <>
        <PageHeader title="Funil" icon={Filter} />
        <Card>
          <EmptyState
            icon={Lock}
            title="Sem acesso"
            description="Peça a um administrador para liberar o módulo Funil."
          />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [funnels, folders, clients] = await Promise.all([
    supabase
      .from("funnels")
      .select("id, name, template, folder_id, client_id, deleted_at, updated_at")
      .eq("agency_id", ctx.agency.id)
      .order("updated_at", { ascending: false }),
    supabase.from("funnel_folders").select("id, name").eq("agency_id", ctx.agency.id).order("name"),
    supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", ctx.agency.id)
      .neq("status", "arquivado")
      .order("name"),
  ]);
  if (funnels.error || folders.error)
    return <ErrorState description="Não foi possível carregar os funis. Recarregue a página." />;
  return (
    <FunnelsApp
      funnels={funnels.data ?? []}
      folders={folders.data ?? []}
      clients={clients.data ?? []}
      canEdit={memberCan(ctx, "funil", "editar")}
    />
  );
}
