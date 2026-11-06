"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { decideProposal } from "@/features/propostas/actions";

/** Aceite ou recusa da proposta pelo cliente, com nome de quem decidiu. */
export function DecisionForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState<"aceita" | "recusada" | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = (decision: "aceita" | "recusada") =>
    start(async () => {
      const r = await decideProposal({ token, decision, name, comment });
      if (!r.ok) return setError(r.fieldErrors?.name?.[0] ?? r.error);
      router.refresh();
    });

  return (
    <section aria-label="Responder proposta" className="rounded-card bg-surface p-5">
      <h2 className="mb-1 font-medium">Responder proposta</h2>
      <p className="mb-4 text-sm text-muted">Ao aceitar, registramos seu nome, a data e o endereço de acesso.</p>
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="grid gap-3">
        <Field label="Seu nome completo" htmlFor="dec-name" required>
          <Input id="dec-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Comentário (opcional)" htmlFor="dec-comment">
          <Textarea id="dec-comment" rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      {confirm ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm">{confirm === "aceita" ? "Confirmar o aceite da proposta?" : "Confirmar a recusa?"}</span>
          <Button variant={confirm === "aceita" ? "primary" : "danger"} loading={pending} onClick={() => send(confirm)}>
            Confirmar
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
            Voltar
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => (name.trim().length < 3 ? setError("Informe seu nome completo.") : (setError(""), setConfirm("aceita")))}>
            <CheckCircle2 /> Aceitar proposta
          </Button>
          <Button variant="secondary" onClick={() => (name.trim().length < 3 ? setError("Informe seu nome completo.") : (setError(""), setConfirm("recusada")))}>
            <XCircle /> Recusar
          </Button>
        </div>
      )}
    </section>
  );
}

export function PrintButton({ label = "Imprimir ou salvar em PDF" }: { label?: string }) {
  return (
    <Button variant="secondary" className="self-center" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}
