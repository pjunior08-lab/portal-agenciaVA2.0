"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, History, MessageSquareWarning, ThumbsDown } from "lucide-react";
import { Alert, Badge, Button, EmptyState, MediaThumb, SectionCard, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DECISIONS, NETWORKS, PARTS, isPending } from "@/features/aprovacoes/schemas";
import { ApprovalStatusBadge, DecisionBadge, formatDateTime } from "@/features/aprovacoes/ui";
import { clientDecide, clientOpenPost } from "@/features/aprovacoes/actions";
import type { ApprovalDecisionT, ApprovalPartT } from "@/lib/supabase/database.types";
import type { ApprovalEventView, MediaView } from "@/features/aprovacoes/types";
import type { PostRow } from "@/lib/supabase/database.types";

export type PortalPost = Pick<
  PostRow,
  "id" | "kind" | "title" | "caption" | "mode" | "status" | "theme_decision" | "media_decision" | "caption_decision" | "networks" | "scheduled_at" | "sent_at" | "round"
> & { media: MediaView[]; events: ApprovalEventView[] };

export function PortalApprovals({ slug, posts, openId, viewer }: { slug: string; posts: PortalPost[]; openId: string | null; viewer: "cliente" | "equipe" }) {
  const open = posts.find((p) => p.id === openId);
  if (open) return <PostDetail slug={slug} post={open} viewer={viewer} />;

  const pending = posts.filter((p) => isPending(p.status));
  const done = posts.filter((p) => !isPending(p.status));
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Aguardando você" icon={CheckCircle2} description="Posts e demandas que a agência enviou para sua aprovação.">
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nada pendente" description="Quando a agência enviar algo para aprovar, aparece aqui." />
        ) : (
          <PostList slug={slug} posts={pending} />
        )}
      </SectionCard>
      {done.length > 0 && (
        <SectionCard title="Já decididos" icon={History}>
          <PostList slug={slug} posts={done} />
        </SectionCard>
      )}
    </div>
  );
}

function PostList({ slug, posts }: { slug: string; posts: PortalPost[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/portal/${slug}/aprovacoes?envio=${p.id}`} className="flex h-full flex-col overflow-hidden rounded-xl bg-surface-2 hover:ring-2 hover:ring-brand">
            {p.kind === "post" && <MediaThumb media={p.media[0]} className="aspect-[4/3] w-full" />}
            <span className="flex flex-col gap-1.5 p-3">
              <span className="text-[11px] text-muted">{p.kind === "post" ? "Post" : "Demanda"} · enviado em {formatDateTime(p.sent_at)}</span>
              <span className="line-clamp-2 text-sm font-medium">{p.title}</span>
              <ApprovalStatusBadge status={p.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PostDetail({ slug, post, viewer }: { slug: string; post: PortalPost; viewer: "cliente" | "equipe" }) {
  const router = useRouter();
  const opened = useRef(false);
  const canDecide = viewer === "cliente" && isPending(post.status);

  // abrir o envio avisa a agência que você está analisando
  useEffect(() => {
    if (viewer !== "cliente" || post.status !== "enviado" || opened.current) return;
    opened.current = true;
    clientOpenPost(post.id).then((r) => r.ok && router.refresh());
  }, [viewer, post.id, post.status, router]);

  const partDecision = (part: ApprovalPartT) =>
    part === "tema" ? post.theme_decision : part === "midias" ? post.media_decision : part === "legenda" ? post.caption_decision : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portal/${slug}/aprovacoes`} className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </Link>
      {viewer === "equipe" && (
        <Alert tone="info">Você está vendo como o cliente vê. Só o cliente pode registrar a decisão.</Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4 rounded-card bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ApprovalStatusBadge status={post.status} />
            {post.round > 1 && <Badge>{post.round}ª versão</Badge>}
            {post.scheduled_at && <span className="text-xs text-muted">Publicação prevista: {formatDateTime(post.scheduled_at)}</span>}
            {post.networks.length > 0 && <span className="text-xs text-muted">· {post.networks.map((n) => NETWORKS[n]).join(", ")}</span>}
          </div>

          <Part label={post.kind === "post" ? "Tema" : "Título"} part="tema" post={post} canDecide={canDecide} decision={partDecision("tema")}>
            <h1 className="text-xl font-normal tracking-tight">{post.title}</h1>
          </Part>

          {(post.media.length > 0 || post.kind === "post") && (
            <Part label={post.kind === "post" ? "Mídias" : "Anexos"} part="midias" post={post} canDecide={canDecide} decision={partDecision("midias")}>
              {post.media.length === 0 ? (
                <p className="text-sm text-muted">Sem arquivos.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {post.media.map((m) => (
                    <li key={m.id}>
                      <MediaThumb media={m} controls className="max-h-[480px] w-full rounded-xl object-contain" />
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] text-muted underline-offset-2 hover:underline">
                          Abrir {m.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Part>
          )}

          <Part label={post.kind === "post" ? "Legenda" : "Descrição"} part="legenda" post={post} canDecide={canDecide} decision={partDecision("legenda")}>
            <p className="text-sm whitespace-pre-wrap">{post.caption || <span className="text-muted">Sem texto.</span>}</p>
          </Part>
        </div>

        <div className="flex flex-col gap-4">
          {canDecide && post.mode === "rapida" && <DecisionForm postId={post.id} part="geral" title="Sua decisão" />}
          {canDecide && post.mode === "detalhada" && (
            <p className="rounded-card bg-surface p-4 text-xs text-muted">
              Aprovação detalhada: decida o tema, as mídias e a legenda separadamente, logo abaixo de cada parte.
            </p>
          )}
          <SectionCard title="Histórico" icon={History}>
            <ol className="flex flex-col gap-2.5 border-l border-line pl-3">
              {[...post.events].reverse().map((e) => (
                <li key={e.id} className="relative text-xs">
                  <span
                    className={cn(
                      "absolute top-1 -left-[17px] size-2 rounded-full",
                      e.decision === "aprovado" ? "bg-success" : e.decision === "reprovado" ? "bg-danger" : e.decision ? "bg-warning" : "bg-muted-2",
                    )}
                    aria-hidden
                  />
                  <p>
                    <span className="font-medium">{e.actor_side === "cliente" ? "Você" : "Agência"}</span>{" "}
                    {e.event === "enviado" && "enviou para aprovação"}
                    {e.event === "reenviado" && `enviou a ${e.round}ª versão`}
                    {e.event === "em_analise" && "abriu para analisar"}
                    {e.event === "decisao" && e.decision && (
                      <>
                        {e.part && e.part !== "geral" ? `${PARTS[e.part]}: ` : ""}
                        {DECISIONS[e.decision].toLowerCase()}
                      </>
                    )}
                  </p>
                  {e.comment && <p className="mt-0.5 rounded-lg bg-surface-2 px-2 py-1 whitespace-pre-wrap">{e.comment}</p>}
                  <p className="text-[10px] text-muted">{formatDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Part({
  label,
  part,
  post,
  canDecide,
  decision,
  children,
}: {
  label: string;
  part: ApprovalPartT;
  post: PortalPost;
  canDecide: boolean;
  decision: ApprovalDecisionT | null;
  children: React.ReactNode;
}) {
  const detailed = post.mode === "detalhada";
  return (
    <section aria-label={label} className="flex flex-col gap-2 border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted uppercase">{label}</h2>
        {detailed && <DecisionBadge decision={decision} />}
      </div>
      {children}
      {detailed && canDecide && !decision && <DecisionForm postId={post.id} part={part} compact />}
    </section>
  );
}

function DecisionForm({ postId, part, title, compact }: { postId: string; part: ApprovalPartT; title?: string; compact?: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<ApprovalDecisionT | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = (decision: ApprovalDecisionT) => {
    if (decision !== "aprovado" && !comment.trim()) {
      setChoice(decision);
      return setError("Escreva o que precisa mudar.");
    }
    start(async () => {
      const r = await clientDecide({ postId, part, decision, comment });
      if (!r.ok) return setError(r.error);
      setError("");
      router.refresh();
    });
  };

  return (
    <div className={cn("flex flex-col gap-2", compact ? "rounded-xl bg-surface-2 p-3" : "rounded-card bg-surface p-4")}>
      {title && <h2 className="text-sm font-semibold">{title}</h2>}
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending && choice === "aprovado"} disabled={pending} onClick={() => (setChoice("aprovado"), send("aprovado"))}>
          <CheckCircle2 /> Aprovar
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setChoice("alteracoes")} aria-pressed={choice === "alteracoes"}>
          <MessageSquareWarning /> Pedir alterações
        </Button>
        <Button size="sm" variant="danger-outline" disabled={pending} onClick={() => setChoice("reprovado")} aria-pressed={choice === "reprovado"}>
          <ThumbsDown /> Reprovar
        </Button>
      </div>
      {(choice === "alteracoes" || choice === "reprovado") && (
        <>
          <label htmlFor={`coment-${part}`} className="text-xs font-medium text-muted">
            {choice === "alteracoes" ? "O que precisa mudar?" : "Por que reprovar?"}
          </label>
          <Textarea id={`coment-${part}`} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
          <Button size="sm" variant={choice === "reprovado" ? "danger" : "primary"} loading={pending} className="self-start" onClick={() => send(choice)}>
            Enviar {choice === "alteracoes" ? "pedido de alteração" : "reprovação"}
          </Button>
        </>
      )}
    </div>
  );
}
