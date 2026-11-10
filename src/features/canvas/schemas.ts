import { z } from "zod";

/** Cores dos blocos: nomes de tokens (a cor real vem do tema). */
export const NODE_COLORS = {
  neutral: { label: "Neutro", bg: "var(--surface)", border: "var(--border-2)" },
  brand: { label: "Amarelo", bg: "var(--brand-soft)", border: "var(--brand)" },
  info: { label: "Azul", bg: "var(--info-soft)", border: "var(--info)" },
  success: { label: "Verde", bg: "var(--success-soft)", border: "var(--success)" },
  danger: { label: "Vermelho", bg: "var(--danger-soft)", border: "var(--danger)" },
} as const;
export type NodeColor = keyof typeof NODE_COLORS;

/** Etapas do funil. */
export const FUNNEL_KINDS = {
  anuncio: "Anúncio",
  conteudo: "Conteúdo orgânico",
  pagina: "Página",
  formulario: "Formulário",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  checkout: "Checkout",
  obrigado: "Obrigado",
  evento: "Evento ao vivo",
  nota: "Anotação",
} as const;
export type FunnelKind = keyof typeof FUNNEL_KINDS;

export const MAX_NODES = 400;
export const MAX_EDGES = 800;

const coord = z.number().finite().min(-100_000).max(100_000);
const nodeSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(["ideia", "etapa"]),
  position: z.object({ x: coord, y: coord }),
  data: z.object({
    label: z.string().max(200),
    note: z.string().max(1000).optional(),
    color: z.enum(["neutral", "brand", "info", "success", "danger"]).optional(),
    kind: z.enum(Object.keys(FUNNEL_KINDS) as [FunnelKind, ...FunnelKind[]]).optional(),
    root: z.boolean().optional(),
  }),
});
const edgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string().min(1).max(40),
  target: z.string().min(1).max(40),
  label: z.string().max(60).optional(),
});
export type CanvasNode = z.infer<typeof nodeSchema>;
export type CanvasEdge = z.infer<typeof edgeSchema>;

/** Desenho salvo: blocos e ligações (as ligações precisam apontar para blocos existentes). */
export const canvasSchema = z
  .object({
    nodes: z.array(nodeSchema).max(MAX_NODES, `Até ${MAX_NODES} blocos.`),
    edges: z.array(edgeSchema).max(MAX_EDGES, `Até ${MAX_EDGES} ligações.`),
  })
  .superRefine((v, ctx) => {
    const ids = new Set(v.nodes.map((n) => n.id));
    if (ids.size !== v.nodes.length) ctx.addIssue({ code: "custom", message: "Blocos repetidos." });
    if (v.edges.some((e) => !ids.has(e.source) || !ids.has(e.target)))
      ctx.addIssue({ code: "custom", message: "Ligação para bloco que não existe." });
  });
export type CanvasData = z.infer<typeof canvasSchema>;

/** Lê o que veio do banco, descartando o que estiver fora do formato. */
export function parseCanvas(nodes: unknown, edges: unknown): CanvasData {
  const ns = (Array.isArray(nodes) ? nodes : []).flatMap((n) => {
    const r = nodeSchema.safeParse(n);
    return r.success ? [r.data] : [];
  });
  const ids = new Set(ns.map((n) => n.id));
  const es = (Array.isArray(edges) ? edges : []).flatMap((e) => {
    const r = edgeSchema.safeParse(e);
    return r.success && ids.has(r.data.source) && ids.has(r.data.target) ? [r.data] : [];
  });
  return { nodes: ns, edges: es };
}

let seq = 0;
/** Identificador curto para blocos novos. */
export const newId = () =>
  `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Modelos ----------
export const MAP_TEMPLATES = {
  em_branco: { label: "Em branco", branches: [] as { label: string; children?: string[] }[] },
  campanha: {
    label: "Planejamento de campanha",
    branches: [
      { label: "Objetivo" },
      { label: "Público" },
      { label: "Mensagem principal" },
      { label: "Canais" },
      { label: "Orçamento" },
      { label: "Cronograma" },
      { label: "Métricas de sucesso" },
    ],
  },
  briefing: {
    label: "Briefing de cliente",
    branches: [
      { label: "Empresa" },
      { label: "Produtos e serviços" },
      { label: "Público-alvo" },
      { label: "Concorrentes" },
      { label: "Diferenciais" },
      { label: "Tom de voz" },
      { label: "Objetivos" },
      { label: "Referências" },
    ],
  },
  pilares: {
    label: "Pilares de conteúdo",
    branches: ["Educar", "Inspirar", "Entreter", "Vender", "Bastidores"].map((label) => ({
      label,
      children: ["Ideia de pauta", "Ideia de pauta"],
    })),
  },
} as const;
export type MapTemplate = keyof typeof MAP_TEMPLATES;

const BRANCH_COLORS: NodeColor[] = ["info", "success", "brand", "danger", "neutral"];

/** Monta o mapa do modelo: ideia central e ramos em volta (com sub-ideias, quando houver). */
export function buildMindMap(template: MapTemplate, centralLabel: string): CanvasData {
  const t = MAP_TEMPLATES[template];
  const root: CanvasNode = {
    id: "raiz",
    type: "ideia",
    position: { x: 0, y: 0 },
    data: { label: centralLabel, color: "brand", root: true },
  };
  const nodes: CanvasNode[] = [root];
  const edges: CanvasEdge[] = [];
  const n = t.branches.length;
  t.branches.forEach((b, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const id = `r${i}`;
    const x = Math.round(Math.cos(angle) * 320);
    const y = Math.round(Math.sin(angle) * 220);
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
    nodes.push({ id, type: "ideia", position: { x, y }, data: { label: b.label, color } });
    edges.push({ id: `e-raiz-${id}`, source: "raiz", target: id });
    ("children" in b ? (b.children ?? []) : []).forEach((c, j) => {
      const cid = `${id}c${j}`;
      nodes.push({
        id: cid,
        type: "ideia",
        position: { x: x + Math.sign(x || 1) * 220, y: y + (j - 0.5) * 70 },
        data: { label: c, color },
      });
      edges.push({ id: `e-${id}-${cid}`, source: id, target: cid });
    });
  });
  return { nodes, edges };
}

export const FUNNEL_TEMPLATES: Record<string, { label: string; steps: [FunnelKind, string][] }> = {
  em_branco: { label: "Em branco", steps: [] },
  captacao: {
    label: "Captação de leads",
    steps: [
      ["anuncio", "Anúncio"],
      ["pagina", "Página de captura"],
      ["obrigado", "Página de obrigado"],
      ["email", "E-mail de boas-vindas"],
      ["whatsapp", "Contato no WhatsApp"],
    ],
  },
  venda_direta: {
    label: "Venda direta",
    steps: [
      ["anuncio", "Anúncio"],
      ["pagina", "Página de vendas"],
      ["checkout", "Checkout"],
      ["obrigado", "Página de obrigado"],
      ["email", "E-mail pós-venda"],
    ],
  },
  webinar: {
    label: "Webinar / aula ao vivo",
    steps: [
      ["anuncio", "Anúncio"],
      ["pagina", "Página de inscrição"],
      ["email", "Lembretes por e-mail"],
      ["evento", "Aula ao vivo"],
      ["pagina", "Página da oferta"],
      ["checkout", "Checkout"],
    ],
  },
  agendamento: {
    label: "Agendamento de reunião",
    steps: [
      ["anuncio", "Anúncio"],
      ["formulario", "Formulário"],
      ["whatsapp", "Qualificação no WhatsApp"],
      ["reuniao", "Reunião"],
    ],
  },
  organico: {
    label: "Orgânico para WhatsApp",
    steps: [
      ["conteudo", "Conteúdo nas redes"],
      ["pagina", "Link da bio"],
      ["whatsapp", "Conversa no WhatsApp"],
    ],
  },
};

/** Monta o funil do modelo: etapas em sequência, da esquerda para a direita. */
export function buildFunnel(template: string): CanvasData {
  const t = FUNNEL_TEMPLATES[template] ?? FUNNEL_TEMPLATES.em_branco;
  const nodes: CanvasNode[] = t.steps.map(([kind, label], i) => ({
    id: `s${i}`,
    type: "etapa",
    position: { x: i * 260, y: 0 },
    data: { label, kind },
  }));
  const edges: CanvasEdge[] = nodes
    .slice(1)
    .map((n, i) => ({ id: `e-s${i}-${n.id}`, source: `s${i}`, target: n.id }));
  return { nodes, edges };
}

// ---------- Formulários ----------
export const mapSchema = z.object({
  title: z.string().trim().min(1, "Dê um título ao mapa.").max(120),
  client_id: z.string().uuid("Escolha o cliente."),
  template: z.enum(["em_branco", "campanha", "briefing", "pilares"]),
});
export const mapMetaSchema = mapSchema.pick({ title: true, client_id: true });

export const funnelSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao funil.").max(120),
  folder_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Pasta inválida."),
  client_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Cliente inválido."),
  template: z.string().refine((v) => v in FUNNEL_TEMPLATES, "Modelo inválido."),
});
export const funnelMetaSchema = funnelSchema.omit({ template: true });
export const folderSchema = z.object({ name: z.string().trim().min(1, "Dê um nome à pasta.").max(60) });
