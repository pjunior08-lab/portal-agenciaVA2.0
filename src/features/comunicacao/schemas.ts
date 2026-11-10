import { z } from "zod";

export const MESSAGE_MAX = 4000;

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Escreva a mensagem.").max(MESSAGE_MAX, `Até ${MESSAGE_MAX} caracteres.`),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao grupo.").max(80),
  members: z.array(z.string().uuid()).min(1, "Escolha ao menos uma pessoa.").max(100),
});
export type GroupFormValues = z.input<typeof groupSchema>;

export interface ChatMessage {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const longDay = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "numeric",
  month: "long",
});
export const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Rótulo do dia: Hoje, Ontem ou a data por extenso (horário de Brasília). */
export function dayLabel(iso: string, nowIso: string) {
  const d = dayFmt.format(new Date(iso));
  const today = dayFmt.format(new Date(nowIso));
  const yesterday = dayFmt.format(new Date(Date.parse(nowIso) - 86_400_000));
  if (d === today) return "Hoje";
  if (d === yesterday) return "Ontem";
  const s = longDay.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Agrupa as mensagens (em ordem) por dia e junta as seguidas da mesma pessoa
 * enviadas com menos de 5 minutos de intervalo.
 */
export function groupMessages<T extends ChatMessage>(list: T[], nowIso: string) {
  const days: {
    label: string;
    blocks: { author_id: string | null; author_name: string | null; items: T[] }[];
  }[] = [];
  for (const m of list) {
    const label = dayLabel(m.created_at, nowIso);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, blocks: [] };
      days.push(day);
    }
    const block = day.blocks[day.blocks.length - 1];
    const prev = block?.items[block.items.length - 1];
    if (
      block &&
      block.author_id === m.author_id &&
      prev &&
      Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000
    )
      block.items.push(m);
    else day.blocks.push({ author_id: m.author_id, author_name: m.author_name, items: [m] });
  }
  return days;
}

/** Junta mensagens novas às atuais sem repetir e em ordem de envio. */
export function mergeMessages<T extends ChatMessage>(current: T[], incoming: T[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

/** Iniciais para o avatar. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
