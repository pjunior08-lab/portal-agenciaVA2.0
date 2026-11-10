import type { Metadata } from "next";
import { Lock, Share2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";
import { metaConfigured } from "@/features/social/meta/graph";
import { SocialApp, type PendingAccount, type PublicationView } from "./social-app";

// mensagens da volta da conexão com a Meta
const META_NOTICES: Record<string, string> = {
  erro: "Não foi possível concluir a conexão com a Meta. Tente de novo.",
  cancelado: "A conexão com a Meta foi cancelada.",
  "sem-contas": "A Meta não devolveu nenhuma Página. Na conexão, marque as Páginas (e os Instagrams ligados a elas) dos clientes.",
  "sem-permissao": "Só quem pode editar o Social conecta contas, e a conexão com a Meta precisa estar configurada no servidor.",
};

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  if (!memberCan(ctx, "social")) {
    return (
      <>
        <PageHeader title="Social" icon={Share2} />
        <Card>
          <EmptyState icon={Lock} title="Sem acesso" description="Peça a um administrador para liberar o módulo Social." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const [pubs, accounts, clients] = await Promise.all([
    supabase
      .from("social_publications")
      .select("*, posts(id, status, post_media(path, name, mime_type, position))")
      .eq("agency_id", ctx.agency.id)
      .order("scheduled_at")
      .limit(1000),
    supabase.from("social_accounts").select("*").eq("agency_id", ctx.agency.id).order("network").order("username"),
    supabase.from("clients").select("id, name, cover_color, status").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
  ]);
  const err = pubs.error ?? accounts.error;
  const canEdit = memberCan(ctx, "social", "editar");
  // contas encontradas na Meta esperando a escolha do cliente (só de quem acabou de conectar)
  let pending: PendingAccount[] = [];
  if (canEdit && sp.conectar === "1") {
    const r = await supabase.rpc("social_pending_list", { a: ctx.agency.id });
    pending = r.data ?? [];
  }
  const metaNotice = typeof sp.meta === "string" ? (META_NOTICES[sp.meta] ?? null) : null;
  if (err) return <ErrorState description="Não foi possível carregar o Social. Recarregue a página." />;

  const firstMedia = (p: NonNullable<typeof pubs.data>[number]) => {
    const post = Array.isArray(p.posts) ? p.posts[0] : p.posts;
    return [...(post?.post_media ?? [])].sort((a, b) => a.position - b.position)[0] ?? null;
  };
  const urls = await signedUrls("aprovacoes", (pubs.data ?? []).map((p) => firstMedia(p)?.path));
  const clientMap = new Map((clients.data ?? []).map((c) => [c.id, c]));

  const views: PublicationView[] = (pubs.data ?? []).map((p) => {
    const { posts: _post, ...row } = p;
    void _post;
    const m = firstMedia(p);
    const client = clientMap.get(row.client_id);
    return {
      ...row,
      clientName: client?.name ?? "Cliente arquivado",
      clientColor: client?.cover_color ?? null,
      media: m ? { name: m.name, mime: m.mime_type, url: urls[m.path] ?? null } : null,
    };
  });

  return (
    <SocialApp
      publications={views}
      accounts={accounts.data ?? []}
      clients={(clients.data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.cover_color }))}
      canEdit={canEdit}
      metaReady={metaConfigured()}
      pending={pending}
      connectReturned={sp.conectar === "1"}
      metaNotice={metaNotice}
    />
  );
}
