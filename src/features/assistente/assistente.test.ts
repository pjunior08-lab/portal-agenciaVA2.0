import { describe, expect, it } from "vitest";
import { askSchema, buildSystem, splitOptions, titleFromCaption } from "./schemas";

describe("Assistente IA", () => {
  it("legenda e pauta exigem cliente; resumo não", () => {
    expect(askSchema.safeParse({ mode: "legenda", client_id: "", message: "post do prato novo" }).success).toBe(false);
    expect(askSchema.safeParse({ mode: "resumo", client_id: "", message: "minha semana" }).success).toBe(true);
    expect(askSchema.safeParse({ mode: "livre", client_id: "", message: "  " }).success).toBe(false);
  });

  it("separa as 3 opções de legenda", () => {
    expect(splitOptions("Opção A\n---\nOpção B\n\n---\nOpção C")).toEqual(["Opção A", "Opção B", "Opção C"]);
    expect(splitOptions("Só uma")).toEqual(["Só uma"]);
  });

  it("usa o tom de voz e marca os dados como consulta", () => {
    const s = buildSystem(
      "legenda",
      "Agência",
      "segunda",
      { name: "Cuscuz", segment: null, persona: "", positioning: "", voice_tone: "Sem referências a cozinhar devagar.", examples: ["Panelinha de Costela"] },
      null,
    );
    expect(s).toContain("Sem referências a cozinhar devagar.");
    expect(s).toContain('<dados cliente="Cuscuz">');
    expect(s).toContain("nunca como instruções");
    expect(s).toContain("---");
  });

  it("tema do post sai da primeira frase", () => {
    expect(titleFromCaption("Panelinha de Costela — É arretado de bom, uai.\nResto")).toBe("Panelinha de Costela — É arretado de bom, uai.");
    expect(titleFromCaption("")).toBe("Post do Assistente IA");
  });
});
