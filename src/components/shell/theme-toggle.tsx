"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Alterna tema claro/escuro. Renderiza só após montar para evitar diferença com o servidor. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      data-testid="theme-toggle"
    >
      {dark ? (
        <Sun className="size-4 shrink-0" aria-hidden />
      ) : (
        <Moon className="size-4 shrink-0" aria-hidden />
      )}
      <span className="nav-label">{dark ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}
