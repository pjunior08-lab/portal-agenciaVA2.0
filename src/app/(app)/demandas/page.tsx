import type { Metadata } from "next";
import { KanbanSquare, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";
import type { TaskView } from "@/features/demandas/types";
import { DemandasApp } from "./demandas-app";
import { NewBoardFirst } from "./new-board-first";

export const metadata: Metadata = { title: "Demandas" };

export default async function DemandasPage({ searchParams }: { searchParams: Promise<{ quadro?: string }> }) {
  const ctx = await requireMember();
  const canView = memberCan(ctx, "demandas");
  const canEdit = memberCan(ctx, "demandas", "editar");
  const supabase = await createClient();

  // quem não tem o módulo só vê os quadros onde é responsável (o banco filtra)
  const { data: boards, error } = await supabase.from("boards").select("*").eq("agency_id", ctx.agency.id).order("position");
  if (error) return <ErrorState description="Não foi possível carregar os quadros. Recarregue a página." />;

  if (!boards?.length) {
    return (
      <>
        <PageHeader title="Demandas" icon={KanbanSquare} />
        <Card>
          {canEdit ? (
            <NewBoardFirst />
          ) : (
            <EmptyState
              icon={canView ? KanbanSquare : Lock}
              title={canView ? "Nenhum quadro ainda" : "Nenhuma demanda para você"}
              description={canView ? "Peça a quem edita demandas para criar o primeiro quadro." : "Quando alguém atribuir uma demanda a você, ela aparece aqui."}
            />
          )}
        </Card>
      </>
    );
  }

  const { quadro } = await searchParams;
  const board = boards.find((b) => b.id === quadro) ?? boards[0];

  const [columns, tasks, labels, clients, members] = await Promise.all([
    supabase.from("board_columns").select("*").eq("board_id", board.id).order("position"),
    supabase
      .from("tasks")
      .select("*, task_assignees(user_id), task_attachments(id, kind, name, url, path, mime_type, size_bytes, created_at)")
      .eq("board_id", board.id)
      .order("position"),
    supabase.from("labels").select("*").eq("agency_id", ctx.agency.id).order("name"),
    supabase.from("clients").select("id, name, cover_color, status").eq("agency_id", ctx.agency.id).order("name"),
    supabase
      .from("agency_members")
      .select("user_id, profiles!agency_members_user_id_fkey(full_name, email)")
      .eq("agency_id", ctx.agency.id)
      .eq("status", "ativo"),
  ]);
  const err = columns.error ?? tasks.error;
  if (err) return <ErrorState description="Não foi possível carregar as demandas. Recarregue a página." />;

  const clientMap = new Map((clients.data ?? []).map((c) => [c.id, c]));
  const filePaths = (tasks.data ?? []).flatMap((t) => (t.task_attachments ?? []).map((a) => a.path));
  const urls = await signedUrls("demandas", filePaths);

  const taskViews: TaskView[] = (tasks.data ?? []).map((t) => {
    const { task_assignees, task_attachments, ...row } = t;
    const atts = [...(task_attachments ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        name: a.name,
        url: a.kind === "link" ? a.url : a.path ? (urls[a.path] ?? null) : null,
        mime: a.mime_type,
        size: a.size_bytes,
      }));
    const client = row.client_id ? clientMap.get(row.client_id) : null;
    return {
      ...row,
      assignees: (task_assignees ?? []).map((a) => a.user_id),
      clientName: client?.name ?? null,
      clientColor: client?.cover_color ?? null,
      attachments: atts,
      coverUrl: atts.find((a) => a.kind === "arquivo" && a.mime?.startsWith("image/") && a.url)?.url ?? null,
    };
  });

  return (
    <DemandasApp
      data={{
        boards,
        board,
        columns: columns.data ?? [],
        tasks: taskViews,
        labels: labels.data ?? [],
        clients: (clients.data ?? [])
          .filter((c) => c.status !== "arquivado")
          .map((c) => ({ id: c.id, name: c.name, color: c.cover_color })),
        people: (members.data ?? []).map((m) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return { id: m.user_id, name: p?.full_name || p?.email || "Sem nome" };
        }),
        canEdit,
        isAdmin: ctx.role === "admin",
        userId: ctx.userId,
        agencyId: ctx.agency.id,
      }}
    />
  );
}
