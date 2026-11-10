"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle, AtSign, BarChart3, CalendarDays, CheckCircle2, ExternalLink, Link2, Link2Off, List, Plus, RotateCcw, Share2, Trash2, Undo2, Unplug, XCircle, Zap } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, buttonVariants, Card, EmptyState, Field, FilterMenu, Input, MediaThumb, Modal, MonthCalendar, SegmentedControl, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dayOf, isoToLocalInput, today, timeOf, weekdayDate } from "@/lib/dates";
import {
  NETWORKS,
  NETWORK_IDS,
  PUBLICATION_STATUS,
  accountSchema,
  publicationSchema,
  type PublicationFormValues,
} from "@/features/aprovacoes/schemas";
import { deleteAccount, deletePublication, disconnectAccount, linkMetaAccounts, saveAccount, savePublication, setPublicationStatus } from "@/features/social/actions";
import type { PublicationRow, SocialAccountRow, SocialNetworkT } from "@/lib/supabase/database.types";

export interface PublicationView extends PublicationRow {
  clientName: string;
  clientColor: string | null;
  media: { name: string; mime: string | null; url: string | null } | null;
}

export interface PendingAccount {
  key: string;
  network: SocialNetworkT;
  username: string;
  picture_url: string | null;
  page_id: string | null;
  suggested_client: string | null;
}

type Client = { id: string; name: string; color: string | null };
const TABS = [
  { id: "agendamentos", label: "Agendamentos", icon: CalendarDays },
  { id: "metricas", label: "Métricas", icon: BarChart3 },
  { id: "contas", label: "Contas", icon: AtSign },
] as const;

export function SocialApp({
  publications,
  accounts,
  clients,
  canEdit,
  metaReady,
  pending,
  connectReturned,
  metaNotice,
}: {
  publications: PublicationView[];
  accounts: SocialAccountRow[];
  clients: Client[];
  canEdit: boolean;
  metaReady: boolean;
  pending: PendingAccount[];
  connectReturned: boolean;
  metaNotice: string | null;
}) {
  // voltando da conexão com a Meta, abre direto na aba Contas
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(connectReturned || metaNotice ? "contas" : "agendamentos");
  const [linkOpen, setLinkOpen] = useState(pending.length > 0);
  const [pubModal, setPubModal] = useState<PublicationView | "new" | null>(null);
  const [accModal, setAccModal] = useState<SocialAccountRow | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Social"
        icon={Share2}
        actions={
          canEdit &&
          (tab === "contas" ? (
            <div className="flex flex-wrap gap-2">
              {metaReady && (
                // rota do servidor que redireciona para a Meta: precisa de navegação completa, não do roteador do Next
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a href="/api/social/meta/connect" className={buttonVariants()}>
                  <Link2 /> Conectar Instagram/Facebook
                </a>
              )}
              <Button variant={metaReady ? "secondary" : "primary"} onClick={() => setAccModal("new")}>
                <Plus /> Adicionar conta
              </Button>
            </div>
          ) : (
            <Button onClick={() => setPubModal("new")}>
              <Plus /> Novo agendamento
            </Button>
          ))
        }
      >
        <div role="tablist" aria-label="Seções do Social" className="flex gap-1 rounded-full bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium",
                tab === t.id ? "bg-panel text-panel-ink" : "text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-3.5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {metaNotice && <Alert className="mb-5">{metaNotice}</Alert>}
      {connectReturned && !pending.length && !metaNotice && (
        <Alert tone="info" className="mb-5">
          Nenhuma conta esperando cliente. Se acabou de conectar, as contas já estão na lista abaixo.
        </Alert>
      )}
      <Alert tone="info" className="mb-5">
        {metaReady
          ? "Instagram e Facebook: post com publicação automática aprovado pelo cliente entra aqui e sai sozinho na data e hora marcadas, pela conta conectada do cliente. "
          : "A publicação automática no Instagram e no Facebook ainda não está configurada no servidor (falta o aplicativo da Meta). "}
        TikTok, YouTube, LinkedIn e os agendamentos criados à mão funcionam como calendário interno: marque como publicado quando postar.
      </Alert>

      {tab === "agendamentos" && <Schedules publications={publications} clients={clients} onOpen={setPubModal} />}
      {tab === "metricas" && (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Métricas ainda não disponíveis"
            description="Os números de alcance, engajamento e seguidores vêm das redes depois da conexão oficial das contas (Fase 9)."
          />
        </Card>
      )}
      {tab === "contas" && <Accounts accounts={accounts} clients={clients} canEdit={canEdit} onOpen={setAccModal} />}
      {linkOpen && pending.length > 0 && <LinkAccountsModal pending={pending} clients={clients} onClose={() => setLinkOpen(false)} />}

      {pubModal && (
        <PublicationModal
          key={pubModal === "new" ? "new" : pubModal.id}
          pub={pubModal === "new" ? null : pubModal}
          clients={clients}
          accounts={accounts}
          canEdit={canEdit}
          onClose={() => setPubModal(null)}
        />
      )}
      {accModal && <AccountModal account={accModal === "new" ? null : accModal} clients={clients} onClose={() => setAccModal(null)} />}
    </>
  );
}

// ---------- Agendamentos ----------
function Schedules({ publications, clients, onOpen }: { publications: PublicationView[]; clients: Client[]; onOpen: (p: PublicationView) => void }) {
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  const [month, setMonth] = useState(today());
  const [client, setClient] = useState("");
  const [network, setNetwork] = useState("");
  const [status, setStatus] = useState("");
  const list = useMemo(
    () =>
      publications.filter(
        (p) => (!client || p.client_id === client) && (!network || p.network === network) && (!status ? p.status !== "cancelado" : p.status === status),
      ),
    [publications, client, network, status],
  );
  const upcoming = list.filter((p) => dayOf(p.scheduled_at) >= today());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Visão"
          value={view}
          onChange={setView}
          options={[
            { value: "calendario", label: "Calendário" },
            { value: "lista", label: "Próximos" },
          ]}
        />
        <FilterMenu label="Cliente" value={client} onChange={setClient} options={[{ value: "", label: "Todos os clientes" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        <FilterMenu label="Rede" value={network} onChange={setNetwork} options={[{ value: "", label: "Todas as redes" }, ...NETWORK_IDS.map((n) => ({ value: n, label: NETWORKS[n] }))]} />
        <FilterMenu
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Agendados e publicados" },
            { value: "agendado", label: "Agendados" },
            { value: "publicado", label: "Publicados" },
            { value: "erro", label: "Falharam" },
            { value: "cancelado", label: "Cancelados" },
          ]}
        />
      </div>
      {view === "calendario" ? (
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          items={list.map((p) => ({
            id: p.id,
            day: dayOf(p.scheduled_at),
            label: `${timeOf(p.scheduled_at)} ${NETWORKS[p.network]} · ${p.title}`,
            color: p.clientColor,
            muted: p.status !== "agendado",
            onClick: () => onOpen(p),
          }))}
        />
      ) : upcoming.length === 0 ? (
        <Card>
          <EmptyState icon={List} title="Nada agendado daqui para frente" description="Crie um agendamento ou leve um post aprovado para o calendário." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-3 lift rounded-card bg-surface p-3 text-left hover:ring-2 hover:ring-brand">
                <MediaThumb media={p.media} className="size-12 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="flex items-center gap-1 truncate text-[11px] text-muted">
                    {p.auto && <Zap className="size-3 shrink-0 text-info" aria-label="Publicação automática" />}
                    {p.clientName} · {NETWORKS[p.network]}
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block capitalize">{weekdayDate(dayOf(p.scheduled_at))}</span>
                  <span className="text-muted">{timeOf(p.scheduled_at)}</span>
                </span>
                <Badge tone={PUBLICATION_STATUS[p.status].tone}>{PUBLICATION_STATUS[p.status].label}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublicationModal({
  pub,
  clients,
  accounts,
  canEdit,
  onClose,
}: {
  pub: PublicationView | null;
  clients: Client[];
  accounts: SocialAccountRow[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PublicationFormValues, unknown, z.output<typeof publicationSchema>>({
    resolver: zodResolver(publicationSchema),
    defaultValues: {
      client_id: pub?.client_id ?? "",
      network: pub?.network ?? "instagram",
      account_id: pub?.account_id ?? "",
      title: pub?.title ?? "",
      caption: pub?.caption ?? "",
      scheduled_at: isoToLocalInput(pub?.scheduled_at ?? null) || `${today()}T09:00`,
      // "publicando" e "erro" são do robô: no formulário a escolha é entre agendado, publicado e cancelado
      status: pub && (pub.status === "publicado" || pub.status === "cancelado") ? pub.status : "agendado",
    },
  });
  const clientId = watch("client_id");
  const network = watch("network");
  const options = accounts.filter((a) => a.client_id === clientId && a.network === network);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      onClose();
      router.refresh();
    });

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={pub ? (canEdit ? "Editar" : "Ver") : "Novo"}
      accent="agendamento"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {pub && canEdit && (
            <>
              {pub.status === "erro" && (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => setPublicationStatus(pub.id, "agendado"))}>
                  <RotateCcw /> Tentar de novo
                </Button>
              )}
              {pub.status === "agendado" && (
                <>
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => setPublicationStatus(pub.id, "publicado"))}>
                    <CheckCircle2 /> Marcar como publicado
                  </Button>
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => setPublicationStatus(pub.id, "cancelado"))}>
                    <XCircle /> Cancelar
                  </Button>
                </>
              )}
              {(pub.status === "publicado" || pub.status === "cancelado") && (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => setPublicationStatus(pub.id, "agendado"))}>
                  <Undo2 /> Voltar para agendado
                </Button>
              )}
              {pub.status !== "publicando" && (confirmDelete ? (
                <Button variant="danger" size="sm" loading={pending} onClick={() => act(() => deletePublication(pub.id))}>
                  Confirmar exclusão
                </Button>
              ) : (
                <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              ))}
            </>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {canEdit && pub?.status !== "publicando" && (
            <Button type="submit" form="form-agendamento" loading={pending}>
              Salvar
            </Button>
          )}
        </div>
      }
    >
      <form
        id="form-agendamento"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(() => act(() => savePublication(pub?.id ?? null, getValues())))}
      >
        {error && <Alert>{error}</Alert>}
        {pub?.status === "publicando" && <Alert tone="info">Publicando agora. Em alguns minutos o resultado aparece aqui.</Alert>}
        {pub?.last_error && pub.status !== "publicado" && (
          <Alert>
            {pub.status === "erro" ? "A publicação automática falhou" : `Tentativa ${pub.attempts} falhou, nova tentativa em alguns minutos`}: {pub.last_error}
          </Alert>
        )}
        {pub && (
          <div className="flex items-center gap-3">
            <MediaThumb media={pub.media} className="size-16 shrink-0 rounded-lg" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="flex flex-wrap gap-1">
                <Badge tone={PUBLICATION_STATUS[pub.status].tone}>{PUBLICATION_STATUS[pub.status].label}</Badge>
                {pub.auto && (
                  <Badge tone="info">
                    <Zap className="size-3" aria-hidden /> Automática
                  </Badge>
                )}
              </span>
              {pub.permalink && (
                <a href={pub.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  <ExternalLink className="size-3" aria-hidden /> Ver na rede
                </a>
              )}
              {pub.post_id && (
                <Link href={`/aprovacoes?envio=${pub.post_id}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  <ExternalLink className="size-3" aria-hidden /> Ver o post na Aprovação
                </Link>
              )}
            </div>
          </div>
        )}
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="pub-client" required error={errors.client_id?.message}>
              <Select id="pub-client" {...register("client_id", { onChange: () => setValue("account_id", "") })}>
                <option value="">Escolha</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rede" htmlFor="pub-network">
              <Select id="pub-network" {...register("network", { onChange: () => setValue("account_id", "") })}>
                {NETWORK_IDS.map((n) => (
                  <option key={n} value={n}>
                    {NETWORKS[n]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Conta" htmlFor="pub-account" hint={clientId && !options.length ? "Nenhuma conta desta rede cadastrada para o cliente." : undefined}>
              <Select id="pub-account" disabled={!options.length} {...register("account_id")}>
                <option value="">Sem conta</option>
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data e hora" htmlFor="pub-when" required error={errors.scheduled_at?.message} hint="Horário de Brasília.">
              <Input id="pub-when" type="datetime-local" {...register("scheduled_at")} />
            </Field>
          </div>
          <Field label="Título" htmlFor="pub-title" required error={errors.title?.message}>
            <Input id="pub-title" {...register("title")} />
          </Field>
          <Field label="Legenda" htmlFor="pub-caption" error={errors.caption?.message}>
            <Textarea id="pub-caption" rows={5} maxLength={5000} {...register("caption")} />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}

// ---------- Contas ----------
function Accounts({
  accounts,
  clients,
  canEdit,
  onOpen,
}: {
  accounts: SocialAccountRow[];
  clients: Client[];
  canEdit: boolean;
  onOpen: (a: SocialAccountRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const withAccounts = clients.filter((c) => accounts.some((a) => a.client_id === c.id));
  if (!accounts.length) {
    return (
      <Card>
        <EmptyState icon={AtSign} title="Nenhuma conta cadastrada" description="Cadastre o perfil de cada cliente em cada rede para usar nos agendamentos." />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      {withAccounts.map((c) => (
        <section key={c.id} aria-label={c.name} className="rounded-card bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: c.color ?? "var(--muted-2)" }} aria-hidden />
            {c.name}
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {accounts
              .filter((a) => a.client_id === c.id)
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                  <NetworkBadge network={a.network} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {/* Página do Facebook tem nome, não @ */}
                    {a.profile_url ? (
                      <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                        {a.network === "facebook" && a.connection !== "manual" ? a.username : `@${a.username}`}
                      </a>
                    ) : (
                      `@${a.username}`
                    )}
                  </span>
                  {a.connection === "conectada" ? (
                    <Badge tone="success-soft">
                      <Link2 className="size-3" aria-hidden /> Publicação automática
                    </Badge>
                  ) : a.connection === "erro" ? (
                    <Badge tone="danger" title={a.last_error ?? undefined}>
                      <AlertTriangle className="size-3" aria-hidden /> Reconecte a conta
                    </Badge>
                  ) : (
                    <Badge>
                      <Link2Off className="size-3" aria-hidden /> Sem conexão automática
                    </Badge>
                  )}
                  {canEdit && (
                    <span className="flex gap-1">
                      {a.connection !== "manual" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await disconnectAccount(a.id);
                              if (!r.ok) return setError(r.error);
                              router.refresh();
                            })
                          }
                        >
                          <Unplug /> Desconectar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onOpen(a)}>
                        Editar
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Excluir @${a.username}`}
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await deleteAccount(a.id);
                            if (!r.ok) return setError(r.error);
                            router.refresh();
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Depois da conexão com a Meta: a pessoa diz de qual cliente é cada Página/Instagram encontrado. */
function LinkAccountsModal({ pending, clients, onClose }: { pending: PendingAccount[]; clients: Client[]; onClose: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(pending.map((p) => [p.key, p.suggested_client ?? ""])),
  );
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const chosen = Object.values(choice).filter(Boolean).length;

  const close = () => {
    onClose();
    // tira o ?conectar=1 do endereço para a janela não voltar ao recarregar
    router.replace("/social");
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && close()}
      title="Contas encontradas"
      accent="na Meta"
      description="Escolha o cliente de cada conta. As que ficarem sem cliente não são conectadas."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Agora não
          </Button>
          <Button
            loading={busy}
            disabled={!chosen}
            onClick={() =>
              start(async () => {
                const r = await linkMetaAccounts(pending.map((p) => ({ key: p.key, client_id: choice[p.key] ?? "" })));
                if (!r.ok) return setError(r.error);
                close();
                router.refresh();
              })
            }
          >
            Conectar {chosen ? `${chosen} conta(s)` : ""}
          </Button>
        </>
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      <ul className="flex flex-col divide-y divide-line">
        {pending.map((p) => (
          <li key={p.key} className="flex flex-wrap items-center gap-3 py-2">
            {p.picture_url ? (
              // foto de perfil vem do CDN da Meta; sem otimização do Next
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.picture_url} alt="" className="size-8 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="size-8 shrink-0 rounded-full bg-surface-3" aria-hidden />
            )}
            <NetworkBadge network={p.network} />
            <span className="min-w-0 flex-1 truncate text-sm">{p.network === "instagram" ? `@${p.username}` : p.username}</span>
            <Select
              aria-label={`Cliente de ${p.username} (${NETWORKS[p.network]})`}
              className="w-full sm:w-56"
              value={choice[p.key] ?? ""}
              onChange={(e) => setChoice((c) => ({ ...c, [p.key]: e.target.value }))}
            >
              <option value="">Não conectar</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function NetworkBadge({ network }: { network: SocialNetworkT }) {
  return <span className="w-20 shrink-0 text-xs font-medium">{NETWORKS[network]}</span>;
}

function AccountModal({ account, clients, onClose }: { account: SocialAccountRow | null; clients: Client[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.input<typeof accountSchema>, unknown, z.output<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      client_id: account?.client_id ?? "",
      network: account?.network ?? "instagram",
      username: account?.username ?? "",
      profile_url: account?.profile_url ?? "",
    },
  });
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={account ? "Editar" : "Adicionar"}
      accent="conta"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-conta" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="form-conta"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(() =>
          start(async () => {
            const r = await saveAccount(account?.id ?? null, getValues());
            if (!r.ok) return setError(r.error);
            onClose();
            router.refresh();
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Cliente" htmlFor="acc-client" required error={errors.client_id?.message}>
          <Select id="acc-client" {...register("client_id")}>
            <option value="">Escolha</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rede" htmlFor="acc-network">
          <Select id="acc-network" {...register("network")}>
            {NETWORK_IDS.map((n) => (
              <option key={n} value={n}>
                {NETWORKS[n]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usuário" htmlFor="acc-user" required error={errors.username?.message}>
          <Input id="acc-user" placeholder="@perfil" {...register("username")} />
        </Field>
        <Field label="Endereço do perfil" htmlFor="acc-url" error={errors.profile_url?.message}>
          <Input id="acc-url" type="url" placeholder="https://" {...register("profile_url")} />
        </Field>
        <p className="text-[11px] text-muted">
          A conexão pelo login da rede (para publicar e ler métricas) chega com as integrações. Aqui fica só o cadastro do perfil.
        </p>
      </form>
    </Modal>
  );
}
