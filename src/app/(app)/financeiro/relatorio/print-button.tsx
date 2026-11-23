"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Abre a impressão do navegador (dá para escolher "Salvar como PDF"). */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer /> Imprimir ou salvar PDF
    </Button>
  );
}
