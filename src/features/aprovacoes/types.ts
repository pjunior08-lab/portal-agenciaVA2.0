import type { PostRow } from "@/lib/supabase/database.types";

export interface MediaView {
  id: string;
  name: string;
  url: string | null;
  mime: string | null;
  size: number;
}

export interface ApprovalEventView {
  id: string;
  actorName: string;
  actor_side: "equipe" | "cliente";
  event: "enviado" | "reenviado" | "em_analise" | "decisao";
  part: "geral" | "tema" | "midias" | "legenda" | null;
  decision: "aprovado" | "alteracoes" | "reprovado" | null;
  round: number;
  comment: string | null;
  created_at: string;
}

export interface PostView extends PostRow {
  clientName: string;
  clientColor: string | null;
  creatorName: string;
  media: MediaView[];
  events: ApprovalEventView[];
  /** já está no calendário do Social */
  scheduledInSocial: boolean;
}

export const isImage = (m: { mime: string | null }) => !!m.mime?.startsWith("image/");
export const isVideo = (m: { mime: string | null }) => !!m.mime?.startsWith("video/");
