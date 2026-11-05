import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Abas ou filtros ao lado do título. */
  children?: React.ReactNode;
  /** Botões à direita (ex.: "Novo cliente"). */
  actions?: React.ReactNode;
}

export function PageHeader({ title, icon: Icon, children, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {Icon && <Icon className="size-5 text-brand-strong" aria-hidden />}
        <h1 className="text-[28px] leading-none font-normal tracking-tight">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
