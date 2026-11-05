"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck } from "lucide-react";
import { Alert, Button, EmptyState, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { forgotSchema } from "@/features/auth/schemas";

type Values = z.infer<typeof forgotSchema>;

export default function RecuperarSenhaPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit({ email }: Values) {
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    // Por segurança a resposta é a mesma exista ou não a conta; só erros técnicos aparecem.
    if (error && error.code === "over_email_send_rate_limit") return setError(authErrorMessage(error));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          icon={MailCheck}
          title="Verifique seu e-mail"
          description="Se houver uma conta com este e-mail, você vai receber um link para criar uma nova senha."
        />
        <Link href="/login" className="text-center text-xs text-muted underline-offset-2 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Recuperar senha</h1>
        <p className="text-xs text-muted">Enviaremos um link para criar uma nova senha.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Enviar link
      </Button>
      <Link href="/login" className="text-center text-xs text-muted underline-offset-2 hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
