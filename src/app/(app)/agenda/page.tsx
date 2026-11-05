import type { Metadata } from "next";
import { CalendarDays, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, localToIso, monthGrid, today } from "@/lib/dates";
import { AgendaApp, type AgendaEvent } from "./agenda-app";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const ctx = await requireMember();
  if (!memberCan(ctx, "agenda")) {
    return (
      <>
        <PageHeader title="Agenda" icon={CalendarDays} />
        <Card>
          <EmptyState icon={Lock} title="Você não tem acesso a este módulo" description="Peça a um administrador para liberar." />
        </Card>
      </>
    );
  }

  const { dia } = await searchParams;
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today();
  // carrega a grade do mês inteiro + 30 dias (visão lista)
  const grid = monthGrid(day);
  const from = grid[0] < day ? grid[0] : day;
  const to = addDays(grid[41] > addDays(day, 30) ? grid[41] : addDays(day, 30), 1);

  const supabase = await createClient();
  const [events, members, clients, availability] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_attendees(user_id), owner:profiles!events_owner_id_fkey(full_name, email)")
      .eq("agency_id", ctx.agency.id)
      .lt("starts_at", localToIso(to, "00:00"))
      .gte("ends_at", localToIso(from, "00:00"))
      .order("starts_at"),
    supabase
      .from("agency_members")
      .select("user_id, profiles!agency_members_user_id_fkey(full_name, email)")
      .eq("agency_id", ctx.agency.id)
      .eq("status", "ativo"),
    supabase.from("clients").select("id, name, cover_color").eq("agency_id", ctx.agency.id).neq("status", "arquivado").order("name"),
    supabase.from("availability_rules").select("user_id, weekday, start_time, end_time").eq("agency_id", ctx.agency.id).order("weekday"),
  ]);
  if (events.error) return <ErrorState description="Não foi possível carregar a agenda. Recarregue a página." />;

  const people = (members.data ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { id: m.user_id, name: p?.full_name || p?.email || "Sem nome" };
  });

  const list: AgendaEvent[] = (events.data ?? []).map((e) => {
    const { event_attendees, owner, ...row } = e;
    const o = Array.isArray(owner) ? owner[0] : owner;
    return {
      ...row,
      attendees: (event_attendees ?? []).map((a) => a.user_id),
      ownerName: o?.full_name || o?.email || "",
    };
  });

  return (
    <AgendaApp
      day={day}
      events={list}
      people={people}
      clients={(clients.data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.cover_color }))}
      availability={availability.data ?? []}
      userId={ctx.userId}
      canEditAll={memberCan(ctx, "agenda", "editar")}
    />
  );
}
