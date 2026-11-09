"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos leves em SVG/HTML, sem biblioteca.
 * Cores por variável (tokens): duas séries usam azul e vermelho, par validado para
 * daltonismo nos temas claro e escuro. Sempre com legenda para 2+ séries e dica ao passar o mouse.
 */

export interface Series {
  name: string;
  color: string;
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-3 text-[11px] text-muted", className)}>
      {series.map((s) => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontais com rótulo e valor (uma série). */
export function BarRows({
  rows,
  format,
  color = "var(--info)",
  max: maxProp,
  empty = "Nada neste mês.",
}: {
  rows: { id: string; label: string; value: number; hint?: string }[];
  format: (n: number) => string;
  color?: string;
  max?: number;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted">{empty}</p>;
  const max = Math.max(1, maxProp ?? Math.max(...rows.map((r) => r.value)));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.id} title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {format(r.value)}
              {r.hint && <span className="ml-1 text-muted">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Barras verticais agrupadas (ex.: receitas x despesas por mês). Grupos "projetados" ficam com textura. */
export function GroupedBars({
  groups,
  series,
  format,
  height = 160,
}: {
  groups: { key: string; label: string; values: number[]; projected?: boolean }[];
  series: Series[];
  format: (n: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  return (
    <div className="flex flex-col gap-2">
      <Legend series={[...series, ...(groups.some((g) => g.projected) ? [{ name: "Previsto (tracejado)", color: "var(--surface-3)" }] : [])]} />
      <div className="relative">
        <div className="flex items-end gap-2" style={{ height }} role="img" aria-label={`Gráfico de ${series.map((s) => s.name).join(" e ")}`}>
          {groups.map((g, gi) => (
            <div
              key={g.key}
              className={cn("flex h-full flex-1 items-end justify-center gap-0.5 rounded-md px-0.5", hover === gi && "bg-surface-2")}
              onMouseEnter={() => setHover(gi)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(gi)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${g.label}: ${g.values.map((v, i) => `${series[i].name} ${format(v)}`).join(", ")}`}
            >
              {g.values.map((v, i) => (
                <div
                  key={i}
                  className="w-full max-w-5 rounded-t"
                  style={{
                    height: `${(v / max) * 100}%`,
                    minHeight: v > 0 ? 2 : 0,
                    background: g.projected
                      ? `repeating-linear-gradient(135deg, ${series[i].color} 0 3px, transparent 3px 6px)`
                      : series[i].color,
                    outline: g.projected ? `1px solid ${series[i].color}` : undefined,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-panel px-2.5 py-1.5 text-[11px] text-panel-ink shadow">
            <p className="font-medium">
              {groups[hover].label}
              {groups[hover].projected && " (previsto)"}
            </p>
            {groups[hover].values.map((v, i) => (
              <p key={i} className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm" style={{ background: series[i].color }} aria-hidden />
                {series[i].name}: {format(v)}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {groups.map((g) => (
          <span key={g.key} className="flex-1 text-center text-[10px] text-muted capitalize">
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Linha (ex.: saldo dia a dia). Pontos "projetados" saem tracejados. */
export function LineChart({
  points,
  format,
  height = 140,
  color = "var(--ink)",
}: {
  points: { key: string; label: string; value: number; projected?: boolean }[];
  format: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="py-6 text-center text-xs text-muted">Sem dados suficientes.</p>;
  const W = 600;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => height - 8 - ((v - min) / (max - min || 1)) * (height - 16);
  const split = points.findIndex((p) => p.projected);
  const path = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((p, i) => `${i ? "L" : "M"}${x(from + i).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join(" ");
  const realEnd = split === -1 ? points.length - 1 : Math.max(0, split - 1);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Gráfico de linha">
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        <path d={path(0, realEnd)} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {split > 0 && (
          <path d={path(realEnd, points.length - 1)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {points.map((p, i) => (
          <rect
            key={p.key}
            x={x(i) - W / points.length / 2}
            y={0}
            width={W / points.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-panel px-2.5 py-1.5 text-[11px] whitespace-nowrap text-panel-ink shadow"
          style={{ left: `${Math.min(85, Math.max(15, (hover / (points.length - 1)) * 100))}%` }}
        >
          {points[hover].label}: {format(points[hover].value)}
          {points[hover].projected && " (previsto)"}
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/**
 * Barra de progresso de meta. Despesa: passar de 100% é ruim (vermelho, "passou").
 * Receita (higherIsBetter): chegar a 100% é bom ("meta batida").
 */
export function GoalBar({
  value,
  goal,
  format,
  label,
  higherIsBetter = false,
}: {
  value: number;
  goal: number;
  format: (n: number) => string;
  label: string;
  higherIsBetter?: boolean;
}) {
  const pct = Math.round((value / goal) * 100);
  const bad = !higherIsBetter && pct > 100;
  const hit = higherIsBetter && pct >= 100;
  return (
    <div title={`${label}: ${format(value)} de ${format(goal)}`}>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <span className={cn("shrink-0 tabular-nums", bad && "font-medium text-danger", hit && "font-medium text-success")}>
          {format(value)} / {format(goal)} · {pct}%{bad && " (passou)"}
          {hit && " (meta batida)"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className={cn("h-2 rounded-full", bad ? "bg-danger" : hit ? "bg-success" : "bg-brand")} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
      </div>
    </div>
  );
}
