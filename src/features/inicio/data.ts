import "server-only";
import { createClient } from "@/lib/supabase/server";
import { memberCan, type MemberContext } from "@/lib/auth/session";
import { addDays, startOfMonth } from "@/lib/dates";
import type { Deadline } from "./schemas";

const none = Promise.resolve({ data: null, error: null, count: null });

/**
 * Busca, de uma vez, só o que a pessoa pode ver em cada módulo.
 * As políticas do banco continuam valendo; aqui só evitamos consultas sem acesso.
 */
export async function loadDashboard(ctx: MemberContext, today: string) {
  const supabase = await createClient();
  const can = (m: string) => memberCan(ctx, m);
  const a = ctx.agency.id;
  const month = startOfMonth(today);
  const in30 = addDays(today, 30);
  const ago30 = `${addDays(today, -30)}T00:00:00-03:00`;

  const [
    members,
    clients,
    portals,
    tasks,
    done,
    approvals,
    proposals,
    contracts,
    fin,
    opps,
    goal,
    taskCount,
  ] = await Promise.all([
    supabase
      .from("agency_members")
      .select("user_id, profiles!agency_members_user_id_fkey(full_name, email)")
      .eq("agency_id", a)
      .eq("status", "ativo"),
    can("clientes")
      ? supabase.from("clients").select("id, name, status, created_at").eq("agency_id", a)
      : none,
    can("clientes")
      ? supabase
          .from("client_portal")
          .select("client_id", { count: "exact", head: true })
          .eq("agency_id", a)
          .eq("enabled", true)
      : none,
    can("demandas")
      ? supabase
          .from("tasks")
          .select("id, title, due_date, client_id, board_id")
          .eq("agency_id", a)
          .is("completed_at", null)
          .is("archived_at", null)
          .limit(2000)
      : none,
    can("demandas")
      ? supabase
          .from("tasks")
          .select("id, completed_at, task_assignees(user_id)")
          .eq("agency_id", a)
          .gte("completed_at", ago30)
          .limit(2000)
      : none,
    can("aprovacoes")
      ? supabase
          .from("posts")
          .select("id, title, client_id, status, sent_at")
          .eq("agency_id", a)
          .in("status", ["enviado", "em_analise"])
          .limit(1000)
      : none,
    can("propostas")
      ? supabase
          .from("proposals")
          .select("id, number, title, status, valid_until")
          .eq("agency_id", a)
          .in("status", ["enviada", "em_negociacao"])
          .limit(500)
      : none,
    can("contratos")
      ? supabase
          .from("contracts")
          .select("id, title, status, ends_on, renewal_on")
          .eq("agency_id", a)
          .in("status", ["aguardando", "assinado"])
          .limit(1000)
      : none,
    can("financeiro")
      ? supabase
          .from("fin_transactions")
          .select("id, kind, amount, description, due_date, paid, client_id, source")
          .eq("agency_id", a)
          .neq("kind", "transferencia")
          .or(`and(due_date.gte.${month},due_date.lte.${in30}),and(paid.eq.false,due_date.lt.${month})`)
          .limit(5000)
      : none,
    can("comercial")
      ? supabase
          .from("crm_opportunities")
          .select("id, name, company, stage, value, closed_at, next_step, next_step_at")
          .eq("agency_id", a)
          .limit(10000)
      : none,
    can("comercial")
      ? supabase.from("crm_goals").select("new_clients").eq("agency_id", a).eq("month", month).maybeSingle()
      : none,
    can("demandas")
      ? supabase.from("tasks").select("id", { count: "exact", head: true }).eq("agency_id", a)
      : none,
  ]);

  const people = (members.data ?? []).map((m) => {
    const p = m.profiles as { full_name: string | null; email: string } | null;
    return { id: m.user_id, name: p?.full_name || p?.email || "Sem nome" };
  });

  const deadlines: Deadline[] = [
    ...(tasks.data ?? []).flatMap((t) =>
      t.due_date && t.due_date <= in30
        ? [
            {
              kind: "demanda" as const,
              title: t.title,
              date: t.due_date,
              href: `/demandas?quadro=${t.board_id}`,
            },
          ]
        : [],
    ),
    ...(proposals.data ?? []).flatMap((p) =>
      p.valid_until
        ? [
            {
              kind: "proposta" as const,
              title: `Proposta ${p.number} vence`,
              date: p.valid_until,
              href: `/propostas/${p.id}`,
            },
          ]
        : [],
    ),
    ...(contracts.data ?? []).flatMap((c) =>
      c.status === "assinado"
        ? [
            ...(c.renewal_on
              ? [
                  {
                    kind: "contrato" as const,
                    title: `Renovação: ${c.title}`,
                    date: c.renewal_on,
                    href: `/contratos/${c.id}`,
                  },
                ]
              : []),
            ...(c.ends_on
              ? [
                  {
                    kind: "contrato" as const,
                    title: `Fim: ${c.title}`,
                    date: c.ends_on,
                    href: `/contratos/${c.id}`,
                  },
                ]
              : []),
          ]
        : [],
    ),
    ...(fin.data ?? []).flatMap((t) =>
      !t.paid && t.due_date <= in30
        ? [
            {
              kind: "financeiro" as const,
              title: `${t.kind === "receita" ? "Receber" : "Pagar"}: ${t.description}`,
              date: t.due_date,
              href: "/financeiro/lancamentos?status=aberto",
            },
          ]
        : [],
    ),
    ...(opps.data ?? []).flatMap((o) =>
      o.next_step_at && !["fechado", "perdido"].includes(o.stage)
        ? [
            {
              kind: "comercial" as const,
              title: `${o.next_step || "Próximo passo"}: ${o.company || o.name}`,
              date: o.next_step_at,
              href: "/comercial/hoje",
            },
          ]
        : [],
    ),
  ];

  return {
    access: {
      clientes: can("clientes"),
      demandas: can("demandas"),
      aprovacoes: can("aprovacoes"),
      propostas: can("propostas"),
      contratos: can("contratos"),
      financeiro: can("financeiro"),
      comercial: can("comercial"),
    },
    people,
    clients: (clients.data ?? []) as { id: string; name: string; status: string; created_at: string }[],
    portalsEnabled: portals.count ?? 0,
    taskCount: taskCount.count ?? 0,
    tasks: (tasks.data ?? []) as {
      id: string;
      title: string;
      due_date: string | null;
      client_id: string | null;
      board_id: string;
    }[],
    done: (
      (done.data ?? []) as { id: string; completed_at: string; task_assignees: { user_id: string }[] }[]
    ).map((t) => ({
      id: t.id,
      completed_at: t.completed_at,
      assignees: (t.task_assignees ?? []).map((x) => x.user_id),
    })),
    approvals: (approvals.data ?? []) as {
      id: string;
      title: string;
      client_id: string;
      status: string;
      sent_at: string | null;
    }[],
    proposals: (proposals.data ?? []) as { id: string; status: string }[],
    contracts: (contracts.data ?? []) as { id: string; status: string }[],
    fin: (
      (fin.data ?? []) as {
        id: string;
        kind: string;
        amount: number;
        description: string;
        due_date: string;
        paid: boolean;
        client_id: string | null;
        source: string;
      }[]
    ).map((t) => ({
      ...t,
      amount: Number(t.amount),
    })),
    opps: (
      (opps.data ?? []) as { id: string; stage: string; value: number | null; closed_at: string | null }[]
    ).map((o) => ({ ...o, value: o.value == null ? null : Number(o.value) })),
    goal: (goal.data as { new_clients: number } | null)?.new_clients ?? null,
    deadlines,
  };
}
