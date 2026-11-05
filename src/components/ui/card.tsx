import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-surface p-5", className)} {...props} />;
}

/** Ícone redondo amarelo usado no título de cards e indicadores. */
export function IconBubble({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink",
        className,
      )}
      aria-hidden
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  description?: React.ReactNode;
}

/** Card com cabeçalho (ícone, título, ação à direita) e corpo livre. */
export function SectionCard({ title, icon, action, description, className, children, ...props }: SectionCardProps) {
  return (
    <section className={cn("rounded-card bg-surface p-5", className)} {...props}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <IconBubble icon={icon} />}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
