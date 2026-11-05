"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { MODULES, type ModuleDef } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

function NavLink({ mod, active, onNavigate }: { mod: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const Icon = mod.icon;
  return (
    <Link
      href={`/${mod.slug}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
        active ? "bg-panel font-medium text-panel-ink" : "text-ink/80 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted")} aria-hidden />
      <span className="truncate">{mod.label}</span>
    </Link>
  );
}

/** Conteúdo da barra lateral; usado fixo no desktop e em gaveta no celular. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (slug: string) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
  const mais = MODULES.filter((m) => m.group === "mais");
  const [maisOpen, setMaisOpen] = useState(() => mais.some((m) => isActive(m.slug)));

  useEffect(() => {
    if (mais.some((m) => isActive(m.slug))) setMaisOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="px-1 pt-1">
        <Brand />
      </div>

      <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-surface p-2">
        {(["operacao", "gestao"] as const).map((group, i) => (
          <div key={group} className={cn("flex flex-col gap-0.5", i > 0 && "border-t border-line pt-3")}>
            {MODULES.filter((m) => m.group === group).map((m) => (
              <NavLink key={m.slug} mod={m} active={isActive(m.slug)} onNavigate={onNavigate} />
            ))}
          </div>
        ))}

        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setMaisOpen((v) => !v)}
            aria-expanded={maisOpen}
            aria-controls="nav-mais-areas"
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink/80 hover:bg-surface-2"
          >
            <LayoutGrid className="size-4 text-muted" aria-hidden />
            <span className="flex-1 text-left">Mais áreas</span>
            <ChevronRight className={cn("size-3.5 text-muted transition-transform", maisOpen && "rotate-90")} aria-hidden />
          </button>
          {maisOpen && (
            <div id="nav-mais-areas" className="mt-0.5 flex flex-col gap-0.5">
              {mais.map((m) => (
                <NavLink key={m.slug} mod={m} active={isActive(m.slug)} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="rounded-2xl bg-surface p-1.5">
        <ThemeToggle className="w-full justify-start" />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 p-3 pr-0 lg:block">
      <SidebarContent />
    </aside>
  );
}
