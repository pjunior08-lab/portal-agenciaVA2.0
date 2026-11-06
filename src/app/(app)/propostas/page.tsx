import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, today } from "@/lib/dates";
import { firstCycleValue, proposalIndicators } from "@/features/propostas/schemas";
import { PropostasApp, type ProposalListItem } from "./propostas-app";

export const metadata: Metadata = { title: "Propostas" };

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  const { proposta } = await searchParams;
  if (proposta && /^[0-9a-f-]{36}$/i.test(proposta)) redirect(`/propostas/${proposta}`);

  const ctx = await requireMember();
  if (!memberCan(ctx, "propostas")) {
    return (
      <>
        <PageHeader title="Propostas" icon={FileText} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Propostas." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [proposals, templates] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, number, title, status, valid_until, client_id, contact_name, sent_at, created_at, cover, clients(name), proposal_items(quantity, unit_price, cadence)")
      .eq("agency_id", ctx.agency.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("proposal_templates").select("id, name, title, items, cover").eq("agency_id", ctx.agency.id).order("name"),
  ]);
  if (proposals.error) return <ErrorState description="Não foi possível carregar as propostas. Recarregue a página." />;

  const now = today();
  const list: ProposalListItem[] = (proposals.data ?? []).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      status: p.status,
      valid_until: p.valid_until,
      client_id: p.client_id,
      clientName: client?.name ?? p.contact_name ?? null,
      cover: p.cover,
      created_at: p.created_at,
      value: firstCycleValue(p.proposal_items ?? []),
      items: p.proposal_items ?? [],
    };
  });

  return (
    <PropostasApp
      proposals={list}
      indicators={proposalIndicators(list, now, addDays(now, 7))}
      templates={(templates.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        title: t.title,
        cover: t.cover,
        itemCount: Array.isArray(t.items) ? t.items.length : 0,
      }))}
      canEdit={memberCan(ctx, "propostas", "editar")}
    />
  );
}
