"use client";

import { Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, type OppFilters } from "@/features/comercial/schemas";
import { useCrm } from "./crm-shell";

/** Busca e filtros do funil e da lista. */
export function FiltersBar({ value, onChange }: { value: OppFilters; onChange: (f: OppFilters) => void }) {
  const { base } = useCrm();
  const set = <K extends keyof OppFilters>(k: K, v: OppFilters[K]) => onChange({ ...value, [k]: v });
  const segments = [
    ...new Set([...base.settings.segments, ...base.opps.map((o) => o.segment ?? "")].filter(Boolean)),
  ].sort();
  const origins = [...new Set(base.opps.map((o) => o.origin ?? "").filter(Boolean))].sort();
  const tags = [...new Set([...base.settings.tags, ...base.opps.flatMap((o) => o.tags)])].sort();
  const active = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);
  const chip = (on: boolean) =>
    cn(
      "h-9 rounded-full border px-3 text-xs font-medium",
      on ? "border-brand bg-brand-soft text-ink" : "border-line bg-surface text-muted hover:text-ink",
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          aria-label="Buscar por nome, empresa, CNPJ ou telefone"
          placeholder="Nome, empresa, CNPJ, telefone…"
          className="h-9 pl-9"
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
        />
      </div>
      <Select
        aria-label="Responsável"
        className="h-9 w-auto"
        value={value.owner}
        onChange={(e) => set("owner", e.target.value)}
      >
        <option value="">Todos os responsáveis</option>
        <option value="none">Sem responsável</option>
        {base.people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      {segments.length > 0 && (
        <Select
          aria-label="Segmento"
          className="h-9 w-auto"
          value={value.segment}
          onChange={(e) => set("segment", e.target.value)}
        >
          <option value="">Todos os segmentos</option>
          {segments.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Último contato"
        className="h-9 w-auto"
        value={value.lastContact}
        onChange={(e) => set("lastContact", e.target.value as OppFilters["lastContact"])}
      >
        <option value="">Qualquer último contato</option>
        <option value="7">Sem contato há 7+ dias</option>
        <option value="14">Sem contato há 14+ dias</option>
        <option value="30">Sem contato há 30+ dias</option>
        <option value="nunca">Nunca contatados</option>
      </Select>
      {origins.length > 0 && (
        <Select
          aria-label="Origem"
          className="h-9 w-auto"
          value={value.origin}
          onChange={(e) => set("origin", e.target.value)}
        >
          <option value="">Todas as origens</option>
          {origins.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      )}
      {tags.length > 0 && (
        <Select
          aria-label="Tag"
          className="h-9 w-auto"
          value={value.tag}
          onChange={(e) => set("tag", e.target.value)}
        >
          <option value="">Todas as tags</option>
          {tags.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      )}
      <button
        type="button"
        aria-pressed={value.overdue}
        className={chip(value.overdue)}
        onClick={() => set("overdue", !value.overdue)}
      >
        Atrasados
      </button>
      <button
        type="button"
        aria-pressed={value.noNextStep}
        className={chip(value.noNextStep)}
        onClick={() => set("noNextStep", !value.noNextStep)}
      >
        Sem próximo passo
      </button>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X /> Limpar
        </Button>
      )}
    </div>
  );
}
