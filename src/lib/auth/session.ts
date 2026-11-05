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

/** Usuário logado (ou null). Valida o token com o Supabase a cada requisição. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Contexto completo do membro: perfil, agência, papel e acessos. Null se não for membro ativo. */
export const getMemberContext = cache(async (): Promise<MemberContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .maybeSingle();
  if (!membership) return null;

  const [{ data: profile }, { data: agency }, { data: accessRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("agencies").select("*").eq("id", membership.agency_id).single(),
    supabase.from("member_module_access").select("module, level").eq("user_id", user.id),
  ]);
  if (!profile || !agency) return null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    agency,
    role: membership.role,
    access: Object.fromEntries((accessRows ?? []).map((r) => [r.module, r.level])),
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
