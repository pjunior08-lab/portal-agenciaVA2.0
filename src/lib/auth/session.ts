import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccessLevelT, AppRoleT, Database } from "@/lib/supabase/database.types";
import { canAccess } from "./permissions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Agency = Database["public"]["Tables"]["agencies"]["Row"];

export interface MemberContext {
  userId: string;
  email: string;
  profile: Profile;
  agency: Agency;
  role: AppRoleT;
  access: Record<string, AccessLevelT>;
}

export interface SessionUser {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, unknown>;
}

/**
 * Usuário logado (ou null), a partir do token de sessão com a assinatura verificada
 * (getClaims). Com chaves de assinatura assimétricas a verificação é local, sem ida
 * ao servidor de autenticação; o banco confere o mesmo token em cada consulta (RLS).
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return {
    id: c.sub,
    email: typeof c.email === "string" ? c.email : undefined,
    user_metadata: (c.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
});

/** Contexto completo do membro: perfil, agência, papel e acessos. Null se não for membro ativo. */
export const getMemberContext = cache(async (): Promise<MemberContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  // uma ida ao banco: vínculo + agência, perfil e acessos em paralelo
  const [{ data: membership }, { data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from("agency_members").select("agency_id, role, status, agencies(*)").eq("user_id", user.id).eq("status", "ativo").maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("member_module_access").select("module, level, agency_id").eq("user_id", user.id),
  ]);
  if (!membership) return null;
  const agency = Array.isArray(membership.agencies) ? membership.agencies[0] : membership.agencies;
  if (!profile || !agency) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    agency,
    role: membership.role,
    access: Object.fromEntries((accessRows ?? []).filter((r) => r.agency_id === membership.agency_id).map((r) => [r.module, r.level])),
  };
});

/** Exige membro ativo; senão manda para o login ou para a tela de boas-vindas. */
export async function requireMember(): Promise<MemberContext> {
  const ctx = await getMemberContext();
  if (ctx) return ctx;
  const user = await getUser();
  redirect(user ? "/boas-vindas" : "/login");
}

export async function requireAdmin(): Promise<MemberContext> {
  const ctx = await requireMember();
  if (ctx.role !== "admin") redirect("/inicio");
  return ctx;
}

export function memberCan(ctx: MemberContext, module: string, need: AccessLevelT = "ver") {
  return canAccess({ role: ctx.role, access: ctx.access }, module, need);
}
