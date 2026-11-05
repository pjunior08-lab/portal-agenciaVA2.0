import { Sidebar, type ShellUser } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { requireMember } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMember();
  const user: ShellUser = {
    name: ctx.profile.full_name || ctx.email,
    agencyName: ctx.agency.name,
    role: ctx.role,
    access: ctx.access,
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
      >
        Pular para o conteúdo
      </a>
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} />
        <main id="conteudo" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
