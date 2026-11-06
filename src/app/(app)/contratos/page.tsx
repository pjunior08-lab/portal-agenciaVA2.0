import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileSignature, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, today } from "@/lib/dates";
import { contractIndicators } from "@/features/contratos/schemas";
import { ContratosApp, type ContractListItem } from "./contratos-app";

export const metadata: Metadata = { title: "Contratos" };

export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ contrato?: string; aba?: string }> }) {
  const { contrato, aba } = await searchParams;
  if (contrato && /^[0-9a-f-]{36}$/i.test(contrato)) redirect(`/contratos/${contrato}`);

  const ctx = await requireMember();
  if (!memberCan(ctx, "contratos")) {
    return (
      <>
        <PageHeader title="Contratos" icon={FileSignature} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Contratos." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [contracts, templates] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, title, status, value, starts_on, ends_on, renewal_on, client_id, created_at, sent_at, clients(name), contract_signatures(party)")
      .eq("agency_id", ctx.agency.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("contract_templates").select("id, name, description, is_default, updated_at").eq("agency_id", ctx.agency.id).order("name"),
  ]);
  if (contracts.error) return <ErrorState description="Não foi possível carregar os contratos. Recarregue a página." />;

  const list: ContractListItem[] = (contracts.data ?? []).map((c) => {
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      value: c.value,
      starts_on: c.starts_on,
      ends_on: c.ends_on,
      renewal_on: c.renewal_on,
      client_id: c.client_id,
      clientName: client?.name ?? "—",
      parties: (c.contract_signatures ?? []).map((s) => s.party),
    };
  });
  const now = today();

  return (
    <ContratosApp
      contracts={list}
      indicators={contractIndicators(list, now, addDays(now, 30))}
      templates={templates.data ?? []}
      initialTab={aba === "modelos" ? "modelos" : "contratos"}
      canEdit={memberCan(ctx, "contratos", "editar")}
    />
  );
}
