import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleDashed, Hammer, Lock } from "lucide-react";
import { getModule } from "@/lib/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Card, EmptyState, SectionCard } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";

/**
 * Página provisória de cada módulo enquanto ele não é implementado.
 * Quando um módulo ganhar a própria pasta (ex.: app/(app)/clientes), ela tem prioridade sobre esta rota.
 * Endereços fora da lista caem em notFound() e mostram a página 404 dentro do layout.
 */

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const { modulo } = await params;
  return { title: getModule(modulo)?.label ?? "Página não encontrada" };
}

export default async function ModulePage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const mod = getModule(modulo);
  if (!mod || mod.slug === "configuracoes") notFound();

  const ctx = await requireMember();
  if (!memberCan(ctx, mod.slug)) {
    return (
      <>
        <PageHeader title={mod.label} icon={mod.icon} />
        <Card>
          <EmptyState
            icon={Lock}
            title="Você não tem acesso a este módulo"
            description="Peça a um administrador para liberar o acesso em Configurações › Equipe."
          />
        </Card>
      </>
    );
  }

  const pending = mod.status === "a-levantar";

  return (
    <>
      <PageHeader title={mod.label} icon={mod.icon} />
      <SectionCard
        icon={pending ? CircleDashed : Hammer}
        title={pending ? "Módulo aguardando levantamento" : "Módulo em construção"}
        description={mod.summary}
        action={<Badge tone="brand">Fase {mod.phase}</Badge>}
      >
        {pending ? (
          <EmptyState
            icon={CircleDashed}
            title="Ainda não temos as telas de referência deste módulo"
            description="Ele só aparece pelo nome no sistema de referência. Assim que as capturas forem enviadas, o escopo entra no plano."
          />
        ) : (
          <div>
            <p className="mb-3 text-xs text-muted">O que este módulo vai ter, segundo o levantamento:</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {mod.features.map((f) => (
                <li key={f} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
    </>
  );
}
