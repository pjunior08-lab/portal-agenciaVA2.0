"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CalendarPlus, ExternalLink, History, ImagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { Alert, Badge, Button, Field, Input, MediaThumb, Modal, SegmentedControl, Select, Textarea } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import { isoToLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { safeFileName } from "@/features/clientes/schemas";
import { CAPTION_LIMIT, INSTAGRAM_LIMIT } from "@/features/demandas/schemas";
import { DECISIONS, NETWORKS, NETWORK_IDS, PARTS, postSchema, type PostFormValues } from "@/features/aprovacoes/schemas";
import { ApprovalStatusBadge, DecisionBadge, formatDateTime } from "@/features/aprovacoes/ui";
import { deletePost, deletePostMedia, registerPostMedia, resendPost, savePost, schedulePost } from "@/features/aprovacoes/actions";
import type { PostView } from "@/features/aprovacoes/types";

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export interface PostModalProps {
  post: PostView | null;
  kind: "post" | "demanda";
  agencyId: string;
  clients: { id: string; name: string }[];
  templates: { id: string; title: string; body: string; client_id: string | null }[];
  tasks: { id: string; title: string; type: "post" | "demanda"; caption: string; client_id: string }[];
  portals: { client_id: string; slug: string; approvals: boolean }[];
  canEdit: boolean;
  canSchedule: boolean;
  onClose: () => void;
}

export function PostModal({ post, kind, agencyId, clients, templates, tasks, portals, canEdit, canSchedule, onClose }: PostModalProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const isPost = kind === "post";
  const noun = isPost ? "post" : "demanda";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PostFormValues, unknown, z.output<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      kind,
      client_id: post?.client_id ?? "",
      task_id: post?.task_id ?? "",
      title: post?.title ?? "",
      caption: post?.caption ?? "",
      mode: post?.mode ?? "rapida",
      publish_mode: post?.publish_mode ?? "manual",
      networks: post?.networks ?? (isPost ? ["instagram"] : []),
      scheduled_at: isoToLocalInput(post?.scheduled_at ?? null),
    },
  });
  const clientId = watch("client_id");
  const caption = watch("caption") ?? "";
  const mode = watch("mode");
  const publishMode = watch("publish_mode");
  const networks = watch("networks") ?? [];
  const clientTasks = tasks.filter((t) => t.client_id === clientId && t.type === kind);
  const clientTemplates = templates.filter((t) => !t.client_id || t.client_id === clientId);
  const portal = portals.find((p) => p.client_id === (post?.client_id ?? clientId));
  const decided = post && ["aprovado", "alteracoes", "reprovado"].includes(post.status);

  async function uploadFiles(postId: string, files: File[]) {
    const supabase = createClient();
    let failed = "";
    for (const [i, file] of files.entries()) {
      if (file.size > MAX_MEDIA_BYTES) {
        failed = `"${file.name}" passa de 100 MB.`;
        continue;
      }
      setProgress(`Enviando ${i + 1} de ${files.length}: ${file.name}`);
      const path = `${agencyId}/${postId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("aprovacoes").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        failed = `Não foi possível enviar "${file.name}".`;
        continue;
      }
      const r = await registerPostMedia({ postId, path, name: file.name.slice(0, 255), size: file.size, mime: file.type || null });
      if (!r.ok) failed = r.error;
    }
    setProgress("");
    return failed;
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, close = true) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      setError("");
      if (close) onClose();
      router.refresh();
    });

  const onSubmit = handleSubmit(() =>
    start(async () => {
      setError("");
      // envia os valores do formulário; a ação valida de novo no servidor com o mesmo esquema
      const r = await savePost(post?.id ?? null, getValues());
      if (!r.ok) return setError(r.error);
      if (pendingFiles.length && r.data) {
        const failed = await uploadFiles(r.data.id, pendingFiles);
        if (failed) {
          setError(`${isPost ? "Post enviado" : "Demanda enviada"}, mas: ${failed}`);
          setPendingFiles([]);
          router.refresh();
          return;
        }
      }
      onClose();
      router.refresh();
    }),
  );

  async function addFilesToExisting(files: File[]) {
    if (!post) return setPendingFiles((f) => [...f, ...files]);
    setError("");
    const failed = await uploadFiles(post.id, files);
    if (failed) setError(failed);
    router.refresh();
  }

  const title = post ? (canEdit ? `Editar ${noun}` : `Ver ${noun}`) : isPost ? "Novo post" : "Nova demanda";

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={title}
      accent="para aprovação"
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {post && canEdit && (
            <>
              {confirmDelete ? (
                <Button variant="danger" size="sm" loading={pending} onClick={() => act(() => deletePost(post.id))}>
                  Confirmar exclusão
                </Button>
              ) : (
                <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              )}
              {decided && (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => resendPost(post.id))}>
                  <RotateCcw /> Reenviar ao cliente
                </Button>
              )}
            </>
          )}
          {post && isPost && post.status === "aprovado" && post.publish_mode === "manual" && !post.scheduledInSocial && canSchedule && (
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await schedulePost(post.id);
                  if (!r.ok) return setError(r.error);
                  setInfo("Post levado para o calendário do Social.");
                  router.refresh();
                })
              }
            >
              <CalendarPlus /> Agendar no Social
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {canEdit ? "Cancelar" : "Fechar"}
          </Button>
          {canEdit && (
            <Button type="submit" form="form-envio" loading={pending}>
              {post ? "Salvar" : "Enviar para aprovação"}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form id="form-envio" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}
          {progress && <Alert tone="info">{progress}</Alert>}
          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente" htmlFor="ap-client" required error={errors.client_id?.message}>
                <Select id="ap-client" {...register("client_id", { onChange: () => setValue("task_id", "") })}>
                  <option value="">Escolha</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`${isPost ? "Post" : "Demanda"} de origem (opcional)`} htmlFor="ap-task">
                <Select
                  id="ap-task"
                  disabled={!clientId}
                  {...register("task_id", {
                    onChange: (e) => {
                      const t = tasks.find((x) => x.id === e.target.value);
                      if (!t) return;
                      if (!watch("title")) setValue("title", t.title);
                      if (!watch("caption") && t.caption) setValue("caption", t.caption);
                    },
                  })}
                >
                  <option value="">Nenhuma</option>
                  {clientTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label={isPost ? "Tema" : "Título"}
              htmlFor="ap-title"
              required
              error={errors.title?.message}
              hint={isPost && mode === "detalhada" ? "Aprovado separadamente pelo cliente." : undefined}
            >
              <Input id="ap-title" autoFocus={!post} {...register("title")} />
            </Field>

            <Field
              label={isPost ? "Legenda" : "Descrição"}
              htmlFor="ap-caption"
              error={errors.caption?.message}
              hint={
                isPost ? (
                  <span className={cn(caption.length > INSTAGRAM_LIMIT && "text-danger")}>
                    {mode === "detalhada" && "Aprovada separadamente pelo cliente · "}
                    {caption.length} / {CAPTION_LIMIT} {caption.length > INSTAGRAM_LIMIT && "· passa do limite do Instagram (2.200)"}
                  </span>
                ) : undefined
              }
            >
              <Textarea id="ap-caption" rows={6} maxLength={CAPTION_LIMIT} {...register("caption")} />
            </Field>
            {isPost && canEdit && clientTemplates.length > 0 && (
              <div className="-mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted">Inserir legenda padrão:</span>
                {clientTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setValue("caption", caption ? `${caption}\n\n${t.body}` : t.body, { shouldValidate: true })}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] hover:bg-surface-3"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}

            {isPost && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Forma de aprovação</span>
                  <SegmentedControl
                    label="Forma de aprovação"
                    value={mode}
                    onChange={(v) => setValue("mode", v)}
                    options={[
                      { value: "rapida", label: "Rápida: o post inteiro" },
                      { value: "detalhada", label: "Detalhada: tema, mídias e legenda" },
                    ]}
                  />
                  {/* a forma muda o que o cliente vê no portal; aqui mostramos como vai ser */}
                  <div className="rounded-xl bg-surface-2 p-3 text-xs" aria-live="polite">
                    {mode === "rapida" ? (
                      <>
                        <p className="font-medium">O cliente decide o post inteiro de uma vez.</p>
                        <p className="mt-1 text-muted">No portal aparecem os botões Aprovar, Pedir alterações e Reprovar para o post todo.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">O cliente decide cada parte separadamente:</p>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {(["Tema", "Mídias", "Legenda"] as const).map((x) => (
                            <li key={x} className="rounded-full bg-brand-soft px-2.5 py-0.5">
                              {x}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1.5 text-muted">
                          O resultado sai quando as três forem decididas: uma reprovada reprova o post; uma com alteração pede ajuste.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium text-muted">Redes</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {NETWORK_IDS.map((n) => {
                      const on = networks.includes(n);
                      return (
                        <label
                          key={n}
                          className={cn("cursor-pointer rounded-full px-3 py-1 text-xs", on ? "bg-panel text-panel-ink" : "bg-surface-2 text-muted hover:bg-surface-3")}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={(e) => setValue("networks", e.target.checked ? [...networks, n] : networks.filter((x) => x !== n), { shouldValidate: true })}
                          />
                          {NETWORKS[n]}
                        </label>
                      );
                    })}
                  </div>
                  {errors.networks && <p className="mt-1 text-xs text-danger">{errors.networks.message}</p>}
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted">Programação da publicação</span>
                    <SegmentedControl
                      label="Programação da publicação"
                      value={publishMode}
                      onChange={(v) => setValue("publish_mode", v)}
                      options={[
                        { value: "manual", label: "A equipe agenda" },
                        { value: "automatica", label: "Agendar ao aprovar" },
                      ]}
                    />
                  </div>
                  <Field label="Data da publicação" htmlFor="ap-when" error={errors.scheduled_at?.message} hint="Horário de Brasília.">
                    <Input id="ap-when" type="datetime-local" {...register("scheduled_at")} />
                  </Field>
                </div>
                {publishMode === "automatica" && (
                  <p className="-mt-2 text-[11px] text-muted">
                    Quando o cliente aprovar, o post entra sozinho no calendário do Social na data acima. A publicação nas redes chega com as integrações.
                  </p>
                )}
              </>
            )}
          </fieldset>

          <section aria-label={isPost ? "Mídias" : "Anexos"} className="flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {isPost ? "Mídias" : "Anexos"}
                {isPost && mode === "detalhada" && <Badge tone="brand">Aprovada separadamente</Badge>}
              </h3>
              {canEdit && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={isPost ? "image/*,video/*" : undefined}
                    className="sr-only"
                    aria-label="Escolher arquivos"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (fileInput.current) fileInput.current.value = "";
                      if (files.length) start(() => addFilesToExisting(files));
                    }}
                  />
                  <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => fileInput.current?.click()}>
                    <ImagePlus /> Adicionar
                  </Button>
                </>
              )}
            </div>
            {!post && pendingFiles.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted">{formatBytes(f.size)}</span>
                    <button type="button" aria-label={`Remover ${f.name}`} onClick={() => setPendingFiles((x) => x.filter((_, j) => j !== i))}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {post && post.media.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {post.media.map((m) => (
                  <li key={m.id} className="group relative">
                    <a href={m.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block" title={m.name}>
                      <MediaThumb media={m} className="aspect-square w-full rounded-lg" />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Excluir ${m.name}`}
                        onClick={() => act(() => deletePostMedia(m.id), false)}
                        className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              (post || pendingFiles.length === 0) && <p className="text-xs text-muted">Nenhum arquivo.</p>
            )}
          </section>
        </form>

        {post ? (
          <aside className="flex flex-col gap-4 lg:border-l lg:border-line lg:pl-6">
            <div className="flex flex-col gap-2">
              <ApprovalStatusBadge status={post.status} />
              <p className="text-[11px] text-muted">
                Enviado por {post.creatorName} em {formatDateTime(post.sent_at)}
                {post.round > 1 && ` · ${post.round}ª rodada`}
              </p>
              {post.scheduledInSocial && <Badge tone="info">No calendário do Social</Badge>}
            </div>
            {post.mode === "detalhada" && (
              <ul className="flex flex-col gap-1.5 text-xs">
                {(["tema", "midias", "legenda"] as const).map((part) => (
                  <li key={part} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5">
                    {PARTS[part]}
                    <DecisionBadge decision={part === "tema" ? post.theme_decision : part === "midias" ? post.media_decision : post.caption_decision} />
                  </li>
                ))}
              </ul>
            )}
            {portal &&
              (portal.approvals ? (
                <Link href={`/portal/${portal.slug}/aprovacoes?envio=${post.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline">
                  <ExternalLink className="size-3.5" aria-hidden /> Ver como o cliente vê
                </Link>
              ) : (
                <p className="text-[11px] text-muted">O portal deste cliente está sem a seção Aprovações. Ative em Clientes › Portal.</p>
              ))}
            {!portal && <p className="text-[11px] text-muted">Este cliente ainda não tem portal. Crie em Clientes para ele aprovar.</p>}
            <section aria-label="Histórico">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <History className="size-4 text-muted" aria-hidden /> Histórico
              </h3>
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
                      <span className="font-medium">{e.actorName}</span>{" "}
                      {e.event === "enviado" && "enviou para aprovação"}
                      {e.event === "reenviado" && `reenviou (${e.round}ª rodada)`}
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
            </section>
          </aside>
        ) : (
          <aside className="text-xs text-muted lg:border-l lg:border-line lg:pl-6">
            <p className="mb-2 font-medium text-ink">Como funciona</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Você envia; o cliente vê no portal, na seção Aprovações.</li>
              <li>Quando ele abre, o status muda para “Cliente analisando”.</li>
              <li>Ele aprova, pede alterações ou reprova{isPost ? " (na detalhada, tema, mídias e legenda separados)" : ""}.</li>
              <li>Se pedir ajuste, edite e reenvie: fica tudo no histórico.</li>
            </ol>
          </aside>
        )}
      </div>
    </Modal>
  );
}
