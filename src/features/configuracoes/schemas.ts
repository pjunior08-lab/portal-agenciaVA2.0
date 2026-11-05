import { z } from "zod";
import { email } from "@/features/auth/schemas";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const digits = (v: string | null) => (v ? v.replace(/\D/g, "") : v);

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(120),
  phone: optional(20).refine((v) => !v || digits(v)!.length >= 10, "Telefone com DDD, ex.: (27) 99999-0000."),
  cpf: optional(14).refine((v) => !v || digits(v)!.length === 11, "CPF com 11 números."),
  job_title: optional(80),
  department: optional(80),
});

export const agencySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da agência.").max(120),
  legal_name: optional(160),
  cnpj: optional(18).refine((v) => !v || digits(v)!.length === 14, "CNPJ com 14 números."),
  email: optional(160).refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido."),
  phone: optional(20),
  address: optional(240),
  pix_key: optional(120),
});

export const accessEntry = z.object({
  module: z.string().min(1),
  level: z.enum(["ver", "editar"]),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(["admin", "colaborador"]),
  access: z.array(accessEntry).default([]),
});

export const memberAccessSchema = z.object({
  userId: z.string().uuid(),
  access: z.array(accessEntry),
});

export const memberRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "colaborador"]),
});

export const memberStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["ativo", "desativado"]),
});

export type ProfileValues = z.input<typeof profileSchema>;
export type AgencyValues = z.input<typeof agencySchema>;
export type InviteValues = z.input<typeof inviteSchema>;
export type AccessEntry = z.infer<typeof accessEntry>;
