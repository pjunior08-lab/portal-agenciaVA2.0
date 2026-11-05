"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KanbanSquare } from "lucide-react";
import { Alert, Button, EmptyState, Input } from "@/components/ui";
import { createBoard } from "@/features/demandas/actions";

export function NewBoardFirst() {
  const router = useRouter();
  const [name, setName] = useState("Quadro principal");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <EmptyState
      icon={KanbanSquare}
      title="Crie o primeiro quadro"
      description="O quadro já vem com as colunas A fazer, Fazendo e Feito. Dá para mudar depois."
      action={
        <form
          className="flex flex-col items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createBoard(name);
              if (!r.ok) return setError(r.error);
              router.replace(`/demandas?quadro=${r.data?.id}`);
              router.refresh();
            });
          }}
        >
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Input aria-label="Nome do quadro" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
            <Button type="submit" loading={pending}>
              Criar quadro
            </Button>
          </div>
        </form>
      }
    />
  );
}
