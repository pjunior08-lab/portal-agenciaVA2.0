import { describe, expect, it } from "vitest";
import { linesToItems, newItems, parseItems, progress, SUGGESTED_TEMPLATES, templateSchema } from "./schemas";

describe("Checklist", () => {
  it("um item por linha, ignorando vazias e marcadores", () => {
    expect(linesToItems("- Legenda revisada\n\n• Arte no tamanho\n  * JPG  \n")).toEqual(["Legenda revisada", "Arte no tamanho", "JPG"]);
  });

  it("modelo precisa de ao menos um item e no máximo 60", () => {
    const base = { name: "Antes de publicar", description: "", applies_to: "demanda" as const };
    expect(templateSchema.safeParse({ ...base, items_text: "\n \n" }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base, items_text: Array.from({ length: 61 }, (_, i) => `item ${i}`).join("\n") }).success).toBe(false);
    const ok = templateSchema.safeParse({ ...base, items_text: "a\nb" });
    expect(ok.success && ok.data.items_text).toEqual(["a", "b"]);
  });

  it("lê itens do banco sem confiar no formato e calcula o progresso", () => {
    const items = parseItems([{ text: "a", done: true, done_by: "u", done_at: "2026-11-23T10:00:00Z" }, { text: "b" }, { nope: 1 }, "x"]);
    expect(items).toHaveLength(2);
    expect(progress(items)).toEqual({ done: 1, total: 2, complete: false });
    expect(progress(newItems(["a"]).map((i) => ({ ...i, done: true })))).toEqual({ done: 1, total: 1, complete: true });
    expect(progress([]).complete).toBe(false);
  });

  it("modelos sugeridos são válidos", () => {
    for (const t of SUGGESTED_TEMPLATES) {
      expect(templateSchema.safeParse({ ...t, items_text: t.items.join("\n") }).success).toBe(true);
    }
  });
});
