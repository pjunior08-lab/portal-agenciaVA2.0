"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import type { ActionResult } from "@/features/configuracoes/actions";
import { MODULES } from "@/lib/navigation";
import { parsePrefs, sidebarPrefsSchema } from "./schemas";

/** Salva a ordem e os módulos escondidos da barra lateral da própria pessoa. */
export async function saveSidebarPrefs(input: unknown): Promise<ActionResult> {
  const ctx = await requireMember();
  const parsed = sidebarPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Preferência inválida." };
  const known = new Set(MODULES.map((m) => m.slug));
  const clean = {
    order: parsed.data.order.filter((s) => known.has(s)),
    hidden: parsed.data.hidden.filter((s) => known.has(s)),
    collapsed: parsed.data.collapsed,
  };
  const supabase = await createClient();
  const { error } = await supabase
    .from("member_preferences")
    .upsert({ user_id: ctx.userId, sidebar: clean }, { onConflict: "user_id" });
  if (error) return { ok: false, error: authErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Guarda se a barra lateral fica recolhida (mantendo ordem e escondidos). */
export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const ctx = await requireMember();
  if (typeof collapsed !== "boolean") return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_preferences")
    .select("sidebar")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const current = parsePrefs(data?.sidebar);
  await supabase
    .from("member_preferences")
    .upsert({ user_id: ctx.userId, sidebar: { ...current, collapsed } }, { onConflict: "user_id" });
}
