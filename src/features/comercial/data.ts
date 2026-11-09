import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberContext } from "@/lib/auth/session";
import type { CrmChannelT, CrmFieldTypeT } from "@/lib/supabase/database.types";
import type { ActivityRow, HistoryRow, Opp } from "./schemas";

export interface OppView extends Opp {
  notes: string | null;
  custom: Record<string, string | number | null>;
}
export interface CrmSettings {
  segments: string[];
  tags: string[];
  cadence_days: number[];
  cadence_paused: boolean;
  stale_days: number;
}
export interface CrmField {
  id: string;
  key: string;
  label: string;
  type: CrmFieldTypeT;
  options: string[];
}
export interface CrmTemplate {
  id: string;
  name: string;
  channel: CrmChannelT;
  body: string;
}
export interface CrmBase {
  opps: OppView[];
  settings: CrmSettings;
  fields: CrmField[];
  templates: CrmTemplate[];
  people: { id: string; name: string }[];
  /** Meta de novos clientes do mês atual (nulo se não definida). */
  goal: number | null;
  error: boolean;
}

export const DEFAULT_SETTINGS: CrmSettings = {
  segments: [],
  tags: [],
  cadence_days: [1, 3, 7],
  cadence_paused: false,
  stale_days: 14,
};

const OPP_COLUMNS =
  "id, name, company, document, email, phone, segment, origin, tags, owner_id, stage, position, value, next_step, next_step_at, last_contact_at, attempts, lost_reason, closed_at, lost_at, stage_changed_at, created_at, client_id, notes, custom";

/** Tudo o que as telas do Comercial usam: oportunidades, configurações, campos, modelos, equipe e meta. */
export async function loadCrmBase(ctx: MemberContext, month: string): Promise<CrmBase> {
  const supabase = await createClient();
  const [opps, settings, fields, templates, people, goal] = await Promise.all([
    supabase
      .from("crm_opportunities")
      .select(OPP_COLUMNS)
      .eq("agency_id", ctx.agency.id)
      .order("position")
      .limit(10000),
    supabase
      .from("crm_settings")
      .select("segments, tags, cadence_days, cadence_paused, stale_days")
      .eq("agency_id", ctx.agency.id)
      .maybeSingle(),
    supabase
      .from("crm_custom_fields")
      .select("id, key, label, type, options")
      .eq("agency_id", ctx.agency.id)
      .order("position"),
    supabase
      .from("crm_message_templates")
      .select("id, name, channel, body")
      .eq("agency_id", ctx.agency.id)
      .order("name"),
    supabase
      .from("agency_members")
      .select("user_id, profiles!agency_members_user_id_fkey(full_name, email)")
      .eq("agency_id", ctx.agency.id)
      .eq("status", "ativo"),
    supabase
      .from("crm_goals")
      .select("new_clients")
      .eq("agency_id", ctx.agency.id)
      .eq("month", `${month}-01`)
      .maybeSingle(),
  ]);
  return {
    opps: (opps.data ?? []).map((o) => ({
      ...o,
      value: o.value == null ? null : Number(o.value),
      custom: (o.custom && typeof o.custom === "object" && !Array.isArray(o.custom)
        ? o.custom
        : {}) as Record<string, string | number | null>,
    })),
    settings: settings.data ?? DEFAULT_SETTINGS,
    fields: fields.data ?? [],
    templates: templates.data ?? [],
    people: (people.data ?? [])
      .map((m) => {
        const p = m.profiles as { full_name: string | null; email: string } | null;
        return { id: m.user_id, name: p?.full_name || p?.email || "Sem nome" };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    goal: goal.data?.new_clients ?? null,
    error: !!opps.error,
  };
}

/** Histórico de etapas e atividades a partir de um instante (para os relatórios). */
export async function loadReportData(
  ctx: MemberContext,
  sinceIso: string,
): Promise<{ history: HistoryRow[]; acts: ActivityRow[]; error: boolean }> {
  const supabase = await createClient();
  const [history, acts] = await Promise.all([
    supabase
      .from("crm_stage_history")
      .select("opportunity_id, from_stage, to_stage, changed_by, changed_at")
      .eq("agency_id", ctx.agency.id)
      .gte("changed_at", sinceIso)
      .order("changed_at")
      .limit(50000),
    supabase
      .from("crm_activities")
      .select("opportunity_id, kind, result, author_id, happened_at")
      .eq("agency_id", ctx.agency.id)
      .gte("happened_at", sinceIso)
      .limit(50000),
  ]);
  return { history: history.data ?? [], acts: acts.data ?? [], error: !!(history.error || acts.error) };
}
