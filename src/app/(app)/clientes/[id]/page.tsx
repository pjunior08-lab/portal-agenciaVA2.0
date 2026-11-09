import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hammer } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS } from "@/features/clientes/schemas";
import { ClientAvatar, SEGMENT_ICONS } from "@/features/clientes/ui";
import { ClientActions } from "./client-actions";
import { Overview } from "./overview";
import { NotesPanel } from "./notes-panel";
import { FilesPanel } from "./files-panel";
import { DocumentsPanel, type ClientDocument } from "./documents-panel";
import { FinancePanel } from "./finance-panel";
import { today } from "@/lib/dates";
import { StrategyPanel } from "./strategy-panel";
import { PortalPanel } from "./portal-panel";

export const metadata: Metadata = { title: "Cliente" };

const TABS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "anotacoes", label: "Anotações" },
  { id: "arquivos", label: "Arquivos" },
  { id: "estrategia", label: "Central Estratégica" },
  { id: "portal", label: "Portal do Cliente" },
  // abas cujo conteúdo depende de módulos de fases seguintes
  { id: "conteudo", label: "Conteúdo", phase: 4, depends: "Aprovação e Social" },
  { id: "metricas", label: "Métricas", phase: 9, depends: "integrações com as redes" },
  { id: "financeiro", label: "Financeiro" },
  { id: "acessos", label: "Acessos", phase: 9, depends: "levantamento das regras de senhas" },
] as const;

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireMember();
  if (!memberCan(ctx, "clientes")) notFound();
  const canEdit = memberCan(ctx, "clientes", "editar");
  const supabase = await createClient();

  const { data: client, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) return <ErrorState description="Não foi possível carregar o cliente. Recarregue a página." />;
  if (!client) notFound();

  const tab = TABS.find((t) => t.id === aba) ?? TABS[0];
  const logos = await signedUrls("clientes", [client.logo_light_path, client.logo_dark_path]);
  const logoUrls = {
    light: client.logo_light_path ? logos[client.logo_light_path] : null,
    dark: client.logo_dark_path ? logos[client.logo_dark_path] : null,
  };
  const Seg = client.segment_icon ? SEGMENT_ICONS[client.segment_icon] : null;

  let body: React.ReactNode;
  switch (tab.id) {
    case "visao-geral": {
      const [{ count: notes }, { count: files }, { data: portal }] = await Promise.all([
        supabase.from("client_notes").select("id", { count: "exact", head: true }).eq("client_id", id),
        supabase.from("client_files").select("id", { count: "exact", head: true }).eq("client_id", id),
        supabase.from("client_portal").select("slug, enabled, sections").eq("client_id", id).maybeSingle(),
      ]);
      body = <Overview client={client} notesCount={notes ?? 0} filesCount={files ?? 0} portal={portal} />;
      break;
    }
    case "anotacoes": {
      const { data } = await supabase
        .from("client_notes")
        .select(
          "id, body, shared_with_client, created_at, author:profiles!client_notes_author_id_fkey(full_name)",
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      body = (
        <NotesPanel
          clientId={id}
          canEdit={canEdit}
          notes={(data ?? []).map((n) => ({
            id: n.id,
            body: n.body,
            shared: n.shared_with_client,
            createdAt: n.created_at,
            author: (Array.isArray(n.author) ? n.author[0] : n.author)?.full_name ?? null,
          }))}
        />
      );
      break;
    }
    case "arquivos": {
      const { data } = await supabase
        .from("client_files")
        .select("id, name, path, size_bytes, mime_type, shared_with_client, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      const urls = await signedUrls(
        "clientes",
        (data ?? []).map((f) => f.path),
      );
      // contratos e propostas do cliente entram sozinhos (conforme o acesso de quem vê)
      const showContracts = memberCan(ctx, "contratos");
      const showProposals = memberCan(ctx, "propostas");
      const [contracts, proposals] = await Promise.all([
        showContracts
          ? supabase
              .from("contracts")
              .select("id, title, status, created_at, sent_at, signed_at")
              .eq("client_id", id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        showProposals
          ? supabase
              .from("proposals")
              .select("id, number, title, status, created_at, sent_at, decided_at")
              .eq("client_id", id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      const documents: ClientDocument[] = [
        ...(contracts.data ?? []).map((c) => ({
          kind: "contrato" as const,
          id: c.id,
          title: c.title,
          status: c.status,
          date: c.signed_at ?? c.sent_at ?? c.created_at,
          dateLabel: c.signed_at ? "assinado em" : c.sent_at ? "enviado em" : "criado em",
        })),
        ...(proposals.data ?? []).map((p) => ({
          kind: "proposta" as const,
          id: p.id,
          title: `Nº ${p.number} · ${p.title}`,
          status: p.status,
          date: p.decided_at ?? p.sent_at ?? p.created_at,
          dateLabel: p.decided_at
            ? p.status === "aceita"
              ? "aceita em"
              : "respondida em"
            : p.sent_at
              ? "enviada em"
              : "criada em",
        })),
      ].sort((a, b) => b.date.localeCompare(a.date));
      body = (
        <div className="flex flex-col gap-4">
          {(showContracts || showProposals) && (
            <DocumentsPanel
              clientId={id}
              documents={documents}
              canCreateContract={memberCan(ctx, "contratos", "editar")}
              showContracts={showContracts}
              showProposals={showProposals}
            />
          )}
          <FilesPanel
            clientId={id}
            agencyId={client.agency_id}
            canEdit={canEdit}
            files={(data ?? []).map((f) => ({
              id: f.id,
              name: f.name,
              size: f.size_bytes,
              mime: f.mime_type,
              shared: f.shared_with_client,
              createdAt: f.created_at,
              url: urls[f.path] ?? null,
            }))}
          />
        </div>
      );
      break;
    }
    case "financeiro": {
      if (!memberCan(ctx, "financeiro")) {
        body = (
          <Card>
            <EmptyState icon={Hammer} title="Sem acesso ao Financeiro" description="Peça a um administrador para liberar o módulo Financeiro." />
          </Card>
        );
        break;
      }
      const { data } = await supabase
        .from("fin_transactions")
        .select("id, description, amount, due_date, paid, paid_at")
        .eq("client_id", id)
        .eq("kind", "receita")
        .order("due_date", { ascending: false })
        .limit(200);
      body = (
        <FinancePanel
          monthlyFee={client.monthly_fee == null ? null : Number(client.monthly_fee)}
          billingDay={client.billing_day}
          status={client.status}
          receipts={(data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }))}
          today={today()}
        />
      );
      break;
    }
    case "estrategia": {
      const { data } = await supabase.from("client_strategy").select("*").eq("client_id", id).maybeSingle();
      body = <StrategyPanel clientId={id} canEdit={canEdit} strategy={data} />;
      break;
    }
    case "portal": {
      const [{ data: portal }, { data: users }, { data: invites }] = await Promise.all([
        supabase.from("client_portal").select("*").eq("client_id", id).maybeSingle(),
        supabase
          .from("client_users")
          .select("user_id, status, created_at, profile:profiles!client_users_user_id_fkey(full_name, email)")
          .eq("client_id", id),
        canEdit
          ? supabase
              .from("client_invitations")
              .select("id, email, expires_at")
              .eq("client_id", id)
              .is("accepted_at", null)
              .is("revoked_at", null)
          : Promise.resolve({ data: [] as { id: string; email: string; expires_at: string }[] }),
      ]);
      body = (
        <PortalPanel
          clientId={id}
          clientName={client.name}
          canEdit={canEdit}
          portal={portal}
          users={(users ?? []).map((u) => {
            const p = Array.isArray(u.profile) ? u.profile[0] : u.profile;
            return {
              userId: u.user_id,
              status: u.status,
              name: p?.full_name || p?.email || "Cliente",
              email: p?.email ?? "",
            };
          })}
          invites={invites ?? []}
        />
      );
      break;
    }
    default:
      body = (
        <Card>
          <EmptyState
            icon={Hammer}
            title={`${tab.label} chega na Fase ${"phase" in tab ? tab.phase : ""}`}
            description={`Esta aba mostra dados de ${"depends" in tab ? tab.depends : "outro módulo"}, que ainda não foi construído.`}
          />
        </Card>
      );
  }

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Clientes
      </Link>

      <header className="mb-5 overflow-hidden rounded-card bg-surface">
        <div className="h-20" style={{ background: client.cover_color ?? "var(--panel)" }} aria-hidden />
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-3 px-5 pb-4">
          <div className="flex min-w-0 items-end gap-3">
            <ClientAvatar
              name={client.name}
              color={client.cover_color}
              lightUrl={logoUrls.light}
              darkUrl={logoUrls.dark}
              size="lg"
              className="ring-4 ring-surface"
            />
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl leading-tight font-normal tracking-tight">{client.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={CLIENT_STATUS[client.status].tone}>{CLIENT_STATUS[client.status].label}</Badge>
                {Seg && (
                  <Badge>
                    <Seg.icon className="size-3" aria-hidden /> {Seg.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {canEdit && <ClientActions client={client} logoUrls={logoUrls} isAdmin={ctx.role === "admin"} />}
        </div>
      </header>

      <nav
        aria-label="Seções do cliente"
        className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-surface p-1"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/clientes/${id}?aba=${t.id}`}
            aria-current={tab.id === t.id ? "page" : undefined}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors",
              tab.id === t.id
                ? "bg-brand text-brand-ink"
                : "phase" in t
                  ? "text-muted-2 hover:text-ink"
                  : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {body}
    </>
  );
}
