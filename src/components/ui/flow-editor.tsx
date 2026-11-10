"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  CalendarCheck,
  Check,
  CircleAlert,
  FileText,
  FormInput,
  Gift,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Newspaper,
  Plus,
  ShoppingCart,
  StickyNote,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUNNEL_KINDS,
  NODE_COLORS,
  newId,
  type CanvasData,
  type CanvasNode,
  type FunnelKind,
  type NodeColor,
} from "@/features/canvas/schemas";
import { Button } from "./button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";

type NodeData = CanvasNode["data"];
type FlowNode = Node<NodeData, "ideia" | "etapa">;

const KIND_ICON: Record<FunnelKind, LucideIcon> = {
  anuncio: Megaphone,
  conteudo: Newspaper,
  pagina: FileText,
  formulario: FormInput,
  whatsapp: MessageCircle,
  email: Mail,
  reuniao: CalendarCheck,
  checkout: ShoppingCart,
  obrigado: Gift,
  evento: Video,
  nota: StickyNote,
};

function Handles() {
  const cls = "!size-2.5 !border-2 !border-surface !bg-muted-2";
  return (
    <>
      <Handle type="source" position={Position.Left} id="l" className={cls} />
      <Handle type="source" position={Position.Top} id="t" className={cls} />
      <Handle type="source" position={Position.Right} id="r" className={cls} />
      <Handle type="source" position={Position.Bottom} id="b" className={cls} />
    </>
  );
}

function IdeaNode({ data, selected }: NodeProps<FlowNode>) {
  const c = NODE_COLORS[data.color ?? "neutral"];
  return (
    <div
      className={cn(
        "max-w-56 min-w-24 rounded-2xl border-2 px-4 py-2.5 text-center text-sm shadow-sm",
        data.root && "px-5 py-3.5 text-base font-semibold",
        selected && "ring-2 ring-ink/40",
      )}
      style={{ background: c.bg, borderColor: c.border }}
    >
      <Handles />
      <p className="break-words whitespace-pre-wrap">
        {data.label || <span className="text-muted-2">Sem título</span>}
      </p>
      {data.note && <p className="mt-1 line-clamp-2 text-[11px] text-muted">{data.note}</p>}
    </div>
  );
}

function StepNode({ data, selected }: NodeProps<FlowNode>) {
  const kind = data.kind ?? "nota";
  const Icon = KIND_ICON[kind];
  const c = NODE_COLORS[data.color ?? "neutral"];
  return (
    <div
      className={cn("w-48 rounded-2xl border-2 bg-surface shadow-sm", selected && "ring-2 ring-ink/40")}
      style={{ borderColor: c.border }}
    >
      <Handles />
      <div
        className="flex items-center gap-2 rounded-t-[14px] px-3 py-2 text-[11px] font-medium text-muted"
        style={{ background: c.bg }}
      >
        <Icon className="size-3.5" aria-hidden /> {FUNNEL_KINDS[kind]}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium break-words">
          {data.label || <span className="text-muted-2">Sem título</span>}
        </p>
        {data.note && <p className="mt-1 line-clamp-3 text-[11px] text-muted">{data.note}</p>}
      </div>
    </div>
  );
}

const nodeTypes = { ideia: IdeaNode, etapa: StepNode };

/** Escolhe os lados da ligação pela posição relativa dos blocos (a linha não dá volta). */
function sides(a: FlowNode | undefined, b: FlowNode | undefined) {
  if (!a || !b) return {};
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  if (Math.abs(dx) >= Math.abs(dy) * 0.8)
    return dx >= 0 ? { sourceHandle: "r", targetHandle: "l" } : { sourceHandle: "l", targetHandle: "r" };
  return dy >= 0 ? { sourceHandle: "b", targetHandle: "t" } : { sourceHandle: "t", targetHandle: "b" };
}

/** Converte para o formato salvo (sem seleção, medidas e outros detalhes da tela). */
function toData(nodes: FlowNode[], edges: Edge[]): CanvasData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "ideia",
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: Object.fromEntries(
        Object.entries(n.data).filter(([, v]) => v !== undefined && v !== ""),
      ) as NodeData,
    })) as CanvasNode[],
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(typeof e.label === "string" && e.label ? { label: e.label } : {}),
    })),
  };
}

type SaveState = "salvo" | "pendente" | "salvando" | "erro";

export interface FlowEditorProps {
  variant: "mapa" | "funil";
  initial: CanvasData;
  readOnly: boolean;
  onSave: (data: CanvasData) => Promise<{ ok: boolean; error?: string }>;
  /** Conteúdo à esquerda da barra (título, voltar). */
  header?: React.ReactNode;
}

/**
 * Editor de blocos e ligações (mapa mental e funil), com salvamento automático.
 * A página que usa precisa importar "@xyflow/react/dist/style.css" (só carrega onde há editor).
 */
export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}

function Editor({ variant, initial, readOnly, onSave, header }: FlowEditorProps) {
  const edgeDefaults = useMemo(
    () => ({
      type: variant === "funil" ? "smoothstep" : "default",
      markerEnd: variant === "funil" ? { type: MarkerType.ArrowClosed } : undefined,
    }),
    [variant],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes as FlowNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initial.edges.map((e) => ({ ...e, ...edgeDefaults })),
  );
  const [state, setState] = useState<SaveState>("salvo");
  const [error, setError] = useState("");
  const saved = useRef(JSON.stringify(toData(initial.nodes as FlowNode[], initial.edges as Edge[])));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flow = useReactFlow();
  const selected = nodes.find((n) => n.selected) ?? null;

  const save = useCallback(
    async (data: CanvasData) => {
      setState("salvando");
      const r = await onSave(data);
      if (r.ok) {
        saved.current = JSON.stringify(data);
        setState("salvo");
        setError("");
      } else {
        setState("erro");
        setError(r.error ?? "Não foi possível salvar.");
      }
    },
    [onSave],
  );

  // salva 1,2 s depois da última mudança de verdade (posição, texto, ligação)
  useEffect(() => {
    if (readOnly) return;
    const data = toData(nodes, edges);
    if (JSON.stringify(data) === saved.current) return;
    setState("pendente");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(data), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nodes, edges, readOnly, save]);

  // avisa antes de sair com alteração ainda não salva
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === "pendente" || state === "salvando" || state === "erro") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${newId()}`, ...edgeDefaults }, es)),
    [setEdges, edgeDefaults],
  );

  const patch = (id: string, data: Partial<NodeData>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));

  /** Cria um bloco; se houver um selecionado, liga a ele e posiciona ao lado. */
  const add = (data: NodeData, from: FlowNode | null) => {
    const id = newId();
    let position: { x: number; y: number };
    if (from) {
      const siblings = edges.filter((e) => e.source === from.id).length;
      position =
        variant === "funil"
          ? { x: from.position.x + 260, y: from.position.y + siblings * 130 }
          : { x: from.position.x + 240, y: from.position.y + (siblings - 1) * 80 };
    } else {
      const el = document.querySelector(".react-flow")?.getBoundingClientRect();
      position = flow.screenToFlowPosition({
        x: (el?.left ?? 0) + (el?.width ?? 600) / 2,
        y: (el?.top ?? 0) + (el?.height ?? 400) / 2,
      });
    }
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      { id, type: variant === "funil" ? "etapa" : "ideia", position, data, selected: true },
    ]);
    if (from)
      setEdges((es) => [...es, { id: `e-${from.id}-${id}`, source: from.id, target: id, ...edgeDefaults }]);
  };

  const remove = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };

  const root = useMemo(() => nodes.find((n) => n.data.root) ?? null, [nodes]);
  const shown = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return edges.map((e) => ({ ...e, ...sides(byId.get(e.source), byId.get(e.target)) }));
  }, [nodes, edges]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={shown}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        onBeforeDelete={async ({ nodes: ns, edges: es }) => ({
          nodes: ns.filter((n) => !(n.data as NodeData).root),
          edges: es,
        })}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
        className="bg-surface-2"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--border-2)" />
        <Controls showInteractive={false} position="bottom-left" />

        <Panel
          position="top-left"
          className="!m-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-2xl bg-surface p-2 shadow-sm"
        >
          {header}
          {!readOnly && variant === "mapa" && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  add(
                    {
                      label: "Nova ideia",
                      color: selected?.data.color && !selected.data.root ? selected.data.color : "neutral",
                    },
                    selected ?? root,
                  )
                }
              >
                <Plus /> {selected ? "Ideia ligada" : "Nova ideia"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => add({ label: "Ideia solta" }, null)}>
                Ideia solta
              </Button>
            </>
          )}
          {!readOnly && variant === "funil" && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm">
                  <Plus /> {selected ? "Próxima etapa" : "Adicionar etapa"}
                </Button>
              </MenuTrigger>
              <MenuContent align="start" className="max-h-80 overflow-y-auto">
                {(Object.keys(FUNNEL_KINDS) as FunnelKind[]).map((k) => {
                  const Icon = KIND_ICON[k];
                  return (
                    <MenuItem key={k} onSelect={() => add({ label: FUNNEL_KINDS[k], kind: k }, selected)}>
                      <Icon className="size-4" /> {FUNNEL_KINDS[k]}
                    </MenuItem>
                  );
                })}
              </MenuContent>
            </Menu>
          )}
          <SaveBadge
            state={readOnly ? "leitura" : state}
            onRetry={() => save(toData(nodes, edges))}
            error={error}
          />
        </Panel>

        {selected && (
          <Panel
            position="top-right"
            className="!m-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-3 shadow-lg"
          >
            <NodePanel
              key={selected.id}
              node={selected}
              variant={variant}
              readOnly={readOnly}
              onChange={(d) => patch(selected.id, d)}
              onDelete={() => remove(selected.id)}
              onClose={() => setNodes((ns) => ns.map((n) => ({ ...n, selected: false })))}
            />
          </Panel>
        )}
        {nodes.length === 0 && (
          <Panel
            position="top-center"
            className="!mt-24 rounded-2xl bg-surface px-4 py-3 text-center text-sm text-muted shadow-sm"
          >
            {readOnly
              ? "Este desenho está vazio."
              : variant === "funil"
                ? "Comece em “Adicionar etapa”."
                : "Comece em “Nova ideia”."}
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function SaveBadge({
  state,
  onRetry,
  error,
}: {
  state: SaveState | "leitura";
  onRetry: () => void;
  error: string;
}) {
  if (state === "leitura") return <span className="px-2 text-[11px] text-muted">Somente leitura</span>;
  if (state === "erro")
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 px-2 text-[11px] font-medium text-danger"
        title={error}
      >
        <CircleAlert className="size-3.5" aria-hidden /> Erro ao salvar — tentar de novo
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 text-[11px] text-muted" role="status">
      {state === "salvo" ? (
        <Check className="size-3.5 text-success" aria-hidden />
      ) : (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      )}
      {state === "salvo" ? "Salvo" : "Salvando…"}
    </span>
  );
}

function NodePanel({
  node,
  variant,
  readOnly,
  onChange,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  variant: "mapa" | "funil";
  readOnly: boolean;
  onChange: (d: Partial<NodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const d = node.data;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">
          {variant === "funil" ? "Etapa" : d.root ? "Ideia central" : "Ideia"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-1 text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>
      <fieldset disabled={readOnly} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Texto
          <textarea
            className="min-h-16 resize-y rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            value={d.label}
            maxLength={200}
            onChange={(e) => onChange({ label: e.target.value })}
            autoFocus={!readOnly}
          />
        </label>
        {variant === "funil" && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tipo de etapa
            <select
              className="h-9 rounded-xl bg-surface-2 px-2 text-sm text-ink"
              value={d.kind ?? "nota"}
              onChange={(e) => onChange({ kind: e.target.value as FunnelKind })}
            >
              {(Object.keys(FUNNEL_KINDS) as FunnelKind[]).map((k) => (
                <option key={k} value={k}>
                  {FUNNEL_KINDS[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          {variant === "funil" ? "Detalhes (meta, oferta, link…)" : "Observação"}
          <textarea
            className="min-h-14 resize-y rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            value={d.note ?? ""}
            maxLength={1000}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </label>
        <div className="flex flex-col gap-1 text-xs text-muted">
          Cor
          <div className="flex gap-1.5" role="radiogroup" aria-label="Cor do bloco">
            {(Object.keys(NODE_COLORS) as NodeColor[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={(d.color ?? "neutral") === c}
                aria-label={NODE_COLORS[c].label}
                onClick={() => onChange({ color: c })}
                className={cn(
                  "size-7 rounded-full border-2",
                  (d.color ?? "neutral") === c && "ring-2 ring-ink/50 ring-offset-1",
                )}
                style={{ background: NODE_COLORS[c].bg, borderColor: NODE_COLORS[c].border }}
              />
            ))}
          </div>
        </div>
        {!d.root && !readOnly && (
          <Button variant="ghost" size="sm" className="self-start text-danger" onClick={onDelete}>
            <Trash2 /> Apagar {variant === "funil" ? "etapa" : "ideia"}
          </Button>
        )}
      </fieldset>
      {!readOnly && (
        <p className="text-[10px] text-muted-2">
          Arraste as bolinhas da borda para ligar blocos. Para apagar uma ligação, clique nela e aperte
          Delete.
        </p>
      )}
    </div>
  );
}
