import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Componentes" };

/** Vitrine interna dos componentes da Fase 0, para aprovação visual. Não aparece no menu. */
export default function ComponentesPage() {
  return (
    <>
      <PageHeader title="Componentes" icon={Palette}>
        <Badge tone="brand">Vitrine interna · dados de exemplo</Badge>
      </PageHeader>
      <Showcase />
    </>
  );
}
