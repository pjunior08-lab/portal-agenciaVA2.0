import { describe, expect, it } from "vitest";
import { availabilitySchema, checklistSchema, eventSchema, eventTimes } from "./schemas";

const base = {
  title: "Reunião de pauta",
  day: "2026-11-10",
  end_day: "2026-11-10",
  start_time: "09:00",
  end_time: "10:00",
  all_day: false,
  client_id: "",
  visibility: "agencia" as const,
  location: "",
  description: "",
  attendees: [],
};

describe("agenda", () => {
  it("converte horário de Brasília em instante UTC", () => {
    expect(eventTimes(base)).toEqual({ starts_at: "2026-11-10T12:00:00.000Z", ends_at: "2026-11-10T13:00:00.000Z" });
    expect(eventTimes({ ...base, all_day: true }).ends_at).toBe("2026-11-11T02:59:00.000Z");
  });

  it("recusa atividade que termina antes de começar", () => {
    const r = eventSchema.safeParse({ ...base, start_time: "11:00" });
    expect(r.success).toBe(false);
  });

  it("aceita atividade de dia inteiro sem horário e esvazia cliente", () => {
    const r = eventSchema.safeParse({ ...base, all_day: true, start_time: "", end_time: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.client_id).toBeNull();
  });

  it("valida disponibilidade e checklist", () => {
    expect(availabilitySchema.safeParse([{ weekday: 1, start_time: "18:00", end_time: "09:00" }]).success).toBe(false);
    expect(checklistSchema.parse({ title: "Enviar relatório", due_date: "" }).due_date).toBeNull();
    expect(checklistSchema.safeParse({ title: "  ", due_date: "" }).success).toBe(false);
  });
});
