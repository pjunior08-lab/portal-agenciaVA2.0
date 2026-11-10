import { z } from "zod";

/** Módulos que sempre ficam no menu principal. */
export const FIXED_SLUGS = ["inicio", "configuracoes"];

export const sidebarPrefsSchema = z.object({
  /** Ordem escolhida (slugs). Os que não estiverem aqui seguem a ordem padrão, no fim. */
  order: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(60),
  /** Módulos movidos para "Mais áreas". */
  hidden: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(60),
  /** Barra lateral recolhida (só ícones) no computador. */
  collapsed: z.boolean().default(false),
});
export type SidebarPrefs = z.infer<typeof sidebarPrefsSchema>;
export const EMPTY_PREFS: SidebarPrefs = { order: [], hidden: [], collapsed: false };

/** Lê a preferência salva, ignorando o que estiver fora do formato. */
export function parsePrefs(raw: unknown): SidebarPrefs {
  const r = sidebarPrefsSchema.safeParse(raw);
  return r.success ? r.data : EMPTY_PREFS;
}

interface Mod {
  slug: string;
  group: "operacao" | "gestao" | "mais";
}

/**
 * Aplica a preferência: reordena dentro de cada grupo e manda os escondidos para "Mais áreas".
 * Sem preferência, o menu fica como o padrão.
 */
export function applyPrefs<T extends Mod>(mods: T[], prefs: SidebarPrefs): T[] {
  const pos = new Map(prefs.order.map((s, i) => [s, i]));
  const hidden = new Set(prefs.hidden.filter((s) => !FIXED_SLUGS.includes(s)));
  // depois de personalizar, o que não está escondido sai de "Mais áreas" (vai para Gestão)
  const customized = prefs.order.length > 0;
  const groupOf = (m: T): Mod["group"] =>
    hidden.has(m.slug)
      ? "mais"
      : customized && m.group === "mais" && !FIXED_SLUGS.includes(m.slug)
        ? "gestao"
        : m.group;
  return mods
    .map((m, i) => ({ m: { ...m, group: groupOf(m) }, i }))
    .sort((a, b) => (pos.get(a.m.slug) ?? 1000 + a.i) - (pos.get(b.m.slug) ?? 1000 + b.i))
    .map((x) => x.m);
}
