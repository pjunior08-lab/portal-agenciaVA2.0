import type { Metadata } from "next";
import { Lock, Network } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MapsApp } from "./maps-app";

export const metadata: Metadata = { title: "Mapa Mental" };

export default async function MapaMentalPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "mapa-mental")) {
    return (
      <>
        <PageHeader title="Mapa Mental" icon={Network} />
        <Card>
          <EmptyState
            icon={Lock}
            title="Sem acesso"
            description="Peça a um administrador para liberar o módulo Mapa Mental."
          />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [maps, clients] = await Promise.all([
    supabase
      .from("mind_maps")
      .select("id, title, template, client_id, updated_at")
      .eq("agency_id", ctx.agency.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name, status")
      .eq("agency_id", ctx.agency.id)
      .neq("status", "arquivado")
      .order("name"),
  ]);
  if (maps.error)
    return <ErrorState description="Não foi possível carregar os mapas. Recarregue a página." />;
  return (
    <MapsApp
      maps={maps.data ?? []}
      clients={clients.data ?? []}
      canEdit={memberCan(ctx, "mapa-mental", "editar")}
    />
  );
}
