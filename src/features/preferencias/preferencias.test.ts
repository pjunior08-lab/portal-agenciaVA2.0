import { describe, expect, it } from "vitest";
import { applyPrefs, parsePrefs } from "./schemas";

const mods = [
  { slug: "inicio", group: "operacao" as const },
  { slug: "agenda", group: "operacao" as const },
  { slug: "clientes", group: "gestao" as const },
  { slug: "comercial", group: "gestao" as const },
  { slug: "configuracoes", group: "mais" as const },
];

describe("barra lateral", () => {
  it("sem preferência mantém o padrão", () => {
    expect(applyPrefs(mods, { order: [], hidden: [], collapsed: false })).toEqual(mods);
  });

  it("reordena e manda escondidos para Mais áreas, sem esconder os fixos", () => {
    const r = applyPrefs(mods, {
      order: ["comercial", "agenda"],
      hidden: ["clientes", "inicio"],
      collapsed: false,
    });
    expect(r.map((m) => m.slug)).toEqual(["comercial", "agenda", "inicio", "clientes", "configuracoes"]);
    expect(r.find((m) => m.slug === "clientes")!.group).toBe("mais");
    expect(r.find((m) => m.slug === "inicio")!.group).toBe("operacao");
  });

  it("depois de personalizar, o que não está escondido sai de Mais áreas", () => {
    const withMais = [...mods, { slug: "funil", group: "mais" as const }];
    const r = applyPrefs(withMais, { order: ["funil", "agenda"], hidden: [], collapsed: false });
    expect(r.find((m) => m.slug === "funil")!.group).toBe("gestao");
    expect(r.find((m) => m.slug === "configuracoes")!.group).toBe("mais");
  });

  it("descarta preferência fora do formato", () => {
    expect(parsePrefs({ order: ["<script>"], hidden: [] })).toEqual({
      order: [],
      hidden: [],
      collapsed: false,
    });
    expect(parsePrefs(null)).toEqual({ order: [], hidden: [], collapsed: false });
    // preferência antiga, sem o campo novo, continua valendo
    expect(parsePrefs({ order: ["agenda"], hidden: [] })).toEqual({
      order: ["agenda"],
      hidden: [],
      collapsed: false,
    });
  });
});
