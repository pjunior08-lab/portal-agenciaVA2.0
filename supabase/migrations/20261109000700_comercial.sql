-- =====================================================================
-- Fase 7A — Comercial (CRM)
-- Módulo "comercial" (ver/editar). Oportunidades no funil de 5 etapas
-- (+ Fechado e Perdido), histórico de etapas (tempo por etapa), atividades
-- de contato com cadência, meta mensal de novos clientes e configurações
-- (segmentos, tags, campos personalizados, modelos de mensagem).
-- =====================================================================

create type public.crm_stage as enum ('novo_lead', 'contato_feito', 'orcamento', 'proposta', 'negociacao', 'fechado', 'perdido');
create type public.crm_channel as enum ('whatsapp', 'ligacao', 'email', 'presencial', 'outro');
create type public.crm_result as enum ('sem_resposta', 'respondeu', 'pediu_retorno', 'reuniao_marcada', 'sem_interesse');
create type public.crm_field_type as enum ('texto', 'numero', 'data', 'opcoes');

-- ---------- Configurações da agência ----------
create table public.crm_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  segments text[] not null default '{}' check (cardinality(segments) <= 100),
  tags text[] not null default '{}' check (cardinality(tags) <= 100),
  -- dias até a próxima tentativa depois de cada "Sem resposta"
  cadence_days smallint[] not null default '{1,3,7}' check (cardinality(cadence_days) between 1 and 10),
  cadence_paused boolean not null default false,
  stale_days smallint not null default 14 check (stale_days between 1 and 365),
  updated_at timestamptz not null default now()
);
create trigger crm_settings_updated_at before update on public.crm_settings
  for each row execute function private.set_updated_at();

create table public.crm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (char_length(trim(label)) between 1 and 60),
  type public.crm_field_type not null default 'texto',
  options text[] not null default '{}' check (cardinality(options) <= 50),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (agency_id, key)
);

-- até 40 campos por agência
create or replace function private.crm_fields_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.crm_custom_fields f where f.agency_id = new.agency_id) >= 40 then
    raise exception 'Limite de 40 campos personalizados.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger crm_fields_limit before insert on public.crm_custom_fields
  for each row execute function private.crm_fields_limit();

create table public.crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  channel public.crm_channel not null default 'whatsapp',
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.crm_goals (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  new_clients smallint not null check (new_clients between 1 and 10000),
  primary key (agency_id, month)
);

-- ---------- Oportunidades ----------
create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  company text check (char_length(company) <= 160),
  -- só dígitos (CPF ou CNPJ); a mesma empresa não se repete na agência
  document text check (document ~ '^\d{11}$|^\d{14}$'),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  segment text check (char_length(segment) <= 60),
  origin text check (char_length(origin) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  owner_id uuid references public.profiles (id) on delete set null,
  stage public.crm_stage not null default 'novo_lead',
  position double precision not null default 0,
  -- valor mensal da conta
  value numeric(14, 2) check (value is null or value >= 0),
  next_step text check (char_length(next_step) <= 200),
  next_step_at date,
  last_contact_at timestamptz,
  attempts smallint not null default 0,
  lost_reason text check (char_length(lost_reason) <= 200),
  closed_at timestamptz,
  lost_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object'),
  notes text check (char_length(notes) <= 4000),
  client_id uuid references public.clients (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'perdido' or lost_reason is not null)
);
create unique index crm_opportunities_document_idx on public.crm_opportunities (agency_id, document) where document is not null;
create index crm_opportunities_stage_idx on public.crm_opportunities (agency_id, stage, position);
create index crm_opportunities_owner_idx on public.crm_opportunities (agency_id, owner_id);
create trigger crm_opportunities_updated_at before update on public.crm_opportunities
  for each row execute function private.set_updated_at();

create table public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities (id) on delete cascade,
  from_stage public.crm_stage,
  to_stage public.crm_stage not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index crm_stage_history_opp_idx on public.crm_stage_history (opportunity_id, changed_at);
create index crm_stage_history_agency_idx on public.crm_stage_history (agency_id, changed_at);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities (id) on delete cascade,
  -- contato registrado (com canal e resultado) ou só anotação
  kind text not null default 'contato' check (kind in ('contato', 'nota')),
  channel public.crm_channel,
  result public.crm_result,
  note text check (char_length(note) <= 4000),
  author_id uuid references public.profiles (id) on delete set null,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (kind = 'nota' or (channel is not null and result is not null)),
  check (kind = 'contato' or note is not null)
);
create index crm_activities_opp_idx on public.crm_activities (opportunity_id, happened_at desc);
create index crm_activities_agency_idx on public.crm_activities (agency_id, happened_at);

-- Regras da oportunidade: responsável da agência, datas de fechamento/perda,
-- histórico de etapas (inclusive a entrada) e documento só com dígitos.
create or replace function private.crm_opportunities_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.agency_members m where m.agency_id = new.agency_id and m.user_id = new.owner_id and m.status = 'ativo'
  ) then
    raise exception 'Responsável inválido.' using errcode = '23514';
  end if;
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if new.document is not null then new.document := nullif(regexp_replace(new.document, '\D', '', 'g'), ''); end if;
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.closed_at := case when new.stage = 'fechado' then now() end;
    new.lost_at := case when new.stage = 'perdido' then now() end;
    if new.stage <> 'perdido' then new.lost_reason := null; end if;
  end if;
  return new;
end;
$$;
create trigger crm_opportunities_guard before insert or update on public.crm_opportunities
  for each row execute function private.crm_opportunities_guard();

create or replace function private.crm_stage_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.crm_stage_history (agency_id, opportunity_id, from_stage, to_stage, changed_by)
    values (new.agency_id, new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage, (select auth.uid()));
  end if;
  return null;
end;
$$;
create trigger crm_stage_log after insert or update of stage on public.crm_opportunities
  for each row execute function private.crm_stage_log();

-- Contato registrado: atualiza o último contato e aplica a cadência.
-- "Sem resposta" agenda a próxima tentativa no intervalo da tentativa;
-- qualquer resposta zera a contagem.
create or replace function private.crm_activity_effects()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o public.crm_opportunities;
  s public.crm_settings;
  n int;
  d int;
  days smallint[];
begin
  if new.kind <> 'contato' then return null; end if;
  select * into o from public.crm_opportunities where id = new.opportunity_id;
  select * into s from public.crm_settings where agency_id = new.agency_id;
  update public.crm_opportunities
     set last_contact_at = greatest(coalesce(last_contact_at, new.happened_at), new.happened_at)
   where id = new.opportunity_id;
  if new.result = 'sem_resposta' then
    n := o.attempts + 1;
    if coalesce(s.cadence_paused, false) = false then
      days := coalesce(s.cadence_days, '{1,3,7}'::smallint[]);
      d := days[least(n, cardinality(days))];
      update public.crm_opportunities
         set attempts = n,
             next_step = 'Nova tentativa de contato (' || (n + 1) || 'ª)',
             next_step_at = (new.happened_at at time zone 'America/Sao_Paulo')::date + d
       where id = new.opportunity_id;
    else
      update public.crm_opportunities set attempts = n where id = new.opportunity_id;
    end if;
  elsif new.result in ('respondeu', 'pediu_retorno', 'reuniao_marcada') then
    update public.crm_opportunities set attempts = 0 where id = new.opportunity_id;
  end if;
  return null;
end;
$$;
create trigger crm_activity_effects after insert on public.crm_activities
  for each row execute function private.crm_activity_effects();

create or replace function private.crm_activity_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.crm_opportunities o where o.id = new.opportunity_id and o.agency_id = new.agency_id) then
    raise exception 'Oportunidade inválida.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger crm_activity_guard before insert or update on public.crm_activities
  for each row execute function private.crm_activity_guard();

create trigger crm_opportunities_audit after delete on public.crm_opportunities
  for each row execute function private.audit_generic();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.crm_settings enable row level security;
alter table public.crm_custom_fields enable row level security;
alter table public.crm_message_templates enable row level security;
alter table public.crm_goals enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_stage_history enable row level security;
alter table public.crm_activities enable row level security;
revoke all on public.crm_settings, public.crm_custom_fields, public.crm_message_templates, public.crm_goals,
  public.crm_opportunities, public.crm_stage_history, public.crm_activities from anon;

create policy crm_settings_select on public.crm_settings for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_settings_write on public.crm_settings for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

create policy crm_fields_select on public.crm_custom_fields for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_fields_write on public.crm_custom_fields for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

create policy crm_templates_select on public.crm_message_templates for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_templates_write on public.crm_message_templates for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

create policy crm_goals_select on public.crm_goals for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_goals_write on public.crm_goals for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

create policy crm_opp_select on public.crm_opportunities for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_opp_insert on public.crm_opportunities for insert to authenticated
  with check (private.can_access(agency_id, 'comercial', 'editar') and created_by = (select auth.uid()));
create policy crm_opp_update on public.crm_opportunities for update to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));
create policy crm_opp_delete on public.crm_opportunities for delete to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar'));

-- histórico de etapas: só leitura (gravado pelo gatilho)
create policy crm_history_select on public.crm_stage_history for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));

create policy crm_act_select on public.crm_activities for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_act_insert on public.crm_activities for insert to authenticated
  with check (private.can_access(agency_id, 'comercial', 'editar') and author_id = (select auth.uid()));
create policy crm_act_delete on public.crm_activities for delete to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar') and (author_id = (select auth.uid()) or private.is_admin(agency_id)));
