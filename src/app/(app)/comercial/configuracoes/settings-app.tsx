"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MessageSquareText, Pencil, Plus, Repeat, SlidersHorizontal, Tags, Trash2, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  SectionCard,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import {
  CHANNELS,
  fieldSchema,
  settingsSchema,
  splitList,
  templateSchema,
} from "@/features/comercial/schemas";
import {
  deleteField,
  deleteTemplate,
  saveField,
  saveSettings,
  saveTemplate,
} from "@/features/comercial/actions";
import type { CrmField, CrmTemplate } from "@/features/comercial/data";
import { useCrm } from "../crm-shell";

const FIELD_TYPES = { texto: "Texto", numero: "Número", data: "Data", opcoes: "Lista de opções" } as const;

export function SettingsApp() {
  const { canEdit } = useCrm();
  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <Alert tone="info">
          Você pode ver as configurações, mas só quem edita o Comercial pode alterá-las.
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListsCard />
        <CadenceCard />
      </div>
      <FieldsCard />
      <TemplatesCard />
    </div>
  );
}

function useSaveSettings() {
  const router = useRouter();
  const { base } = useCrm();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = (patch: Partial<z.input<typeof settingsSchema>>) =>
    start(async () => {
      setError("");
      setSaved(false);
      const input = { ...base.settings, ...patch };
      const parsed = settingsSchema.safeParse(input);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      const r = await saveSettings(input);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  return { save, pending, error, saved };
}

function ChipList({
  label,
  items,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const next = [...new Set([...items, ...splitList(text)])];
    setText("");
    if (next.length !== items.length) onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-muted-2">Nenhum cadastrado.</span>}
        {items.map((t) => (
          <Badge key={t} className="text-xs">
            {t}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remover ${t}`}
                className="ml-0.5 rounded-full hover:text-danger"
                onClick={() => onChange(items.filter((x) => x !== t))}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            aria-label={`Adicionar em ${label}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="h-9"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!text.trim()}>
            Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

function ListsCard() {
  const { base, canEdit } = useCrm();
  const { save, pending, error } = useSaveSettings();
  return (
    <SectionCard
      title="Segmentos e tags"
      icon={Tags}
      description="Sugestões que aparecem no cadastro e nos filtros."
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <ChipList
          label="Segmentos"
          items={base.settings.segments}
          onChange={(segments) => save({ segments })}
          disabled={!canEdit || pending}
          placeholder="Ex.: Restaurantes, Clínicas"
        />
        <ChipList
          label="Tags"
          items={base.settings.tags}
          onChange={(tags) => save({ tags })}
          disabled={!canEdit || pending}
          placeholder="Ex.: quente, indicação"
        />
      </div>
    </SectionCard>
  );
}

function CadenceCard() {
  const { base, canEdit } = useCrm();
  const { save, pending, error, saved } = useSaveSettings();
  const [days, setDays] = useState(base.settings.cadence_days.join(", "));
  const [stale, setStale] = useState(String(base.settings.stale_days));
  return (
    <SectionCard
      title="Cadência de contato"
      icon={Repeat}
      description="Quando um contato fica sem resposta, a próxima tentativa é agendada sozinha."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save({
            cadence_days: days
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number),
            stale_days: Number(stale),
          });
        }}
      >
        {error && <Alert>{error}</Alert>}
        {saved && !error && <Alert tone="success">Configuração salva.</Alert>}
        <fieldset disabled={!canEdit || pending} className="flex flex-col gap-4">
          <Field
            label="Dias até a próxima tentativa"
            htmlFor="cad-days"
            hint="Um número por tentativa, separados por vírgula. Ex.: 1, 3, 7 → 1 dia depois da 1ª falta de resposta, 3 depois da 2ª e 7 a partir da 3ª."
          >
            <Input id="cad-days" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
          </Field>
          <div className="flex items-center gap-3">
            <Switch
              id="cad-pause"
              checked={base.settings.cadence_paused}
              onCheckedChange={(v) => save({ cadence_paused: v })}
            />
            <label htmlFor="cad-pause" className="text-sm">
              Pausar a cadência
              <span className="block text-xs text-muted">
                Enquanto pausada, “Sem resposta” só conta a tentativa, sem agendar a próxima.
              </span>
            </label>
          </div>
          <Field
            label="Lead parado depois de (dias sem contato)"
            htmlFor="cad-stale"
            hint="Usado no relatório de leads parados."
          >
            <Input
              id="cad-stale"
              type="number"
              min={1}
              max={365}
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              className="w-32"
            />
          </Field>
        </fieldset>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              Salvar cadência
            </Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

function useRemove() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const remove = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível excluir.");
      router.refresh();
    });
  return { remove, pending, error };
}

function FieldsCard() {
  const { base, canEdit } = useCrm();
  const [modal, setModal] = useState<CrmField | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const { remove, pending, error } = useRemove();
  return (
    <SectionCard
      title="Campos personalizados"
      icon={SlidersHorizontal}
      description={`Informações extras na ficha da oportunidade e na importação (até 40). ${base.fields.length} de 40.`}
      action={
        canEdit &&
        base.fields.length < 40 && (
          <Button size="sm" variant="secondary" onClick={() => setModal("new")}>
            <Plus /> Novo campo
          </Button>
        )
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      {base.fields.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Nenhum campo personalizado.</p>
      ) : (
        <ul className="flex flex-col">
          {base.fields.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-0"
            >
              <span className="min-w-40 flex-1 text-sm font-medium">{f.label}</span>
              <Badge>{FIELD_TYPES[f.type]}</Badge>
              {f.type === "opcoes" && (
                <span className="max-w-xs truncate text-xs text-muted">{f.options.join(", ")}</span>
              )}
              {canEdit &&
                (confirm === f.id ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    Apagar o campo? Os valores preenchidos deixam de aparecer.
                    <Button
                      size="sm"
                      variant="danger"
                      loading={pending}
                      onClick={() => remove(() => deleteField(f.id))}
                    >
                      Apagar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${f.label}`}
                      onClick={() => setModal(f)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Apagar ${f.label}`}
                      onClick={() => setConfirm(f.id)}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}
      {modal && <FieldModal field={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </SectionCard>
  );
}

type FieldIn = z.input<typeof fieldSchema>;
type FieldOut = z.output<typeof fieldSchema>;

function FieldModal({ field, onClose }: { field: CrmField | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [optionsText, setOptionsText] = useState(field?.options.join("\n") ?? "");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FieldIn, unknown, FieldOut>({
    resolver: zodResolver(fieldSchema),
    defaultValues: { label: field?.label ?? "", type: field?.type ?? "texto", options: field?.options ?? [] },
  });
  const type = watch("type");
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={field ? "Editar" : "Novo"}
      accent="campo"
      size="sm"
      footer={
        <Button type="submit" form="form-campo" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-campo"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await saveField(field?.id ?? null, v);
            if (!r.ok) return setError(r.error);
            router.refresh();
            onClose();
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Nome do campo" htmlFor="f-label" required error={errors.label?.message}>
          <Input id="f-label" {...register("label")} autoFocus />
        </Field>
        <Field
          label="Tipo"
          htmlFor="f-type"
          hint={field ? "Mudar o tipo não apaga o que já foi preenchido." : undefined}
        >
          <Select id="f-type" {...register("type")}>
            {Object.entries(FIELD_TYPES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        {type === "opcoes" && (
          <Field
            label="Opções (uma por linha)"
            htmlFor="f-options"
            error={errors.options?.message ?? errors.options?.root?.message}
          >
            <Textarea
              id="f-options"
              rows={5}
              value={optionsText}
              onChange={(e) => {
                setOptionsText(e.target.value);
                setValue("options", [
                  ...new Set(
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  ),
                ]);
              }}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function TemplatesCard() {
  const { base, canEdit } = useCrm();
  const [modal, setModal] = useState<CrmTemplate | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const { remove, pending, error } = useRemove();
  return (
    <SectionCard
      title="Modelos de mensagem"
      icon={MessageSquareText}
      description="Textos prontos para copiar ao registrar um contato. Use {{nome}}, {{empresa}} e {{responsavel}}."
      action={
        canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setModal("new")}>
            <Plus /> Novo modelo
          </Button>
        )
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      {base.templates.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Nenhum modelo de mensagem.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {base.templates.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                <Badge tone="info">{CHANNELS[t.channel]}</Badge>
                {canEdit && (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${t.name}`}
                      onClick={() => setModal(t)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Apagar ${t.name}`}
                      onClick={() => setConfirm(t.id)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
              <p className="line-clamp-3 text-xs whitespace-pre-wrap text-muted">{t.body}</p>
              {confirm === t.id && (
                <span className="flex items-center gap-1.5 text-xs">
                  Apagar este modelo?
                  <Button
                    size="sm"
                    variant="danger"
                    loading={pending}
                    onClick={() => remove(() => deleteTemplate(t.id))}
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
      {modal && <TemplateModal template={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </SectionCard>
  );
}

type TplIn = z.input<typeof templateSchema>;

function TemplateModal({ template, onClose }: { template: CrmTemplate | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TplIn>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name ?? "",
      channel: template?.channel ?? "whatsapp",
      body: template?.body ?? "",
    },
  });
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={template ? "Editar" : "Novo"}
      accent="modelo"
      footer={
        <Button type="submit" form="form-modelo" loading={pending}>
          Salvar
        </Button>
      }
    >
      <form
        id="form-modelo"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await saveTemplate(template?.id ?? null, v);
            if (!r.ok) return setError(r.error);
            router.refresh();
            onClose();
          }),
        )}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Nome" htmlFor="t-name" required error={errors.name?.message}>
          <Input id="t-name" {...register("name")} placeholder="Ex.: Primeiro contato" autoFocus />
        </Field>
        <Field label="Canal" htmlFor="t-channel">
          <Select id="t-channel" {...register("channel")}>
            {Object.entries(CHANNELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Mensagem"
          htmlFor="t-body"
          required
          error={errors.body?.message}
          hint="{{nome}} vira o primeiro nome do contato."
        >
          <Textarea id="t-body" rows={6} {...register("body")} />
        </Field>
      </form>
    </Modal>
  );
}
