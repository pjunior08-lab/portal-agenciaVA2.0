"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { MODULES } from "@/lib/navigation";
import { canAccess } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { FIXED_SLUGS, applyPrefs } from "@/features/preferencias/schemas";
import { saveSidebarPrefs } from "@/features/preferencias/actions";
import { Alert, Button, Modal } from "@/components/ui";
import type { ShellUser } from "./sidebar";

/** Botão e janela para escolher a ordem do menu e o que vai para "Mais áreas". */
export function SidebarCustomize({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Personalizar menu"
        className="inline-flex h-8 w-full items-center gap-2 rounded-full px-3 text-xs text-muted hover:bg-surface-2 hover:text-ink"
      >
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden />{" "}
        <span className="nav-label">Personalizar menu</span>
      </button>
      {open && <CustomizeModal user={user} onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomizeModal({ user, onClose }: { user: ShellUser; onClose: () => void }) {
  const router = useRouter();
  const allowed = MODULES.filter((m) => canAccess(user, m.slug));
  // começa da preferência atual: módulos que estavam em "Mais áreas" por padrão entram como escondidos
  const current = applyPrefs(allowed, user.sidebar);
  const [order, setOrder] = useState(current.map((m) => m.slug));
  const [hidden, setHidden] = useState<string[]>(
    current.filter((m) => m.group === "mais" && !FIXED_SLUGS.includes(m.slug)).map((m) => m.slug),
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const label = (slug: string) => allowed.find((m) => m.slug === slug)?.label ?? slug;
  const iconOf = (slug: string) => allowed.find((m) => m.slug === slug)?.icon;

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const c = [...o];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });

  const save = (prefs: { order: string[]; hidden: string[]; collapsed: boolean }) =>
    start(async () => {
      const r = await saveSidebarPrefs(prefs);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Personalizar"
      accent="menu"
      description="Mude a ordem e escolha o que fica em “Mais áreas”. Vale só para você."
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => save({ order: [], hidden: [], collapsed: user.sidebar.collapsed })}
            disabled={pending}
          >
            Voltar ao padrão
          </Button>
          <Button
            loading={pending}
            onClick={() => save({ order, hidden, collapsed: user.sidebar.collapsed })}
          >
            Salvar
          </Button>
        </>
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      <ol className="flex flex-col gap-1">
        {order.map((slug, i) => {
          const Icon = iconOf(slug);
          const isHidden = hidden.includes(slug);
          const fixed = FIXED_SLUGS.includes(slug);
          return (
            <li
              key={slug}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm",
                isHidden ? "text-muted" : "bg-surface-2",
              )}
            >
              {Icon && <Icon className="size-4 shrink-0 text-muted" aria-hidden />}
              <span className="flex-1 truncate">{label(slug)}</span>
              {isHidden && <span className="text-[10px] text-muted-2">em Mais áreas</span>}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Subir ${label(slug)}`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Descer ${label(slug)}`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={fixed}
                aria-label={
                  fixed
                    ? `${label(slug)} fica sempre no menu`
                    : isHidden
                      ? `Mostrar ${label(slug)} no menu`
                      : `Mandar ${label(slug)} para Mais áreas`
                }
                aria-pressed={isHidden}
                onClick={() => setHidden((h) => (isHidden ? h.filter((x) => x !== slug) : [...h, slug]))}
              >
                {isHidden ? <EyeOff /> : <Eye />}
              </Button>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
