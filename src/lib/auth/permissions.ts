import type { AccessLevelT, AppRoleT } from "@/lib/supabase/database.types";

/** Módulos liberados para qualquer membro ativo (espelha modules.always_allowed no banco). */
export const ALWAYS_ALLOWED = new Set(["inicio", "meu-dia", "configuracoes"]);

export interface AccessContext {
  role: AppRoleT;
  /** slug do módulo → nível concedido (só colaboradores). */
  access: Record<string, AccessLevelT>;
}

/**
 * Mesma regra da função private.can_access do banco, usada para esconder menus e telas.
 * A proteção de verdade continua no banco (RLS); isto só evita mostrar o que a pessoa não pode usar.
 */
export function canAccess(ctx: AccessContext, module: string, need: AccessLevelT = "ver"): boolean {
  if (ctx.role === "admin") return true;
  if (ALWAYS_ALLOWED.has(module)) return true;
  const level = ctx.access[module];
  if (!level) return false;
  return need === "ver" || level === "editar";
}

export const ROLE_LABEL: Record<AppRoleT, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
};

export const LEVEL_LABEL: Record<AccessLevelT | "nenhum", string> = {
  nenhum: "Sem acesso",
  ver: "Ver",
  editar: "Ver e editar",
};
