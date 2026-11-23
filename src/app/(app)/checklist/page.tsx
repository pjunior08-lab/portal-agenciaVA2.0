import type { Metadata } from "next";
import { ListChecks, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TemplatesApp } from "./templates-app";

export const metadata: Metadata = { title: "Checklist" };

export default async function ChecklistPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "checklist")) {
    return (
      <>
        <PageHeader title="Checklist" icon={ListChecks} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Checklist." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("id, name, description, applies_to, items")
    .eq("agency_id", ctx.agency.id)
    .order("name");
  if (error) return <ErrorState description="Não foi possível carregar os modelos. Recarregue a página." />;
  return (
    <TemplatesApp
      templates={(data ?? []).map((t) => ({ ...t, items: Array.isArray(t.items) ? (t.items as unknown[]).filter((x): x is string => typeof x === "string") : [] }))}
      canEdit={memberCan(ctx, "checklist", "editar")}
    />
  );
}
