import type { BoardRow, ColumnRow, LabelRow, TaskRow } from "@/lib/supabase/database.types";

export interface AttachmentView {
  id: string;
  kind: "arquivo" | "link";
  name: string;
  url: string | null; // link externo ou link temporário do arquivo
  mime: string | null;
  size: number | null;
}

export interface TaskView extends TaskRow {
  assignees: string[];
  clientName: string | null;
  clientColor: string | null;
  attachments: AttachmentView[];
  /** primeira imagem anexada (para capa/miniatura do card) */
  coverUrl: string | null;
}

export interface Person {
  id: string;
  name: string;
}

export interface ClientOption {
  id: string;
  name: string;
  color: string | null;
}

export interface DemandasData {
  boards: BoardRow[];
  board: BoardRow;
  columns: ColumnRow[];
  tasks: TaskView[];
  labels: LabelRow[];
  clients: ClientOption[];
  people: Person[];
  canEdit: boolean;
  isAdmin: boolean;
  userId: string;
  agencyId: string;
}
