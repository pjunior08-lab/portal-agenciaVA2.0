"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMemberContext } from "@/lib/auth/session";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
}

/** Últimas 40 notificações da pessoa (gerais da agência ou endereçadas a ela) e quantas não foram lidas. */
export async function loadNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const ctx = await getMemberContext();
  if (!ctx) return { items: [], unread: 0 };
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, created_at")
    .eq("agency_id", ctx.agency.id)
    .order("created_at", { ascending: false })
    .limit(40);
  const list = data ?? [];
  const { data: reads } = list.length
    ? await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", ctx.userId)
        .in(
          "notification_id",
          list.map((n) => n.id),
        )
    : { data: [] };
  const read = new Set((reads ?? []).map((r) => r.notification_id));
  const items = list.map((n) => ({ ...n, read: read.has(n.id) }));
  return { items, unread: items.filter((n) => !n.read).length };
}

/** Marca como lidas (uma lista ou todas as carregadas). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  const ctx = await getMemberContext();
  const parsed = z.array(z.string().uuid()).max(100).safeParse(ids);
  if (!ctx || !parsed.success || !parsed.data.length) return;
  const supabase = await createClient();
  await supabase.from("notification_reads").upsert(
    parsed.data.map((id) => ({ notification_id: id, user_id: ctx.userId })),
    { onConflict: "notification_id,user_id", ignoreDuplicates: true },
  );
}
