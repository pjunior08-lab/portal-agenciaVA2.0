import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMemberContext, getUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { buttonVariants, EmptyState } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { SignUpForm } from "../../cadastro/signup-form";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Convite" };

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { token });
  const invite = data?.[0];

  if (!invite || !invite.valid) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Convite inválido"
        description="Este link já foi usado, foi cancelado ou venceu (convites valem 7 dias). Peça um novo ao administrador."
      />
    );
  }

  const user = await getUser();
  const self = `/convite/${token}`;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-surface-2 p-3 text-xs">
          Você foi convidado para <strong>{invite.agency_name}</strong> como <strong>{ROLE_LABEL[invite.role]}</strong>.
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
          description={`Este convite é para ${invite.email}, mas você entrou como ${user.email}. Saia e entre com o e-mail convidado.`}
        />
        <SignOutButton variant="secondary" />
      </div>
    );
  }

  if (await getMemberContext()) redirect("/inicio");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Entrar na equipe</h1>
      <p className="text-sm text-muted">
        {invite.agency_name} convidou você como {ROLE_LABEL[invite.role]}.
      </p>
      <AcceptInvite token={token} />
      <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Agora não
      </Link>
    </div>
  );
}
