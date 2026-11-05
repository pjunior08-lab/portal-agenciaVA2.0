"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/redirect";
import { loginSchema } from "@/features/auth/schemas";

type Values = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: Values) {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) return setError(authErrorMessage(error));
    await supabase.rpc("log_access", { user_agent: navigator.userAgent });
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="text-xs text-muted">Use o e-mail e a senha da sua conta.</p>
      </div>
      {params.get("motivo") === "senha-alterada" && <Alert tone="success">Senha alterada. Entre com a nova senha.</Alert>}
      {params.get("motivo") === "link-invalido" && (
        <Alert>O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.</Alert>
      )}
      {params.get("motivo") === "sessoes-encerradas" && (
        <Alert tone="success">Você saiu de todos os aparelhos. Entre de novo.</Alert>
      )}
      {error && <Alert>{error}</Alert>}
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Senha" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Entrar
      </Button>
      <div className="flex flex-col items-center gap-1 text-xs">
        <Link href="/recuperar-senha" className="text-muted underline-offset-2 hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/cadastro" className="text-muted underline-offset-2 hover:underline">
          Primeiro acesso: criar a agência
        </Link>
      </div>
    </form>
  );
}
