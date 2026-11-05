import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { getPortal } from "@/features/portal/context";
import { ClientAvatar } from "@/features/clientes/ui";
import { PORTAL_SECTIONS } from "@/features/clientes/schemas";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { PortalNav } from "./portal-nav";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getPortal(slug);
  const links = [
    { href: `/portal/${slug}`, label: "Início" },
    ...PORTAL_SECTIONS.filter((s) => p.sections.includes(s.id)).map((s) => ({
      href: `/portal/${slug}/${s.id}`,
      label: s.label,
    })),
    { href: `/portal/${slug}/conta`, label: "Conta" },
  ];

  return (
    <div className="min-h-dvh">
      {p.viewer === "equipe" && (
        <div className="flex items-center justify-center gap-2 bg-panel px-4 py-2 text-xs text-panel-ink">
          <Eye className="size-3.5 text-brand" aria-hidden />
          Você está vendo o portal como o cliente vê.
          <Link href={`/clientes/${p.clientId}?aba=portal`} className="font-medium text-brand underline-offset-2 hover:underline">
            Voltar ao cliente
          </Link>
        </div>
      )}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={p.clientName} color={p.coverColor} lightUrl={p.logoUrl} size="sm" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{p.clientName}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Image src="/brand/simbolo-amarelo.png" alt="" width={12} height={12} className="size-3 rounded" />
                Portal Vai Aonde Capixaba?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {p.viewer === "cliente" && <SignOutButton size="sm" />}
          </div>
        </div>
        <PortalNav links={links} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
