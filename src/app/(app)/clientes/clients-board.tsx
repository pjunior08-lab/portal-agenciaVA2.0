"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Button, Card, EmptyState, FilterMenu, Input } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import type { ClientRow, ClientStatusT } from "@/lib/supabase/database.types";
import { CLIENT_STATUS } from "@/features/clientes/schemas";
import { ClientAvatar, SEGMENT_ICONS } from "@/features/clientes/ui";
import { ClientFormModal } from "@/features/clientes/client-form";

type StatusFilter = "todos" | ClientStatusT;
type Sort = "nome" | "mensalidade" | "recentes";

export function ClientsBoard({
  clients,
  logoUrls,
  canEdit,
}: {
  clients: ClientRow[];
  logoUrls: Record<string, string>;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [sort, setSort] = useState<Sort>("nome");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: 0 };
    for (const cl of clients) {
      if (cl.status !== "arquivado") c.todos++;
      c[cl.status] = (c[cl.status] ?? 0) + 1;
    }
    return c;
  }, [clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clients.filter(
      (c) =>
        (status === "todos" ? c.status !== "arquivado" : c.status === status) &&
        (!q || c.name.toLowerCase().includes(q) || (c.contact_name ?? "").toLowerCase().includes(q)),
    );
    return list.sort((a, b) =>
      sort === "mensalidade"
        ? (b.monthly_fee ?? 0) - (a.monthly_fee ?? 0)
        : sort === "recentes"
          ? b.created_at.localeCompare(a.created_at)
          : a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [clients, query, status, sort]);

  const monthly = clients.filter((c) => c.status === "ativo").reduce((s, c) => s + (c.monthly_fee ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Clientes"
        icon={Users}
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Novo cliente
            </Button>
          )
        }
      >
        <Badge>{counts.ativo ?? 0} ativos</Badge>
        {monthly > 0 && <Badge tone="brand">{formatBRL(monthly)}/mês</Badge>}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            aria-label="Buscar cliente"
            placeholder="Buscar cliente ou contato"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 bg-surface pl-9"
          />
        </div>
        <FilterMenu
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "todos", label: `Todos (${counts.todos})` },
            ...(Object.keys(CLIENT_STATUS) as ClientStatusT[]).map((k) => ({
              value: k,
              label: `${CLIENT_STATUS[k].label} (${counts[k] ?? 0})`,
            })),
          ]}
        />
        <FilterMenu
          label="Ordenar"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          icon={<ArrowUpDown className="size-3.5 text-muted" aria-hidden />}
          options={[
            { value: "nome", label: "Nome (A–Z)" },
            { value: "mensalidade", label: "Maior mensalidade" },
            { value: "recentes", label: "Mais recentes" },
          ]}
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description="Cadastre o primeiro cliente para organizar demandas, aprovações e cobranças."
            action={
              canEdit && (
                <Button onClick={() => setCreating(true)}>
                  <Plus /> Novo cliente
                </Button>
              )
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nenhum cliente encontrado" description="Mude a busca ou o filtro de status." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const Seg = c.segment_icon ? SEGMENT_ICONS[c.segment_icon]?.icon : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-card bg-surface transition-shadow hover:shadow-md focus-visible:shadow-md"
                >
                  <div className="h-14" style={{ background: c.cover_color ?? "var(--panel)" }} aria-hidden />
                  <div className="-mt-7 flex flex-1 flex-col gap-3 px-4 pb-4">
                    <div className="flex items-end justify-between gap-2">
                      <ClientAvatar
                        name={c.name}
                        color={c.cover_color}
                        lightUrl={c.logo_light_path ? logoUrls[c.logo_light_path] : null}
                        darkUrl={c.logo_dark_path ? logoUrls[c.logo_dark_path] : null}
                        className="ring-4 ring-surface"
                      />
                      <Badge tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Badge>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium group-hover:underline">
                        {Seg && <Seg className="size-3.5 shrink-0 text-muted" aria-hidden />}
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-muted">{c.contact_name ?? "Sem contato cadastrado"}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-xs text-muted">
                      <span>{c.monthly_fee != null ? `${formatBRL(c.monthly_fee)}/mês` : "Sem mensalidade"}</span>
                      {c.billing_day && <span>Vence dia {c.billing_day}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && <ClientFormModal open={creating} onOpenChange={setCreating} />}
    </>
  );
}
