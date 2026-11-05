import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMemberContext, getUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { CreateAgencyForm } from "./create-agency-form";

export const metadata: Metadata = { title: "Boas-vindas" };

/** Pessoa logada que ainda não é membro: cria a agência (primeiro acesso) ou aguarda convite. */
export default async function BoasVindasPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (await getMemberContext()) redirect("/inicio");

  const supabase = await createClient();
  // login de cliente: vai direto para o portal
  const { data: portals } = await supabase.rpc("my_client_portals");
  if (portals?.length) redirect(`/portal/${portals[0].slug}`);

  const { data: exists } = await supabase.rpc("agency_exists");

  if (!exists) {
    const suggested = typeof user.user_metadata?.agency_name === "string" ? user.user_metadata.agency_name : "";
    return <CreateAgencyForm defaultName={suggested} />;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <EmptyState
        icon={Hourglass}
        title="Sua conta ainda não tem acesso"
        description={`Você entrou como ${user.email}. Peça a um administrador um convite para este e-mail e abra o link recebido.`}
      />
      <SignOutButton variant="secondary" />
    </div>
  );
}
