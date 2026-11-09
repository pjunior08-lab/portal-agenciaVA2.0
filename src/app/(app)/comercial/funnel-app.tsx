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
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, CalendarClock, CheckCircle2, Flag, Pencil, Plus, XCircle } from "lucide-react";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import type { CrmStageT } from "@/lib/supabase/database.types";
import { EMPTY_FILTERS, OPEN_STAGES, STAGES, filterOpps, monthSummary } from "@/features/comercial/schemas";
import { positionBetween } from "@/features/demandas/schemas";
import { moveOpportunity, saveGoal } from "@/features/comercial/actions";
import type { OppView } from "@/features/comercial/data";
import { useCrm } from "./crm-shell";
import { FiltersBar } from "./filters-bar";

type Lanes = Record<string, OppView[]>;
const toLanes = (opps: OppView[]): Lanes => {
  const lanes: Lanes = Object.fromEntries(OPEN_STAGES.map((s) => [s, []]));
  for (const o of opps) lanes[o.stage]?.push(o);
  return lanes;
};

export function FunnelApp() {
  const { base, canEdit, today } = useCrm();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const month = today.slice(0, 7);
  const summary = useMemo(() => monthSummary(base.opps, month), [base.opps, month]);
  const visible = useMemo(() => filterOpps(base.opps, filters, today), [base.opps, filters, today]);
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
        <GoalCard closed={summary.closedCount} goal={base.goal} canEdit={canEdit} month={month} />
        <section aria-label="Resumo do mês" className="rounded-2xl bg-panel p-5 text-panel-ink">
          <p className="text-xs text-panel-muted">Resumo do mês</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatBRL(summary.newRevenue)}
            <span className="text-sm font-normal text-panel-muted">/mês em novas contas</span>
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="text-panel-muted">Pipeline aberto</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums">{formatBRL(summary.pipeline)}</dd>
            </div>
            <div>
              <dt className="text-panel-muted">Vendas perdidas</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums">{formatBRL(summary.lost)}</dd>
            </div>
            <div>
              <dt className="text-panel-muted">Leads abertos</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums">{summary.openLeads}</dd>
            </div>
          </dl>
        </section>
      </div>

      <FiltersBar value={filters} onChange={setFilters} />
      <Board opps={visible} filtering={filtering} />
    </div>
  );
}

function GoalCard({
  closed,
  goal,
  canEdit,
  month,
}: {
  closed: number;
  goal: number | null;
  canEdit: boolean;
  month: string;
}) {
  const [editing, setEditing] = useState(false);
  const pct = goal ? Math.round((closed / goal) * 100) : 0;
  return (
    <section aria-label="Meta do mês" className="rounded-2xl bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Flag className="size-3.5" aria-hidden /> Meta de novos clientes no mês
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {closed}
            <span className="text-sm font-normal text-muted"> {goal ? `de ${goal}` : "fechados"}</span>
          </p>
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> {goal ? "Editar meta" : "Definir meta"}
          </Button>
        )}
      </div>
      {goal ? (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className={cn("h-2 rounded-full", pct >= 100 ? "bg-success" : "bg-brand")}
              style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
            />
          </div>
          <p className={cn("mt-1.5 text-xs", pct >= 100 ? "font-medium text-success" : "text-muted")}>
            {pct >= 100 ? `Meta batida (${pct}%)` : `${pct}% da meta`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">Sem meta definida para este mês.</p>
      )}
      {editing && <GoalModal month={month} goal={goal} onClose={() => setEditing(false)} />}
    </section>
  );
}

function GoalModal({ month, goal, onClose }: { month: string; goal: number | null; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(goal ? String(goal) : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Meta do"
      accent="mês"
      size="sm"
      footer={
        <Button type="submit" form="form-meta" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-meta"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveGoal(month, value);
            if (!r.ok) return setError(r.error);
            router.refresh();
            onClose();
          });
        }}
      >
        <Field label="Novos clientes fechados no mês" htmlFor="meta-n" error={error}>
          <Input
            id="meta-n"
            type="number"
            min={1}
            max={10000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </Field>
      </form>
    </Modal>
  );
}

function Board({ opps, filtering }: { opps: OppView[]; filtering: boolean }) {
  const router = useRouter();
  const { canEdit, openNew } = useCrm();
  const [lanes, setLanes] = useState<Lanes>(() => toLanes(opps));
  const [dragging, setDragging] = useState<OppView | null>(null);
  const [lostAsk, setLostAsk] = useState<OppView | null>(null);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  useEffect(() => setLanes(toLanes(opps)), [opps]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const laneOf = (id: string) =>
    lanes[id] ? id : Object.keys(lanes).find((k) => lanes[k].some((o) => o.id === id));
  const canDrag = canEdit && !filtering;

  function persist(id: string, stage: CrmStageT, position: number, lostReason?: string) {
    start(async () => {
      const r = await moveOpportunity(id, stage, position, lostReason);
      if (!r.ok) {
        setError(r.error);
        setLanes(toLanes(opps));
      }
      router.refresh();
    });
  }

  function onDragOver(e: DragOverEvent) {
    const from = laneOf(String(e.active.id));
    const to = e.over ? laneOf(String(e.over.id)) : undefined;
    if (!from || !to || from === to) return;
    setLanes((prev) => {
      const o = prev[from].find((x) => x.id === e.active.id);
      if (!o) return prev;
      const idx = prev[to].findIndex((x) => x.id === e.over!.id);
      const dest = [...prev[to]];
      dest.splice(idx < 0 ? dest.length : idx, 0, { ...o, stage: to as CrmStageT });
      return { ...prev, [from]: prev[from].filter((x) => x.id !== o.id), [to]: dest };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const id = String(e.active.id);
    const original = opps.find((o) => o.id === id);
    if (!original || !e.over) return setLanes(toLanes(opps));
    // soltou em Fechado ou Perdido
    if (e.over.id === "drop-fechado") {
      setLanes((prev) =>
        Object.fromEntries(Object.entries(prev).map(([k, l]) => [k, l.filter((o) => o.id !== id)])),
      );
      return persist(id, "fechado", Date.now());
    }
    if (e.over.id === "drop-perdido") return setLostAsk(original);

    const lane = laneOf(id);
    if (!lane) return;
    let list = lanes[lane];
    const oldIndex = list.findIndex((o) => o.id === id);
    const overIndex = list.findIndex((o) => o.id === e.over!.id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      list = [...list];
      const [moved] = list.splice(oldIndex, 1);
      list.splice(overIndex, 0, moved);
    }
    const index = list.findIndex((o) => o.id === id);
    const originalIndex = opps.filter((o) => o.stage === original.stage).findIndex((o) => o.id === id);
    if (original.stage === lane && originalIndex === index) return setLanes(toLanes(opps));
    const position = positionBetween(list[index - 1]?.position ?? null, list[index + 1]?.position ?? null);
    setLanes((prev) => ({
      ...prev,
      [lane]: list.map((o) => (o.id === id ? { ...o, position, stage: lane as CrmStageT } : o)),
    }));
    persist(id, lane as CrmStageT, position);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      {filtering && canEdit && (
        <p className="text-xs text-muted">
          Com filtros ativos, arrastar fica desligado. Para mudar a etapa, abra a oportunidade.
        </p>
      )}
      <DndContext
        id="crm-funil"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setDragging(opps.find((o) => o.id === e.active.id) ?? null)}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setLanes(toLanes(opps));
        }}
      >
        <div className="relative flex gap-3 overflow-x-auto pb-2">
          {OPEN_STAGES.map((s) => (
            <Lane
              key={s}
              stage={s}
              opps={lanes[s] ?? []}
              canDrag={canDrag}
              onNew={canEdit ? () => openNew(s) : undefined}
            />
          ))}
        </div>
        {canDrag && (
          <div
            className={cn(
              "grid grid-cols-2 gap-3 transition-opacity",
              dragging ? "opacity-100" : "opacity-60",
            )}
          >
            <DropZone
              id="drop-fechado"
              label="Solte aqui para marcar como Fechado"
              icon={CheckCircle2}
              tone="success"
            />
            <DropZone
              id="drop-perdido"
              label="Solte aqui para marcar como Perdido"
              icon={XCircle}
              tone="danger"
            />
          </div>
        )}
        <DragOverlay>
          {dragging && (
            <div className="w-64 rotate-2 rounded-xl bg-surface p-3 shadow-xl">
              <OppCardBody o={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {lostAsk && (
        <LostModal
          opp={lostAsk}
          onCancel={() => {
            setLostAsk(null);
            setLanes(toLanes(opps));
          }}
          onConfirm={(reason) => {
            setLostAsk(null);
            setLanes((prev) =>
              Object.fromEntries(
                Object.entries(prev).map(([k, l]) => [k, l.filter((o) => o.id !== lostAsk.id)]),
              ),
            );
            persist(lostAsk.id, "perdido", Date.now(), reason);
          }}
        />
      )}
    </div>
  );
}

function DropZone({
  id,
  label,
  icon: Icon,
  tone,
}: {
  id: string;
  label: string;
  icon: typeof CheckCircle2;
  tone: "success" | "danger";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-xs font-medium",
        tone === "success" ? "border-success/40 text-success" : "border-danger/40 text-danger",
        isOver && (tone === "success" ? "bg-success-soft" : "bg-danger-soft"),
      )}
    >
      <Icon className="size-4" aria-hidden /> {label}
    </div>
  );
}

function Lane({
  stage,
  opps,
  canDrag,
  onNew,
}: {
  stage: CrmStageT;
  opps: OppView[];
  canDrag: boolean;
  onNew?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const { openOpp } = useCrm();
  const total = opps.reduce((s, o) => s + (o.value ?? 0), 0);
  return (
    <section
      aria-label={`Etapa ${STAGES[stage].label}`}
      className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-2xl p-2", isOver && "ring-2 ring-brand")}
      style={{ background: `color-mix(in srgb, ${STAGES[stage].color} 8%, var(--surface-2))` }}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1">
        <span className="size-2.5 rounded-full" style={{ background: STAGES[stage].color }} aria-hidden />
        <h2 className="flex-1 truncate text-xs font-semibold">{STAGES[stage].label}</h2>
        <span className="text-[11px] text-muted">{opps.length}</span>
        {onNew && (
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface"
            aria-label={`Nova oportunidade em ${STAGES[stage].label}`}
            onClick={onNew}
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </header>
      <p className="px-1.5 text-[11px] text-muted tabular-nums">{formatBRL(total)}/mês</p>
      <SortableContext id={stage} items={opps.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {opps.length === 0 && (
            <li className="stripes flex h-16 items-center justify-center rounded-xl text-[11px] text-muted-2">
              Nenhuma oportunidade
            </li>
          )}
          {opps.map((o) => (
            <SortableCard key={o.id} o={o} disabled={!canDrag} onOpen={() => openOpp(o)} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ o, disabled, onOpen }: { o: OppView; disabled: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: o.id,
    disabled,
  });
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
        aria-label={`${o.name}. ${disabled ? "Abrir" : "Abrir, ou arraste para mudar a etapa"}`}
        aria-roledescription={disabled ? undefined : "oportunidade arrastável"}
        className={cn("block w-full text-left", !disabled && "cursor-grab active:cursor-grabbing")}
      >
        <OppCardBody o={o} />
      </button>
    </li>
  );
}

export function OppCardBody({ o }: { o: OppView }) {
  const { personName, today } = useCrm();
  const late = o.next_step_at && o.next_step_at < today;
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="text-sm leading-tight font-medium">{o.company || o.name}</p>
      {o.company && <p className="text-muted">{o.name}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        {o.value != null && (
          <span className="font-medium text-ink tabular-nums">{formatBRL(o.value)}/mês</span>
        )}
        <span>{personName(o.owner_id)}</span>
      </div>
      {o.next_step_at ? (
        <p className={cn("flex items-center gap-1", late ? "font-medium text-danger" : "text-muted")}>
          {late ? (
            <AlertCircle className="size-3.5" aria-hidden />
          ) : (
            <CalendarClock className="size-3.5" aria-hidden />
          )}
          {shortDate(o.next_step_at)}
          {o.next_step && ` · ${o.next_step}`}
          {late && <span className="sr-only">(atrasado)</span>}
        </p>
      ) : (
        <p className="text-muted-2">Sem próximo passo</p>
      )}
      {o.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {o.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LostModal({
  opp,
  onCancel,
  onConfirm,
}: {
  opp: OppView;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onCancel()}
      title="Marcar como"
      accent="perdida"
      description={opp.company || opp.name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" form="form-perda">
            Marcar como perdida
          </Button>
        </>
      }
    >
      <form
        id="form-perda"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) return setError("Informe o motivo da perda.");
          onConfirm(reason.trim().slice(0, 200));
        }}
      >
        <Field label="Motivo da perda" htmlFor="perda-motivo" required error={error}>
          <Input
            id="perda-motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: preço, sem orçamento"
            maxLength={200}
            autoFocus
          />
        </Field>
      </form>
    </Modal>
  );
}
