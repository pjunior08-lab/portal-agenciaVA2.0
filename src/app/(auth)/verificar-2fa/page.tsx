"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, Button, Field, Input } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { totpSchema } from "@/features/auth/schemas";

type Values = z.infer<typeof totpSchema>;

/** Segundo passo do login para quem ativou a verificação em duas etapas. */
export default function Verificar2faPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(totpSchema) });

  async function onSubmit({ code }: Values) {
    setError("");
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) return setError(authErrorMessage(listError));
    const factor = factors.totp.find((f) => f.status === "verified");
    if (!factor) return setError("Nenhum app autenticador encontrado nesta conta.");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return setError(authErrorMessage(error));
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
        <p className="text-xs text-muted">Digite o código de 6 números do seu app autenticador.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <Field label="Código" htmlFor="code" error={errors.code?.message}>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="text-center text-lg tracking-[0.5em]"
          {...register("code")}
        />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Confirmar
      </Button>
      <SignOutButton size="sm" label="Sair e entrar com outra conta" />
    </form>
  );
}
