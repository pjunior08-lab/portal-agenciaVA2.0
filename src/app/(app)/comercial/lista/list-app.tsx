"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Inbox } from "lucide-react";
import { Button, Card, EmptyState, Select } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import type { CrmStageT } from "@/lib/supabase/database.types";
import {
  EMPTY_FILTERS,
  STAGES,
  STAGE_IDS,
  filterOpps,
  stageIndex,
  toCsv,
  toLocalDay,
} from "@/features/comercial/schemas";
import type { OppView } from "@/features/comercial/data";
import { useCrm } from "../crm-shell";
import { FiltersBar } from "../filters-bar";
import { StageDot } from "../opportunity-modal";

type SortKey = "name" | "stage" | "value" | "owner" | "next" | "last";
const PAGE = 100;

export function ListApp() {
  const { base, today, personName, openOpp, canEdit, openNew } = useCrm();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [stage, setStage] = useState<"" | "abertas" | CrmStageT>("abertas");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "next", asc: true });
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const list = filterOpps(base.opps, filters, today).filter((o) =>
      stage === "" ? true : stage === "abertas" ? STAGES[o.stage].open : o.stage === stage,
    );
    const val = (o: OppView): string | number => {
      switch (sort.key) {
        case "name":
          return (o.company || o.name).toLowerCase();
        case "stage":
          return stageIndex(o.stage);
        case "value":
          return o.value ?? -1;
        case "owner":
          return personName(o.owner_id).toLowerCase();
        case "next":
          return o.next_step_at ?? "9999";
        case "last":
          return o.last_contact_at ?? "";
      }
    };
    return [...list].sort((a, b) => {
      const x = val(a),
        y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [base.opps, filters, today, stage, sort, personName]);

  function exportCsv() {
    const header = [
      "Contato",
      "Empresa",
      "CNPJ/CPF",
      "E-mail",
      "Telefone",
      "Etapa",
      "Valor mensal",
      "Responsável",
      "Segmento",
      "Origem",
      "Tags",
      "Próximo passo",
      "Data do próximo passo",
      "Último contato",
      "Motivo da perda",
    ];
    const csv = toCsv([
      header,
      ...rows.map((o) => [
        o.name,
        o.company,
        o.document,
        o.email,
        o.phone,
        STAGES[o.stage].label,
        o.value == null ? null : o.value.toFixed(2).replace(".", ","),
        personName(o.owner_id),
        o.segment,
        o.origin,
        o.tags.join(", "),
        o.next_step,
        o.next_step_at,
        o.last_contact_at ? toLocalDay(o.last_contact_at) : null,
        o.lost_reason,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `oportunidades-${today}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      scope="col"
      className={cn("px-3 py-2 font-medium", className)}
      aria-sort={sort.key === k ? (sort.asc ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : true }))}
      >
        {children}
        {sort.key === k &&
          (sort.asc ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Etapa"
            className="h-9 w-auto"
            value={stage}
            onChange={(e) => setStage(e.target.value as typeof stage)}
          >
            <option value="abertas">Em aberto</option>
            <option value="">Todas as etapas</option>
            {STAGE_IDS.map((s) => (
              <option key={s} value={s}>
                {STAGES[s].label}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted">{rows.length} oportunidade(s)</span>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download /> Exportar CSV
        </Button>
      </div>
      <FiltersBar value={filters} onChange={setFilters} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={base.opps.length ? "Nada com esses filtros" : "Nenhuma oportunidade ainda"}
            description={
              base.opps.length
                ? "Ajuste os filtros para ver outras oportunidades."
                : "Cadastre a primeira ou importe uma planilha."
            }
            action={
              canEdit && !base.opps.length ? (
                <Button onClick={() => openNew()}>Nova oportunidade</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <Th k="name">Oportunidade</Th>
                <Th k="stage">Etapa</Th>
                <Th k="value" className="text-right">
                  Valor/mês
                </Th>
                <Th k="owner">Responsável</Th>
                <Th k="next">Próximo passo</Th>
                <Th k="last">Último contato</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-left hover:underline" onClick={() => openOpp(o)}>
                      <span className="block font-medium">{o.company || o.name}</span>
                      {o.company && <span className="block text-xs text-muted">{o.name}</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <StageDot stage={o.stage} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {o.value == null ? "—" : formatBRL(o.value)}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{personName(o.owner_id)}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-xs",
                      o.next_step_at &&
                        o.next_step_at < today &&
                        STAGES[o.stage].open &&
                        "font-medium text-danger",
                    )}
                  >
                    {o.next_step_at ? (
                      `${shortDate(o.next_step_at)}${o.next_step ? ` · ${o.next_step}` : ""}`
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {o.last_contact_at ? shortDate(toLocalDay(o.last_contact_at)) : "Nunca"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="flex justify-center p-3">
              <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Mostrar mais ({rows.length - limit})
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
