"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { progress, type ChecklistItem } from "./schemas";
import { applyChecklist, createChecklist, deleteChecklist, loadChecklists, toggleChecklistItem, type ChecklistView } from "./actions";

const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Checklists de uma demanda ou de um cliente: aplicar modelo, marcar itens, remover. */
export function ChecklistPanel({
  target,
  canWrite,
  preferred,
}: {
  target: { task_id: string } | { client_id: string };
  canWrite: boolean;
  /** tipo de modelo mostrado primeiro na lista */
  preferred: "demanda" | "cliente";
}) {
  const [lists, setLists] = useState<ChecklistView[] | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; applies_to: string }[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState<{ name: string; items: string } | null>(null);
  const [pending, start] = useTransition();
  const key = JSON.stringify(target);

  const reload = useCallback(async () => {
    const r = await loadChecklists(JSON.parse(key));
    if (!r.ok) return setError(r.error);
    setLists(r.data!.lists);
    setTemplates(r.data!.templates);
    setPeople(r.data!.people);
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      await reload();
    });

  const toggle = (list: ChecklistView, index: number) => {
    const done = !list.items[index].done;
    // mostra na hora; se o servidor recusar, recarrega
    setLists((cur) => cur?.map((l) => (l.id === list.id ? { ...l, items: l.items.map((it, i) => (i === index ? { ...it, done } : it)) } : l)) ?? null);
    start(async () => {
      const r = await toggleChecklistItem(list.id, index, done);
      if (!r.ok) {
        setError(r.error);
        await reload();
      } else setLists((cur) => cur?.map((l) => (l.id === list.id ? { ...l, items: r.data!.items } : l)) ?? null);
    });
  };

  const sorted = [...templates].sort((a, b) => Number(b.applies_to === preferred) - Number(a.applies_to === preferred));

  return (
    <section className="flex flex-col gap-3" aria-label="Checklists">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <ListChecks className="size-4 text-muted" aria-hidden /> Checklists
      </h3>
      {error && <Alert>{error}</Alert>}
      {lists === null && !error && <p className="text-xs text-muted">Carregando…</p>}
      {lists?.length === 0 && <p className="text-xs text-muted">Nenhum checklist ainda.</p>}

      {lists?.map((l) => {
        const p = progress(l.items);
        return (
          <div key={l.id} className="rounded-xl bg-surface-2 p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="flex-1 text-sm font-medium">{l.name}</p>
              <span className={cn("text-xs tabular-nums", p.complete ? "text-success" : "text-muted")}>
                {p.done}/{p.total}
              </span>
              {canWrite && (
                <Button size="icon-sm" variant="ghost" aria-label={`Remover checklist ${l.name}`} disabled={pending} onClick={() => run(() => deleteChecklist(l.id))}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <ul className="flex flex-col">
              {l.items.map((it: ChecklistItem, i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => toggle(l, i)}
                    className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-surface-3 disabled:cursor-default disabled:hover:bg-transparent"
                    aria-pressed={it.done}
                  >
                    {it.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-2" aria-hidden />}
                    <span className={cn("flex-1", it.done && "text-muted line-through")}>{it.text}</span>
                    {it.done && it.done_at && (
                      <span className="shrink-0 text-[10px] text-muted-2">
                        {it.done_by && people[it.done_by] ? `${people[it.done_by].split(" ")[0]} · ` : ""}
                        {when.format(new Date(it.done_at))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {canWrite && lists !== null && (
        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && (
            <>
              <div className="min-w-48 flex-1">
                <Select aria-label="Modelo de checklist" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Escolha um modelo…</option>
                  {sorted.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button size="sm" variant="secondary" disabled={!pick || pending} onClick={() => run(async () => {
                const r = await applyChecklist(JSON.parse(key), pick);
                if (r.ok) setPick("");
                return r;
              })}>
                Aplicar
              </Button>
            </>
          )}
          {!custom && (
            <Button size="sm" variant="ghost" onClick={() => setCustom({ name: "", items: "" })}>
              <Plus /> Checklist avulso
            </Button>
          )}
        </div>
      )}
      {custom && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <Input aria-label="Nome do checklist" placeholder="Nome do checklist" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          <Textarea aria-label="Itens, um por linha" placeholder="Um item por linha" rows={4} value={custom.items} onChange={(e) => setCustom({ ...custom, items: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCustom(null)}>
              Cancelar
            </Button>
            <Button size="sm" loading={pending} onClick={() => run(async () => {
              const r = await createChecklist(JSON.parse(key), custom.name, custom.items);
              if (r.ok) setCustom(null);
              return r;
            })}>
              Criar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
