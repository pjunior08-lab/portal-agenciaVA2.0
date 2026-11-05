"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, ExternalLink, FileText, Link2, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Alert, Button, Field, Input, Modal, SegmentedControl, Select, Textarea } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import { isoToLocalInput, localInputToIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import {
  addLink,
  createLabel,
  createTask,
  deleteAttachment,
  deleteTask,
  registerTaskFile,
  setTaskArchived,
  updateTask,
} from "@/features/demandas/actions";
import { CAPTION_LIMIT, INSTAGRAM_LIMIT, PRIORITIES, taskSchema, type TaskFormValues } from "@/features/demandas/schemas";
import { MAX_FILE_BYTES, safeFileName } from "@/features/clientes/schemas";
import type { DemandasData, TaskView } from "@/features/demandas/types";

const toForm = (t: TaskView | null, columnId: string): TaskFormValues => ({
  title: t?.title ?? "",
  type: t?.type ?? "demanda",
  column_id: t?.column_id ?? columnId,
  client_id: t?.client_id ?? "",
  label_id: t?.label_id ?? "",
  description: t?.description ?? "",
  caption: t?.caption ?? "",
  priority: t?.priority ?? "",
  start_date: t?.start_date ?? "",
  due_date: t?.due_date ?? "",
  publish_at: t?.publish_at ? isoToLocalInput(t.publish_at) : "",
  assignees: t?.assignees ?? [],
});

export function TaskModal({
  data,
  task,
  defaultColumnId,
  onClose,
}: {
  data: DemandasData;
  task: TaskView | null;
  defaultColumnId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !task;
  const isAssignee = !!task?.assignees.includes(data.userId);
  const canWrite = data.canEdit || isAssignee;
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError: setFieldError,
    formState: { errors, isDirty },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: toForm(task, defaultColumnId) });
  const type = watch("type");
  const caption = watch("caption") ?? "";
  const assignees = watch("assignees") ?? [];

  const onSubmit = (values: TaskFormValues) => {
    setError("");
    const payload = { ...values, publish_at: values.publish_at ? localInputToIso(String(values.publish_at)) : "" };
    start(async () => {
      const r = task ? await updateTask(task.id, payload) : await createTask(data.board.id, payload);
      if (!r.ok) {
        setError(r.error);
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) if (v?.[0]) setFieldError(k as keyof TaskFormValues, { message: v[0] });
        return;
      }
      onClose();
      router.refresh();
    });
  };

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
      title={isNew ? "Nova" : canWrite ? "Editar" : "Ver"}
      accent={type === "post" ? "post" : "demanda"}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {task && data.canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => act(() => setTaskArchived(task.id, !task.archived_at))}
              >
                {task.archived_at ? <ArchiveRestore /> : <Archive />}
                {task.archived_at ? "Restaurar" : "Arquivar"}
              </Button>
              {confirmDelete ? (
                <Button variant="danger" size="sm" loading={pending} onClick={() => act(() => deleteTask(task.id))}>
                  Confirmar exclusão
                </Button>
              ) : (
                <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              )}
            </>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {canWrite ? "Cancelar" : "Fechar"}
          </Button>
          {canWrite && (
            <Button type="submit" form="form-demanda" loading={pending} disabled={!isNew && !isDirty}>
              {isNew ? "Criar" : "Salvar"}
            </Button>
          )}
        </div>
      }
    >
      <form id="form-demanda" onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_260px]" noValidate>
        {error && <Alert className="lg:col-span-2">{error}</Alert>}
        <fieldset disabled={!canWrite} className="flex min-w-0 flex-col gap-4">
          <SegmentedControl
            label="Tipo"
            value={type}
            onChange={(v) => setValue("type", v, { shouldDirty: true })}
            options={[
              { value: "demanda", label: "Demanda" },
              { value: "post", label: "Post" },
            ]}
            className="max-w-xs"
          />
          <Field label="Título" htmlFor="t-title" required error={errors.title?.message}>
            <Input id="t-title" autoFocus={isNew} {...register("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="t-client">
              <Select id="t-client" {...register("client_id")}>
                <option value="">Sem cliente</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <LabelField data={data} value={watch("label_id") ?? ""} onChange={(v) => setValue("label_id", v, { shouldDirty: true })} />
          </div>
          <Field label="Descrição" htmlFor="t-desc" hint="Briefing, referências, o que precisa ser feito.">
            <Textarea id="t-desc" rows={6} maxLength={20000} {...register("description")} />
          </Field>
          {type === "post" && (
            <Field
              label="Legenda"
              htmlFor="t-caption"
              error={errors.caption?.message}
              hint={`${caption.length}/${CAPTION_LIMIT}${caption.length > INSTAGRAM_LIMIT ? ` · passou do limite do Instagram (${INSTAGRAM_LIMIT})` : ` · Instagram: ${caption.length}/${INSTAGRAM_LIMIT}`}`}
            >
              <Textarea id="t-caption" rows={6} maxLength={CAPTION_LIMIT} {...register("caption")} />
            </Field>
          )}
        </fieldset>

        <fieldset disabled={!canWrite} className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface-2 p-4">
          <Field label="Coluna" htmlFor="t-col">
            <Select id="t-col" {...register("column_id")}>
              {data.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridade" htmlFor="t-prio">
            <Select id="t-prio" {...register("priority")}>
              <option value="">Sem prioridade</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Início" htmlFor="t-start">
            <Input id="t-start" type="date" {...register("start_date")} />
          </Field>
          <Field label="Prazo" htmlFor="t-due" error={errors.due_date?.message}>
            <Input id="t-due" type="date" {...register("due_date")} />
          </Field>
          {type === "post" && (
            <Field label="Data da postagem" htmlFor="t-pub" error={errors.publish_at?.message} hint="Horário de Brasília.">
              <Input id="t-pub" type="datetime-local" {...register("publish_at")} />
            </Field>
          )}
          <fieldset disabled={!data.canEdit}>
            <legend className="mb-1.5 text-xs font-medium text-muted">Responsáveis</legend>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {data.people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-surface">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand)]"
                    checked={assignees.includes(p.id)}
                    onChange={(e) =>
                      setValue("assignees", e.target.checked ? [...assignees, p.id] : assignees.filter((x) => x !== p.id), {
                        shouldDirty: true,
                      })
                    }
                  />
                  {p.name}
                  {p.id === data.userId && <span className="text-muted">(você)</span>}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      </form>

      <Attachments task={task} agencyId={data.agencyId} canWrite={canWrite} canDeleteAll={data.canEdit} />
    </Modal>
  );
}

function LabelField({ data, value, onChange }: { data: DemandasData; value: string; onChange: (v: string) => void }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (creating) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Nova etiqueta</span>
        <div className="flex gap-1.5">
          <Input aria-label="Nome da etiqueta" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await createLabel({ name, color: "#feb800" });
                if (!r.ok) return setError(r.error);
                onChange(r.data!.id);
                setCreating(false);
                router.refresh();
              })
            }
          >
            Criar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="t-label" className="text-xs font-medium text-muted">
        Etiqueta
      </label>
      <div className="flex gap-1.5">
        <div className="flex-1">
          <Select id="t-label" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Sem etiqueta</option>
            {data.labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        {data.canEdit && (
          <Button size="icon" variant="secondary" aria-label="Nova etiqueta" onClick={() => setCreating(true)}>
            <Plus />
          </Button>
        )}
      </div>
    </div>
  );
}

function Attachments({ task, agencyId, canWrite, canDeleteAll }: { task: TaskView | null; agencyId: string; canWrite: boolean; canDeleteAll: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();

  if (!task) {
    return <p className="mt-6 rounded-xl bg-surface-2 p-3 text-xs text-muted">Salve a demanda para anexar arquivos e links.</p>;
  }

  async function upload(files: FileList | null) {
    if (!files?.length || !task) return;
    setError("");
    const supabase = createClient();
    for (const [i, file] of Array.from(files).entries()) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" passa de 50 MB.`);
        continue;
      }
      setProgress(`Enviando ${i + 1} de ${files.length}: ${file.name}`);
      const path = `${agencyId}/${task.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("demandas").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`Não foi possível enviar "${file.name}".`);
        continue;
      }
      const r = await registerTaskFile({ taskId: task.id, path, name: file.name.slice(0, 255), size: file.size, mime: file.type || null });
      if (!r.ok) setError(r.error);
    }
    setProgress("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-line pt-4" aria-label="Anexos">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Paperclip className="size-4 text-muted" aria-hidden /> Anexos
      </h3>
      {error && <Alert>{error}</Alert>}
      {progress && <Alert tone="info">{progress}</Alert>}
      {task.attachments.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {task.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
              {a.kind === "arquivo" && a.mime?.startsWith("image/") && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="size-10 rounded-lg object-cover" />
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-surface text-muted">
                  {a.kind === "link" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{a.name}</p>
                <p className="text-[10px] text-muted">{a.kind === "link" ? "Link" : a.size != null ? formatBytes(a.size) : "Arquivo"}</p>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface" aria-label={`Abrir ${a.name}`}>
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              {canDeleteAll && (
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface disabled:opacity-50"
                  aria-label={`Excluir ${a.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteAttachment(a.id);
                      if (!r.ok) setError(r.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className={cn("flex flex-col gap-2 sm:flex-row")}>
          <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Escolher arquivos" />
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()} loading={!!progress}>
            <Upload /> Enviar arquivo
          </Button>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addLink(task.id, { url: link });
                if (!r.ok) return setError(r.error);
                setLink("");
                router.refresh();
              });
            }}
          >
            <Input aria-label="Link (Google Drive, Canva, Figma...)" placeholder="Cole um link (Google Drive, Canva, Figma...)" value={link} onChange={(e) => setLink(e.target.value)} className="h-8" />
            <Button size="sm" type="submit" variant="secondary" loading={pending} disabled={!link.trim()}>
              <Link2 /> Adicionar
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
