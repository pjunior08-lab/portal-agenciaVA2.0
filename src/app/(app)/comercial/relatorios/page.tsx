import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, today } from "@/lib/dates";
import { loadReportData } from "@/features/comercial/data";
import { ReportsApp } from "./reports-app";

export const metadata: Metadata = { title: "Comercial · Relatórios" };

const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial")) return null;
  const sp = await searchParams;
  const now = today();
  let from = isDay(sp.de) ? sp.de! : `${now.slice(0, 7)}-01`;
  let to = isDay(sp.ate) ? sp.ate! : now;
  if (from > to) [from, to] = [to, from];
  // um ano antes do início, para medir o tempo de quem entrou na etapa antes do período
  const data = await loadReportData(ctx, `${addDays(from, -365)}T00:00:00-03:00`);
  if (data.error)
    return <ErrorState description="Não foi possível carregar os relatórios. Recarregue a página." />;
  return <ReportsApp period={{ from, to }} history={data.history} acts={data.acts} />;
}
