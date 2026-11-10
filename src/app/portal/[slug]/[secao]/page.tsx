import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  MessageCircle,
  Receipt,
  Clock,
  Download,
  FileSignature,
  FileText,
  Loader,
  StickyNote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { getPortal } from "@/features/portal/context";
import { PORTAL_SECTIONS } from "@/features/clientes/schemas";
import { Badge, EmptyState, ErrorState, SectionCard } from "@/components/ui";
import { dayOf, shortDate, today } from "@/lib/dates";
import { NETWORKS } from "@/features/aprovacoes/schemas";
import { cleanHtml } from "@/lib/html";
import { formatBRL } from "@/lib/utils";
import { CADENCES, investment } from "@/features/propostas/schemas";
import { CONTRACT_STATUS, fmtDay } from "@/features/contratos/schemas";
import { ContractSheet } from "@/features/contratos/document";
import { getUser } from "@/lib/auth/session";
import { ChatThread } from "@/features/comunicacao/chat-thread";
import { PortalApprovals, type PortalPost } from "./approvals";
import { PortalCalendar } from "./calendar";
import { formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Portal" };

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PortalSection({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; secao: string }>;
  searchParams: Promise<{ envio?: string }>;
}) {
  const { slug, secao } = await params;
  const p = await getPortal(slug);
  const section = PORTAL_SECTIONS.find((s) => s.id === secao);
  if (!section || !p.sections.includes(section.id)) notFound();
  const supabase = await createClient();

  if (section.id === "arquivos") {
    // filtro explícito por "compartilhado" também para quem é da equipe e está pré-visualizando
    const { data } = await supabase
      .from("client_files")
      .select("id, name, path, size_bytes, created_at")
      .eq("client_id", p.clientId)
      .eq("shared_with_client", true)
      .order("created_at", { ascending: false });
    const urls = await signedUrls(
      "clientes",
      (data ?? []).map((f) => f.path),
    );
    return (
      <SectionCard
        title="Arquivos"
        icon={FileText}
        description="Materiais que a agência compartilhou com você."
      >
        {!data?.length ? (
          <EmptyState icon={FileText} title="Nenhum arquivo compartilhado ainda" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {data.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{f.name}</p>
                  <p className="text-[11px] text-muted">
                    {formatBytes(f.size_bytes)} · {when.format(new Date(f.created_at))}
                  </p>
                </div>
                {urls[f.path] && (
                  <a
                    href={urls[f.path]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium hover:bg-surface-3"
                  >
                    <Download className="size-3.5" aria-hidden /> Baixar
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  }

  if (section.id === "aprovacoes") {
    const { envio } = await searchParams;
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, kind, title, caption, mode, status, theme_decision, media_decision, caption_decision, networks, scheduled_at, sent_at, round, post_media(id, name, path, mime_type, size_bytes, position), approval_events(id, actor_side, event, part, decision, round, comment, created_at)",
      )
      .eq("client_id", p.clientId)
      .order("sent_at", { ascending: false })
      .limit(200);
    if (error) return <ErrorState description="Não foi possível carregar as aprovações." />;
    const urls = await signedUrls(
      "aprovacoes",
      (data ?? []).flatMap((x) => (x.post_media ?? []).map((m) => m.path)),
    );
    const posts: PortalPost[] = (data ?? []).map(({ post_media, approval_events, ...row }) => ({
      ...row,
      media: [...(post_media ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          id: m.id,
          name: m.name,
          url: urls[m.path] ?? null,
          mime: m.mime_type,
          size: m.size_bytes,
        })),
      // o cliente não vê nomes da equipe, só "Agência"
      events: [...(approval_events ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({ ...e, actorName: e.actor_side === "cliente" ? "Você" : "Agência" })),
    }));
    return <PortalApprovals slug={slug} posts={posts} openId={envio ?? null} viewer={p.viewer} />;
  }

  if (section.id === "faturas") {
    // só pela função: o cliente não lê a tabela de lançamentos
    const { data, error } = await supabase.rpc("portal_invoices", { c: p.clientId });
    if (error) return <ErrorState description="Não foi possível carregar suas faturas." />;
    const now = today();
    const open = (data ?? []).filter((f) => !f.paid);
    return (
      <SectionCard title="Faturas" icon={Receipt} description="Cobranças da agência para você.">
        {!data?.length ? (
          <EmptyState icon={Receipt} title="Nenhuma fatura ainda" />
        ) : (
          <>
            {open.length > 0 && (
              <p className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
                Em aberto: <strong>{formatBRL(open.reduce((s, f) => s + Number(f.amount), 0))}</strong>
              </p>
            )}
            <ul className="flex flex-col divide-y divide-line">
              {data.map((f) => {
                const late = !f.paid && f.due_date < now;
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{f.description}</span>
                      <span className="text-xs text-muted">Vencimento {fmtDay(f.due_date)}</span>
                    </span>
                    <Badge tone={f.paid ? "success-soft" : late ? "danger" : "neutral"}>
                      {f.paid
                        ? `Pago${f.paid_at ? ` em ${shortDate(f.paid_at)}` : ""}`
                        : late
                          ? "Atrasada"
                          : "A vencer"}
                    </Badge>
                    <span className="w-28 text-right tabular-nums">{formatBRL(Number(f.amount))}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SectionCard>
    );
  }

  if (section.id === "servicos") {
    const [contracts, proposals] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, title, status, value, starts_on, ends_on, renewal_on, rendered_html, header_text, footer_text, watermark, document_hash, signed_at",
        )
        .eq("client_id", p.clientId)
        .in("status", ["aguardando", "assinado"])
        .order("created_at", { ascending: false }),
      supabase
        .from("proposals")
        .select(
          "id, number, title, decided_at, proposal_items(service, quantity, unit_price, cadence, position)",
        )
        .eq("client_id", p.clientId)
        .eq("status", "aceita")
        .order("decided_at", { ascending: false }),
    ]);
    if (contracts.error || proposals.error)
      return <ErrorState description="Não foi possível carregar seus serviços." />;
    const none = !contracts.data?.length && !proposals.data?.length;
    return (
      <div className="flex flex-col gap-4">
        {none && (
          <SectionCard title="Serviços" icon={BriefcaseBusiness}>
            <EmptyState
              icon={BriefcaseBusiness}
              title="Nada por aqui ainda"
              description="Seus contratos e propostas aceitas aparecem aqui."
            />
          </SectionCard>
        )}
        {!!proposals.data?.length && (
          <SectionCard
            title="Serviços contratados"
            icon={BriefcaseBusiness}
            description="Das propostas que você aceitou."
          >
            <ul className="flex flex-col gap-3">
              {proposals.data.map((pr) => {
                const items = [...(pr.proposal_items ?? [])].sort((a, b) => a.position - b.position);
                return (
                  <li key={pr.id} className="rounded-xl bg-surface-2 p-4">
                    <p className="text-[11px] text-muted">Proposta nº {pr.number}</p>
                    <p className="font-medium">{pr.title}</p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {items.map((i, n) => (
                        <li key={n} className="flex justify-between gap-3">
                          <span>{i.service}</span>
                          <span className="text-muted tabular-nums">
                            {formatBRL(Math.round(Number(i.quantity) * Number(i.unit_price) * 100) / 100)}
                            {CADENCES[i.cadence].suffix}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted">
                      Total:{" "}
                      {investment(items)
                        .map((t) => `${formatBRL(t.total)}${CADENCES[t.cadence].suffix}`)
                        .join(" + ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        )}
        {!!contracts.data?.length && (
          <SectionCard title="Contratos" icon={FileSignature}>
            <ul className="flex flex-col gap-3">
              {contracts.data.map((ct) => (
                <li key={ct.id} className="rounded-xl bg-surface-2 p-4">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{ct.title}</span>
                        <span className="block text-xs text-muted">
                          {ct.starts_on
                            ? `${fmtDay(ct.starts_on)} a ${ct.ends_on ? fmtDay(ct.ends_on) : "prazo indeterminado"}`
                            : "Vigência a definir"}
                          {ct.value != null && ` · ${formatBRL(ct.value)}`}
                        </span>
                      </span>
                      <Badge tone={CONTRACT_STATUS[ct.status].tone}>{CONTRACT_STATUS[ct.status].label}</Badge>
                      <span className="text-xs text-muted underline-offset-2 hover:underline">
                        Ver contrato
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <ContractSheet
                        html={cleanHtml(ct.rendered_html)}
                        header={ct.header_text}
                        footer={ct.footer_text}
                        watermark={ct.watermark}
                      />
                      <p className="text-[11px] break-all text-muted">
                        {ct.signed_at ? `Assinado pelas duas partes em ${fmtDay(dayOf(ct.signed_at))}. ` : ""}
                        Código do documento (SHA-256): <span className="font-mono">{ct.document_hash}</span>
                      </p>
                      {ct.status === "aguardando" && (
                        <p className="text-xs text-muted">
                          Para assinar, use o link de assinatura que a agência enviou.
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    );
  }

  if (section.id === "calendario") {
    const [pubs, approved] = await Promise.all([
      supabase
        .from("social_publications")
        .select("id, post_id, title, network, scheduled_at, status")
        .eq("client_id", p.clientId)
        .neq("status", "cancelado")
        .order("scheduled_at"),
      supabase
        .from("posts")
        .select("id, title, networks, scheduled_at")
        .eq("client_id", p.clientId)
        .eq("status", "aprovado")
        .eq("kind", "post")
        .not("scheduled_at", "is", null),
    ]);
    if (pubs.error) return <ErrorState description="Não foi possível carregar o calendário." />;
    const inCalendar = new Set((pubs.data ?? []).map((x) => x.post_id));
    const items = [
      ...(pubs.data ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        network: NETWORKS[x.network],
        at: x.scheduled_at,
        published: x.status === "publicado",
      })),
      // aprovados com data que a equipe ainda não levou ao Social
      ...(approved.data ?? [])
        .filter((x) => !inCalendar.has(x.id))
        .map((x) => ({
          id: x.id,
          title: x.title,
          network: x.networks.map((n) => NETWORKS[n]).join(", ") || "Rede a definir",
          at: x.scheduled_at as string,
          published: false,
        })),
    ];
    return (
      <SectionCard
        title="Calendário"
        icon={CalendarDays}
        description="Publicações previstas e já feitas pela agência."
      >
        {items.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nada agendado ainda" />
        ) : (
          <PortalCalendar items={items} />
        )}
      </SectionCard>
    );
  }

  if (section.id === "em-andamento") {
    // RPC devolve só demandas do cliente fora de coluna "concluída", sem dados internos (responsáveis, descrição)
    const { data, error } = await supabase.rpc("portal_tasks_in_progress", { c: p.clientId });
    if (error) return <ErrorState description="Não foi possível carregar o que está em andamento." />;
    return (
      <SectionCard
        title="Em andamento"
        icon={Loader}
        description="O que a agência está produzindo para você agora."
      >
        {!data?.length ? (
          <EmptyState icon={Loader} title="Nada em andamento no momento" />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: t.column_color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.title}</p>
                  <p className="text-[11px] text-muted">
                    {t.type === "post" ? "Post" : "Demanda"} · {t.column_name}
                  </p>
                </div>
                {t.due_date && <Badge>Prazo {shortDate(t.due_date)}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  }

  if (section.id === "mensagens") {
    const user = await getUser();
    const { data: conv, error } = await supabase.rpc("chat_client_conversation", { c: p.clientId });
    if (error || !conv || !user)
      return <ErrorState description="Não foi possível abrir as mensagens agora. Recarregue a página." />;
    const { data } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, author_id, author_name, body, created_at, deleted_at")
      .eq("conversation_id", conv)
      .order("created_at", { ascending: false })
      .limit(50);
    return (
      <section
        aria-label="Mensagens"
        className="flex h-[calc(100dvh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-card bg-surface"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <MessageCircle className="size-4 text-muted" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold">Mensagens</h1>
            <p className="text-[11px] text-muted">Converse com a equipe da agência por aqui.</p>
          </div>
        </header>
        <ChatThread
          conversationId={conv}
          me={user.id}
          initial={(data ?? []).reverse()}
          hasMore={(data ?? []).length === 50}
          canPost
          placeholder="Escreva para a agência…"
        />
      </section>
    );
  }

  if (section.id === "anotacoes") {
    const { data } = await supabase
      .from("client_notes")
      .select("id, body, created_at")
      .eq("client_id", p.clientId)
      .eq("shared_with_client", true)
      .order("created_at", { ascending: false });
    return (
      <SectionCard
        title="Anotações"
        icon={StickyNote}
        description="Recados e registros da agência para você."
      >
        {!data?.length ? (
          <EmptyState icon={StickyNote} title="Nenhuma anotação compartilhada ainda" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((n) => (
              <li key={n.id} className="rounded-xl bg-surface-2 p-3">
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted">{when.format(new Date(n.created_at))}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  }

  return (
    <div className="rounded-card bg-surface">
      <EmptyState
        icon={Clock}
        title={`${section.label}: em breve`}
        description="A agência está preparando esta seção. Ela aparece aqui assim que estiver pronta."
      />
    </div>
  );
}
