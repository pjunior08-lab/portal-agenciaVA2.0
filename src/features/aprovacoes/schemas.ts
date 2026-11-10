import { z } from "zod";
import type {
  ApprovalDecisionT,
  ApprovalPartT,
  ApprovalStatusT,
  PublicationStatusT,
  SocialNetworkT,
} from "@/lib/supabase/database.types";
import { localInputToIso } from "@/lib/dates";

export const STATUS: Record<ApprovalStatusT, { label: string; tone: "neutral" | "brand" | "info" | "success-soft" | "danger"; color: string }> = {
  enviado: { label: "Enviado", tone: "info", color: "var(--info)" },
  em_analise: { label: "Cliente analisando", tone: "brand", color: "var(--brand)" },
  aprovado: { label: "Aprovado", tone: "success-soft", color: "var(--success)" },
  alteracoes: { label: "Alterações", tone: "neutral", color: "var(--warning)" },
  reprovado: { label: "Reprovado", tone: "danger", color: "var(--danger)" },
};
export const STATUS_ORDER: ApprovalStatusT[] = ["enviado", "em_analise", "alteracoes", "reprovado", "aprovado"];

export const DECISIONS: Record<ApprovalDecisionT, string> = {
  aprovado: "Aprovado",
  alteracoes: "Pedir alterações",
  reprovado: "Reprovado",
};

export const PARTS: Record<ApprovalPartT, string> = {
  geral: "Envio inteiro",
  tema: "Tema",
  midias: "Mídias",
  legenda: "Legenda",
};

export const NETWORKS: Record<SocialNetworkT, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};
export const NETWORK_IDS = Object.keys(NETWORKS) as SocialNetworkT[];

export const PUBLICATION_STATUS: Record<PublicationStatusT, { label: string; tone: "info" | "success-soft" | "neutral" | "danger" }> = {
  agendado: { label: "Agendado", tone: "info" },
  publicando: { label: "Publicando", tone: "info" },
  publicado: { label: "Publicado", tone: "success-soft" },
  erro: { label: "Falhou", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

const uuidOrNull = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Valor inválido.");

/** Envio para aprovação (post ou demanda). A data agendada usa o horário de Brasília. */
export const postSchema = z
  .object({
    kind: z.enum(["post", "demanda"]),
    client_id: z.string().uuid("Escolha o cliente."),
    task_id: uuidOrNull,
    title: z.string().trim().min(1, "Informe o tema.").max(200),
    caption: z.string().max(5000, "Máximo de 5.000 caracteres."),
    mode: z.enum(["rapida", "detalhada"]),
    publish_mode: z.enum(["manual", "automatica"]),
    networks: z.array(z.enum(["instagram", "facebook", "tiktok", "youtube", "linkedin"])).max(5),
    scheduled_at: z.string(), // "AAAA-MM-DDTHH:MM" ou vazio
  })
  .superRefine((v, ctx) => {
    if (v.kind === "demanda" && v.mode !== "rapida")
      ctx.addIssue({ code: "custom", path: ["mode"], message: "Demanda usa aprovação rápida." });
    if (v.kind === "post" && v.publish_mode === "automatica") {
      if (!v.scheduled_at) ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "Informe a data para agendar depois da aprovação." });
      if (!v.networks.length) ctx.addIssue({ code: "custom", path: ["networks"], message: "Escolha a rede." });
    }
    if (v.scheduled_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.scheduled_at))
      ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "Data inválida." });
  })
  .transform((v) => ({
    ...v,
    mode: v.kind === "demanda" ? ("rapida" as const) : v.mode,
    publish_mode: v.kind === "demanda" ? ("manual" as const) : v.publish_mode,
    networks: v.kind === "demanda" ? [] : v.networks,
    scheduled_at: v.scheduled_at ? localInputToIso(v.scheduled_at) : null,
  }));
export type PostFormValues = z.input<typeof postSchema>;

export const decisionSchema = z
  .object({
    postId: z.string().uuid(),
    part: z.enum(["geral", "tema", "midias", "legenda"]),
    decision: z.enum(["aprovado", "alteracoes", "reprovado"]),
    comment: z.string().trim().max(2000, "Máximo de 2.000 caracteres."),
  })
  .refine((v) => v.decision === "aprovado" || v.comment.length > 0, {
    path: ["comment"],
    message: "Escreva o que precisa mudar.",
  });

export const captionTemplateSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome.").max(80),
  body: z.string().trim().min(1, "Escreva a legenda.").max(5000),
  client_id: uuidOrNull,
});

/**
 * Resultado da aprovação detalhada (mesma regra do banco): só sai quando
 * tema, mídias e legenda foram decididos; uma reprovada reprova; uma com
 * alterações pede ajuste.
 */
export function detailedResult(parts: (ApprovalDecisionT | null)[]): ApprovalStatusT {
  if (parts.some((p) => p === null)) return "em_analise";
  if (parts.includes("reprovado")) return "reprovado";
  if (parts.includes("alteracoes")) return "alteracoes";
  return "aprovado";
}

/** Envio aguardando o cliente. */
export const isPending = (s: ApprovalStatusT) => s === "enviado" || s === "em_analise";
/** Envio que voltou para a equipe ajustar. */
export const needsWork = (s: ApprovalStatusT) => s === "alteracoes" || s === "reprovado";

export interface PostFilters {
  q: string;
  client: string;
  status: string;
  kind: "post" | "demanda";
}

export function filterPosts<T extends { title: string; caption: string; client_id: string; status: ApprovalStatusT; kind: "post" | "demanda" }>(
  posts: T[],
  f: PostFilters,
): T[] {
  const q = f.q.trim().toLowerCase();
  return posts.filter(
    (p) =>
      p.kind === f.kind &&
      (!f.client || p.client_id === f.client) &&
      (!f.status || p.status === f.status) &&
      (!q || p.title.toLowerCase().includes(q) || p.caption.toLowerCase().includes(q)),
  );
}

// ---------- Social ----------
export const accountSchema = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  network: z.enum(["instagram", "facebook", "tiktok", "youtube", "linkedin"]),
  username: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .pipe(z.string().min(1, "Informe o usuário.").max(100)),
  profile_url: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Use um endereço que comece com http:// ou https://."),
});

export const publicationSchema = z
  .object({
    client_id: z.string().uuid("Escolha o cliente."),
    network: z.enum(["instagram", "facebook", "tiktok", "youtube", "linkedin"]),
    account_id: uuidOrNull,
    title: z.string().trim().min(1, "Informe o título.").max(200),
    caption: z.string().max(5000, "Máximo de 5.000 caracteres."),
    scheduled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe data e hora."),
    status: z.enum(["agendado", "publicado", "cancelado"]),
  })
  .transform((v) => ({ ...v, scheduled_at: localInputToIso(v.scheduled_at) as string }));
export type PublicationFormValues = z.input<typeof publicationSchema>;
