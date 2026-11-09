import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberContext } from "@/lib/auth/session";
import type { CrmChannelT, CrmFieldTypeT } from "@/lib/supabase/database.types";
import type { ActivityRow, HistoryRow, Opp } from "./schemas";

export interface OppView extends Opp {
  source: "manual" | "importacao" | "api" | "formulario";
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
  "id, name, company, document, email, phone, segment, origin, tags, owner_id, stage, position, value, next_step, next_step_at, last_contact_at, attempts, lost_reason, closed_at, lost_at, stage_changed_at, created_at, client_id, notes, custom, source";

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

// ---------- Automações e integrações ----------
export interface RuleRow {
  id: string;
  name: string;
  active: boolean;
  trigger: "lead_criado" | "etapa_alterada" | "sem_contato";
  conditions: Record<string, unknown>;
  actions: unknown;
  created_at: string;
}
export interface RunRow {
  id: string;
  rule_name: string;
  trigger: string;
  status: "ok" | "erro";
  detail: string | null;
  ran_at: string;
  opportunity_id: string | null;
}

export async function loadAutomations(ctx: MemberContext) {
  const supabase = await createClient();
  const [rules, runs, dist] = await Promise.all([
    supabase
      .from("crm_rules")
      .select("id, name, active, trigger, conditions, actions, created_at")
      .eq("agency_id", ctx.agency.id)
      .order("position")
      .order("created_at"),
    supabase
      .from("crm_rule_runs")
      .select("id, rule_name, trigger, status, detail, ran_at, opportunity_id")
      .eq("agency_id", ctx.agency.id)
      .order("ran_at", { ascending: false })
      .limit(300),
    supabase
      .from("crm_distribution")
      .select("members, auto_new, pointer")
      .eq("agency_id", ctx.agency.id)
      .maybeSingle(),
  ]);
  return {
    rules: (rules.data ?? []) as RuleRow[],
    runs: (runs.data ?? []) as RunRow[],
    distribution: dist.data ?? { members: [], auto_new: false, pointer: 0 },
    error: !!(rules.error || runs.error || dist.error),
  };
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  last_status: number | null;
  last_at: string | null;
}
export interface DeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  ok: boolean | null;
  error: string | null;
  created_at: string;
}
export interface FormRow {
  id: string;
  name: string;
  token: string;
  title: string;
  description: string | null;
  fields: { key: string; required: boolean }[];
  stage: string;
  owner_id: string | null;
  distribute: boolean;
  origin: string | null;
  tags: string[];
  success_message: string | null;
  active: boolean;
  submissions: number;
}

/** Chaves e webhooks só para administradores (o banco também bloqueia). */
export async function loadIntegrations(ctx: MemberContext) {
  const supabase = await createClient();
  const isAdmin = ctx.role === "admin";
  const empty = { data: [] as never[], error: null };
  const [keys, hooks, deliveries, forms] = await Promise.all([
    isAdmin
      ? supabase
          .from("crm_api_keys")
          .select("id, name, prefix, created_at, last_used_at, revoked_at")
          .eq("agency_id", ctx.agency.id)
          .order("created_at", { ascending: false })
      : empty,
    isAdmin
      ? supabase
          .from("crm_webhooks")
          .select("id, name, url, events, secret, active, last_status, last_at")
          .eq("agency_id", ctx.agency.id)
          .order("created_at")
      : empty,
    isAdmin
      ? supabase
          .from("crm_webhook_deliveries")
          .select("id, webhook_id, event, status_code, ok, error, created_at")
          .eq("agency_id", ctx.agency.id)
          .order("created_at", { ascending: false })
          .limit(100)
      : empty,
    supabase
      .from("crm_forms")
      .select(
        "id, name, token, title, description, fields, stage, owner_id, distribute, origin, tags, success_message, active, submissions",
      )
      .eq("agency_id", ctx.agency.id)
      .order("created_at"),
  ]);
  return {
    isAdmin,
    keys: (keys.data ?? []) as ApiKeyRow[],
    webhooks: (hooks.data ?? []) as WebhookRow[],
    deliveries: (deliveries.data ?? []) as DeliveryRow[],
    forms: (forms.data ?? []) as unknown as FormRow[],
    error: !!(keys.error || hooks.error || deliveries.error || forms.error),
  };
}
