import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { siteUrl } from "@/lib/request";
import { loadIntegrations } from "@/features/comercial/data";
import { IntegrationsApp } from "./integrations-app";

export const metadata: Metadata = { title: "Comercial · Integrações" };

export default async function IntegracoesPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial")) return null;
  const [data, site] = await Promise.all([loadIntegrations(ctx), siteUrl()]);
  if (data.error)
    return <ErrorState description="Não foi possível carregar as integrações. Recarregue a página." />;
  return <IntegrationsApp {...data} site={site} />;
}
