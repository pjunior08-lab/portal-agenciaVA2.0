import { z } from "zod";
import { localToIso } from "@/lib/dates";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida.");

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título à atividade.").max(200),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    end_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    start_time: time.or(z.literal("")),
    end_time: time.or(z.literal("")),
    all_day: z.boolean(),
    client_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    visibility: z.enum(["agencia", "privado"]),
    location: z.string().trim().max(300),
    description: z.string().max(5000),
    attendees: z.array(z.string().uuid()).max(50),
  })
  .superRefine((v, ctx) => {
    if (!v.all_day && (!v.start_time || !v.end_time)) {
      ctx.addIssue({ code: "custom", path: ["start_time"], message: "Informe o horário de início e de fim." });
      return;
    }
    const { starts_at, ends_at } = eventTimes(v);
    if (ends_at < starts_at) ctx.addIssue({ code: "custom", path: ["end_time"], message: "O fim precisa ser depois do início." });
  });

export type EventFormValues = z.input<typeof eventSchema>;

/** Converte data/hora do formulário (horário de Brasília) em instantes ISO. Dia inteiro = 00:00 a 23:59. */
export function eventTimes(v: { day: string; end_day: string; start_time: string; end_time: string; all_day: boolean }) {
  if (v.all_day) return { starts_at: localToIso(v.day, "00:00"), ends_at: localToIso(v.end_day, "23:59") };
  return { starts_at: localToIso(v.day, v.start_time), ends_at: localToIso(v.end_day, v.end_time) };
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const availabilitySchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), start_time: time, end_time: time })
      .refine((r) => r.end_time > r.start_time, { message: "O fim precisa ser depois do início." }),
  )
  .max(21);

export const checklistSchema = z.object({
  title: z.string().trim().min(1, "Escreva o item.").max(200),
  due_date: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida."),
});
