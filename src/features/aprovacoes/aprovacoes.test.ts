import { describe, expect, it } from "vitest";
import {
  accountSchema,
  decisionSchema,
  detailedResult,
  filterPosts,
  isPending,
  needsWork,
  postSchema,
  publicationSchema,
} from "./schemas";

const client = "00000000-0000-4000-8000-000000000001";
const base = {
  kind: "post" as const,
  client_id: client,
  task_id: "",
  title: "Lançamento da coleção",
  caption: "Chegou!",
  mode: "rapida" as const,
  publish_mode: "manual" as const,
  networks: ["instagram" as const],
  scheduled_at: "",
};

describe("aprovação", () => {
  it("resultado da detalhada segue a regra do banco", () => {
    expect(detailedResult(["aprovado", null, "aprovado"])).toBe("em_analise");
    expect(detailedResult(["aprovado", "aprovado", "aprovado"])).toBe("aprovado");
    expect(detailedResult(["aprovado", "alteracoes", "aprovado"])).toBe("alteracoes");
    expect(detailedResult(["alteracoes", "reprovado", "aprovado"])).toBe("reprovado");
  });

  it("converte a data da publicação (Brasília) e limpa a origem vazia", () => {
    const r = postSchema.parse({ ...base, scheduled_at: "2026-11-10T09:30" });
    expect(r.scheduled_at).toBe("2026-11-10T12:30:00.000Z");
    expect(r.task_id).toBeNull();
  });

  it("agendar ao aprovar exige data e rede", () => {
    const r = postSchema.safeParse({ ...base, publish_mode: "automatica", networks: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const f = r.error.flatten().fieldErrors;
      expect(f.scheduled_at).toBeDefined();
      expect(f.networks).toBeDefined();
    }
  });

  it("demanda é sempre aprovação rápida, sem redes nem agendamento automático", () => {
    expect(postSchema.safeParse({ ...base, kind: "demanda", mode: "detalhada" }).success).toBe(false);
    const r = postSchema.parse({ ...base, kind: "demanda", networks: ["tiktok"] });
    expect(r).toMatchObject({ mode: "rapida", publish_mode: "manual", networks: [] });
  });

  it("pedir alterações ou reprovar exige comentário", () => {
    const id = "00000000-0000-4000-8000-0000000000aa";
    expect(decisionSchema.safeParse({ postId: id, part: "geral", decision: "aprovado", comment: "" }).success).toBe(true);
    expect(decisionSchema.safeParse({ postId: id, part: "geral", decision: "alteracoes", comment: "  " }).success).toBe(false);
    expect(decisionSchema.safeParse({ postId: id, part: "legenda", decision: "reprovado", comment: "Tom errado" }).success).toBe(true);
  });

  it("filtra por tipo, cliente, status e busca", () => {
    const posts = [
      { title: "Post A", caption: "promo", client_id: client, status: "enviado" as const, kind: "post" as const },
      { title: "Post B", caption: "", client_id: "outro", status: "aprovado" as const, kind: "post" as const },
      { title: "Site", caption: "", client_id: client, status: "enviado" as const, kind: "demanda" as const },
    ];
    expect(filterPosts(posts, { q: "", client: "", status: "", kind: "post" })).toHaveLength(2);
    expect(filterPosts(posts, { q: "promo", client: "", status: "", kind: "post" })).toHaveLength(1);
    expect(filterPosts(posts, { q: "", client, status: "", kind: "post" })).toHaveLength(1);
    expect(filterPosts(posts, { q: "", client: "", status: "aprovado", kind: "post" })[0].title).toBe("Post B");
    expect(filterPosts(posts, { q: "", client: "", status: "", kind: "demanda" })[0].title).toBe("Site");
  });

  it("separa pendentes do cliente e envios que voltaram para ajuste", () => {
    expect(isPending("em_analise")).toBe(true);
    expect(isPending("aprovado")).toBe(false);
    expect(needsWork("alteracoes")).toBe(true);
    expect(needsWork("enviado")).toBe(false);
  });
});

describe("social", () => {
  it("conta: tira o @ e valida o endereço", () => {
    expect(accountSchema.parse({ client_id: client, network: "instagram", username: "@marca", profile_url: "" })).toMatchObject({
      username: "marca",
      profile_url: null,
    });
    expect(accountSchema.safeParse({ client_id: client, network: "instagram", username: "marca", profile_url: "instagram.com/marca" }).success).toBe(false);
  });

  it("agendamento exige data e hora", () => {
    const v = { client_id: client, network: "tiktok", account_id: "", title: "Vídeo", caption: "", status: "agendado" };
    expect(publicationSchema.safeParse({ ...v, scheduled_at: "" }).success).toBe(false);
    expect(publicationSchema.parse({ ...v, scheduled_at: "2026-12-01T18:00" }).scheduled_at).toBe("2026-12-01T21:00:00.000Z");
  });
});
