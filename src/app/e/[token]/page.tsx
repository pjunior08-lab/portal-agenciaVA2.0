import type { Metadata } from "next";
import Image from "next/image";
import { LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { STRATEGY_FIELDS } from "@/features/clientes/schemas";

export const metadata: Metadata = { title: "Central Estratégica", robots: { index: false, follow: false } };

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

/** Página pública (só com o link) da Central Estratégica de um cliente. Somente leitura. */
export default async function SharedStrategyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_client_strategy", { token });
  const s = data?.[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <Image src="/brand/simbolo-amarelo.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
        <div>
          <p className="text-xs text-muted">{s ? s.agency_name : "Vai Aonde Capixaba?"}</p>
          <h1 className="text-2xl font-normal tracking-tight">
            Central Estratégica{s && <span className="text-muted"> · {s.client_name}</span>}
          </h1>
        </div>
      </header>

      {!s ? (
        <div className="rounded-card bg-surface">
          <EmptyState icon={LinkIcon} title="Link inválido" description="Este link foi desativado ou trocado. Peça um novo à agência." />
        </div>
      ) : (
        <>
          {STRATEGY_FIELDS.map((f) => (
            <section key={f.key} className="rounded-card bg-surface p-5">
              <h2 className="mb-2 text-sm font-semibold">{f.label}</h2>
              <p className="text-sm whitespace-pre-wrap">{s[f.key] || <span className="text-muted-2">Ainda não preenchido.</span>}</p>
            </section>
          ))}
          <p className="text-center text-xs text-muted">Atualizado em {when.format(new Date(s.updated_at))}</p>
        </>
      )}
    </div>
  );
}
