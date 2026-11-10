import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken } from "./crypto";
import { isPermanentMetaError, planPublication } from "./plan";

const key = randomBytes(32).toString("base64");
const jpg = { path: "a.jpg", mime: "image/jpeg" };
const png = { path: "a.png", mime: "image/png" };
const mp4 = { path: "v.mp4", mime: "video/mp4" };

describe("social: chaves de acesso", () => {
  it("criptografa e lê de volta; outra chave ou texto alterado não abre", () => {
    const sealed = encryptToken("EAAB-segredo", key);
    expect(sealed).not.toContain("EAAB");
    expect(decryptToken(sealed, key)).toBe("EAAB-segredo");
    expect(() => decryptToken(sealed, randomBytes(32).toString("base64"))).toThrow();
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => encryptToken("x", "curta")).toThrow(/SOCIAL_TOKEN_KEY/);
  });
});

describe("social: formato da publicação", () => {
  it("Instagram: foto, vídeo e carrossel; recusa PNG, texto puro e excesso", () => {
    expect(planPublication("instagram", [jpg], "oi")).toMatchObject({ ok: true, kind: "imagem" });
    expect(planPublication("instagram", [mp4], "oi")).toMatchObject({ ok: true, kind: "video" });
    expect(planPublication("instagram", [jpg, jpg], "oi")).toMatchObject({ ok: true, kind: "carrossel" });
    expect(planPublication("instagram", [png], "oi")).toMatchObject({ ok: false });
    expect(planPublication("instagram", [], "só texto")).toMatchObject({ ok: false });
    expect(planPublication("instagram", Array(11).fill(jpg), "")).toMatchObject({ ok: false });
    expect(planPublication("instagram", [jpg], "x".repeat(2201))).toMatchObject({ ok: false });
    expect(planPublication("instagram", [jpg], Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toMatchObject({ ok: false });
  });

  it("Facebook: aceita texto e PNG; vídeo vai sozinho", () => {
    expect(planPublication("facebook", [], "aviso")).toMatchObject({ ok: true, kind: "texto" });
    expect(planPublication("facebook", [png, jpg], "")).toMatchObject({ ok: true, kind: "carrossel" });
    expect(planPublication("facebook", [mp4, jpg], "")).toMatchObject({ ok: false });
    expect(planPublication("tiktok", [jpg], "")).toMatchObject({ ok: false });
  });

  it("separa erro definitivo de erro passageiro", () => {
    expect(isPermanentMetaError(190)).toBe(true);
    expect(isPermanentMetaError(200)).toBe(true);
    expect(isPermanentMetaError(2)).toBe(false);
    expect(isPermanentMetaError(4)).toBe(false);
    expect(isPermanentMetaError(undefined)).toBe(false);
  });
});
