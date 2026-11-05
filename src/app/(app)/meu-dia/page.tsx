import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { addDays, localToIso, today } from "@/lib/dates";
import { ErrorState } from "@/components/ui";
import { MeuDiaApp } from "./meu-dia-app";

export const metadata: Metadata = { title: "Meu Dia" };

export default async function MeuDiaPage() {
  const ctx = await requireMember();
  const supabase = await createClient();
  const now = today();
  const limit = addDays(now, 7);

  // minhas demandas: responsável, não arquivada, não concluída, com prazo até 7 dias (inclui atrasadas) ou sem prazo
  const { data: mine, error } = await supabase
    .from("task_assignees")
    .select(
      "tasks!inner(id, title, type, priority, due_date, completed_at, archived_at, client_id, board_id, column_id, board_columns(name, color), clients(name, cover_color))",
    )
    .eq("user_id", ctx.userId)
    .is("tasks.archived_at", null)
    .is("tasks.completed_at", null);
  if (error) return <ErrorState description="Não foi possível carregar o seu dia. Recarregue a página." />;

  const agendaAllowed = memberCan(ctx, "agenda");
  const approvalsAllowed = memberCan(ctx, "aprovacoes");
  const [events, checklist, approvals] = await Promise.all([
    agendaAllowed
      ? supabase
          .from("events")
          .select("id, title, starts_at, ends_at, all_day, done_at, location, owner_id, event_attendees(user_id)")
          .lt("starts_at", localToIso(addDays(now, 1), "00:00"))
          .gte("ends_at", localToIso(now, "00:00"))
          .order("starts_at")
      : Promise.resolve({ data: [] }),
    supabase.from("checklist_items").select("id, title, due_date, done_at").eq("user_id", ctx.userId).order("done_at", { nullsFirst: true }).order("position"),
    // envios que eu fiz e ainda não foram aprovados: aguardando o cliente ou voltaram para ajuste
    approvalsAllowed
      ? supabase
          .from("posts")
          .select("id, title, status, kind, decided_at, clients(name)")
          .eq("created_by", ctx.userId)
          .in("status", ["enviado", "em_analise", "alteracoes", "reprovado"])
          .order("sent_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  const tasks = (mine ?? [])
    .map((r) => (Array.isArray(r.tasks) ? r.tasks[0] : r.tasks))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => {
      const col = Array.isArray(t.board_columns) ? t.board_columns[0] : t.board_columns;
      const cl = Array.isArray(t.clients) ? t.clients[0] : t.clients;
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        due_date: t.due_date,
        board_id: t.board_id,
        client_id: t.client_id,
        clientName: cl?.name ?? null,
        clientColor: cl?.cover_color ?? null,
        columnName: col?.name ?? "",
        columnColor: col?.color ?? "var(--muted)",
      };
    })
    .filter((t) => !t.due_date || t.due_date <= limit);

  // "minha agenda": atividades que criei ou em que participo
  const myEvents = (events.data ?? []).filter(
    (e) => e.owner_id === ctx.userId || (e.event_attendees ?? []).some((a: { user_id: string }) => a.user_id === ctx.userId),
  );

  return (
    <MeuDiaApp
      name={(ctx.profile.full_name || ctx.email).split(/\s+/)[0]}
      tasks={tasks}
      events={myEvents.map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day, done: !!e.done_at, location: e.location }))}
      checklist={checklist.data ?? []}
      agendaAllowed={agendaAllowed}
      approvalsAllowed={approvalsAllowed}
      approvals={(approvals.data ?? []).map((a) => {
        const c = Array.isArray(a.clients) ? a.clients[0] : a.clients;
        return { id: a.id, title: a.title, status: a.status, kind: a.kind, clientName: c?.name ?? "" };
      })}
    />
  );
}
