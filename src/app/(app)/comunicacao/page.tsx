import type { Metadata } from "next";
import { Lock, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ComunicacaoApp, type ConversationItem } from "./comunicacao-app";

export const metadata: Metadata = { title: "Comunicação" };

const MSG_COLUMNS = "id, conversation_id, author_id, author_name, body, created_at, deleted_at";

export default async function ComunicacaoPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "comunicacao")) {
    return (
      <>
        <PageHeader title="Comunicação" icon={MessageCircle} />
        <Card>
          <EmptyState
            icon={Lock}
            title="Sem acesso"
            description="Peça a um administrador para liberar o módulo Comunicação."
          />
        </Card>
      </>
    );
  }
  const { c } = await searchParams;
  const supabase = await createClient();
  const [convs, parts, people, unread, clients, portals] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, kind, name, client_id, created_by, last_message_at, last_message_preview, created_at")
      .eq("agency_id", ctx.agency.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_participants")
      .select("conversation_id, user_id")
      .eq("agency_id", ctx.agency.id)
      .eq("member", true),
    supabase
      .from("agency_members")
      .select("user_id, profiles!agency_members_user_id_fkey(full_name, email)")
      .eq("agency_id", ctx.agency.id)
      .eq("status", "ativo"),
    supabase.rpc("chat_unread", { a: ctx.agency.id }),
    supabase.from("clients").select("id, name, status").eq("agency_id", ctx.agency.id).order("name"),
    supabase.from("client_portal").select("client_id, enabled, sections").eq("agency_id", ctx.agency.id),
  ]);
  if (convs.error)
    return <ErrorState description="Não foi possível carregar as conversas. Recarregue a página." />;

  const team = (people.data ?? [])
    .map((m) => {
      const p = m.profiles as { full_name: string | null; email: string } | null;
      return { id: m.user_id, name: p?.full_name || p?.email || "Sem nome" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const nameOf = new Map(team.map((p) => [p.id, p.name]));
  const portalOf = new Map((portals.data ?? []).map((p) => [p.client_id, p]));
  const clientList = (clients.data ?? []).map((cl) => {
    const portal = portalOf.get(cl.id);
    return {
      id: cl.id,
      name: cl.name,
      status: cl.status as string,
      portalChat: !!portal?.enabled && portal.sections.includes("mensagens"),
    };
  });
  const unreadMap = new Map((unread.data ?? []).map((u) => [u.conversation_id, u.unread]));
  const membersOf = new Map<string, string[]>();
  for (const p of parts.data ?? [])
    membersOf.set(p.conversation_id, [...(membersOf.get(p.conversation_id) ?? []), p.user_id]);

  const items: ConversationItem[] = (convs.data ?? []).map((cv) => {
    const members = membersOf.get(cv.id) ?? [];
    const other = members.find((u) => u !== ctx.userId);
    return {
      id: cv.id,
      kind: cv.kind,
      portalChat:
        cv.kind === "cliente" ? (clientList.find((cl) => cl.id === cv.client_id)?.portalChat ?? null) : null,
      title:
        cv.kind === "cliente"
          ? (cv.name ?? "Cliente")
          : cv.kind === "grupo"
            ? (cv.name ?? "Grupo")
            : (nameOf.get(other ?? "") ?? "Ex-membro"),
      clientId: cv.client_id,
      members,
      createdBy: cv.created_by,
      lastAt: cv.last_message_at,
      preview: cv.last_message_preview,
      unread: unreadMap.get(cv.id) ?? 0,
    };
  });

  const selected = c ? items.find((i) => i.id === c) : undefined;
  let messages: Awaited<ReturnType<typeof loadMessages>> = { list: [], hasMore: false };
  if (selected) messages = await loadMessages(selected.id);

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("chat_messages")
      .select(MSG_COLUMNS)
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    return { list: (data ?? []).reverse(), hasMore: (data ?? []).length === 50 };
  }

  return (
    <ComunicacaoApp
      me={ctx.userId}
      isAdmin={ctx.role === "admin"}
      canReplyClients={memberCan(ctx, "comunicacao", "editar")}
      conversations={items}
      team={team}
      clients={clientList}
      selected={selected?.id ?? null}
      messages={messages.list}
      hasMore={messages.hasMore}
    />
  );
}
