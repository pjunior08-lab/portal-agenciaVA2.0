"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  LogOut,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ChatThread } from "@/features/comunicacao/chat-thread";
import {
  groupSchema,
  initials,
  timeOf,
  dayLabel,
  type ChatMessage,
  type GroupFormValues,
} from "@/features/comunicacao/schemas";
import { leaveGroup, openClientConversation, openDirect, saveGroup } from "@/features/comunicacao/actions";

export interface ConversationItem {
  id: string;
  kind: "direta" | "grupo" | "cliente";
  title: string;
  clientId: string | null;
  portalChat: boolean | null;
  members: string[];
  createdBy: string | null;
  lastAt: string | null;
  preview: string | null;
  unread: number;
}
interface Person {
  id: string;
  name: string;
}

interface Props {
  me: string;
  isAdmin: boolean;
  canReplyClients: boolean;
  conversations: ConversationItem[];
  team: Person[];
  clients: { id: string; name: string; status: string; portalChat: boolean }[];
  selected: string | null;
  messages: ChatMessage[];
  hasMore: boolean;
}

export function ComunicacaoApp({
  me,
  isAdmin,
  canReplyClients,
  conversations,
  team,
  clients,
  selected,
  messages,
  hasMore,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"equipe" | "clientes">(
    conversations.find((c) => c.id === selected)?.kind === "cliente" ? "clientes" : "equipe",
  );
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"direta" | "grupo" | "cliente" | { edit: ConversationItem } | null>(
    null,
  );
  const current = conversations.find((c) => c.id === selected) ?? null;
  const [now] = useState(() => new Date().toISOString());

  // qualquer mensagem nova (que a pessoa pode ver) atualiza a lista: prévia, ordem e não lidas
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chat:lista")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 700);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const unreadTeam = conversations.filter((c) => c.kind !== "cliente").reduce((s, c) => s + c.unread, 0);
  const unreadClients = conversations.filter((c) => c.kind === "cliente").reduce((s, c) => s + c.unread, 0);
  const list = useMemo(
    () =>
      conversations.filter(
        (c) =>
          (tab === "clientes" ? c.kind === "cliente" : c.kind !== "cliente") &&
          (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [conversations, tab, q],
  );
  const nameOf = (id: string) => team.find((p) => p.id === id)?.name ?? "Ex-membro";

  return (
    <>
      <div className={cn(current && "hidden lg:block")}>
        <PageHeader title="Comunicação" icon={MessageCircle} />
      </div>
      <div className="grid h-[calc(100dvh-10rem)] min-h-[460px] overflow-hidden rounded-card bg-surface lg:grid-cols-[320px_1fr]">
        {/* lista */}
        <aside
          className={cn("flex min-h-0 flex-col border-line lg:border-r", current && "hidden lg:flex")}
          aria-label="Conversas"
        >
          <div className="flex flex-col gap-2 border-b border-line p-3">
            <SegmentedControl
              label="Tipo de conversa"
              value={tab}
              onChange={setTab}
              options={[
                { value: "equipe", label: `Equipe${unreadTeam ? ` (${unreadTeam})` : ""}` },
                { value: "clientes", label: `Clientes${unreadClients ? ` (${unreadClients})` : ""}` },
              ]}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <Input
                  aria-label="Buscar conversa"
                  placeholder="Buscar…"
                  className="h-9 pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon" aria-label="Nova conversa">
                    <MessageSquarePlus />
                  </Button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem onSelect={() => setModal("direta")}>
                    <Users className="size-4" /> Conversa com alguém da equipe
                  </MenuItem>
                  <MenuItem onSelect={() => setModal("grupo")}>
                    <UsersRound className="size-4" /> Novo grupo
                  </MenuItem>
                  <MenuItem onSelect={() => setModal("cliente")}>
                    <Building2 className="size-4" /> Conversa com cliente
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && (
              <li className="p-6 text-center text-xs text-muted">
                {q
                  ? "Nada encontrado."
                  : tab === "clientes"
                    ? "Nenhuma conversa com cliente ainda."
                    : "Nenhuma conversa ainda. Comece pelo botão acima."}
              </li>
            )}
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/comunicacao?c=${c.id}`}
                  aria-current={c.id === selected ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2",
                    c.id === selected && "bg-surface-2",
                  )}
                >
                  <Avatar item={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("flex-1 truncate text-sm", c.unread ? "font-semibold" : "font-medium")}
                      >
                        {c.title}
                      </span>
                      {c.lastAt && (
                        <span className="text-[10px] text-muted">
                          {dayLabel(c.lastAt, now) === "Hoje"
                            ? timeOf(c.lastAt)
                            : dayLabel(c.lastAt, now).split(",")[0]}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs text-muted">
                        {c.preview || (c.kind === "grupo" ? `${c.members.length} pessoas` : "Sem mensagens")}
                      </span>
                      {c.unread > 0 && (
                        <span
                          className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-ink"
                          aria-label={`${c.unread} não lidas`}
                        >
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* conversa */}
        <section
          className={cn("flex min-h-0 flex-col", !current && "hidden lg:flex")}
          aria-label={current ? `Conversa: ${current.title}` : "Conversa"}
        >
          {current ? (
            <>
              <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
                <Link
                  href="/comunicacao"
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
                  aria-label="Voltar para as conversas"
                >
                  <ArrowLeft className="size-4" />
                </Link>
                <Avatar item={current} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{current.title}</p>
                  <p className="truncate text-[11px] text-muted">
                    {current.kind === "grupo"
                      ? current.members.map(nameOf).join(", ")
                      : current.kind === "cliente"
                        ? current.portalChat
                          ? "O cliente vê e responde pelo Portal"
                          : "Seção Mensagens desligada no Portal: o cliente ainda não vê esta conversa"
                        : "Conversa direta"}
                  </p>
                </div>
                {current.kind === "cliente" && current.clientId && (
                  <Badge tone={current.portalChat ? "success" : "neutral"}>
                    {current.portalChat ? "Portal ativo" : "Portal sem Mensagens"}
                  </Badge>
                )}
                {current.kind === "grupo" && (
                  <GroupMenu
                    item={current}
                    canEdit={isAdmin || current.createdBy === me}
                    onEdit={() => setModal({ edit: current })}
                  />
                )}
              </header>
              <ChatThread
                key={current.id}
                conversationId={current.id}
                me={me}
                initial={messages}
                hasMore={hasMore}
                canPost={current.kind !== "cliente" || canReplyClients}
                readOnlyHint="Para responder clientes, peça acesso de edição à Comunicação."
                placeholder={
                  current.kind === "cliente" ? `Mensagem para ${current.title}…` : "Escreva uma mensagem…"
                }
              />
            </>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Escolha uma conversa"
              description="Ou comece uma nova pelo botão ao lado da busca."
              className="m-auto"
            />
          )}
        </section>
      </div>

      {modal === "direta" && (
        <DirectModal team={team.filter((p) => p.id !== me)} onClose={() => setModal(null)} />
      )}
      {modal === "cliente" && <ClientModal clients={clients} onClose={() => setModal(null)} />}
      {(modal === "grupo" || (modal && typeof modal === "object")) && (
        <GroupModal
          team={team.filter((p) => p.id !== me)}
          edit={typeof modal === "object" ? modal.edit : null}
          me={me}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function Avatar({ item }: { item: ConversationItem }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        item.kind === "cliente"
          ? "bg-brand-soft"
          : item.kind === "grupo"
            ? "bg-info-soft text-info"
            : "bg-surface-3",
      )}
      aria-hidden
    >
      {item.kind === "grupo" ? <UsersRound className="size-4" /> : initials(item.title)}
    </span>
  );
}

function GroupMenu({
  item,
  canEdit,
  onEdit,
}: {
  item: ConversationItem;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={pending}>
          Grupo
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {canEdit && (
          <MenuItem onSelect={onEdit}>
            <Pencil className="size-4" /> Editar nome e pessoas
          </MenuItem>
        )}
        <MenuItem
          className="text-danger"
          onSelect={() =>
            start(async () => {
              const r = await leaveGroup(item.id);
              if (r.ok) router.push("/comunicacao");
            })
          }
        >
          <LogOut className="size-4" /> Sair do grupo
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function DirectModal({ team, onClose }: { team: Person[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const list = team.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Conversa com" accent="a equipe" size="sm">
      <div className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <Input
          aria-label="Buscar pessoa"
          placeholder="Buscar pessoa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {list.length === 0 && <li className="py-4 text-center text-xs text-muted">Ninguém encontrado.</li>}
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() =>
                  start(async () => {
                    const r = await openDirect(p.id);
                    if (!r.ok) return setError(r.error);
                    onClose();
                    router.push(`/comunicacao?c=${r.data!.id}`);
                  })
                }
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold"
                  aria-hidden
                >
                  {initials(p.name)}
                </span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function ClientModal({ clients, onClose }: { clients: Props["clients"]; onClose: () => void }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const chosen = clients.find((c) => c.id === clientId);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Conversa com"
      accent="cliente"
      size="sm"
      footer={
        <Button
          loading={pending}
          disabled={!clientId}
          onClick={() =>
            start(async () => {
              const r = await openClientConversation(clientId);
              if (!r.ok) return setError(r.error);
              onClose();
              router.push(`/comunicacao?c=${r.data!.id}`);
            })
          }
        >
          Abrir conversa
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        {clients.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum cliente disponível (é preciso acesso ao módulo Clientes para listar).
          </p>
        ) : (
          <Field label="Cliente" htmlFor="chat-client">
            <Select id="chat-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Escolha…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {chosen && !chosen.portalChat && (
          <Alert tone="info">
            O cliente só vê as mensagens quando o Portal estiver ativo com a seção Mensagens ligada (Clientes
            › Portal).
          </Alert>
        )}
      </div>
    </Modal>
  );
}

function GroupModal({
  team,
  edit,
  me,
  onClose,
}: {
  team: Person[];
  edit: ConversationItem | null;
  me: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: edit?.title ?? "", members: edit?.members.filter((m) => m !== me) ?? [] },
  });
  const members = watch("members");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={edit ? "Editar" : "Novo"}
      accent="grupo"
      size="sm"
      footer={
        <Button type="submit" form="form-grupo" loading={pending}>
          {edit ? "Salvar" : "Criar grupo"}
        </Button>
      }
    >
      <form
        id="form-grupo"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await saveGroup(edit?.id ?? null, v);
            if (!r.ok) return setError(r.error);
            onClose();
            router.push(`/comunicacao?c=${r.data!.id}`);
            router.refresh();
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Nome do grupo" htmlFor="grp-name" required error={errors.name?.message}>
          <Input id="grp-name" {...register("name")} placeholder="Ex.: Atendimento" autoFocus />
        </Field>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-medium text-muted">Pessoas (você já entra)</legend>
          {errors.members?.message && <p className="text-xs text-danger">{errors.members.message}</p>}
          <div className="flex max-h-60 flex-col overflow-y-auto">
            {team.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={members.includes(p.id)}
                  onChange={(e) =>
                    setValue(
                      "members",
                      e.target.checked ? [...members, p.id] : members.filter((x) => x !== p.id),
                      { shouldValidate: true },
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
