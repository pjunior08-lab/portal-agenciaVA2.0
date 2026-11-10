"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MoreHorizontal, Network, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  MenuTrigger,
  Modal,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { MAP_TEMPLATES, mapMetaSchema, mapSchema, type MapTemplate } from "@/features/canvas/schemas";
import { createMap, deleteMap, updateMapMeta } from "@/features/mapa-mental/actions";

interface MapRow {
  id: string;
  title: string;
  template: MapTemplate;
  client_id: string;
  updated_at: string;
}
interface ClientRow {
  id: string;
  name: string;
}
const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function MapsApp({
  maps,
  clients,
  canEdit,
}: {
  maps: MapRow[];
  clients: ClientRow[];
  canEdit: boolean;
}) {
  const [client, setClient] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"new" | MapRow | null>(null);
  const [confirm, setConfirm] = useState<MapRow | null>(null);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Cliente";

  const groups = useMemo(() => {
    const list = maps.filter(
      (m) =>
        (!client || m.client_id === client) &&
        (!q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase())),
    );
    const by = new Map<string, MapRow[]>();
    for (const m of list) by.set(m.client_id, [...(by.get(m.client_id) ?? []), m]);
    return [...by]
      .map(([id, items]) => ({ id, name: clientName(id), items }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, client, q, clients]);

  return (
    <>
      <PageHeader
        title="Mapa Mental"
        icon={Network}
        actions={
          canEdit && (
            <Button onClick={() => setModal("new")} disabled={!clients.length}>
              <Plus /> Novo mapa
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            aria-label="Buscar mapa"
            placeholder="Buscar mapa…"
            className="h-9 pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          aria-label="Cliente"
          className="h-9 w-auto"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Network}
            title={maps.length ? "Nada com esses filtros" : "Nenhum mapa ainda"}
            description={
              !clients.length
                ? "Cadastre um cliente antes: cada mapa pertence a um cliente."
                : maps.length
                  ? "Ajuste a busca ou o cliente."
                  : "Crie um mapa em branco ou a partir de um modelo."
            }
            action={
              canEdit && !maps.length && clients.length ? (
                <Button onClick={() => setModal("new")}>Novo mapa</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.id} aria-label={g.name}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.name}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((m) => (
                  <li key={m.id} className="group relative lift rounded-card bg-surface p-4">
                    <Link href={`/mapa-mental/${m.id}`} className="flex flex-col gap-2 pr-8">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft">
                        <Network className="size-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium">{m.title}</span>
                      <span className="text-[11px] text-muted">
                        {MAP_TEMPLATES[m.template]?.label ?? "Em branco"} · atualizado{" "}
                        {when.format(new Date(m.updated_at))}
                      </span>
                    </Link>
                    {canEdit && (
                      <Menu>
                        <MenuTrigger asChild>
                          <button
                            type="button"
                            className="absolute top-3 right-3 rounded-full p-1.5 text-muted hover:bg-surface-2"
                            aria-label={`Opções de ${m.title}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuItem onSelect={() => setModal(m)}>
                            <Pencil className="size-4" /> Renomear ou trocar cliente
                          </MenuItem>
                          <MenuItem className="text-danger" onSelect={() => setConfirm(m)}>
                            <Trash2 className="size-4" /> Excluir
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal === "new" && (
        <NewMapModal clients={clients} defaultClient={client} onClose={() => setModal(null)} />
      )}
      {modal && modal !== "new" && (
        <EditMapModal map={modal} clients={clients} onClose={() => setModal(null)} />
      )}
      {confirm && <DeleteModal map={confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

function NewMapModal({
  clients,
  defaultClient,
  onClose,
}: {
  clients: ClientRow[];
  defaultClient: string;
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
  } = useForm<z.input<typeof mapSchema>>({
    resolver: zodResolver(mapSchema),
    defaultValues: { title: "", client_id: defaultClient, template: "em_branco" },
  });
  const template = watch("template");
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Novo"
      accent="mapa"
      footer={
        <Button type="submit" form="form-mapa" loading={pending}>
          Criar e abrir
        </Button>
      }
    >
      <form
        id="form-mapa"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await createMap(v);
            if (!r.ok) return setError(r.error);
            router.push(`/mapa-mental/${r.data!.id}`);
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field
          label="Título (vira a ideia central)"
          htmlFor="mm-title"
          required
          error={errors.title?.message}
        >
          <Input id="mm-title" {...register("title")} placeholder="Ex.: Campanha de Natal" autoFocus />
        </Field>
        <Field label="Cliente" htmlFor="mm-client" required error={errors.client_id?.message}>
          <Select id="mm-client" {...register("client_id")}>
            <option value="">Escolha…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Modelo</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modelo do mapa">
            {(Object.keys(MAP_TEMPLATES) as MapTemplate[]).map((k) => (
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
                <span className="font-medium">{MAP_TEMPLATES[k].label}</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {MAP_TEMPLATES[k].branches.length
                    ? MAP_TEMPLATES[k].branches.map((b) => b.label).join(", ")
                    : "Só a ideia central"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function EditMapModal({ map, clients, onClose }: { map: MapRow; clients: ClientRow[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof mapMetaSchema>>({
    resolver: zodResolver(mapMetaSchema),
    defaultValues: { title: map.title, client_id: map.client_id },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Editar"
      accent="mapa"
      size="sm"
      footer={
        <Button type="submit" form="form-mapa-meta" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-mapa-meta"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await updateMapMeta(map.id, v);
            if (!r.ok) return setError(r.error);
            router.refresh();
            onClose();
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Título" htmlFor="mme-title" required error={errors.title?.message}>
          <Input id="mme-title" {...register("title")} autoFocus />
        </Field>
        <Field label="Cliente" htmlFor="mme-client" required error={errors.client_id?.message}>
          <Select id="mme-client" {...register("client_id")}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function DeleteModal({ map, onClose }: { map: MapRow; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Excluir"
      accent="mapa"
      size="sm"
      description={map.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteMap(map.id);
                if (!r.ok) return setError(r.error);
                router.refresh();
                onClose();
              })
            }
          >
            Excluir de vez
          </Button>
        </>
      }
    >
      {error ? (
        <Alert>{error}</Alert>
      ) : (
        <p className="text-sm text-muted">
          O mapa e todas as ideias dele serão apagados. Não dá para desfazer.
        </p>
      )}
    </Modal>
  );
}
