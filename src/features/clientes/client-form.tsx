"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal, Select, Switch, Textarea } from "@/components/ui";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/lib/supabase/database.types";
import { createClientAction, setClientLogo, updateClientAction } from "./actions";
import {
  CLIENT_STATUS,
  COVER_COLORS,
  MAX_LOGO_BYTES,
  clientSchema,
  safeFileName,
  type ClientFormValues,
} from "./schemas";
import { ClientAvatar, SEGMENT_ICONS } from "./ui";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** cliente existente (edição) ou nada (novo) */
  client?: ClientRow;
  logoUrls?: { light?: string | null; dark?: string | null };
}

type LogoState = { file: File | null; preview: string | null; remove: boolean };

const toForm = (c?: ClientRow): ClientFormValues => ({
  name: c?.name ?? "",
  status: c?.status ?? "ativo",
  segment_icon: c?.segment_icon ?? "",
  cover_color: c?.cover_color ?? COVER_COLORS[0],
  client_since: c?.client_since ?? "",
  notes: c?.notes ?? "",
  auto_reminders: c?.auto_reminders ?? true,
  contact_name: c?.contact_name ?? "",
  email: c?.email ?? "",
  phone: c?.phone ?? "",
  document: c?.document ?? "",
  address: c?.address ?? "",
  monthly_fee: c?.monthly_fee != null ? String(c.monthly_fee).replace(".", ",") : "",
  billing_day: c?.billing_day != null ? String(c.billing_day) : "",
});

export function ClientFormModal({ open, onOpenChange, client, logoUrls }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [logos, setLogos] = useState<Record<"light" | "dark", LogoState>>({
    light: { file: null, preview: logoUrls?.light ?? null, remove: false },
    dark: { file: null, preview: logoUrls?.dark ?? null, remove: false },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError: setFieldError,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({ resolver: zodResolver(clientSchema), defaultValues: toForm(client) });
  const color = watch("cover_color");
  const segment = watch("segment_icon");
  const reminders = watch("auto_reminders");
  const name = watch("name");

  function pickLogo(variant: "light" | "dark", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("O logo precisa ser uma imagem (PNG, JPG, SVG ou WebP).");
    if (file.size > MAX_LOGO_BYTES) return setError("O logo pode ter no máximo 5 MB.");
    setError("");
    setLogos((l) => ({ ...l, [variant]: { file, preview: URL.createObjectURL(file), remove: false } }));
  }

  function close(v: boolean) {
    if (!v && !client) {
      reset(toForm());
      setLogos({ light: { file: null, preview: null, remove: false }, dark: { file: null, preview: null, remove: false } });
    }
    setError("");
    onOpenChange(v);
  }

  const onSubmit = (values: ClientFormValues) => {
    setError("");
    start(async () => {
      let clientId = client?.id;
      let agencyId = client?.agency_id;
      const res = client ? await updateClientAction(client.id, values) : await createClientAction(values);
      if (!res.ok) {
        setError(res.error);
        for (const [k, v] of Object.entries(res.fieldErrors ?? {}))
          if (v?.[0]) setFieldError(k as keyof ClientFormValues, { message: v[0] });
        return;
      }
      if (!client && res.data) {
        clientId = res.data.id;
        agencyId = res.data.agencyId;
      }

      // logos: envia direto do navegador para o Storage (as políticas conferem a permissão)
      const supabase = createBrowserSupabase();
      for (const variant of ["light", "dark"] as const) {
        const l = logos[variant];
        if (l.file && clientId && agencyId) {
          const path = `${agencyId}/${clientId}/logo/${variant}-${Date.now()}-${safeFileName(l.file.name)}`;
          const { error: upErr } = await supabase.storage.from("clientes").upload(path, l.file, { upsert: false });
          if (upErr) {
            setError("Cliente salvo, mas o logo não foi enviado. Tente de novo pela edição.");
            break;
          }
          const r = await setClientLogo({ clientId, variant, path });
          if (!r.ok) setError(r.error);
        } else if (l.remove && clientId) {
          const r = await setClientLogo({ clientId, variant, path: null });
          if (!r.ok) setError(r.error);
        }
      }

      close(false);
      if (!client && clientId) router.push(`/clientes/${clientId}`);
      else router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={client ? "Editar" : "Novo"}
      accent="cliente"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cliente" loading={pending}>
            {client ? "Salvar alterações" : "Criar cliente"}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[220px_1fr]" noValidate>
        {error && <Alert className="lg:col-span-2">{error}</Alert>}

        {/* Identidade visual */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl p-4" style={{ background: color || undefined }}>
            <ClientAvatar
              name={name || "?"}
              color={color}
              lightUrl={logos.light.remove ? null : logos.light.preview}
              darkUrl={logos.dark.remove ? null : logos.dark.preview}
              size="lg"
            />
            <span className="max-w-full truncate rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">{name || "Nome do cliente"}</span>
          </div>
          {(["light", "dark"] as const).map((variant) => (
            <div key={variant} className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
                <ImagePlus className="size-4 text-muted" aria-hidden />
                {variant === "light" ? "Logo (tema claro)" : "Logo (tema escuro)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => pickLogo(variant, e.target.files?.[0])}
                />
              </label>
              {logos[variant].preview && !logos[variant].remove && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remover logo"
                  onClick={() => setLogos((l) => ({ ...l, [variant]: { file: null, preview: null, remove: true } }))}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Cor da capa</legend>
            <div className="flex flex-wrap gap-1.5">
              {COVER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setValue("cover_color", c)}
                  className={cn("size-7 rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Segmento</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(SEGMENT_ICONS).map(([key, { label, icon: Icon }]) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={segment === key}
                  onClick={() => setValue("segment_icon", segment === key ? "" : key)}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl",
                    segment === key ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Dados */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Nome do cliente" htmlFor="c_name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="c_name" {...register("name")} />
          </Field>
          <Field label="Status" htmlFor="c_status">
            <Select id="c_status" {...register("status")}>
              {Object.entries(CLIENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cliente desde" htmlFor="c_since" error={errors.client_since?.message}>
            <Input id="c_since" type="date" {...register("client_since")} />
          </Field>

          <p className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase sm:col-span-2">Contato e cobrança</p>
          <Field label="Pessoa de contato" htmlFor="c_contact" error={errors.contact_name?.message}>
            <Input id="c_contact" {...register("contact_name")} />
          </Field>
          <Field label="Telefone" htmlFor="c_phone" error={errors.phone?.message}>
            <Input id="c_phone" type="tel" placeholder="(27) 99999-0000" {...register("phone")} />
          </Field>
          <Field label="E-mail" htmlFor="c_email" error={errors.email?.message}>
            <Input id="c_email" type="email" {...register("email")} />
          </Field>
          <Field label="CPF ou CNPJ" htmlFor="c_doc" error={errors.document?.message}>
            <Input id="c_doc" inputMode="numeric" {...register("document")} />
          </Field>
          <Field label="Endereço" htmlFor="c_address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="c_address" {...register("address")} />
          </Field>
          <Field label="Mensalidade (R$)" htmlFor="c_fee" error={errors.monthly_fee?.message} hint="Ex.: 1.500,00">
            <Input id="c_fee" inputMode="decimal" {...register("monthly_fee")} />
          </Field>
          <Field
            label="Dia de cobrança"
            htmlFor="c_day"
            error={errors.billing_day?.message}
            hint="As cobranças automáticas chegam com o Financeiro (Fase 6)."
          >
            <Input id="c_day" type="number" min={1} max={31} {...register("billing_day")} />
          </Field>

          <Field label="Observações" htmlFor="c_notes" error={errors.notes?.message} hint="Só a equipe vê." className="sm:col-span-2">
            <Textarea id="c_notes" rows={3} {...register("notes")} />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="c_rem" checked={!!reminders} onCheckedChange={(v) => setValue("auto_reminders", v)} />
            <label htmlFor="c_rem" className="text-sm">
              Lembretes automáticos por e-mail para este cliente
              <span className="block text-xs text-muted">Usado pelos lembretes de aprovação (Fase 4) e de cobrança (Fase 6).</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
