"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  GanttChart,
  KanbanSquare,
  List,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import {
  Alert,
  Button,
  FilterMenu,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  SegmentedControl,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { createBoard, deleteBoard, updateBoard } from "@/features/demandas/actions";
import { EMPTY_FILTERS, PRIORITIES, filterTasks, sortTasks, type TaskFilters, type TaskSort } from "@/features/demandas/schemas";
import type { DemandasData, TaskView } from "@/features/demandas/types";
import { KanbanView } from "./kanban-view";
import { ListView } from "./list-view";
import { CalendarView } from "./calendar-view";
import { GanttView } from "./gantt-view";
import { TaskModal } from "./task-modal";

const VIEWS = [
  { id: "quadro", label: "Quadro", icon: KanbanSquare },
  { id: "lista", label: "Lista", icon: List },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: GanttChart },
  { id: "arquivadas", label: "Arquivadas", icon: Archive },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

export function DemandasApp({ data }: { data: DemandasData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<ViewId>(() => {
    const v = params.get("visao");
    return VIEWS.some((x) => x.id === v) ? (v as ViewId) : "quadro";
  });
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<TaskSort>("quadro");
  const [editing, setEditing] = useState<TaskView | "new" | null>(null);
  const [newInColumn, setNewInColumn] = useState<string | null>(null);
  const [boardModal, setBoardModal] = useState<"new" | "rename" | "delete" | "visual" | null>(null);

  const changeView = (v: ViewId) => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("visao", v);
    window.history.replaceState(null, "", url);
  };

  const active = useMemo(() => data.tasks.filter((t) => !t.archived_at), [data.tasks]);
  const archived = useMemo(() => data.tasks.filter((t) => t.archived_at), [data.tasks]);
  const visible = useMemo(
    () => sortTasks(filterTasks(view === "arquivadas" ? archived : active, filters), sort),
    [active, archived, filters, sort, view],
  );
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const openNew = (columnId?: string) => {
    setNewInColumn(columnId ?? null);
    setEditing("new");
  };

  return (
    <>
      <PageHeader
        title="Demandas"
        icon={KanbanSquare}
        actions={
          data.canEdit && (
            <Button onClick={() => openNew()}>
              <Plus /> Nova demanda
            </Button>
          )
        }
      >
        <Menu>
          <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-medium hover:bg-surface-2">
            {data.board.name}
            <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </MenuTrigger>
          <MenuContent align="start">
            {data.boards.map((b) => (
              <MenuItem key={b.id} onSelect={() => router.push(`/demandas?quadro=${b.id}&visao=${view}`)}>
                <span className={cn("flex-1", b.id === data.board.id && "font-semibold")}>{b.name}</span>
              </MenuItem>
            ))}
            {data.canEdit && (
              <MenuItem onSelect={() => setBoardModal("new")}>
                <Plus /> Novo quadro
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
        {data.canEdit && (
          <Menu>
            <MenuTrigger className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface" aria-label="Opções do quadro">
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem onSelect={() => setBoardModal("rename")}>Renomear quadro</MenuItem>
              <MenuItem onSelect={() => setBoardModal("visual")}>
                <Palette /> Personalizar visual
              </MenuItem>
              {data.isAdmin && (
                <MenuItem onSelect={() => setBoardModal("delete")} className="text-danger">
                  <Trash2 /> Excluir quadro
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visão" className="flex flex-wrap gap-1 rounded-full bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => changeView(v.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                view === v.id ? "bg-brand text-brand-ink" : "text-muted hover:text-ink",
              )}
            >
              <v.icon className="size-3.5" aria-hidden />
              {v.label}
              {v.id === "arquivadas" && archived.length > 0 && <span className="text-[10px] opacity-70">{archived.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            aria-label="Buscar demanda"
            placeholder="Buscar demanda"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="h-8 bg-surface pl-9"
          />
        </div>
        <FilterMenu
          label="Cliente"
          value={filters.client}
          onChange={(v) => setFilters((f) => ({ ...f, client: v }))}
          options={[
            { value: "", label: "Todos os clientes" },
            { value: "none", label: "Sem cliente" },
            ...data.clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterMenu
          label="Prioridade"
          value={filters.priority}
          icon={<SlidersHorizontal className="size-3.5 text-muted" aria-hidden />}
          onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
          options={[
            { value: "", label: "Toda prioridade" },
            ...PRIORITIES.map((p) => ({ value: p.value, label: p.label, leading: <span className={cn("size-2 rounded-full", p.dot)} /> })),
            { value: "none", label: "Sem prioridade" },
          ]}
        />
        <FilterMenu
          label="Responsável"
          value={filters.assignee}
          onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))}
          options={[
            { value: "", label: "Todos os responsáveis" },
            { value: data.userId, label: "Minhas demandas" },
            ...data.people.filter((p) => p.id !== data.userId).map((p) => ({ value: p.id, label: p.name })),
            { value: "none", label: "Sem responsável" },
          ]}
        />
        <FilterMenu
          label="Tipo"
          value={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          options={[
            { value: "", label: "Todos os tipos" },
            { value: "demanda", label: "Demandas" },
            { value: "post", label: "Posts" },
          ]}
        />
        {view !== "quadro" && (
          <FilterMenu
            label="Ordenar"
            value={sort}
            icon={<ArrowUpDown className="size-3.5 text-muted" aria-hidden />}
            onChange={(v) => setSort(v as TaskSort)}
            options={[
              { value: "quadro", label: "Ordem do quadro" },
              { value: "prazo", label: "Prazo" },
              { value: "cliente", label: "Cliente (A–Z)" },
              { value: "titulo", label: "Título (A–Z)" },
            ]}
          />
        )}
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        )}
      </div>

      {view === "quadro" && (
        <KanbanView
          data={data}
          tasks={visible}
          filtering={filtering}
          onOpen={(t) => setEditing(t)}
          onNew={data.canEdit ? openNew : undefined}
        />
      )}
      {(view === "lista" || view === "arquivadas") && (
        <ListView data={data} tasks={visible} archived={view === "arquivadas"} onOpen={(t) => setEditing(t)} />
      )}
      {view === "calendario" && <CalendarView tasks={visible} columns={data.columns} onOpen={(t) => setEditing(t)} />}
      {view === "gantt" && <GanttView tasks={visible} columns={data.columns} onOpen={(t) => setEditing(t)} />}

      {editing && (
        <TaskModal
          key={editing === "new" ? "new" : editing.id}
          data={data}
          task={editing === "new" ? null : editing}
          defaultColumnId={newInColumn ?? data.columns[0]?.id}
          onClose={() => setEditing(null)}
        />
      )}

      <BoardModals mode={boardModal} onClose={() => setBoardModal(null)} data={data} />
    </>
  );
}

function BoardModals({ mode, onClose, data }: { mode: "new" | "rename" | "delete" | "visual" | null; onClose: () => void; data: DemandasData }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cardImage, setCardImage] = useState(data.board.card_image);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const close = () => {
    setError("");
    setName("");
    onClose();
  };
  if (!mode) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: { id: string } }>, after?: (id?: string) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      close();
      after?.(r.data?.id);
      router.refresh();
    });

  if (mode === "delete") {
    return (
      <Modal
        open
        onOpenChange={(v) => !v && close()}
        title="Excluir"
        accent="quadro"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={name.trim() !== data.board.name}
              onClick={() => run(() => deleteBoard(data.board.id), () => router.replace("/demandas"))}
            >
              Excluir para sempre
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {error && <Alert>{error}</Alert>}
          <p>
            Apaga <strong>{data.board.name}</strong> com todas as demandas e anexos, inclusive as arquivadas. Não dá para desfazer.
          </p>
          <label htmlFor="confirm-board" className="text-xs text-muted">
            Digite o nome do quadro para confirmar
          </label>
          <Input id="confirm-board" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    );
  }

  if (mode === "visual") {
    return (
      <Modal
        open
        onOpenChange={(v) => !v && close()}
        title="Personalizar"
        accent="visual"
        size="sm"
        footer={
          <Button loading={pending} onClick={() => run(() => updateBoard({ boardId: data.board.id, card_image: cardImage }))}>
            Salvar
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}
          <p className="text-xs text-muted">Imagem no card (usa a primeira imagem anexada à demanda):</p>
          <SegmentedControl
            label="Imagem no card"
            value={cardImage}
            onChange={setCardImage}
            options={[
              { value: "miniatura", label: "Miniatura" },
              { value: "capa", label: "Capa" },
              { value: "sem", label: "Sem imagem" },
            ]}
          />
        </div>
      </Modal>
    );
  }

  const isNew = mode === "new";
  return (
    <Modal
      open
      onOpenChange={(v) => !v && close()}
      title={isNew ? "Novo" : "Renomear"}
      accent="quadro"
      size="sm"
      footer={
        <Button
          type="submit"
          form="form-quadro"
          loading={pending}
        >
          {isNew ? "Criar quadro" : "Salvar"}
        </Button>
      }
    >
      <form
        id="form-quadro"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = name || (isNew ? "" : data.board.name);
          if (isNew) run(() => createBoard(value), (id) => id && router.push(`/demandas?quadro=${id}`));
          else run(() => updateBoard({ boardId: data.board.id, name: value }));
        }}
      >
        {error && <Alert>{error}</Alert>}
        <label htmlFor="nome-quadro" className="text-xs text-muted">
          Nome do quadro
        </label>
        <Input id="nome-quadro" defaultValue={isNew ? "" : data.board.name} onChange={(e) => setName(e.target.value)} autoFocus />
        {isNew && <p className="text-xs text-muted">Começa com as colunas A fazer, Fazendo e Feito.</p>}
      </form>
    </Modal>
  );
}
