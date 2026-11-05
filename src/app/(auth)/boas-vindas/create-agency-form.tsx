"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { createAgencySchema } from "@/features/auth/schemas";

type Values = z.infer<typeof createAgencySchema>;

export function CreateAgencyForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(createAgencySchema), defaultValues: { agencyName: defaultName } });

  async function onSubmit({ agencyName }: Values) {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("bootstrap_agency", { agency_name: agencyName });
    if (error) return setError(authErrorMessage(error));
    await supabase.rpc("log_access", { user_agent: navigator.userAgent });
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Criar a agência</h1>
        <p className="text-xs text-muted">Você será o primeiro administrador.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <Field label="Nome da agência" htmlFor="agencyName" error={errors.agencyName?.message}>
        <Input id="agencyName" {...register("agencyName")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Criar agência
      </Button>
    </form>
  );
}
