import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar a agência" };

export default async function CadastroPage() {
  const supabase = await createClient();
  const { data: exists, error } = await supabase.rpc("agency_exists");

  if (error) {
    return <Alert>Não foi possível falar com o servidor. Recarregue a página.</Alert>;
  }

  // Sistema interno de uma agência só: depois do primeiro acesso esta tela deixa de existir.
  // Novas pessoas entram por convite (Configurações › Equipe).
  if (exists) redirect("/login");

  return <SignUpForm mode="agency" />;
}
