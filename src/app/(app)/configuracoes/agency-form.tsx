"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
import { Alert, Button, Field, Input, SectionCard } from "@/components/ui";
import { updateAgency } from "@/features/configuracoes/actions";
import { agencySchema, type AgencyValues } from "@/features/configuracoes/schemas";
import type { Database } from "@/lib/supabase/database.types";
import { useActionSubmit } from "./use-action-form";

type Agency = Database["public"]["Tables"]["agencies"]["Row"];

export function AgencyForm({ agency }: { agency: Agency }) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<AgencyValues>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency.name,
      legal_name: agency.legal_name ?? "",
      cnpj: agency.cnpj ?? "",
      email: agency.email ?? "",
      phone: agency.phone ?? "",
      address: agency.address ?? "",
      pix_key: agency.pix_key ?? "",
    },
  });
  const { submit, pending, message } = useActionSubmit(updateAgency, setError);

  return (
    <SectionCard
      title="Dados da empresa"
      icon={Building2}
      description="Aparecem em propostas, contratos e cobranças."
      className="max-w-3xl"
    >
      <form
        onSubmit={handleSubmit((v) => submit(v, "Dados da agência salvos.", () => reset(v)))}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <Field label="Nome da agência" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Razão social" htmlFor="legal_name" error={errors.legal_name?.message}>
          <Input id="legal_name" {...register("legal_name")} />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj" error={errors.cnpj?.message}>
          <Input id="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" {...register("cnpj")} />
        </Field>
        <Field label="E-mail" htmlFor="agency_email" error={errors.email?.message}>
          <Input id="agency_email" type="email" placeholder="contato@agencia.com" {...register("email")} />
        </Field>
        <Field label="Telefone" htmlFor="agency_phone" error={errors.phone?.message}>
          <Input id="agency_phone" type="tel" {...register("phone")} />
        </Field>
        <Field label="Chave Pix" htmlFor="pix_key" error={errors.pix_key?.message} hint="Usada nas propostas e cobranças.">
          <Input id="pix_key" {...register("pix_key")} />
        </Field>
        <Field label="Endereço" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="address" {...register("address")} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="min-h-5 flex-1">{message && <Alert tone={message.tone}>{message.text}</Alert>}</div>
          <Button type="submit" loading={pending} disabled={!isDirty}>
            Salvar agência
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
