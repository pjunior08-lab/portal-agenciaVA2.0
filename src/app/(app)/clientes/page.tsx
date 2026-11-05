import type { Metadata } from "next";
import { Lock, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";
import { ClientsBoard } from "./clients-board";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "clientes")) {
    return (
      <>
        <PageHeader title="Clientes" icon={Users} />
        <Card>
          <EmptyState icon={Lock} title="Você não tem acesso a este módulo" description="Peça a um administrador para liberar." />
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("agency_id", ctx.agency.id)
    .order("name");

  if (error) {
    return (
      <>
        <PageHeader title="Clientes" icon={Users} />
        <ErrorState description="Não foi possível carregar os clientes. Recarregue a página." />
      </>
    );
  }

  const clients = data ?? [];
  const urls = await signedUrls(
    "clientes",
    clients.flatMap((c) => [c.logo_light_path, c.logo_dark_path]),
  );

  return (
    <ClientsBoard
      clients={clients}
      logoUrls={urls}
      canEdit={memberCan(ctx, "clientes", "editar")}
    />
  );
}
