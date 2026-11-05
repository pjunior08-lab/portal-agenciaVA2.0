import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { SignUpForm } from "../../cadastro/signup-form";
import { AcceptInvite } from "../../convite/[token]/accept-invite";

export const metadata: Metadata = { title: "Acesso ao portal" };

/** Convite para uma pessoa do CLIENTE acessar o Portal do Cliente. */
export default async function PortalConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("client_invitation_preview", { token });
  const invite = data?.[0];

  if (!invite || !invite.valid) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Convite inválido"
        description="Este link já foi usado, foi cancelado ou venceu (convites valem 7 dias). Peça um novo à agência."
      />
    );
  }

  const user = await getUser();
  const self = `/portal-convite/${token}`;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-surface-2 p-3 text-xs">
          <strong>{invite.agency_name}</strong> liberou para você o portal de <strong>{invite.client_name}</strong>: arquivos,
          aprovações e acompanhamento do trabalho.
        </p>
        <SignUpForm mode="invite" inviteEmail={invite.email} next={self} />
        <Link
          href={`/login?next=${encodeURIComponent(self)}`}
          className="text-center text-xs text-muted underline-offset-2 hover:underline"
        >
          Já tenho conta com {invite.email}
        </Link>
      </div>
    );
  }

  if (user.email?.toLowerCase() !== invite.email) {
    return (
      <div className="flex flex-col items-center gap-3">
        <EmptyState
          icon={LinkIcon}
          title="Convite para outro e-mail"
          description={`Este convite é para ${invite.email}, mas você entrou como ${user.email}.`}
        />
        <SignOutButton variant="secondary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Portal de {invite.client_name}</h1>
      <p className="text-sm text-muted">Confirme para acessar o portal preparado por {invite.agency_name}.</p>
      <AcceptInvite token={token} kind="cliente" />
    </div>
  );
}
