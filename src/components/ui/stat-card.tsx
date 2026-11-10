import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBubble } from "./card";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  className?: string;
}

/** Indicador simples: rótulo, número grande e legenda. */
export function StatCard({ label, value, icon, hint, className }: StatCardProps) {
  return (
    <div className={cn("lift animate-rise flex flex-col gap-2 rounded-card bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        {icon && <IconBubble icon={icon} />}
      </div>
      <span className="text-2xl font-medium tracking-tight tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-2">{hint}</span>}
    </div>
  );
}

/** Indicador de destaque em painel escuro (valor em aberto, valor em contratos...). */
export function HeroStatCard({ label, value, icon, hint, className }: StatCardProps) {
  return (
    <div className={cn("lift animate-rise flex min-h-40 flex-col justify-between rounded-card bg-panel p-5 text-panel-ink", className)}>
      <div className="flex items-start justify-between gap-2">
        {icon && <IconBubble icon={icon} className="size-9" />}
        {hint && (
          <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-panel-muted">{hint}</span>
        )}
      </div>
      <div>
        <div className="text-3xl font-medium tracking-tight tabular-nums">{value}</div>
        <div className="text-xs text-panel-muted">{label}</div>
      </div>
    </div>
  );
}
