import { describe, expect, it } from "vitest";
import { canAccess } from "./permissions";
import { safeNext } from "./redirect";
import { authErrorMessage } from "./errors";
import { loginSchema, newPasswordSchema, signUpSchema } from "@/features/auth/schemas";
import { agencySchema, inviteSchema, profileSchema } from "@/features/configuracoes/schemas";

describe("canAccess (espelha private.can_access do banco)", () => {
  const colab = { role: "colaborador" as const, access: { clientes: "editar" as const, agenda: "ver" as const } };

  it("administrador acessa tudo", () => {
    expect(canAccess({ role: "admin", access: {} }, "financeiro", "editar")).toBe(true);
  });
  it("colaborador acessa só o liberado, no nível liberado", () => {
    expect(canAccess(colab, "clientes", "editar")).toBe(true);
    expect(canAccess(colab, "agenda", "ver")).toBe(true);
    expect(canAccess(colab, "agenda", "editar")).toBe(false);
    expect(canAccess(colab, "financeiro")).toBe(false);
  });
  it("Início, Meu Dia e Configurações ficam sempre liberados", () => {
    for (const m of ["inicio", "meu-dia", "configuracoes"]) expect(canAccess({ role: "colaborador", access: {} }, m)).toBe(true);
  });
});

describe("safeNext", () => {
  it("aceita caminho interno", () => expect(safeNext("/clientes?x=1")).toBe("/clientes?x=1"));
  it("recusa outro site", () => {
    expect(safeNext("https://malicioso.com")).toBe("/inicio");
    expect(safeNext("//malicioso.com")).toBe("/inicio");
    expect(safeNext("/\\malicioso.com")).toBe("/inicio");
    expect(safeNext(null)).toBe("/inicio");
  });
});

describe("authErrorMessage", () => {
  it("traduz credenciais inválidas", () =>
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos."));
  it("mantém mensagens do banco já em português", () =>
    expect(authErrorMessage({ message: "Só administradores podem convidar." })).toBe("Só administradores podem convidar."));
  it("não vaza mensagem técnica em inglês", () =>
    expect(authErrorMessage({ message: "duplicate key value violates unique constraint" })).toBe("Algo deu errado. Tente de novo."));
});

describe("esquemas de formulário", () => {
  it("login exige e-mail válido", () => {
    expect(loginSchema.safeParse({ email: "x", password: "1" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: " A@B.COM ", password: "1" }).data?.email).toBe("a@b.com");
  });
  it("senha precisa de 8+ caracteres com letra e número", () => {
    const base = { fullName: "Ana", email: "a@b.com" };
    expect(signUpSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "abcd1234" }).success).toBe(true);
  });
  it("confirmação de senha precisa bater", () => {
    expect(newPasswordSchema.safeParse({ password: "abcd1234", confirm: "abcd12345" }).success).toBe(false);
  });
  it("perfil: campos vazios viram nulo e CPF é validado", () => {
    const ok = profileSchema.safeParse({ full_name: "Ana", phone: "", cpf: "", job_title: "", department: "" });
    expect(ok.success && ok.data.phone).toBe(null);
    expect(profileSchema.safeParse({ full_name: "Ana", phone: "", cpf: "123", job_title: "", department: "" }).success).toBe(false);
  });
  it("agência: CNPJ com 14 números", () => {
    const base = { name: "VA", legal_name: "", email: "", phone: "", address: "", pix_key: "" };
    expect(agencySchema.safeParse({ ...base, cnpj: "12.345.678/0001-90" }).success).toBe(true);
    expect(agencySchema.safeParse({ ...base, cnpj: "123" }).success).toBe(false);
  });
  it("convite: papel e níveis válidos", () => {
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "dono", access: [] }).success).toBe(false);
    expect(
      inviteSchema.safeParse({ email: "a@b.com", role: "colaborador", access: [{ module: "clientes", level: "tudo" }] }).success,
    ).toBe(false);
  });
});
