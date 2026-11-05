import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getUser } from "@/lib/auth/session";
import { getPortal } from "@/features/portal/context";
import { SectionCard, buttonVariants } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";

export const metadata: Metadata = { title: "Conta" };

export default async function PortalConta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPortal(slug);
  const user = await getUser();

  return (
    <SectionCard title="Sua conta" icon={UserRound} className="max-w-xl">
      <dl className="mb-4 flex flex-col gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Nome</dt>
          <dd>{p.userName || "Não informado"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">E-mail</dt>
          <dd>{user?.email}</dd>
        </div>
      </dl>
      {p.viewer === "cliente" && (
        <div className="flex flex-wrap gap-2">
          <Link href="/recuperar-senha" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Trocar senha
          </Link>
          <SignOutButton scope="global" size="sm" variant="secondary" label="Sair de todos os aparelhos" />
        </div>
      )}
    </SectionCard>
  );
}
