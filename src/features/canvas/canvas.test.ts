import { describe, expect, it } from "vitest";
import { buildFunnel, buildMindMap, canvasSchema, funnelSchema, parseCanvas } from "./schemas";

describe("canvas", () => {
  it("monta o mapa do modelo com ideia central e ramos ligados", () => {
    const m = buildMindMap("campanha", "Black Friday");
    expect(m.nodes[0]).toMatchObject({ id: "raiz", data: { label: "Black Friday", root: true } });
    expect(m.nodes).toHaveLength(8);
    expect(m.edges.every((e) => e.source === "raiz")).toBe(true);
    const p = buildMindMap("pilares", "Pilares");
    expect(p.nodes).toHaveLength(1 + 5 + 10);
    expect(canvasSchema.safeParse(p).success).toBe(true);
    expect(buildMindMap("em_branco", "X").nodes).toHaveLength(1);
  });

  it("monta o funil do modelo em sequência", () => {
    const f = buildFunnel("venda_direta");
    expect(f.nodes.map((n) => n.data.kind)).toEqual(["anuncio", "pagina", "checkout", "obrigado", "email"]);
    expect(f.edges).toHaveLength(4);
    expect(buildFunnel("nao-existe").nodes).toHaveLength(0);
  });

  it("recusa ligações soltas e blocos repetidos", () => {
    const n = { id: "a", type: "ideia" as const, position: { x: 0, y: 0 }, data: { label: "A" } };
    expect(
      canvasSchema.safeParse({ nodes: [n], edges: [{ id: "e", source: "a", target: "b" }] }).success,
    ).toBe(false);
    expect(canvasSchema.safeParse({ nodes: [n, n], edges: [] }).success).toBe(false);
    expect(
      canvasSchema.safeParse({ nodes: [{ ...n, position: { x: Infinity, y: 0 } }], edges: [] }).success,
    ).toBe(false);
  });

  it("lê do banco descartando o que está fora do formato", () => {
    const c = parseCanvas(
      [
        { id: "a", type: "ideia", position: { x: 1, y: 2 }, data: { label: "A" } },
        { id: "b", lixo: true },
      ],
      [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "a" },
      ],
    );
    expect(c.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(c.edges.map((e) => e.id)).toEqual(["e2"]);
    expect(parseCanvas(null, "x")).toEqual({ nodes: [], edges: [] });
  });

  it("valida o cadastro do funil", () => {
    expect(funnelSchema.parse({ name: "F", folder_id: "", client_id: "", template: "captacao" })).toEqual({
      name: "F",
      folder_id: null,
      client_id: null,
      template: "captacao",
    });
    expect(funnelSchema.safeParse({ name: "F", folder_id: "", client_id: "", template: "x" }).success).toBe(
      false,
    );
  });
});
