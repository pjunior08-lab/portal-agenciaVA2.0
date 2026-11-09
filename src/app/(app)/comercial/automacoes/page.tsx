import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { loadAutomations } from "@/features/comercial/data";
import { AutomationsApp } from "./automations-app";

export const metadata: Metadata = { title: "Comercial · Automações" };

export default async function AutomacoesPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial")) return null;
  const data = await loadAutomations(ctx);
  if (data.error)
    return <ErrorState description="Não foi possível carregar as automações. Recarregue a página." />;
  return <AutomationsApp rules={data.rules} runs={data.runs} distribution={data.distribution} />;
}
