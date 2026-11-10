import { describe, expect, it } from "vitest";
import {
  dayLabel,
  groupMessages,
  groupSchema,
  initials,
  mergeMessages,
  messageSchema,
  type ChatMessage,
} from "./schemas";

const msg = (id: string, author: string, at: string): ChatMessage => ({
  id,
  conversation_id: "c",
  author_id: author,
  author_name: author,
  body: id,
  created_at: at,
  deleted_at: null,
});

describe("comunicação", () => {
  it("valida mensagem e grupo", () => {
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(messageSchema.parse({ body: "  oi " }).body).toBe("oi");
    expect(messageSchema.safeParse({ body: "x".repeat(4001) }).success).toBe(false);
    expect(groupSchema.safeParse({ name: "Time", members: [] }).success).toBe(false);
  });

  it("rotula os dias no horário de Brasília", () => {
    const now = "2026-11-09T15:00:00Z";
    expect(dayLabel("2026-11-09T12:00:00Z", now)).toBe("Hoje");
    // 01h UTC do dia 9 ainda é dia 8 em São Paulo
    expect(dayLabel("2026-11-09T01:00:00Z", now)).toBe("Ontem");
    expect(dayLabel("2026-11-01T15:00:00Z", now)).toBe("Domingo, 1 de novembro");
  });

  it("agrupa por dia e junta mensagens seguidas da mesma pessoa", () => {
    const g = groupMessages(
      [
        msg("1", "ana", "2026-11-09T12:00:00Z"),
        msg("2", "ana", "2026-11-09T12:03:00Z"),
        msg("3", "ana", "2026-11-09T12:20:00Z"),
        msg("4", "beto", "2026-11-09T12:21:00Z"),
      ],
      "2026-11-09T15:00:00Z",
    );
    expect(g).toHaveLength(1);
    expect(g[0].blocks.map((b) => b.items.map((m) => m.id))).toEqual([["1", "2"], ["3"], ["4"]]);
  });

  it("junta mensagens sem repetir e em ordem", () => {
    const a = [msg("1", "ana", "2026-11-09T12:00:00Z"), msg("3", "ana", "2026-11-09T12:10:00Z")];
    const merged = mergeMessages(a, [
      msg("2", "beto", "2026-11-09T12:05:00Z"),
      { ...msg("1", "ana", "2026-11-09T12:00:00Z"), deleted_at: "x", body: "" },
    ]);
    expect(merged.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(merged[0].deleted_at).toBe("x");
    expect(initials("Maria da Silva")).toBe("MD");
    expect(initials("")).toBe("?");
  });
});
