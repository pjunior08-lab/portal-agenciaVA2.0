"use client";

import { useRouter } from "next/navigation";
import { SignForm } from "@/features/contratos/sign-form";
import { signAsClient } from "@/features/contratos/actions";

export function ClientSign({ token }: { token: string }) {
  const router = useRouter();
  return (
    <section aria-label="Assinar" className="rounded-card bg-surface p-5">
      <h2 className="mb-1 font-medium">Assinar o contrato</h2>
      <p className="mb-4 text-sm text-muted">Leia o contrato acima. Para assinar, informe os dados de quem assina pelo contratante.</p>
      <SignForm
        onSign={async (v) => {
          const r = await signAsClient(token, v);
          if (r.ok) router.refresh();
          return r;
        }}
      />
    </section>
  );
}
