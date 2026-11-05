"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  GanttChart,
  Grid3x3,
  KanbanSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, FilterMenu, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { STATUS, STATUS_ORDER, filterPosts, type PostFilters } from "@/features/aprovacoes/schemas";
import type { PostView } from "@/features/aprovacoes/types";
import { PostModal, type PostModalProps } from "./post-modal";
import { CaptionsModal } from "./captions-modal";
import { BoardView, CalendarView, FeedView, GanttView, GridView, ListView } from "./views";

const VIEWS = [
  { id: "grade", label: "Grade", icon: LayoutGrid },
  { id: "quadro", label: "Quadro", icon: KanbanSquare },
  { id: "feed", label: "Feed", icon: Grid3x3 },
  { id: "lista", label: "Lista", icon: List },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: GanttChart },
  { id: "aprovados", label: "Aprovados", icon: CheckCircle2 },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

type Props = Omit<PostModalProps, "post" | "kind" | "onClose"> & {
  posts: PostView[];
};

export function AprovacoesApp({ posts, ...shared }: Props) {
  const params = useSearchParams();
  const initial = posts.find((p) => p.id === params.get("envio"));
  const [kind, setKind] = useState<"post" | "demanda">(initial?.kind ?? "post");
  const [view, setView] = useState<ViewId>("grade");
  const [filters, setFilters] = useState<Omit<PostFilters, "kind">>({ q: "", client: "", status: "" });
  const [openId, setOpenId] = useState<string | "new" | null>(initial?.id ?? null);
  const [captions, setCaptions] = useState(false);

  const visible = useMemo(() => {
    const list = filterPosts(posts, { ...filters, kind });
    return view === "aprovados" ? list.filter((p) => p.status === "aprovado") : list;
  }, [posts, filters, kind, view]);
  const open = openId && openId !== "new" ? posts.find((p) => p.id === openId) : null;
  const onOpen = (p: PostView) => setOpenId(p.id);
  const count = (k: "post" | "demanda") => posts.filter((p) => p.kind === k && (p.status === "enviado" || p.status === "em_analise")).length;

  // a visão Feed só faz sentido para posts
  const views = kind === "post" ? VIEWS : VIEWS.filter((v) => v.id !== "feed");
  const activeView = views.some((v) => v.id === view) ? view : "grade";

  return (
    <>
      <PageHeader
        title="Aprovação"
        icon={CheckCircle2}
        actions={
          shared.canEdit && (
            <>
              {kind === "post" && (
                <Button variant="secondary" onClick={() => setCaptions(true)}>
                  <ScrollText /> Legendas padrão
                </Button>
              )}
              <Button onClick={() => setOpenId("new")}>
                <Plus /> {kind === "post" ? "Novo post" : "Nova demanda"}
              </Button>
            </>
          )
        }
      >
        <div role="tablist" aria-label="Tipo de aprovação" className="flex gap-1 rounded-full bg-surface p-1">
          {(["post", "demanda"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium",
                kind === k ? "bg-panel text-panel-ink" : "text-muted hover:text-ink",
              )}
            >
              {k === "post" ? "Aprovação de posts" : "Aprovação de demandas"}
              {count(k) > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] text-brand-ink">{count(k)}</span>}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visão" className="flex flex-wrap gap-1 rounded-full bg-surface p-1">
          {views.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={activeView === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                activeView === v.id ? "bg-brand text-brand-ink" : "text-muted hover:text-ink",
              )}
            >
              <v.icon className="size-3.5" aria-hidden />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            aria-label="Buscar"
            placeholder="Buscar"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="h-8 pl-9"
          />
        </div>
        <FilterMenu
          label="Cliente"
          value={filters.client}
          onChange={(client) => setFilters({ ...filters, client })}
          options={[{ value: "", label: "Todos os clientes" }, ...shared.clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
        {activeView !== "aprovados" && (
          <FilterMenu
            label="Status"
            value={filters.status}
            onChange={(status) => setFilters({ ...filters, status })}
            options={[{ value: "", label: "Todos os status" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label }))]}
          />
        )}
      </div>

      {activeView === "grade" && <GridView posts={visible} onOpen={onOpen} />}
      {activeView === "quadro" && <BoardView posts={visible} onOpen={onOpen} />}
      {activeView === "feed" && <FeedView posts={visible} onOpen={onOpen} />}
      {(activeView === "lista" || activeView === "aprovados") && (
        <ListView posts={visible} onOpen={onOpen} empty={activeView === "aprovados" ? "Nenhum envio aprovado ainda" : undefined} />
      )}
      {activeView === "calendario" && <CalendarView posts={visible} onOpen={onOpen} />}
      {activeView === "gantt" && <GanttView posts={visible} onOpen={onOpen} />}

      {openId && (openId === "new" || open) && (
        <PostModal key={openId} post={open ?? null} kind={open?.kind ?? kind} onClose={() => setOpenId(null)} {...shared} />
      )}
      {captions && <CaptionsModal templates={shared.templates} clients={shared.clients} onClose={() => setCaptions(false)} />}
    </>
  );
}
