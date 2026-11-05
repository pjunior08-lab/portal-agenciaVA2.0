import { z } from "zod";

export const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
export const password = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .regex(/[a-zA-Z]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.");
export const fullName = z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const signUpSchema = z.object({ fullName, email, password });

export const createAgencySchema = z.object({
  agencyName: z.string().trim().min(2, "Informe o nome da agência.").max(120, "Nome muito longo."),
});

export const forgotSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export const totpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 números."),
});
