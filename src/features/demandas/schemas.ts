import { z } from "zod";
import type { TaskPriorityT, TaskRow, TaskTypeT } from "@/lib/supabase/database.types";
import { today as todayFn } from "@/lib/dates";

export const PRIORITIES: { value: TaskPriorityT; label: string; dot: string }[] = [
  { value: "alta", label: "Alta", dot: "bg-danger" },
  { value: "media", label: "Média", dot: "bg-warning" },
  { value: "baixa", label: "Baixa", dot: "bg-success" },
];

export const TASK_TYPES: { value: TaskTypeT; label: string }[] = [
  { value: "demanda", label: "Demanda" },
  { value: "post", label: "Post" },
];

/** Limites de legenda: geral do sistema e o do Instagram. */
export const CAPTION_LIMIT = 5000;
export const INSTAGRAM_LIMIT = 2200;

export const COLUMN_COLORS = ["#2f7be5", "#feb800", "#1f9d55", "#d0342c", "#8b5cf6", "#ec4899", "#0ea5e9", "#8e8e96"];

const uuid = z.string().uuid();
const optUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || uuid.safeParse(v).success, "Inválido.");
const optDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título à demanda.").max(200),
    type: z.enum(["demanda", "post"]),
    column_id: uuid,
    client_id: optUuid,
    label_id: optUuid,
    description: z.string().max(20000),
    caption: z.string().max(CAPTION_LIMIT, `Legenda com no máximo ${CAPTION_LIMIT} caracteres.`),
    priority: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || ["alta", "media", "baixa"].includes(v), "Prioridade inválida.")
      .transform((v) => v as TaskPriorityT | null),
    start_date: optDate,
    due_date: optDate,
    /** valor ISO (UTC) já convertido do campo de data e hora */
    publish_at: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Data inválida."),
    assignees: z.array(uuid).max(30),
  })
  .refine((v) => !v.start_date || !v.due_date || v.start_date <= v.due_date, {
    message: "O início precisa ser antes do prazo.",
    path: ["due_date"],
  });

export type TaskFormValues = z.input<typeof taskSchema>;

export const columnSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à coluna.").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  is_done: z.boolean(),
});

export const boardNameSchema = z.string().trim().min(1, "Dê um nome ao quadro.").max(80);

export const labelSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à etiqueta.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const linkSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Cole um link completo, começando com https://")
    .refine((u) => /^https?:\/\//i.test(u), "O link precisa começar com http:// ou https://"),
  name: z.string().trim().max(255).optional(),
});

/** Nome legível de um link (Google Drive, Canva, Figma ou o domínio). */
export function linkName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.endsWith("drive.google.com") || host.endsWith("docs.google.com")) return "Google Drive";
    if (host.endsWith("canva.com")) return "Canva";
    if (host.endsWith("figma.com")) return "Figma";
    return host;
  } catch {
    return "Link";
  }
}

/** Posição entre dois vizinhos para ordenar sem renumerar a lista inteira. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

// ---------- Filtros e ordenação (compartilhados pelas visões) ----------
export interface TaskFilters {
  q: string;
  client: string; // "" = todos, "none" = sem cliente
  priority: string; // "" | "alta" | "media" | "baixa" | "none"
  assignee: string; // "" | userId | "none"
  type: string; // "" | "post" | "demanda"
}

export const EMPTY_FILTERS: TaskFilters = { q: "", client: "", priority: "", assignee: "", type: "" };

export type TaskSort = "quadro" | "cliente" | "titulo" | "prazo";

export interface TaskLike extends Pick<TaskRow, "id" | "title" | "client_id" | "priority" | "type" | "due_date" | "position" | "completed_at"> {
  assignees: string[];
  clientName?: string | null;
}

export function filterTasks<T extends TaskLike>(tasks: T[], f: TaskFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!f.client || (f.client === "none" ? !t.client_id : t.client_id === f.client)) &&
      (!f.priority || (f.priority === "none" ? !t.priority : t.priority === f.priority)) &&
      (!f.assignee || (f.assignee === "none" ? t.assignees.length === 0 : t.assignees.includes(f.assignee))) &&
      (!f.type || t.type === f.type),
  );
}

export function sortTasks<T extends TaskLike>(tasks: T[], sort: TaskSort): T[] {
  const list = [...tasks];
  switch (sort) {
    case "cliente":
      return list.sort((a, b) => (a.clientName ?? "~").localeCompare(b.clientName ?? "~", "pt-BR") || a.position - b.position);
    case "titulo":
      return list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "prazo":
      return list.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.position - b.position);
    default:
      return list.sort((a, b) => a.position - b.position);
  }
}

/** Atrasada = tem prazo no passado e não foi concluída. */
export function isOverdue(t: Pick<TaskRow, "due_date" | "completed_at">, today = todayFn()): boolean {
  return !!t.due_date && !t.completed_at && t.due_date < today;
}
