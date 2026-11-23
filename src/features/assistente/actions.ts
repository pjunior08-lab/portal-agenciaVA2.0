"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { AiError, complete } from "@/lib/ai/anthropic";
import type { ActionResult } from "@/features/configuracoes/actions";
import { savePost } from "@/features/aprovacoes/actions";
import { STATUS } from "@/features/aprovacoes/schemas";
import { askSchema, buildSystem, HOURLY_LIMIT, splitOptions, titleFromCaption, type ClientContext, type WeekContext } from "./schemas";

const NO_PERMISSION: ActionResult<never> = { ok: false, error: "Você não tem acesso ao Assistente IA." };
const tz = "America/Sao_Paulo";
const dayIso = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

export async function askAssistant(input: unknown): Promise<ActionResult<{ text: string; options: string[] }>> {
  const ctx = await requireMember();
  if (!memberCan(ctx, "maestro")) return NO_PERMISSION;
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  const { mode, client_id, message, history } = parsed.data;
  const supabase = await createClient();

  // limite por pessoa: protege o custo da agência
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) return { ok: false, error: `Limite de ${HOURLY_LIMIT} pedidos por hora atingido. Tente de novo mais tarde.` };

  // contexto lido com as permissões da própria pessoa (RLS)
  let client: ClientContext | null = null;
  if (client_id) {
    const [c, s, p] = await Promise.all([
      supabase.from("clients").select("id, name").eq("id", client_id).eq("agency_id", ctx.agency.id).maybeSingle(),
      supabase.from("client_strategy").select("persona, positioning, voice_tone").eq("client_id", client_id).maybeSingle(),
      supabase
        .from("posts")
        .select("caption")
        .eq("client_id", client_id)
        .in("status", ["aprovado", "enviado", "em_analise"])
        .neq("caption", "")
        .order("sent_at", { ascending: false })
        .limit(5),
    ]);
    if (!c.data) return { ok: false, error: "Cliente não encontrado." };
    client = {
      name: c.data.name,
      segment: null,
      persona: s.data?.persona ?? "",
      positioning: s.data?.positioning ?? "",
      voice_tone: s.data?.voice_tone ?? "",
      examples: (p.data ?? []).map((x) => x.caption),
    };
  }

  let week: WeekContext | null = null;
  if (mode === "resumo") {
    const until = dayIso(new Date(Date.now() + 7 * 86400_000));
    const [mine, approvals] = await Promise.all([
      supabase
        .from("task_assignees")
        .select("tasks(title, due_date, completed_at, archived_at, clients(name))")
        .eq("user_id", ctx.userId)
        .limit(200),
      memberCan(ctx, "aprovacoes")
        ? supabase
            .from("posts")
            .select("title, status, clients(name)")
            .eq("agency_id", ctx.agency.id)
            .in("status", ["enviado", "em_analise", "alteracoes"])
            .order("sent_at")
            .limit(40)
        : Promise.resolve({ data: [] as { title: string; status: string; clients: { name: string } | null }[] }),
    ]);
    type T = { title: string; due_date: string | null; completed_at: string | null; archived_at: string | null; clients: { name: string } | null };
    const tasks = ((mine.data ?? []) as unknown as { tasks: T | null }[])
      .map((r) => r.tasks)
      .filter((t): t is T => !!t && !t.completed_at && !t.archived_at && (!t.due_date || t.due_date <= until))
      .filter((t) => !client || t.clients?.name === client.name)
      .slice(0, 40);
    week = {
      tasks: tasks.map((t) => ({ title: t.title, due: t.due_date, client: t.clients?.name ?? null })),
      approvals: ((approvals.data ?? []) as { title: string; status: string; clients: { name: string } | null }[])
        .filter((a) => !client || a.clients?.name === client.name)
        .map((a) => ({ title: a.title, status: STATUS[a.status as keyof typeof STATUS]?.label ?? a.status, client: a.clients?.name ?? null })),
    };
  }

  const today = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const system = buildSystem(mode, ctx.agency.name, today, client, week);
  try {
    const reply = await complete(system, [...history, { role: "user", content: message }], mode === "pauta" ? 1600 : 1200);
    await supabase.from("ai_usage").insert({
      agency_id: ctx.agency.id,
      user_id: ctx.userId,
      client_id: client_id || null,
      mode,
      input_tokens: reply.inputTokens,
      output_tokens: reply.outputTokens,
    });
    return { ok: true, data: { text: reply.text, options: mode === "legenda" ? splitOptions(reply.text) : [] } };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.message : "Não foi possível falar com o serviço de IA agora." };
  }
}

/** Cria um rascunho em Aprovações com a legenda escolhida (o cliente só vê depois de enviado). */
export async function createDraftFromCaption(clientId: string, caption: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();
  if (!memberCan(ctx, "maestro") || !memberCan(ctx, "aprovacoes", "editar")) return { ok: false, error: "Você não tem permissão para criar posts em Aprovações." };
  if (!z.string().uuid().safeParse(clientId).success) return { ok: false, error: "Escolha o cliente." };
  return savePost(
    null,
    {
      kind: "post",
      client_id: clientId,
      task_id: null,
      title: titleFromCaption(caption),
      caption: caption.slice(0, 5000),
      mode: "rapida",
      publish_mode: "manual",
      networks: ["instagram"],
      scheduled_at: "",
    },
    true,
  );
}
