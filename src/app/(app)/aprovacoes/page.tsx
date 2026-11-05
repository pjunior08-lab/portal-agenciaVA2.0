import type { Metadata } from "next";
import { CheckCircle2, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";
import type { PostView } from "@/features/aprovacoes/types";
import { AprovacoesApp } from "./aprovacoes-app";

export const metadata: Metadata = { title: "Aprovação" };

export default async function AprovacoesPage() {
  const ctx = await requireMember();
  if (!memberCan(ctx, "aprovacoes")) {
    return (
      <>
        <PageHeader title="Aprovação" icon={CheckCircle2} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Aprovação." />
        </Card>
      </>
    );
  }
  const canEdit = memberCan(ctx, "aprovacoes", "editar");
  const supabase = await createClient();

  const [posts, clients, templates, tasks, people, portals] = await Promise.all([
    supabase
      .from("posts")
      .select("*, post_media(id, name, path, mime_type, size_bytes, position), approval_events(id, actor_id, actor_side, event, part, decision, round, comment, created_at), social_publications(id)")
      .eq("agency_id", ctx.agency.id)
      .order("sent_at", { ascending: false })
      .limit(500),
    supabase.from("clients").select("id, name, cover_color, status").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
    supabase.from("caption_templates").select("id, title, body, client_id").eq("agency_id", ctx.agency.id).order("title"),
    supabase
      .from("tasks")
      .select("id, title, type, caption, client_id")
      .eq("agency_id", ctx.agency.id)
      .is("archived_at", null)
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("client_portal").select("client_id, slug, sections, enabled").eq("agency_id", ctx.agency.id),
  ]);
  if (posts.error) return <ErrorState description="Não foi possível carregar as aprovações. Recarregue a página." />;

  const clientMap = new Map((clients.data ?? []).map((c) => [c.id, c]));
  const names = new Map((people.data ?? []).map((p) => [p.id, p.full_name || p.email]));
  const urls = await signedUrls(
    "aprovacoes",
    (posts.data ?? []).flatMap((p) => (p.post_media ?? []).map((m) => m.path)),
  );

  const views: PostView[] = (posts.data ?? []).map((p) => {
    const { post_media, approval_events, social_publications, ...row } = p;
    const client = clientMap.get(row.client_id);
    const pubs = Array.isArray(social_publications) ? social_publications : social_publications ? [social_publications] : [];
    return {
      ...row,
      clientName: client?.name ?? "Cliente arquivado",
      clientColor: client?.cover_color ?? null,
      creatorName: (row.created_by && names.get(row.created_by)) || "—",
      scheduledInSocial: pubs.length > 0,
      media: [...(post_media ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((m) => ({ id: m.id, name: m.name, url: urls[m.path] ?? null, mime: m.mime_type, size: m.size_bytes })),
      events: [...(approval_events ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({
          ...e,
          actorName: e.actor_side === "cliente" ? (client?.name ?? "Cliente") : (e.actor_id && names.get(e.actor_id)) || "Equipe",
        })),
    };
  });

  return (
    <AprovacoesApp
      posts={views}
      clients={(clients.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
      templates={templates.data ?? []}
      tasks={(tasks.data ?? []).map((t) => ({ id: t.id, title: t.title, type: t.type, caption: t.caption, client_id: t.client_id as string }))}
      portals={(portals.data ?? []).map((p) => ({ client_id: p.client_id, slug: p.slug, approvals: p.enabled && p.sections.includes("aprovacoes") }))}
      agencyId={ctx.agency.id}
      canEdit={canEdit}
      canSchedule={memberCan(ctx, "social", "editar")}
    />
  );
}
