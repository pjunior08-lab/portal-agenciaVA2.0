"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Filter,
  Folder,
  FolderPlus,
  Inbox,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { FUNNEL_TEMPLATES, folderSchema, funnelSchema } from "@/features/canvas/schemas";
import {
  createFunnel,
  deleteFolder,
  deleteFunnelForever,
  emptyTrash,
  restoreFunnel,
  saveFolder,
  trashFunnel,
  updateFunnelMeta,
} from "@/features/funil/actions";

interface FunnelRow {
  id: string;
  name: string;
  template: string;
  folder_id: string | null;
  client_id: string | null;
  deleted_at: string | null;
  updated_at: string;
}
interface Named {
  id: string;
  name: string;
}
type View = "todos" | "sem-pasta" | "lixeira" | string;
const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function FunnelsApp({
  funnels,
  folders,
  clients,
  canEdit,
}: {
  funnels: FunnelRow[];
  folders: Named[];
  clients: Named[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("todos");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"new" | "folder" | { folder: Named } | { funnel: FunnelRow } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const alive = funnels.filter((f) => !f.deleted_at);
  const trash = funnels.filter((f) => f.deleted_at);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Não foi possível concluir.");
      router.refresh();
    });

  const list = useMemo(() => {
    const base =
      view === "lixeira"
        ? trash
        : view === "todos"
          ? alive
          : view === "sem-pasta"
            ? alive.filter((f) => !f.folder_id)
            : alive.filter((f) => f.folder_id === view);
    return base.filter((f) => !q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()));
  }, [view, q, alive, trash]);
  const name = (rows: Named[], id: string | null) => rows.find((r) => r.id === id)?.name;
  const currentFolder = folders.find((f) => f.id === view);
  const nav = [
    { id: "todos", label: "Todos", icon: Layers, count: alive.length },
    { id: "sem-pasta", label: "Sem pasta", icon: Inbox, count: alive.filter((f) => !f.folder_id).length },
  ];

  return (
    <>
      <PageHeader
        title="Funil"
        icon={Filter}
        actions={
          canEdit && (
            <Button onClick={() => setModal("new")}>
              <Plus /> Novo funil
            </Button>
          )
        }
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr] [&>*]:min-w-0">
        <nav aria-label="Pastas" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {nav.map((n) => (
            <FolderButton
              key={n.id}
              active={view === n.id}
              onClick={() => setView(n.id)}
              icon={n.icon}
              label={n.label}
              count={n.count}
            />
          ))}
          {folders.map((f) => (
            <div key={f.id} className="group relative flex shrink-0 items-center">
              <FolderButton
                active={view === f.id}
                onClick={() => setView(f.id)}
                icon={Folder}
                label={f.name}
                count={alive.filter((x) => x.folder_id === f.id).length}
              />
              {canEdit && (
                <Menu>
                  <MenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-1 rounded-full p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-surface focus:opacity-100"
                      aria-label={`Opções da pasta ${f.name}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem onSelect={() => setModal({ folder: f })}>
                      <Pencil className="size-4" /> Renomear
                    </MenuItem>
                    <MenuItem
                      className="text-danger"
                      onSelect={() => {
                        if (view === f.id) setView("todos");
                        run(() => deleteFolder(f.id));
                      }}
                    >
                      <Trash2 className="size-4" /> Apagar pasta (os funis ficam sem pasta)
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </div>
          ))}
          {canEdit && (
            <button
              type="button"
              onClick={() => setModal("folder")}
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-ink"
            >
              <FolderPlus className="size-4" aria-hidden /> Nova pasta
            </button>
          )}
          <div className="lg:mt-3 lg:border-t lg:border-line lg:pt-3">
            <FolderButton
              active={view === "lixeira"}
              onClick={() => setView("lixeira")}
              icon={Trash2}
              label="Lixeira"
              count={trash.length}
            />
          </div>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                aria-label="Buscar funil"
                placeholder="Buscar funil…"
                className="h-9 pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {view === "lixeira" && (
              <>
                <span className="text-xs text-muted">
                  Itens na lixeira são apagados de vez depois de 30 dias.
                </span>
                {canEdit && trash.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-danger"
                    loading={pending}
                    onClick={() => run(emptyTrash)}
                  >
                    Esvaziar lixeira
                  </Button>
                )}
              </>
            )}
          </div>

          {list.length === 0 ? (
            <Card>
              <EmptyState
                icon={view === "lixeira" ? Trash2 : Filter}
                title={
                  view === "lixeira"
                    ? "Lixeira vazia"
                    : q
                      ? "Nada encontrado"
                      : currentFolder
                        ? `Nenhum funil em ${currentFolder.name}`
                        : "Nenhum funil ainda"
                }
                description={
                  view === "lixeira" || q ? undefined : "Comece em branco ou a partir de um modelo."
                }
                action={
                  canEdit && view !== "lixeira" && !q ? (
                    <Button onClick={() => setModal("new")}>Novo funil</Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((f) => (
                <li
                  key={f.id}
                  className={cn(
                    "relative rounded-card bg-surface p-4 hover:shadow-sm",
                    f.deleted_at && "opacity-75",
                  )}
                >
                  <Link href={`/funil/${f.id}`} className="flex flex-col gap-1.5 pr-8">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-info-soft text-info">
                      <Filter className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className="text-[11px] text-muted">
                      {[name(folders, f.folder_id), name(clients, f.client_id)].filter(Boolean).join(" · ") ||
                        "Sem pasta"}
                    </span>
                    <span className="text-[11px] text-muted-2">
                      {f.deleted_at
                        ? `Na lixeira desde ${when.format(new Date(f.deleted_at))}`
                        : `Atualizado ${when.format(new Date(f.updated_at))}`}
                    </span>
                  </Link>
                  {canEdit && (
                    <Menu>
                      <MenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute top-3 right-3 rounded-full p-1.5 text-muted hover:bg-surface-2"
                          aria-label={`Opções de ${f.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </MenuTrigger>
                      <MenuContent align="end">
                        {f.deleted_at ? (
                          <>
                            <MenuItem onSelect={() => run(() => restoreFunnel(f.id))}>
                              <RotateCcw className="size-4" /> Restaurar
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              className="text-danger"
                              onSelect={() => run(() => deleteFunnelForever(f.id))}
                            >
                              <Trash2 className="size-4" /> Excluir de vez
                            </MenuItem>
                          </>
                        ) : (
                          <>
                            <MenuItem onSelect={() => setModal({ funnel: f })}>
                              <Pencil className="size-4" /> Renomear, pasta e cliente
                            </MenuItem>
                            <MenuItem className="text-danger" onSelect={() => run(() => trashFunnel(f.id))}>
                              <Trash2 className="size-4" /> Mandar para a lixeira
                            </MenuItem>
                          </>
                        )}
                      </MenuContent>
                    </Menu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modal === "new" && (
        <FunnelModal
          funnel={null}
          folders={folders}
          clients={clients}
          defaultFolder={currentFolder?.id ?? ""}
          onClose={() => setModal(null)}
        />
      )}
      {modal && typeof modal === "object" && "funnel" in modal && (
        <FunnelModal
          funnel={modal.funnel}
          folders={folders}
          clients={clients}
          defaultFolder=""
          onClose={() => setModal(null)}
        />
      )}
      {(modal === "folder" || (modal && typeof modal === "object" && "folder" in modal)) && (
        <FolderModal
          folder={typeof modal === "object" && "folder" in modal ? modal.folder : null}
          onClose={() => setModal(null)}
          onCreated={(id) => setView(id)}
        />
      )}
    </>
  );
}

function FolderButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Folder;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full shrink-0 items-center gap-2 rounded-xl px-3 py-2 pr-8 text-left text-sm whitespace-nowrap",
        active ? "bg-brand text-brand-ink" : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[11px] tabular-nums">{count}</span>
    </button>
  );
}

function FunnelModal({
  funnel,
  folders,
  clients,
  defaultFolder,
  onClose,
}: {
  funnel: FunnelRow | null;
  folders: Named[];
  clients: Named[];
  defaultFolder: string;
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
  } = useForm<z.input<typeof funnelSchema>, unknown, z.output<typeof funnelSchema>>({
    // na edição o modelo não muda; o servidor só lê nome, pasta e cliente
    resolver: zodResolver(funnelSchema),
    defaultValues: {
      name: funnel?.name ?? "",
      folder_id: funnel?.folder_id ?? defaultFolder,
      client_id: funnel?.client_id ?? "",
      template: funnel?.template ?? "em_branco",
    },
  });
  const template = watch("template");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={funnel ? "Editar" : "Novo"}
      accent="funil"
      size={funnel ? "sm" : "md"}
      footer={
        <Button type="submit" form="form-funil" loading={pending}>
          {funnel ? "Salvar" : "Criar e abrir"}
        </Button>
      }
    >
      <form
        id="form-funil"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            if (funnel) {
              const r = await updateFunnelMeta(funnel.id, v);
              if (!r.ok) return setError(r.error);
              router.refresh();
              return onClose();
            }
            const r = await createFunnel(v);
            if (!r.ok) return setError(r.error);
            router.push(`/funil/${r.data!.id}`);
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Nome" htmlFor="fn-name" required error={errors.name?.message}>
          <Input id="fn-name" {...register("name")} placeholder="Ex.: Lançamento curso de março" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pasta" htmlFor="fn-folder">
            <Select id="fn-folder" {...register("folder_id")}>
              <option value="">Sem pasta</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cliente (opcional)" htmlFor="fn-client">
            <Select id="fn-client" {...register("client_id")}>
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!funnel && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">Modelo</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modelo de funil">
              {Object.entries(FUNNEL_TEMPLATES).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={template === k}
                  onClick={() => setValue("template", k)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left text-sm",
                    template === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
                  )}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {t.steps.length ? t.steps.map(([, l]) => l).join(" → ") : "Comece do zero"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}

function FolderModal({
  folder,
  onClose,
  onCreated,
}: {
  folder: Named | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof folderSchema>>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: folder?.name ?? "" },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={folder ? "Renomear" : "Nova"}
      accent="pasta"
      size="sm"
      footer={
        <Button type="submit" form="form-pasta" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-pasta"
        noValidate
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await saveFolder(folder?.id ?? null, v);
            if (!r.ok) return setError(r.error);
            router.refresh();
            if (!folder) onCreated(r.data!.id);
            onClose();
          }),
        )}
      >
        {error && <Alert className="mb-3">{error}</Alert>}
        <Field label="Nome da pasta" htmlFor="fd-name" required error={errors.name?.message}>
          <Input id="fd-name" {...register("name")} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
