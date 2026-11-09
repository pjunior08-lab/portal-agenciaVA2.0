"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  KeyRound,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionCard,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { STAGES, OPEN_STAGES } from "@/features/comercial/schemas";
import {
  FORM_FIELDS,
  FORM_FIELD_KEYS,
  WEBHOOK_EVENTS,
  apiKeySchema,
  formSchema,
  webhookSchema,
  type FormFieldKey,
} from "@/features/comercial/automations";
import {
  createApiKey,
  deleteForm,
  deleteWebhook,
  revokeApiKey,
  saveForm,
  saveWebhook,
} from "@/features/comercial/automation-actions";
import type { ApiKeyRow, DeliveryRow, FormRow, WebhookRow } from "@/features/comercial/data";
import { useCrm } from "../crm-shell";

type Tab = "api" | "webhooks" | "formularios" | "meta";
const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  isAdmin: boolean;
  keys: ApiKeyRow[];
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
  forms: FormRow[];
  site: string;
}

export function IntegrationsApp(props: Props) {
  const [tab, setTab] = useState<Tab>("formularios");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Tipo de integração"
        value={tab}
        onChange={setTab}
        options={[
          { value: "formularios", label: "Formulários" },
          { value: "api", label: "API de entrada" },
          { value: "webhooks", label: "Webhooks" },
          { value: "meta", label: "Meta Ads" },
        ]}
      />
      {tab === "formularios" && <Forms forms={props.forms} site={props.site} />}
      {tab === "api" && <Api keys={props.keys} isAdmin={props.isAdmin} site={props.site} />}
      {tab === "webhooks" && (
        <Webhooks webhooks={props.webhooks} deliveries={props.deliveries} isAdmin={props.isAdmin} />
      )}
      {tab === "meta" && <Meta site={props.site} />}
    </div>
  );
}

function CopyField({ value, label, mono = true }: { value: string; label: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className={cn("h-9", mono && "font-mono text-xs")}
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-9 shrink-0"
        onClick={() =>
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => undefined,
          )
        }
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function AdminOnly() {
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title="Só administradores"
        description="Chaves de API e webhooks guardam segredos da agência. Peça a um administrador."
      />
    </Card>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível concluir.");
      router.refresh();
      after?.();
    });
  return { run, pending, error };
}

// ---------- Formulários ----------
function Forms({ forms, site }: { forms: FormRow[]; site: string }) {
  const { canEdit, personName } = useCrm();
  const [modal, setModal] = useState<FormRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-muted">
          Cada formulário tem um link próprio para colocar na bio, no site, em botões ou em QR code. Quem
          preencher vira oportunidade no funil, com origem e tags do formulário.
        </p>
        {canEdit && (
          <Button onClick={() => setModal("new")}>
            <Plus /> Novo formulário
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {forms.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Nenhum formulário"
            description="Crie um formulário de contato e compartilhe o link."
          />
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {forms.map((f) => {
            const url = `${site}/f/${f.token}`;
            return (
              <li
                key={f.id}
                className={cn("flex flex-col gap-3 rounded-2xl bg-surface p-4", !f.active && "opacity-70")}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {f.name} {!f.active && <Badge>Desativado</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {f.submissions} envio(s) · entra em {STAGES[f.stage as keyof typeof STAGES]?.label} ·{" "}
                      {f.owner_id ? personName(f.owner_id) : f.distribute ? "rodízio" : "sem responsável"}
                    </p>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2"
                    aria-label={`Abrir ${f.name}`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  {canEdit && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Editar ${f.name}`}
                        onClick={() => setModal(f)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-danger"
                        aria-label={`Apagar ${f.name}`}
                        onClick={() => setConfirm(f.id)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
                <CopyField value={url} label={`Link do formulário ${f.name}`} />
                {confirm === f.id && (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    Apagar o formulário? O link para de funcionar; os leads já recebidos continuam no funil.
                    <Button
                      size="sm"
                      variant="danger"
                      loading={pending}
                      onClick={() =>
                        run(
                          () => deleteForm(f.id),
                          () => setConfirm(null),
                        )
                      }
                    >
                      Apagar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Cancelar
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {modal && <FormModal form={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}

type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

function FormModal({ form, onClose }: { form: FormRow | null; onClose: () => void }) {
  const { base } = useCrm();
  const { run, pending, error } = useAction();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: form?.name ?? "",
      title: form?.title ?? "Fale com a gente",
      description: form?.description ?? "",
      fields: (form?.fields as { key: FormFieldKey; required: boolean }[]) ?? [
        { key: "phone", required: true },
        { key: "email", required: false },
        { key: "message", required: false },
      ],
      stage: (form?.stage as FormIn["stage"]) ?? "novo_lead",
      owner_id: form?.owner_id ?? "",
      distribute: form?.distribute ?? false,
      origin: form?.origin ?? "",
      tags: form?.tags.join(", ") ?? "",
      success_message: form?.success_message ?? "",
      active: form?.active ?? true,
    },
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={form ? "Editar" : "Novo"}
      accent="formulário"
      size="lg"
      footer={
        <Button type="submit" form="form-captura" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-captura"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((v) => run(() => saveForm(form?.id ?? null, v), onClose))}
      >
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome interno"
            htmlFor="fm-name"
            required
            error={errors.name?.message}
            hint="Só a equipe vê."
          >
            <Input id="fm-name" {...register("name")} placeholder="Ex.: Site — contato" autoFocus />
          </Field>
          <Field label="Título para o visitante" htmlFor="fm-title" required error={errors.title?.message}>
            <Input id="fm-title" {...register("title")} />
          </Field>
          <Field
            label="Texto de apresentação"
            htmlFor="fm-desc"
            className="sm:col-span-2"
            error={errors.description?.message}
          >
            <Textarea id="fm-desc" rows={2} {...register("description")} />
          </Field>
        </div>

        <Controller
          control={control}
          name="fields"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
              <legend className="mb-1 text-xs font-medium text-muted">Campos (o nome é sempre pedido)</legend>
              {FORM_FIELD_KEYS.map((k) => {
                const cur = field.value.find((x) => x.key === k);
                const set = (next: { key: FormFieldKey; required: boolean } | null) =>
                  field.onChange(
                    FORM_FIELD_KEYS.flatMap((key) =>
                      key === k ? (next ? [next] : []) : field.value.filter((x) => x.key === key),
                    ),
                  );
                return (
                  <div key={k} className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={!!cur}
                        onChange={(e) => set(e.target.checked ? { key: k, required: false } : null)}
                      />
                      {FORM_FIELDS[k].label}
                    </label>
                    {cur && (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-brand"
                          checked={cur.required}
                          onChange={(e) => set({ key: k, required: e.target.checked })}
                        />
                        obrigatório
                      </label>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entra na etapa" htmlFor="fm-stage">
            <Select id="fm-stage" {...register("stage")}>
              {OPEN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGES[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável" htmlFor="fm-owner" error={errors.owner_id?.message}>
            <Select id="fm-owner" {...register("owner_id")}>
              <option value="">Sem responsável fixo</option>
              {base.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Origem" htmlFor="fm-origin" hint="Em branco: “Formulário: <nome interno>”.">
            <Input id="fm-origin" {...register("origin")} placeholder="Ex.: Site" />
          </Field>
          <Field label="Tags" htmlFor="fm-tags" hint="Separe por vírgula." error={errors.tags?.message}>
            <Input id="fm-tags" {...register("tags")} />
          </Field>
          <Field label="Mensagem depois do envio" htmlFor="fm-success" className="sm:col-span-2">
            <Input
              id="fm-success"
              {...register("success_message")}
              placeholder="Em breve alguém da equipe fala com você."
            />
          </Field>
        </div>
        <Controller
          control={control}
          name="distribute"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch id="fm-dist" checked={field.value} onCheckedChange={field.onChange} />
              <label htmlFor="fm-dist" className="text-sm">
                Sem responsável fixo, distribuir no rodízio
              </label>
            </div>
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch id="fm-active" checked={field.value} onCheckedChange={field.onChange} />
              <label htmlFor="fm-active" className="text-sm">
                Formulário ativo (desligado, o link mostra “indisponível”)
              </label>
            </div>
          )}
        />
      </form>
    </Modal>
  );
}

// ---------- API de entrada ----------
function Api({ keys, isAdmin, site }: { keys: ApiKeyRow[]; isAdmin: boolean; site: string }) {
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  const endpoint = `${site}/api/comercial/leads`;
  const example = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Maria Souza","empresa":"Loja X","telefone":"27 99999-0000","email":"maria@lojax.com","origem":"Site","tags":["site"]}'`;
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Como enviar leads"
        icon={KeyRound}
        description="Para Make, Zapier, n8n ou o site da agência. Cada envio vira uma oportunidade em Novo Lead."
      >
        <div className="flex flex-col gap-3 text-sm">
          <Field label="Endereço (POST)" htmlFor="api-endpoint">
            <CopyField value={endpoint} label="Endereço da API" />
          </Field>
          <pre className="overflow-x-auto rounded-xl bg-panel p-3 text-[11px] leading-relaxed text-panel-ink">
            {example}
          </pre>
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {[
              ["nome", "obrigatório"],
              ["empresa, email, telefone, segmento", "texto"],
              ["documento (ou cnpj / cpf)", "evita duplicar: se já existir, vira anotação"],
              ["origem", "padrão: “API”"],
              ["valor_mensal", "número, ex.: 1500.00"],
              ["etapa", "novo_lead, contato_feito, orcamento, proposta ou negociacao"],
              ["tags", 'lista, ex.: ["site"]'],
              ["mensagem", "vai para as observações"],
              ["campos", "objeto com os campos personalizados pela chave"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-mono">{k}</dt> <dd className="inline text-muted">— {v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            Respostas: 201 criado, 200 já existia, 401 chave inválida, 422 dado inválido, 429 mais de 120
            envios por minuto.
          </p>
        </div>
      </SectionCard>

      {!isAdmin ? (
        <AdminOnly />
      ) : (
        <SectionCard
          title="Chaves de API"
          icon={KeyRound}
          description="Use uma chave por ferramenta, para poder revogar só aquela."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Nova chave
            </Button>
          }
        >
          {error && <Alert className="mb-3">{error}</Alert>}
          {keys.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">Nenhuma chave criada.</p>
          ) : (
            <ul className="flex flex-col">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-0",
                    k.revoked_at && "opacity-60",
                  )}
                >
                  <span className="min-w-32 flex-1 text-sm font-medium">{k.name}</span>
                  <code className="text-xs text-muted">{k.prefix}…</code>
                  <span className="text-xs text-muted">
                    {k.last_used_at ? `Usada em ${when.format(new Date(k.last_used_at))}` : "Nunca usada"}
                  </span>
                  {k.revoked_at ? (
                    <Badge tone="danger">Revogada</Badge>
                  ) : confirm === k.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      Revogar? Quem usa esta chave para de conseguir enviar.
                      <Button
                        size="sm"
                        variant="danger"
                        loading={pending}
                        onClick={() =>
                          run(
                            () => revokeApiKey(k.id),
                            () => setConfirm(null),
                          )
                        }
                      >
                        Revogar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setConfirm(k.id)}
                    >
                      Revogar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
      {creating && <NewKeyModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewKeyModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof apiKeySchema>>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { name: "" },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nova"
      accent="chave"
      size="sm"
      footer={
        key ? (
          <Button onClick={onClose}>Já guardei a chave</Button>
        ) : (
          <Button type="submit" form="form-chave" loading={pending}>
            Criar chave
          </Button>
        )
      }
    >
      {key ? (
        <div className="flex flex-col gap-3">
          <Alert tone="info">
            Copie agora e guarde num lugar seguro. Por segurança, ela não aparece de novo.
          </Alert>
          <CopyField value={key} label="Chave de API" />
        </div>
      ) : (
        <form
          id="form-chave"
          noValidate
          onSubmit={handleSubmit((v) =>
            start(async () => {
              const r = await createApiKey(v);
              if (!r.ok) return setError(r.error);
              setKey(r.data!.key);
              router.refresh();
            }),
          )}
        >
          {error && <Alert className="mb-3">{error}</Alert>}
          <Field label="Para que é a chave" htmlFor="key-name" required error={errors.name?.message}>
            <Input id="key-name" {...register("name")} placeholder="Ex.: Make — Meta Ads" autoFocus />
          </Field>
        </form>
      )}
    </Modal>
  );
}

// ---------- Webhooks ----------
function Webhooks({
  webhooks,
  deliveries,
  isAdmin,
}: {
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
  isAdmin: boolean;
}) {
  const [modal, setModal] = useState<WebhookRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  if (!isAdmin) return <AdminOnly />;
  const hookName = (id: string) => webhooks.find((w) => w.id === id)?.name ?? "—";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-muted">
          O sistema avisa outra ferramenta (Make, Zapier, planilha…) quando algo acontece no Comercial,
          enviando os dados da oportunidade em JSON. O cabeçalho X-Assinatura traz o HMAC-SHA256 do corpo com
          o segredo do webhook.
        </p>
        <Button onClick={() => setModal("new")}>
          <Plus /> Novo webhook
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      {webhooks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Webhook}
            title="Nenhum webhook"
            description="Cadastre o endereço que vai receber os avisos."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {webhooks.map((w) => (
            <li
              key={w.id}
              className={cn("flex flex-col gap-2 rounded-2xl bg-surface p-4", !w.active && "opacity-70")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm font-medium">{w.name}</span>
                {!w.active && <Badge>Pausado</Badge>}
                {w.last_status !== null && (
                  <Badge tone={w.last_status >= 200 && w.last_status < 300 ? "success" : "danger"}>
                    Último retorno: {w.last_status || "sem resposta"}
                  </Badge>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Editar ${w.name}`}
                  onClick={() => setModal(w)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-danger"
                  aria-label={`Apagar ${w.name}`}
                  onClick={() => setConfirm(w.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              <p className="truncate font-mono text-xs text-muted">{w.url}</p>
              <p className="text-xs">
                {w.events.map((e) => WEBHOOK_EVENTS[e as keyof typeof WEBHOOK_EVENTS]).join(" · ")}
              </p>
              {showSecret === w.id ? (
                <CopyField value={w.secret} label={`Segredo de ${w.name}`} />
              ) : (
                <button
                  type="button"
                  className="self-start text-xs text-info hover:underline"
                  onClick={() => setShowSecret(w.id)}
                >
                  Mostrar segredo
                </button>
              )}
              {confirm === w.id && (
                <span className="flex items-center gap-1.5 text-xs">
                  Apagar o webhook?
                  <Button
                    size="sm"
                    variant="danger"
                    loading={pending}
                    onClick={() =>
                      run(
                        () => deleteWebhook(w.id),
                        () => setConfirm(null),
                      )
                    }
                  >
                    Apagar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Cancelar
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {deliveries.length > 0 && (
        <SectionCard
          title="Últimos envios"
          icon={Webhook}
          description="Retornos conferidos a cada 5 minutos; guardados por 30 dias."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  {["Quando", "Webhook", "Evento", "Retorno"].map((h) => (
                    <th key={h} scope="col" className="px-2 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-2 text-xs whitespace-nowrap text-muted">
                      {when.format(new Date(d.created_at))}
                    </td>
                    <td className="px-2 py-2">{hookName(d.webhook_id)}</td>
                    <td className="px-2 py-2 text-xs">
                      {WEBHOOK_EVENTS[d.event as keyof typeof WEBHOOK_EVENTS] ?? d.event}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-xs",
                        d.ok === true && "text-success",
                        d.ok === false && "text-danger",
                      )}
                    >
                      {d.ok === null
                        ? "Aguardando"
                        : d.ok
                          ? `OK (${d.status_code})`
                          : (d.error ?? `HTTP ${d.status_code}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
      {modal && <WebhookModal hook={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </>
  );
}

type HookIn = z.input<typeof webhookSchema>;

function WebhookModal({ hook, onClose }: { hook: WebhookRow | null; onClose: () => void }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<HookIn>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: hook?.name ?? "",
      url: hook?.url ?? "",
      events: (hook?.events as HookIn["events"]) ?? ["lead_criado"],
      active: hook?.active ?? true,
    },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={hook ? "Editar" : "Novo"}
      accent="webhook"
      footer={
        secret ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : (
          <Button type="submit" form="form-webhook" loading={pending}>
            Salvar
          </Button>
        )
      }
    >
      {secret ? (
        <div className="flex flex-col gap-3">
          <Alert tone="success">
            Webhook criado. Use este segredo para conferir a assinatura (também fica em “Mostrar segredo”).
          </Alert>
          <CopyField value={secret} label="Segredo do webhook" />
        </div>
      ) : (
        <form
          id="form-webhook"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((v) =>
            start(async () => {
              const r = await saveWebhook(hook?.id ?? null, v);
              if (!r.ok) return setError(r.error);
              router.refresh();
              if (r.data?.secret) setSecret(r.data.secret);
              else onClose();
            }),
          )}
        >
          {error && <Alert>{error}</Alert>}
          <Field label="Nome" htmlFor="wh-name" required error={errors.name?.message}>
            <Input
              id="wh-name"
              {...register("name")}
              placeholder="Ex.: Make — planilha de vendas"
              autoFocus
            />
          </Field>
          <Field label="Endereço (https)" htmlFor="wh-url" required error={errors.url?.message}>
            <Input id="wh-url" type="url" {...register("url")} placeholder="https://hook.make.com/…" />
          </Field>
          <Controller
            control={control}
            name="events"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-medium text-muted">Avisar quando</legend>
                {Object.entries(WEBHOOK_EVENTS).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={field.value.includes(k as HookIn["events"][number])}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked ? [...field.value, k] : field.value.filter((x) => x !== k),
                        )
                      }
                    />
                    {l}
                  </label>
                ))}
                {errors.events?.message && <p className="text-xs text-danger">{errors.events.message}</p>}
              </fieldset>
            )}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch id="wh-active" checked={field.value} onCheckedChange={field.onChange} />
                <label htmlFor="wh-active" className="text-sm">
                  Ativo
                </label>
              </div>
            )}
          />
        </form>
      )}
    </Modal>
  );
}

// ---------- Meta Ads ----------
function Meta({ site }: { site: string }) {
  const steps = [
    [
      "Crie uma chave",
      "Na aba API de entrada, crie uma chave com o nome “Make — Meta Ads” (só administradores).",
    ],
    [
      "Monte o cenário no Make",
      "Módulo 1: Facebook Lead Ads → “Watch Leads”, escolhendo a página e o formulário do anúncio.",
    ],
    [
      "Envie para o sistema",
      `Módulo 2: HTTP → “Make a request”, método POST, URL ${site}/api/comercial/leads, cabeçalho Authorization: Bearer <sua chave>, corpo JSON.`,
    ],
    [
      "Ligue os campos",
      "No corpo, mapeie nome, telefone e email do lead e escreva origem “Meta Ads” (pode incluir o nome da campanha em tags).",
    ],
    [
      "Teste e ative",
      "Use a ferramenta de teste de leads da Meta, confira se a oportunidade apareceu no Funil e ligue o cenário.",
    ],
  ];
  return (
    <SectionCard
      title="Leads dos anúncios da Meta"
      icon={Megaphone}
      description="Por enquanto, via Make (ou Zapier/n8n) usando a API de entrada. A ligação direta com a Meta depende de um app aprovado pela Meta."
    >
      <ol className="flex flex-col gap-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-ink">
              {i + 1}
            </span>
            <div className="text-sm">
              <p className="font-medium">{t}</p>
              <p className="text-xs break-words text-muted">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-panel p-3 text-[11px] leading-relaxed text-panel-ink">{`{
  "nome": "{{full_name}}",
  "telefone": "{{phone_number}}",
  "email": "{{email}}",
  "origem": "Meta Ads",
  "tags": ["{{campaign_name}}"]
}`}</pre>
      <p className="mt-2 text-[11px] text-muted">
        Os nomes entre chaves são exemplos de campos do Make; escolha os do seu formulário de anúncio.
      </p>
    </SectionCard>
  );
}
