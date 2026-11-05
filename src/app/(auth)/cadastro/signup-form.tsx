"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { Alert, Button, EmptyState, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { createAgencySchema, signUpSchema } from "@/features/auth/schemas";

const agencySignUp = signUpSchema.and(createAgencySchema);

interface Props {
  /** "agency": primeiro acesso, cria a agência. "invite": conta para aceitar convite. */
  mode: "agency" | "invite";
  /** e-mail fixo do convite */
  inviteEmail?: string;
  /** para onde voltar depois de confirmar o e-mail */
  next?: string;
}

export function SignUpForm({ mode, inviteEmail, next }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const schema = mode === "agency" ? agencySignUp : signUpSchema;
  type Values = z.infer<typeof agencySignUp>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema as typeof agencySignUp),
    defaultValues: { email: inviteEmail ?? "" },
  });

  async function onSubmit(values: Values) {
    setError("");
    const supabase = createClient();
    const after = mode === "agency" ? "/boas-vindas" : next ?? "/inicio";
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName, ...(mode === "agency" ? { agency_name: values.agencyName } : {}) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(after)}`,
      },
    });
    if (error) return setError(authErrorMessage(error));

    // Sem confirmação de e-mail ativa no Supabase a sessão já vem pronta.
    if (data.session) {
      if (mode === "agency") {
        const { error: rpcError } = await supabase.rpc("bootstrap_agency", { agency_name: values.agencyName });
        if (rpcError) return setError(authErrorMessage(rpcError));
        await supabase.rpc("log_access", { user_agent: navigator.userAgent });
        router.replace("/inicio");
      } else {
        router.replace(after);
      }
      router.refresh();
      return;
    }
    // Supabase devolve usuário sem identidades quando o e-mail já existe (proteção contra enumeração).
    if (data.user && data.user.identities?.length === 0) {
      return setError("Já existe uma conta com este e-mail. Entre com sua senha.");
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <EmptyState
        icon={MailCheck}
        title="Confirme seu e-mail"
        description={`Enviamos um link para ${sentTo}. Abra-o neste mesmo navegador para continuar.`}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">{mode === "agency" ? "Criar a agência" : "Criar sua conta"}</h1>
        <p className="text-xs text-muted">
          {mode === "agency"
            ? "Primeiro acesso: você será o administrador."
            : "Depois de criar a conta, o convite é aceito automaticamente."}
        </p>
      </div>
      {error && <Alert>{error}</Alert>}
      {mode === "agency" && (
        <Field label="Nome da agência" htmlFor="agencyName" error={errors.agencyName?.message}>
          <Input id="agencyName" {...register("agencyName")} placeholder="Ex.: Vai Aonde Capixaba?" />
        </Field>
      )}
      <Field label="Seu nome" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" readOnly={!!inviteEmail} {...register("email")} />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        {mode === "agency" ? "Criar agência" : "Criar conta"}
      </Button>
      {mode === "agency" && (
        <Link href="/login" className="text-center text-xs text-muted underline-offset-2 hover:underline">
          Já tenho conta
        </Link>
      )}
    </form>
  );
}
