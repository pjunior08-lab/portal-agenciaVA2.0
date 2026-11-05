import { describe, expect, it } from "vitest";
import { addDays, diffDays, localToIso, monthGrid, startOfWeek, weekday } from "@/lib/dates";
import {
  EMPTY_FILTERS,
  filterTasks,
  isOverdue,
  linkName,
  positionBetween,
  sortTasks,
  taskSchema,
  type TaskLike,
} from "./schemas";

const t = (o: Partial<TaskLike>): TaskLike => ({
  id: "x",
  title: "Tarefa",
  client_id: null,
  priority: null,
  type: "demanda",
  due_date: null,
  position: 0,
  completed_at: null,
  assignees: [],
  ...o,
});

describe("datas", () => {
  it("soma e subtrai dias atravessando meses e anos", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-01", "2026-11-30")).toBe(29);
  });
  it("semana começa no domingo e a grade do mês tem 42 dias", () => {
    expect(weekday("2026-11-05")).toBe(4); // quinta
    expect(startOfWeek("2026-11-05")).toBe("2026-11-01");
    const g = monthGrid("2026-11-15");
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-11-01");
  });
  it("converte horário de São Paulo para UTC", () => {
    expect(localToIso("2026-11-05", "09:00")).toBe("2026-11-05T12:00:00.000Z");
  });
});

describe("taskSchema", () => {
  const base = {
    title: "Post de lançamento",
    type: "post",
    column_id: "00000000-0000-4000-8000-000000000001",
    client_id: "",
    label_id: "",
    description: "",
    caption: "",
    priority: "",
    start_date: "",
    due_date: "",
    publish_at: "",
    assignees: [],
  };
  it("aceita o mínimo e transforma vazios em nulo", () => {
    const r = taskSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.priority).toBe(null);
  });
  it("recusa início depois do prazo", () => {
    expect(taskSchema.safeParse({ ...base, start_date: "2026-11-10", due_date: "2026-11-01" }).success).toBe(false);
  });
  it("recusa legenda acima de 5000 caracteres", () => {
    expect(taskSchema.safeParse({ ...base, caption: "a".repeat(5001) }).success).toBe(false);
  });
  it("recusa prioridade inventada", () => {
    expect(taskSchema.safeParse({ ...base, priority: "urgente" }).success).toBe(false);
  });
});

describe("ordem e filtros", () => {
  it("positionBetween calcula posição entre vizinhos", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(3000, null)).toBe(4000);
    expect(positionBetween(null, null)).toBe(1000);
  });
  it("filtra por cliente, prioridade, responsável, tipo e texto", () => {
    const list = [
      t({ id: "1", title: "Post Aurora", client_id: "c1", priority: "alta", assignees: ["u1"], type: "post" }),
      t({ id: "2", title: "Relatório", client_id: null, priority: null, assignees: [] }),
    ];
    expect(filterTasks(list, { ...EMPTY_FILTERS, client: "c1" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, client: "none" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, priority: "none" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, assignee: "u1" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, type: "post" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, q: "relat" }).map((x) => x.id)).toEqual(["2"]);
  });
  it("ordena por prazo com sem-prazo no fim", () => {
    const list = [t({ id: "a", due_date: null }), t({ id: "b", due_date: "2026-11-10" }), t({ id: "c", due_date: "2026-11-01" })];
    expect(sortTasks(list, "prazo").map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
  it("atrasada só se não concluída", () => {
    expect(isOverdue({ due_date: "2026-11-01", completed_at: null }, "2026-11-05")).toBe(true);
    expect(isOverdue({ due_date: "2026-11-01", completed_at: "2026-11-02" }, "2026-11-05")).toBe(false);
    expect(isOverdue({ due_date: "2026-11-05", completed_at: null }, "2026-11-05")).toBe(false);
  });
  it("reconhece links do Google Drive", () => {
    expect(linkName("https://drive.google.com/file/d/abc")).toBe("Google Drive");
    expect(linkName("https://www.exemplo.com.br/x")).toBe("exemplo.com.br");
  });
});
