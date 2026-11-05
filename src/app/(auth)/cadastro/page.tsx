import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, buttonVariants } from "@/components/ui";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar a agência" };

export default async function CadastroPage() {
  const supabase = await createClient();
  const { data: exists, error } = await supabase.rpc("agency_exists");

  if (error) {
    return <Alert>Não foi possível falar com o servidor. Recarregue a página.</Alert>;
  }

  if (exists) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">A agência já está criada</h1>
        <p className="text-sm text-muted">
          Novas pessoas entram por convite. Peça a um administrador o link de convite com o seu e-mail.
        </p>
        <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
          Voltar para o login
        </Link>
      </div>
    );
  }

  return <SignUpForm mode="agency" />;
}
