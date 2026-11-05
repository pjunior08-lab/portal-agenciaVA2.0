"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, StickyNote, Trash2 } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SectionCard, Switch, Textarea } from "@/components/ui";
import { addNote, deleteNote, setNoteShared } from "@/features/clientes/actions";

interface Note {
  id: string;
  body: string;
  shared: boolean;
  createdAt: string;
  author: string | null;
}

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function NotesPanel({ clientId, notes, canEdit }: { clientId: string; notes: Note[]; canEdit: boolean }) {
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError("");
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Não foi possível salvar.");
      else after?.();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <SectionCard title="Anotações" icon={StickyNote} description="Registro do dia a dia com o cliente.">
        {error && <Alert className="mb-3">{error}</Alert>}
        {notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="Nenhuma anotação ainda" />
        ) : (
          <ul className="flex flex-col gap-2" aria-busy={pending}>
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-surface-2 p-3">
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>
                    {n.author ?? "Equipe"} · {when.format(new Date(n.createdAt))}
                  </span>
                  {n.shared ? <Badge tone="info">Visível no portal</Badge> : <Badge>Só equipe</Badge>}
                  {canEdit && (
                    <span className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => setNoteShared(n.id, clientId, !n.shared))}
                      >
                        {n.shared ? <EyeOff /> : <Eye />}
                        {n.shared ? "Esconder do cliente" : "Mostrar ao cliente"}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Excluir anotação"
                        disabled={pending}
                        onClick={() => run(() => deleteNote(n.id, clientId))}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canEdit && (
        <SectionCard title="Nova anotação" icon={StickyNote} className="self-start">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return setError("Escreva a anotação.");
              run(
                () => addNote({ clientId, body, shared }),
                () => {
                  setBody("");
                  setShared(false);
                },
              );
            }}
          >
            <label htmlFor="nova-nota" className="sr-only">
              Texto da anotação
            </label>
            <Textarea id="nova-nota" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
            <div className="flex items-center gap-2">
              <Switch id="nota-portal" checked={shared} onCheckedChange={setShared} />
              <label htmlFor="nota-portal" className="text-xs">
                Mostrar no Portal do Cliente
              </label>
            </div>
            <Button type="submit" loading={pending}>
              Salvar anotação
            </Button>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
