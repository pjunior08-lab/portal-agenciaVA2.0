import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { ImportApp } from "./import-app";

export const metadata: Metadata = { title: "Comercial · Importar" };

export default async function ImportarPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comercial", "editar")) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="Sem permissão para importar"
          description="Importar exige acesso de edição ao Comercial."
        />
      </Card>
    );
  }
  return <ImportApp />;
}
