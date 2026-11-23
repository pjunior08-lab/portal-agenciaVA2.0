import type { Metadata } from "next";
import { Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai/anthropic";
import { AssistantApp } from "./assistant-app";

export const metadata: Metadata = { title: "Assistente IA" };

export default async function AssistentePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "maestro")) {
    return (
      <>
        <PageHeader title="Assistente IA" icon={Sparkles} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o Assistente IA." />
        </Card>
      </>
    );
  }
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name");
  return (
    <AssistantApp
      clients={clients ?? []}
      initialClient={clients?.some((c) => c.id === cliente) ? cliente! : ""}
      configured={aiConfigured()}
      canDraft={memberCan(ctx, "aprovacoes", "editar")}
    />
  );
}
