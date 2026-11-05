"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Modal, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addColumn, deleteColumn, moveColumn, moveTask, updateColumn } from "@/features/demandas/actions";
import { COLUMN_COLORS, positionBetween } from "@/features/demandas/schemas";
import type { ColumnRow } from "@/lib/supabase/database.types";
import type { DemandasData, TaskView } from "@/features/demandas/types";
import { TaskCardBody } from "./task-card";

type Lanes = Record<string, TaskView[]>;

function toLanes(columns: ColumnRow[], tasks: TaskView[]): Lanes {
  const lanes: Lanes = Object.fromEntries(columns.map((c) => [c.id, []]));
  for (const t of tasks) lanes[t.column_id]?.push(t);
  return lanes;
}

export function KanbanView({
  data,
  tasks,
  filtering,
  onOpen,
  onNew,
}: {
  data: DemandasData;
  tasks: TaskView[];
  filtering: boolean;
  onOpen: (t: TaskView) => void;
  onNew?: (columnId: string) => void;
}) {
  const router = useRouter();
  const [lanes, setLanes] = useState<Lanes>(() => toLanes(data.columns, tasks));
  const [dragging, setDragging] = useState<TaskView | null>(null);
  const [error, setError] = useState("");
  const [columnModal, setColumnModal] = useState<ColumnRow | "new" | null>(null);
  const [, start] = useTransition();
  const labels = useMemo(() => new Map(data.labels.map((l) => [l.id, l])), [data.labels]);

  // dados novos do servidor substituem o estado local
  useEffect(() => setLanes(toLanes(data.columns, tasks)), [data.columns, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canMove = (t: TaskView) => !filtering && (data.canEdit || t.assignees.includes(data.userId));
  const laneOf = (id: string) => (lanes[id] ? id : Object.keys(lanes).find((k) => lanes[k].some((t) => t.id === id)));

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  // muda de coluna enquanto arrasta, para a lista se abrir no destino
  function onDragOver(e: DragOverEvent) {
    const from = laneOf(String(e.active.id));
    const to = e.over ? laneOf(String(e.over.id)) : undefined;
    if (!from || !to || from === to) return;
    setLanes((prev) => {
      const task = prev[from].find((t) => t.id === e.active.id);
      if (!task) return prev;
      const overIndex = prev[to].findIndex((t) => t.id === e.over!.id);
      const dest = [...prev[to]];
      dest.splice(overIndex < 0 ? dest.length : overIndex, 0, { ...task, column_id: to });
      return { ...prev, [from]: prev[from].filter((t) => t.id !== task.id), [to]: dest };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const id = String(e.active.id);
    const lane = laneOf(id);
    if (!lane || !e.over) return;
    let list = lanes[lane];
    const oldIndex = list.findIndex((t) => t.id === id);
    const overIndex = list.findIndex((t) => t.id === e.over!.id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      list = [...list];
      const [moved] = list.splice(oldIndex, 1);
      list.splice(overIndex, 0, moved);
    }
    const index = list.findIndex((t) => t.id === id);
    const original = tasks.find((t) => t.id === id);
    if (!original) return;
    // nada mudou: mesma coluna e mesmo lugar
    const originalIndex = tasks.filter((t) => t.column_id === original.column_id).findIndex((t) => t.id === id);
    if (original.column_id === lane && originalIndex === index) {
      setLanes(toLanes(data.columns, tasks));
      return;
    }
    const position = positionBetween(list[index - 1]?.position ?? null, list[index + 1]?.position ?? null);
    list = list.map((t) => (t.id === id ? { ...t, position, column_id: lane } : t));
    setLanes((prev) => ({ ...prev, [lane]: list }));
    start(async () => {
      const r = await moveTask({ taskId: id, columnId: lane, position });
      if (!r.ok) {
        setError(r.error);
        setLanes(toLanes(data.columns, tasks));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      {filtering && <p className="text-xs text-muted">Com filtros ativos, arrastar fica desligado para não bagunçar a ordem.</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setLanes(toLanes(data.columns, tasks));
        }}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {data.columns.map((col, i) => (
            <Lane
              key={col.id}
              column={col}
              tasks={lanes[col.id] ?? []}
              data={data}
              labels={labels}
              canMove={canMove}
              first={i === 0}
              last={i === data.columns.length - 1}
              onOpen={onOpen}
              onNew={onNew}
              onEdit={() => setColumnModal(col)}
              onError={setError}
            />
          ))}
          {data.canEdit && (
            <button
              type="button"
              onClick={() => setColumnModal("new")}
              className="flex h-12 w-64 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-2 text-xs text-muted hover:bg-surface"
            >
              <Plus className="size-4" aria-hidden /> Nova coluna
            </button>
          )}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="w-64 rotate-2 rounded-xl bg-surface p-3 shadow-xl">
              <TaskCardBody task={dragging} people={data.people} cardImage="sem" />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {columnModal && <ColumnModal boardId={data.board.id} column={columnModal === "new" ? null : columnModal} onClose={() => setColumnModal(null)} />}
    </div>
  );
}

function Lane({
  column,
  tasks,
  data,
  labels,
  canMove,
  first,
  last,
  onOpen,
  onNew,
  onEdit,
  onError,
}: {
  column: ColumnRow;
  tasks: TaskView[];
  data: DemandasData;
  labels: Map<string, { name: string; color: string }>;
  canMove: (t: TaskView) => boolean;
  first: boolean;
  last: boolean;
  onOpen: (t: TaskView) => void;
  onNew?: (columnId: string) => void;
  onEdit: () => void;
  onError: (e: string) => void;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) onError(r.error ?? "Não foi possível salvar.");
      router.refresh();
    });

  return (
    <section
      aria-label={`Coluna ${column.name}`}
      className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-surface-2/70 p-2", isOver && "ring-2 ring-brand")}
      style={{ background: `color-mix(in srgb, ${column.color} 9%, var(--surface-2))` }}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1">
        <span className="size-2.5 rounded-full" style={{ background: column.color }} aria-hidden />
        <h2 className="flex-1 truncate text-xs font-semibold">
          {column.name}
          {column.is_done && <CheckCircle2 className="ml-1 inline size-3 text-success" aria-label="Coluna de concluídas" />}
        </h2>
        <span className="text-[11px] text-muted">{tasks.length}</span>
        {onNew && (
          <button type="button" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface" aria-label={`Nova demanda em ${column.name}`} onClick={() => onNew(column.id)}>
            <Plus className="size-3.5" />
          </button>
        )}
        {data.canEdit && (
          <Menu>
            <MenuTrigger className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface" aria-label={`Opções da coluna ${column.name}`} disabled={pending}>
              <MoreHorizontal className="size-3.5" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={onEdit}>
                <Pencil /> Editar coluna
              </MenuItem>
              {!first && (
                <MenuItem onSelect={() => run(() => moveColumn(column.id, "left"))}>
                  <ArrowLeft /> Mover para a esquerda
                </MenuItem>
              )}
              {!last && (
                <MenuItem onSelect={() => run(() => moveColumn(column.id, "right"))}>
                  <ArrowRight /> Mover para a direita
                </MenuItem>
              )}
              <MenuItem className="text-danger" onSelect={() => run(() => deleteColumn(column.id))}>
                <Trash2 /> Excluir coluna
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </header>
      <SortableContext id={column.id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {tasks.length === 0 && (
            <li className="stripes flex h-16 items-center justify-center rounded-xl text-[11px] text-muted-2">Nenhuma demanda</li>
          )}
          {tasks.map((t) => {
            const label = t.label_id ? labels.get(t.label_id) : null;
            return (
              <SortableCard key={t.id} task={t} disabled={!canMove(t)} onOpen={() => onOpen(t)}>
                <TaskCardBody task={t} people={data.people} cardImage={data.board.card_image} labelName={label?.name} labelColor={label?.color} />
              </SortableCard>
            );
          })}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, disabled, onOpen, children }: { task: TaskView; disabled: boolean; onOpen: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-xl bg-surface p-3 shadow-sm", isDragging && "opacity-40")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onOpen}
        aria-label={`${task.title}. ${disabled ? "Abrir" : "Abrir, ou arraste para mover"}`}
        aria-roledescription={disabled ? undefined : "demanda arrastável"}
        className={cn("block w-full text-left", !disabled && "cursor-grab active:cursor-grabbing")}
      >
        {children}
      </button>
    </li>
  );
}

function ColumnModal({ boardId, column, onClose }: { boardId: string; column: ColumnRow | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column?.color ?? COLUMN_COLORS[0]);
  const [isDone, setIsDone] = useState(column?.is_done ?? false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={column ? "Editar" : "Nova"}
      accent="coluna"
      size="sm"
      footer={
        <Button type="submit" form="form-coluna" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-coluna"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const input = { name, color, is_done: isDone };
            const r = column ? await updateColumn(column.id, input) : await addColumn(boardId, input);
            if (!r.ok) return setError(r.error);
            onClose();
            router.refresh();
          });
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Nome" htmlFor="col-nome">
          <Input id="col-nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-muted">Cor</legend>
          <div className="flex flex-wrap gap-1.5">
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn("size-7 rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3">
          <Switch id="col-done" checked={isDone} onCheckedChange={setIsDone} />
          <label htmlFor="col-done" className="text-sm">
            Coluna de concluídas
            <span className="block text-xs text-muted">Demandas que chegam aqui contam como feitas e saem das atrasadas.</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
