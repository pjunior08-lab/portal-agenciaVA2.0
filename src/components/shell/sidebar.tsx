"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid } from "lucide-react";
import { MODULES, type ModuleDef } from "@/lib/navigation";
import { canAccess, ROLE_LABEL } from "@/lib/auth/permissions";
import type { AccessLevelT, AppRoleT } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { applyPrefs, type SidebarPrefs } from "@/features/preferencias/schemas";
import { NotificationBell } from "./notification-bell";
import { SidebarCustomize } from "./sidebar-customize";
import { setSidebarCollapsed } from "@/features/preferencias/actions";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

export interface ShellUser {
  name: string;
  agencyName: string;
  role: AppRoleT;
  access: Record<string, AccessLevelT>;
  sidebar: SidebarPrefs;
}

function NavLink({ mod, active, onNavigate }: { mod: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const Icon = mod.icon;
  return (
    <Link
      href={`/${mod.slug}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={mod.label}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] whitespace-nowrap transition-colors group-data-[collapsed=true]/side:justify-center",
        active ? "bg-panel font-medium text-panel-ink" : "text-ink/80 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted")} aria-hidden />
      <span className="nav-label truncate">{mod.label}</span>
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Conteúdo da barra lateral; usado fixo no desktop e em gaveta no celular. */
export function SidebarContent({
  user,
  onNavigate,
  hideBell,
}: {
  user: ShellUser;
  onNavigate?: () => void;
  hideBell?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (slug: string) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
  // só mostra o que a pessoa pode abrir; o banco também bloqueia
  // ordem e "Mais áreas" conforme a preferência da pessoa
  const visible = applyPrefs(
    MODULES.filter((m) => canAccess(user, m.slug)),
    user.sidebar,
  );
  const mais = visible.filter((m) => m.group === "mais");
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

      <div className="flex items-center gap-1 rounded-2xl bg-surface p-1 pr-1.5 group-data-[collapsed=true]/side:flex-col group-data-[collapsed=true]/side:pr-1">
        <Link
          href="/configuracoes"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2"
          aria-label={`Sua conta: ${user.name}`}
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-panel text-[11px] font-semibold text-panel-ink">
            {initials(user.name) || "?"}
          </span>
          <span className="nav-label min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="block truncate text-[11px] text-muted">
              {ROLE_LABEL[user.role]} · {user.agencyName}
            </span>
          </span>
        </Link>
        {!hideBell && <NotificationBell />}
      </div>

      <nav
        aria-label="Menu principal"
        className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-surface p-2"
      >
        {(["operacao", "gestao"] as const).map((group, i) => (
          <div key={group} className={cn("flex flex-col gap-0.5", i > 0 && "border-t border-line pt-3")}>
            {visible
              .filter((m) => m.group === group)
              .map((m) => (
                <NavLink key={m.slug} mod={m} active={isActive(m.slug)} onNavigate={onNavigate} />
              ))}
          </div>
        ))}

        {mais.length > 0 && (
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setMaisOpen((v) => !v)}
              aria-expanded={maisOpen}
              aria-controls="nav-mais-areas"
              title="Mais áreas"
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] whitespace-nowrap text-ink/80 hover:bg-surface-2"
            >
              <LayoutGrid className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="nav-label flex-1 text-left">Mais áreas</span>
              <ChevronRight
                className={cn("nav-label size-3.5 text-muted transition-transform", maisOpen && "rotate-90")}
                aria-hidden
              />
            </button>
            {maisOpen && (
              <div id="nav-mais-areas" className="mt-0.5 flex flex-col gap-0.5">
                {mais.map((m) => (
                  <NavLink key={m.slug} mod={m} active={isActive(m.slug)} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="flex flex-col rounded-2xl bg-surface p-1.5 group-data-[collapsed=true]/side:[&>*]:justify-center group-data-[collapsed=true]/side:[&>*]:px-0">
        <SidebarCustomize user={user} />
        <ThemeToggle className="w-full justify-start" />
        <SignOutButton size="sm" className="w-full justify-start px-3 text-xs font-normal text-muted" />
      </div>
    </div>
  );
}

/**
 * Barra lateral do computador. Abre e fecha com animação; fechada, mostra só os ícones
 * (o nome aparece ao passar o mouse). A escolha fica salva para a pessoa.
 */
export function Sidebar({ user }: { user: ShellUser }) {
  const [collapsed, setCollapsed] = useState(user.sidebar.collapsed);
  const [, start] = useTransition();
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    start(() => setSidebarCollapsed(next));
  };

  // atalho: Ctrl/Cmd + B abre e fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "b" &&
        !(e.target as HTMLElement)?.closest("input, textarea, [contenteditable=true]")
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/side sticky top-0 hidden h-dvh shrink-0 p-3 pr-0 transition-[width] duration-300 ease-out lg:block print:hidden motion-reduce:transition-none",
        collapsed ? "w-[4.75rem] [&_.nav-label]:sr-only" : "w-60",
      )}
    >
      <div className="relative h-full">
        <SidebarContent user={user} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Abrir menu lateral" : "Fechar menu lateral"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Abrir" : "Fechar"} menu (Ctrl+B)`}
          className="absolute top-12 -right-3 z-10 inline-flex size-6 items-center justify-center rounded-full bg-surface text-muted shadow-md ring-1 ring-line transition-colors hover:bg-brand hover:text-brand-ink"
        >
          {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
        </button>
      </div>
    </aside>
  );
}
