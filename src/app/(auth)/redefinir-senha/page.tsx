"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { newPasswordSchema } from "@/features/auth/schemas";

type Values = z.infer<typeof newPasswordSchema>;

/** Aberta pelo link de recuperação (a sessão temporária já foi criada em /auth/callback). */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(newPasswordSchema) });

  async function onSubmit({ password }: Values) {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setError(authErrorMessage(error));
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login?motivo=senha-alterada");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Nova senha</h1>
        <p className="text-xs text-muted">Depois de salvar, todas as sessões são encerradas.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirm" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Salvar nova senha
      </Button>
    </form>
  );
}
