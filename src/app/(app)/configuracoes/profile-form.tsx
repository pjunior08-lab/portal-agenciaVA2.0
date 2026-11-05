"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { Alert, Button, Field, Input, SectionCard } from "@/components/ui";
import { updateProfile } from "@/features/configuracoes/actions";
import { profileSchema, type ProfileValues } from "@/features/configuracoes/schemas";
import type { Database } from "@/lib/supabase/database.types";
import { useActionSubmit } from "./use-action-form";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      cpf: profile.cpf ?? "",
      job_title: profile.job_title ?? "",
      department: profile.department ?? "",
    },
  });
  const { submit, pending, message } = useActionSubmit(updateProfile, setError);

  return (
    <SectionCard title="Seus dados" icon={User} description={`Conta: ${profile.email}`} className="max-w-3xl">
      <form
        onSubmit={handleSubmit((v) => submit(v, "Dados salvos.", () => reset(v)))}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <Field label="Nome" htmlFor="full_name" required error={errors.full_name?.message} className="sm:col-span-2">
          <Input id="full_name" autoComplete="name" {...register("full_name")} />
        </Field>
        <Field label="Celular" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="(27) 99999-0000" {...register("phone")} />
        </Field>
        <Field label="CPF" htmlFor="cpf" error={errors.cpf?.message} hint="Usado em contratos (Fase 5).">
          <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" {...register("cpf")} />
        </Field>
        <Field label="Cargo" htmlFor="job_title" error={errors.job_title?.message}>
          <Input id="job_title" {...register("job_title")} />
        </Field>
        <Field label="Setor" htmlFor="department" error={errors.department?.message}>
          <Input id="department" {...register("department")} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="min-h-5 flex-1">{message && <Alert tone={message.tone}>{message.text}</Alert>}</div>
          <Button type="submit" loading={pending} disabled={!isDirty}>
            Salvar perfil
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
