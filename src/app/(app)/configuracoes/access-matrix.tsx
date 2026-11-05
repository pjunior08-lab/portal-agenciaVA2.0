"use client";

import { GROUP_LABELS, MODULES } from "@/lib/navigation";
import { ALWAYS_ALLOWED, LEVEL_LABEL } from "@/lib/auth/permissions";
import type { AccessEntry } from "@/features/configuracoes/schemas";

/** Módulos que um administrador pode liberar para colaboradores. */
export const GRANTABLE = MODULES.filter((m) => !ALWAYS_ALLOWED.has(m.slug));

type Level = "nenhum" | "ver" | "editar";

export function toMap(entries: AccessEntry[]): Record<string, Level> {
  return Object.fromEntries(entries.map((e) => [e.module, e.level]));
}

export function toEntries(map: Record<string, Level>): AccessEntry[] {
  return Object.entries(map)
    .filter(([, l]) => l !== "nenhum")
    .map(([module, level]) => ({ module, level: level as "ver" | "editar" }));
}

/** Tabela de módulos × nível de acesso (sem acesso, ver, ver e editar). */
export function AccessMatrix({
  value,
  onChange,
}: {
  value: Record<string, Level>;
  onChange: (next: Record<string, Level>) => void;
}) {
  const setAll = (level: Level) => onChange(Object.fromEntries(GRANTABLE.map((m) => [m.slug, level])));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Início, Meu Dia e o próprio perfil ficam sempre liberados.</p>
        <div className="flex gap-1 text-xs">
          <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-surface-2" onClick={() => setAll("ver")}>
            Liberar tudo (ver)
          </button>
          <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-surface-2" onClick={() => setAll("nenhum")}>
            Limpar
          </button>
        </div>
      </div>
      {(["operacao", "gestao", "mais"] as const).map((group) => (
        <fieldset key={group} className="rounded-xl bg-surface-2 p-2">
          <legend className="px-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{GROUP_LABELS[group]}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {GRANTABLE.filter((m) => m.group === group).map((m) => {
              const id = `acesso-${m.slug}`;
              return (
                <div key={m.slug} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <label htmlFor={id} className="flex min-w-0 items-center gap-2 text-xs">
                    <m.icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="truncate">{m.label}</span>
                  </label>
                  <select
                    id={id}
                    value={value[m.slug] ?? "nenhum"}
                    onChange={(e) => onChange({ ...value, [m.slug]: e.target.value as Level })}
                    className="h-7 rounded-lg border border-line bg-surface px-1.5 text-[11px]"
                  >
                    {(["nenhum", "ver", "editar"] as const).map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
