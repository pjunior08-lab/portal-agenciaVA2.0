"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  loadNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/features/notificacoes/actions";

const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Sininho com as notificações da pessoa; atualiza sozinho quando chega uma nova. */
export function NotificationBell({ className }: { className?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [, start] = useTransition();
  // cada sininho (menu do computador e do celular) tem o próprio canal
  const channelId = useId();

  const refresh = useCallback(async () => {
    const r = await loadNotifications();
    setItems(r.items);
    setUnread(r.unread);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    const channel = supabase
      .channel(`notificacoes:${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, channelId]);

  const markRead = (ids: string[]) => {
    if (!ids.length) return;
    setItems((cur) => cur.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - ids.length));
    start(() => markNotificationsRead(ids));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-2",
          className,
        )}
        aria-label={unread ? `Notificações: ${unread} não lida(s)` : "Notificações"}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-line origin-(--radix-popover-content-transform-origin) data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
              >
                <CheckCheck className="size-3.5" aria-hidden /> Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {!loaded && <li className="p-4 text-center text-xs text-muted">Carregando…</li>}
            {loaded && items.length === 0 && (
              <li className="p-6 text-center text-xs text-muted">Nenhuma notificação por enquanto.</li>
            )}
            {items.map((n) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-brand",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-medium")}>{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="block text-[10px] text-muted-2">
                      {when.format(new Date(n.created_at))}
                      {!n.read && <span className="sr-only"> (não lida)</span>}
                    </span>
                  </span>
                </>
              );
              const cls = "flex w-full gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-surface-2";
              // só links internos do sistema
              const internal = n.link && n.link.startsWith("/") && !n.link.startsWith("//");
              return (
                <li key={n.id}>
                  {internal ? (
                    <Link
                      href={n.link!}
                      className={cls}
                      onClick={() => {
                        markRead(n.read ? [] : [n.id]);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button type="button" className={cls} onClick={() => markRead(n.read ? [] : [n.id])}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
