"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, RichTextEditor, Select, Switch, Textarea } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import {
  CADENCES,
  CADENCE_IDS,
  filterServices,
  serviceSchema,
  type ServiceData,
  type ServiceInput,
  type ServiceRow,
} from "@/features/servicos/schemas";
import { deleteService, reorderServices, saveService } from "@/features/servicos/actions";

export function ServicesApp({ services, canEdit }: { services: ServiceRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<"new" | ServiceRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const list = filterServices(services, q, showInactive);
  const reordering = !q.trim() && showInactive;

  const move = (i: number, d: -1 | 1) => {
    const ids = services.map((s) => s.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    start(async () => {
      const r = await reorderServices(ids);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        title="Tabela de Serviços"
        icon={Tags}
        actions={
          canEdit && (
            <Button onClick={() => setModal("new")}>
              <Plus /> Novo serviço
            </Button>
          )
        }
      />
      <p className="-mt-2 mb-4 text-sm text-muted">
        Os serviços daqui aparecem no botão “Da tabela de serviços” das Propostas, já com preço, cobrança e escopo.
      </p>
      {error && <Alert className="mb-4">{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            className="w-full bg-transparent outline-none placeholder:text-muted-2"
            placeholder="Buscar serviço"
            aria-label="Buscar serviço"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label="Mostrar inativos" />
          Mostrar inativos
        </label>
        {canEdit && services.length > 1 && !reordering && (
          <span className="text-xs text-muted-2">Para mudar a ordem, ligue “Mostrar inativos” e limpe a busca.</span>
        )}
      </div>

      {services.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="Nenhum serviço cadastrado"
            description="Cadastre os serviços que a agência vende, com preço base e o que inclui."
            action={
              canEdit && (
                <Button onClick={() => setModal("new")}>
                  <Plus /> Cadastrar o primeiro
                </Button>
              )
            }
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nada encontrado" description="Tente outra busca." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => {
            const i = services.findIndex((x) => x.id === s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.name}
                    {!s.active && <Badge>Inativo</Badge>}
                  </p>
                  {s.description && <p className="truncate text-xs text-muted">{s.description}</p>}
                </div>
                <Badge tone={s.cadence === "unica" ? "neutral" : "info"}>{CADENCES[s.cadence].label}</Badge>
                <span className="w-32 text-right tabular-nums">
                  {formatBRL(s.unit_price)}
                  <span className="text-xs text-muted">{CADENCES[s.cadence].suffix}</span>
                </span>
                {canEdit && (
                  <span className="flex gap-1">
                    {reordering && (
                      <>
                        <Button size="icon-sm" variant="ghost" aria-label={`Subir ${s.name}`} disabled={pending || i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Descer ${s.name}`}
                          disabled={pending || i === services.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                      </>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => setModal(s)}>
                      <Pencil />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modal && <ServiceModal service={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}

function ServiceModal({ service, onClose }: { service: ServiceRow | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ServiceInput, unknown, ServiceData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      cadence: service?.cadence ?? "mensal",
      unit_price: service ? service.unit_price.toFixed(2).replace(".", ",") : "",
      scope_html: service?.scope_html ?? "",
      active: service?.active ?? true,
    },
  });

  const onSubmit = handleSubmit(() =>
    start(async () => {
      const r = await saveService(service?.id ?? null, getValues());
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    }),
  );

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={service ? "Editar" : "Novo"}
      accent="serviço"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {service &&
            (confirmDelete ? (
              <Button
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteService(service.id);
                    if (!r.ok) return setError(r.error);
                    onClose();
                    router.refresh();
                  })
                }
              >
                Confirmar exclusão
              </Button>
            ) : (
              <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </Button>
            ))}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-servico" loading={pending}>
            Salvar
          </Button>
        </div>
      }
    >
      <form id="form-servico" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nome do serviço" htmlFor="sv-name" error={errors.name?.message} required>
          <Input id="sv-name" placeholder="Ex.: Gestão de redes sociais" {...register("name")} />
        </Field>
        <Field label="Descrição curta" htmlFor="sv-desc" error={errors.description?.message} hint="Aparece na lista. Ex.: 12 posts + stories por semana.">
          <Textarea id="sv-desc" rows={2} {...register("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cobrança" htmlFor="sv-cad" error={errors.cadence?.message}>
            <Select id="sv-cad" {...register("cadence")}>
              {CADENCE_IDS.map((c) => (
                <option key={c} value={c}>
                  {CADENCES[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Preço base (R$)" htmlFor="sv-price" error={errors.unit_price?.message} required>
            <Input id="sv-price" inputMode="decimal" placeholder="0,00" {...register("unit_price")} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">O que inclui (vai para o escopo da proposta)</span>
          <Controller
            control={control}
            name="scope_html"
            render={({ field }) => <RichTextEditor label="O que inclui" value={field.value ?? ""} onChange={field.onChange} minHeight={120} />}
          />
          {errors.scope_html?.message && <p className="text-xs text-danger">{errors.scope_html.message}</p>}
        </div>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Serviço ativo" />
              Ativo (aparece nas Propostas)
            </label>
          )}
        />
      </form>
    </Modal>
  );
}
