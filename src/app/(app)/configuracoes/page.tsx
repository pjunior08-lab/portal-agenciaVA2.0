import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Cog, ShieldCheck, User, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { AgencyForm } from "./agency-form";
import { TeamPanel, type InviteRow, type MemberRow } from "./team-panel";
import { SecurityPanel } from "./security-panel";

export const metadata: Metadata = { title: "Configurações" };

const TABS = [
  { id: "perfil", label: "Perfil", icon: User, admin: false },
  { id: "agencia", label: "Agência", icon: Building2, admin: true },
  { id: "equipe", label: "Equipe", icon: Users, admin: true },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck, admin: false },
] as const;

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await requireMember();
  const isAdmin = ctx.role === "admin";
  const tabs = TABS.filter((t) => !t.admin || isAdmin);
  const { aba } = await searchParams;
  const tab = tabs.find((t) => t.id === aba)?.id ?? "perfil";
  const supabase = await createClient();

  let body: React.ReactNode;
  if (tab === "perfil") {
    body = <ProfileForm profile={ctx.profile} />;
  } else if (tab === "agencia") {
    body = <AgencyForm agency={ctx.agency} />;
  } else if (tab === "equipe") {
    const [members, access, invites] = await Promise.all([
      supabase
        .from("agency_members")
        .select("user_id, role, status, created_at, profiles!agency_members_user_id_fkey(full_name, email, job_title)")
        .eq("agency_id", ctx.agency.id)
        .order("created_at"),
      supabase.from("member_module_access").select("user_id, module, level").eq("agency_id", ctx.agency.id),
      supabase
        .from("invitations")
        .select("id, email, role, module_access, expires_at, created_at")
        .eq("agency_id", ctx.agency.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);
    const error = members.error ?? access.error ?? invites.error;
    if (error) {
      body = <ErrorState description="Não foi possível carregar a equipe. Recarregue a página." />;
    } else {
      const rows: MemberRow[] = (members.data ?? []).map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          userId: m.user_id,
          name: p?.full_name || p?.email || "Sem nome",
          email: p?.email ?? "",
          jobTitle: p?.job_title ?? null,
          role: m.role,
          status: m.status,
          isSelf: m.user_id === ctx.userId,
          access: (access.data ?? [])
            .filter((a) => a.user_id === m.user_id)
            .map((a) => ({ module: a.module, level: a.level })),
        };
      });
      const inviteRows: InviteRow[] = (invites.data ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expires_at,
        accessCount: Array.isArray(i.module_access) ? i.module_access.length : 0,
      }));
      body = <TeamPanel members={rows} invites={inviteRows} />;
    }
  } else {
    const { data: history } = await supabase
      .from("audit_log")
      .select("id, created_at, data")
      .eq("actor_id", ctx.userId)
      .eq("action", "login")
      .order("created_at", { ascending: false })
      .limit(15);
    body = (
      <SecurityPanel
        history={(history ?? []).map((h) => ({
          id: h.id,
          at: h.created_at,
          userAgent:
            h.data && typeof h.data === "object" && !Array.isArray(h.data) && typeof h.data.user_agent === "string"
              ? h.data.user_agent
              : null,
        }))}
      />
    );
  }

  return (
    <>
      <PageHeader title="Configurações" icon={Cog}>
        <nav aria-label="Seções de configurações" className="flex flex-wrap gap-1 rounded-full bg-surface p-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/configuracoes?aba=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                tab === t.id ? "bg-brand text-brand-ink" : "text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-3.5" aria-hidden />
              {t.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {body}
    </>
  );
}
