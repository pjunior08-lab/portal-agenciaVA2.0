import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { getPortal } from "@/features/portal/context";
import { PORTAL_SECTIONS } from "@/features/clientes/schemas";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Portal" };

/** Fase atual do sistema: seções de fases posteriores mostram "em breve". */
const CURRENT_PHASE = 8;

export default async function PortalHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPortal(slug);
  const sections = PORTAL_SECTIONS.filter((s) => p.sections.includes(s.id));
  const first = p.userName.split(/\s+/)[0];
  let pendingApprovals = 0;
  if (p.sections.includes("aprovacoes")) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", p.clientId)
      .in("status", ["enviado", "em_analise"]);
    pendingApprovals = count ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-normal tracking-tight">Olá{first ? `, ${first}` : ""}!</h1>
        <p className="text-sm text-muted">Aqui você acompanha o trabalho da agência para {p.clientName}.</p>
      </div>
      {sections.length === 0 ? (
        <p className="rounded-card bg-surface p-5 text-sm text-muted">A agência ainda não liberou nenhuma seção para você.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const ready = s.phase <= CURRENT_PHASE;
            return (
              <li key={s.id}>
                <Link
                  href={`/portal/${slug}/${s.id}`}
                  className="flex h-full items-center justify-between gap-3 rounded-card bg-surface p-5 hover:shadow-md"
                >
                  <span className="font-medium">{s.label}</span>
                  {ready ? (
                    s.id === "aprovacoes" && pendingApprovals > 0 ? (
                      <Badge tone="brand">{pendingApprovals} aguardando</Badge>
                    ) : (
                      <ArrowRight className="size-4 text-muted" aria-hidden />
                    )
                  ) : (
                    <Badge>
                      <Clock className="size-3" aria-hidden /> Em breve
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
