-- Fase 7B: Comercial — automações (regras, execuções, distribuição) e integrações
-- (API de entrada, webhooks de saída e formulários públicos).
-- pg_net envia os webhooks a partir do banco; pg_cron roda as regras de "sem contato"
-- e confere o retorno dos webhooks.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- De onde a oportunidade veio (para relatórios e regras).
alter table public.crm_opportunities
  add column source text not null default 'manual' check (source in ('manual', 'importacao', 'api', 'formulario'));

-- =====================================================================
-- Tabelas
-- =====================================================================
create table public.crm_distribution (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  -- ordem do rodízio
  members uuid[] not null default '{}' check (cardinality(members) <= 100),
  pointer integer not null default 0,
  -- leads novos sem responsável entram no rodízio automaticamente
  auto_new boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.crm_rules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  active boolean not null default true,
  trigger text not null check (trigger in ('lead_criado', 'etapa_alterada', 'sem_contato')),
  -- {stage, origin, source, days}
  conditions jsonb not null default '{}' check (jsonb_typeof(conditions) = 'object'),
  -- [{type, ...}] até 5 ações
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 5),
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trigger <> 'sem_contato' or (conditions ? 'days'))
);
create index crm_rules_agency_idx on public.crm_rules (agency_id, trigger) where active;
create trigger crm_rules_updated_at before update on public.crm_rules
  for each row execute function private.set_updated_at();

create table public.crm_rule_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rule_id uuid references public.crm_rules (id) on delete set null,
  rule_name text not null,
  opportunity_id uuid references public.crm_opportunities (id) on delete cascade,
  trigger text not null,
  status text not null check (status in ('ok', 'erro')),
  detail text,
  -- para "sem contato": a mesma pausa de contato só dispara a regra uma vez
  marker timestamptz,
  ran_at timestamptz not null default now()
);
create index crm_rule_runs_agency_idx on public.crm_rule_runs (agency_id, ran_at desc);
create unique index crm_rule_runs_idle_idx on public.crm_rule_runs (rule_id, opportunity_id, marker) where marker is not null;

create table public.crm_api_keys (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  -- só o começo da chave fica visível; a chave em si fica guardada como hash
  prefix text not null,
  key_hash text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  window_start timestamptz,
  window_count integer not null default 0
);
create index crm_api_keys_agency_idx on public.crm_api_keys (agency_id);

create table public.crm_webhooks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  events text[] not null check (cardinality(events) between 1 and 4 and events <@ array['lead_criado', 'etapa_alterada', 'fechado', 'perdido']),
  -- usado para assinar o corpo (HMAC-SHA256)
  secret text not null,
  active boolean not null default true,
  last_status integer,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index crm_webhooks_agency_idx on public.crm_webhooks (agency_id) where active;

create table public.crm_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  webhook_id uuid not null references public.crm_webhooks (id) on delete cascade,
  event text not null,
  opportunity_id uuid,
  request_id bigint,
  status_code integer,
  ok boolean,
  error text,
  created_at timestamptz not null default now()
);
create index crm_webhook_deliveries_idx on public.crm_webhook_deliveries (webhook_id, created_at desc);
create index crm_webhook_deliveries_pending_idx on public.crm_webhook_deliveries (request_id) where ok is null;

create table public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  -- endereço público do formulário (não é segredo)
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (char_length(description) <= 600),
  -- [{key, required}] — key: company, email, phone, document, segment, message
  fields jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  stage public.crm_stage not null default 'novo_lead' check (stage not in ('fechado', 'perdido')),
  owner_id uuid references public.profiles (id) on delete set null,
  distribute boolean not null default false,
  origin text check (char_length(origin) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  success_message text check (char_length(success_message) <= 300),
  active boolean not null default true,
  submissions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger crm_forms_updated_at before update on public.crm_forms
  for each row execute function private.set_updated_at();

create table public.crm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  form_id uuid not null references public.crm_forms (id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities (id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index crm_form_submissions_rate_idx on public.crm_form_submissions (form_id, ip_hash, created_at);

-- =====================================================================
-- Validações
-- =====================================================================
create or replace function private.crm_member_ok(a uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agency_members m where m.agency_id = a and m.user_id = u and m.status = 'ativo');
$$;

create or replace function private.crm_forms_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null and not private.crm_member_ok(new.agency_id, new.owner_id) then
    raise exception 'Responsável inválido.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger crm_forms_guard before insert or update on public.crm_forms
  for each row execute function private.crm_forms_guard();

-- =====================================================================
-- Distribuição (rodízio)
-- =====================================================================
create or replace function private.crm_next_owner(a uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.crm_distribution;
  active uuid[];
  pick uuid;
begin
  select * into d from public.crm_distribution where agency_id = a for update;
  if d is null then return null; end if;
  -- só quem continua ativo na agência entra na vez
  select coalesce(array_agg(u order by ord), '{}') into active
    from unnest(d.members) with ordinality as t(u, ord)
   where private.crm_member_ok(a, u);
  if cardinality(active) = 0 then return null; end if;
  pick := active[(d.pointer % cardinality(active)) + 1];
  update public.crm_distribution set pointer = (d.pointer + 1) % 1000000 where agency_id = a;
  return pick;
end;
$$;

-- =====================================================================
-- Regras
-- =====================================================================
-- Executa as ações de uma regra numa oportunidade. Erros sobem para quem chamou.
create or replace function private.crm_apply_actions(r public.crm_rules, oid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  act jsonb;
  done text[] := '{}';
  who uuid;
  st public.crm_stage;
begin
  for act in select * from jsonb_array_elements(r.actions) loop
    case act ->> 'type'
      when 'mover_etapa' then
        st := (act ->> 'stage')::public.crm_stage;
        if st = 'perdido' then raise exception 'Regra não pode marcar como perdido.'; end if;
        update public.crm_opportunities set stage = st where id = oid and stage is distinct from st;
        done := done || ('etapa → ' || st::text);
      when 'definir_responsavel' then
        who := (act ->> 'user_id')::uuid;
        if not private.crm_member_ok(r.agency_id, who) then raise exception 'Responsável da regra não está ativo.'; end if;
        update public.crm_opportunities set owner_id = who where id = oid;
        done := done || 'responsável definido'::text;
      when 'distribuir' then
        who := private.crm_next_owner(r.agency_id);
        if who is null then raise exception 'Rodízio sem pessoas ativas.'; end if;
        update public.crm_opportunities set owner_id = who where id = oid;
        done := done || 'distribuído no rodízio'::text;
      when 'adicionar_tag' then
        update public.crm_opportunities
           set tags = case when tags @> array[act ->> 'tag'] then tags else tags || (act ->> 'tag') end
         where id = oid;
        done := done || ('tag ' || (act ->> 'tag'));
      when 'proximo_passo' then
        update public.crm_opportunities
           set next_step = left(act ->> 'text', 200),
               next_step_at = (now() at time zone 'America/Sao_Paulo')::date + coalesce((act ->> 'days')::int, 0)
         where id = oid;
        done := done || 'próximo passo definido'::text;
      else
        raise exception 'Ação desconhecida: %', act ->> 'type';
    end case;
  end loop;
  return array_to_string(done, ', ');
end;
$$;

create or replace function private.crm_rule_matches(r public.crm_rules, o public.crm_opportunities)
returns boolean language sql immutable set search_path = '' as $$
  select (not (r.conditions ? 'stage') or o.stage::text = r.conditions ->> 'stage')
     and (not (r.conditions ? 'origin') or lower(coalesce(o.origin, '')) = lower(r.conditions ->> 'origin'))
     and (not (r.conditions ? 'source') or o.source = r.conditions ->> 'source');
$$;

-- Roda as regras ativas de um gatilho. Uma regra não dispara outra (sem cascata).
create or replace function private.crm_run_rules(oid uuid, trig text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.crm_opportunities;
  r public.crm_rules;
  msg text;
begin
  if coalesce(current_setting('app.crm_rules', true), '') = 'on' then return; end if;
  select * into o from public.crm_opportunities where id = oid;
  if o is null then return; end if;
  perform set_config('app.crm_rules', 'on', true);
  for r in select * from public.crm_rules where agency_id = o.agency_id and active and trigger = trig order by position, created_at loop
    select * into o from public.crm_opportunities where id = oid;
    continue when not private.crm_rule_matches(r, o);
    begin
      msg := private.crm_apply_actions(r, oid);
      insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail)
      values (o.agency_id, r.id, r.name, oid, trig, 'ok', msg);
    exception when others then
      insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail)
      values (o.agency_id, r.id, r.name, oid, trig, 'erro', left(sqlerrm, 300));
    end;
  end loop;
  perform set_config('app.crm_rules', 'off', true);
end;
$$;

-- Regras de "sem contato há N dias" (chamada pelo agendador a cada hora).
create or replace function private.crm_run_idle_rules()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.crm_rules;
  o public.crm_opportunities;
  msg text;
  total integer := 0;
begin
  perform set_config('app.crm_rules', 'on', true);
  for r in select * from public.crm_rules where active and trigger = 'sem_contato' loop
    for o in
      select * from public.crm_opportunities x
       where x.agency_id = r.agency_id
         and x.stage not in ('fechado', 'perdido')
         and coalesce(x.last_contact_at, x.created_at) < now() - make_interval(days => (r.conditions ->> 'days')::int)
         and private.crm_rule_matches(r, x)
         and not exists (
           select 1 from public.crm_rule_runs k
            where k.rule_id = r.id and k.opportunity_id = x.id and k.marker = coalesce(x.last_contact_at, x.created_at))
       limit 500
    loop
      begin
        msg := private.crm_apply_actions(r, o.id);
        insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail, marker)
        values (r.agency_id, r.id, r.name, o.id, 'sem_contato', 'ok', msg, coalesce(o.last_contact_at, o.created_at));
      exception when others then
        insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail, marker)
        values (r.agency_id, r.id, r.name, o.id, 'sem_contato', 'erro', left(sqlerrm, 300), coalesce(o.last_contact_at, o.created_at));
      end;
      total := total + 1;
    end loop;
  end loop;
  perform set_config('app.crm_rules', 'off', true);
  return total;
end;
$$;

-- =====================================================================
-- Webhooks de saída
-- =====================================================================
create or replace function private.crm_emit(oid uuid, ev text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.crm_opportunities;
  w public.crm_webhooks;
  body jsonb;
  req bigint;
begin
  select * into o from public.crm_opportunities where id = oid;
  if o is null then return; end if;
  for w in select * from public.crm_webhooks where agency_id = o.agency_id and active and ev = any (events) loop
    body := jsonb_build_object(
      'evento', ev,
      'enviado_em', now(),
      'oportunidade', jsonb_build_object(
        'id', o.id, 'nome', o.name, 'empresa', o.company, 'documento', o.document, 'email', o.email,
        'telefone', o.phone, 'segmento', o.segment, 'origem', o.origin, 'fonte', o.source, 'tags', to_jsonb(o.tags),
        'etapa', o.stage, 'valor_mensal', o.value, 'responsavel_id', o.owner_id, 'proximo_passo', o.next_step,
        'proximo_passo_em', o.next_step_at, 'motivo_perda', o.lost_reason, 'campos', o.custom, 'criado_em', o.created_at));
    begin
      select net.http_post(
        url := w.url,
        body := body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Evento', ev,
          'X-Assinatura', 'sha256=' || encode(extensions.hmac(body::text, w.secret, 'sha256'), 'hex')),
        timeout_milliseconds := 5000) into req;
      insert into public.crm_webhook_deliveries (agency_id, webhook_id, event, opportunity_id, request_id)
      values (o.agency_id, w.id, ev, o.id, req);
    exception when others then
      insert into public.crm_webhook_deliveries (agency_id, webhook_id, event, opportunity_id, ok, error)
      values (o.agency_id, w.id, ev, o.id, false, left(sqlerrm, 300));
    end;
  end loop;
end;
$$;

-- Confere as respostas dos envios (chamada pelo agendador).
create or replace function private.crm_sync_deliveries()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with done as (
    update public.crm_webhook_deliveries d
       set status_code = r.status_code,
           ok = (r.status_code between 200 and 299),
           error = case when r.status_code between 200 and 299 then null else left(coalesce(r.error_msg, 'HTTP ' || r.status_code), 300) end
      from net._http_response r
     where d.request_id = r.id and d.ok is null
    returning d.webhook_id, d.status_code, d.created_at
  ), last as (
    select distinct on (webhook_id) webhook_id, status_code, created_at from done order by webhook_id, created_at desc
  )
  update public.crm_webhooks w set last_status = coalesce(l.status_code, 0), last_at = l.created_at
    from last l where w.id = l.webhook_id;
  get diagnostics n = row_count;
  -- envios sem resposta há mais de 1 hora
  update public.crm_webhook_deliveries set ok = false, error = 'Sem resposta do destino.'
   where ok is null and created_at < now() - interval '1 hour';
  -- mantém 30 dias de registros
  delete from public.crm_webhook_deliveries where created_at < now() - interval '30 days';
  delete from public.crm_rule_runs where ran_at < now() - interval '90 days' and marker is null;
  return n;
end;
$$;

-- =====================================================================
-- Gatilhos na oportunidade
-- =====================================================================
create or replace function private.crm_opportunity_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who uuid;
begin
  if new.owner_id is null and exists (select 1 from public.crm_distribution d where d.agency_id = new.agency_id and d.auto_new) then
    who := private.crm_next_owner(new.agency_id);
    if who is not null then update public.crm_opportunities set owner_id = who where id = new.id; end if;
  end if;
  perform private.crm_run_rules(new.id, 'lead_criado');
  perform private.crm_emit(new.id, 'lead_criado');
  return null;
end;
$$;
create trigger crm_opportunity_created after insert on public.crm_opportunities
  for each row execute function private.crm_opportunity_created();

create or replace function private.crm_opportunity_stage_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage is not distinct from old.stage then return null; end if;
  perform private.crm_emit(new.id, 'etapa_alterada');
  if new.stage = 'fechado' then perform private.crm_emit(new.id, 'fechado'); end if;
  if new.stage = 'perdido' then perform private.crm_emit(new.id, 'perdido'); end if;
  perform private.crm_run_rules(new.id, 'etapa_alterada');
  return null;
end;
$$;
create trigger crm_opportunity_stage_changed after update of stage on public.crm_opportunities
  for each row execute function private.crm_opportunity_stage_changed();

-- =====================================================================
-- API de entrada e formulários (sem login; validam a chave/o formulário aqui)
-- =====================================================================
-- Monta e grava um lead a partir de dados externos. Retorna o id (novo ou existente).
create or replace function private.crm_external_lead(
  a uuid, p jsonb, src text, def_stage public.crm_stage, def_owner uuid, def_origin text, extra_tags text[], out oid uuid, out created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  nm text := left(trim(coalesce(p ->> 'nome', p ->> 'name', '')), 120);
  doc text := nullif(regexp_replace(coalesce(p ->> 'documento', p ->> 'cnpj', p ->> 'cpf', ''), '\D', '', 'g'), '');
  em text := nullif(left(trim(coalesce(p ->> 'email', '')), 200), '');
  st public.crm_stage := def_stage;
  val numeric;
  tg text[] := '{}';
  cu jsonb := '{}';
  msg text := nullif(left(trim(coalesce(p ->> 'mensagem', p ->> 'observacoes', '')), 4000), '');
begin
  if nm = '' then raise exception 'Informe o nome do contato.' using errcode = '22023'; end if;
  if doc is not null and doc !~ '^\d{11}$|^\d{14}$' then raise exception 'CNPJ/CPF inválido.' using errcode = '22023'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.' using errcode = '22023'; end if;
  if p ? 'etapa' then
    if (p ->> 'etapa') not in ('novo_lead', 'contato_feito', 'orcamento', 'proposta', 'negociacao') then
      raise exception 'Etapa inválida.' using errcode = '22023';
    end if;
    st := (p ->> 'etapa')::public.crm_stage;
  end if;
  if nullif(p ->> 'valor_mensal', '') is not null then
    begin
      val := (p ->> 'valor_mensal')::numeric;
    exception when others then raise exception 'Valor inválido.' using errcode = '22023';
    end;
    if val < 0 or val > 999999999 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  end if;
  if jsonb_typeof(p -> 'tags') = 'array' then
    select coalesce(array_agg(distinct left(trim(t), 40)), '{}') into tg
      from jsonb_array_elements_text(p -> 'tags') t where trim(t) <> '';
  end if;
  tg := (select coalesce(array_agg(distinct x), '{}') from unnest(tg || coalesce(extra_tags, '{}')) x);
  if cardinality(tg) > 20 then tg := tg[1:20]; end if;
  -- só campos personalizados que existem na agência
  if jsonb_typeof(p -> 'campos') = 'object' then
    select coalesce(jsonb_object_agg(f.key, left(p -> 'campos' ->> f.key, 500)), '{}') into cu
      from public.crm_custom_fields f where f.agency_id = a and (p -> 'campos') ? f.key;
  end if;

  if doc is not null then
    select id into oid from public.crm_opportunities where agency_id = a and document = doc;
    if oid is not null then
      -- já existe: registra o novo contato como anotação e não duplica
      insert into public.crm_activities (agency_id, opportunity_id, kind, note)
      values (a, oid, 'nota', left('Novo envio (' || src || ')' || coalesce(': ' || msg, ''), 4000));
      created := false;
      return;
    end if;
  end if;

  insert into public.crm_opportunities (agency_id, name, company, document, email, phone, segment, origin, tags, owner_id,
    stage, value, notes, custom, source, position)
  values (a, nm, nullif(left(trim(coalesce(p ->> 'empresa', p ->> 'company', '')), 160), ''), doc, em,
    nullif(left(trim(coalesce(p ->> 'telefone', p ->> 'phone', '')), 40), ''),
    nullif(left(trim(coalesce(p ->> 'segmento', '')), 60), ''),
    coalesce(nullif(left(trim(coalesce(p ->> 'origem', '')), 60), ''), def_origin),
    tg, def_owner, st, val, msg, cu, src, extract(epoch from now()) * 1000)
  returning id into oid;
  created := true;
end;
$$;

create or replace function public.crm_api_create_lead(api_key text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k public.crm_api_keys;
  res record;
begin
  select * into k from public.crm_api_keys
   where key_hash = encode(extensions.digest(coalesce(api_key, ''), 'sha256'), 'hex') and revoked_at is null
   for update;
  if k is null then raise exception 'Chave de API inválida ou revogada.' using errcode = '28000'; end if;
  -- até 120 leads por minuto por chave
  if k.window_start is null or k.window_start < now() - interval '1 minute' then
    update public.crm_api_keys set window_start = now(), window_count = 1, last_used_at = now() where id = k.id;
  elsif k.window_count >= 120 then
    raise exception 'Limite de 120 envios por minuto atingido.' using errcode = '54000';
  else
    update public.crm_api_keys set window_count = window_count + 1, last_used_at = now() where id = k.id;
  end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'Envie um objeto JSON.' using errcode = '22023'; end if;
  select * into res from private.crm_external_lead(k.agency_id, payload, 'api', 'novo_lead', null, 'API', '{}');
  return jsonb_build_object('id', res.oid, 'criado', res.created);
end;
$$;

-- Dados para montar o formulário público.
create or replace function public.crm_form_public(form_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', f.title, 'description', f.description, 'fields', f.fields,
           'success_message', f.success_message, 'agency', g.name)
    from public.crm_forms f join public.agencies g on g.id = f.agency_id
   where f.token = form_token and f.active;
$$;

create or replace function public.crm_form_submit(form_token text, payload jsonb, ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  f public.crm_forms;
  fld jsonb;
  who uuid;
  res record;
begin
  select * into f from public.crm_forms where token = form_token and active for update;
  if f is null then raise exception 'Formulário indisponível.' using errcode = 'P0002'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  -- limite: 5 envios por pessoa a cada 10 minutos e 300 por hora no formulário
  if ip_hash is not null and (select count(*) from public.crm_form_submissions s
       where s.form_id = f.id and s.ip_hash = crm_form_submit.ip_hash and s.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Muitos envios seguidos. Tente de novo em alguns minutos.' using errcode = '54000';
  end if;
  if (select count(*) from public.crm_form_submissions s where s.form_id = f.id and s.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Formulário com muitos envios agora. Tente mais tarde.' using errcode = '54000';
  end if;
  for fld in select * from jsonb_array_elements(f.fields) loop
    if (fld ->> 'required')::boolean and coalesce(trim(payload ->> (case fld ->> 'key'
        when 'company' then 'empresa' when 'phone' then 'telefone' when 'document' then 'documento'
        when 'segment' then 'segmento' when 'message' then 'mensagem' else fld ->> 'key' end)), '') = '' then
      raise exception 'Preencha os campos obrigatórios.' using errcode = '22023';
    end if;
  end loop;
  who := f.owner_id;
  if who is null and f.distribute then who := private.crm_next_owner(f.agency_id); end if;
  -- origem e etapa vêm do formulário, não do visitante
  select * into res from private.crm_external_lead(f.agency_id, (payload - 'etapa' - 'origem' - 'campos' - 'tags' - 'valor_mensal'),
    'formulario', f.stage, who, coalesce(f.origin, 'Formulário: ' || f.name), f.tags);
  insert into public.crm_form_submissions (agency_id, form_id, opportunity_id, ip_hash) values (f.agency_id, f.id, res.oid, ip_hash);
  update public.crm_forms set submissions = submissions + 1 where id = f.id;
  return true;
end;
$$;

revoke all on function public.crm_api_create_lead(text, jsonb) from public;
revoke all on function public.crm_form_public(text) from public;
revoke all on function public.crm_form_submit(text, jsonb, text) from public;
grant execute on function public.crm_api_create_lead(text, jsonb) to anon, authenticated;
grant execute on function public.crm_form_public(text) to anon, authenticated;
grant execute on function public.crm_form_submit(text, jsonb, text) to anon, authenticated;

-- Anotações sem autor (envios externos) são permitidas; contatos continuam exigindo canal.
-- (author_id já é opcional na tabela.)

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.crm_distribution enable row level security;
alter table public.crm_rules enable row level security;
alter table public.crm_rule_runs enable row level security;
alter table public.crm_api_keys enable row level security;
alter table public.crm_webhooks enable row level security;
alter table public.crm_webhook_deliveries enable row level security;
alter table public.crm_forms enable row level security;
alter table public.crm_form_submissions enable row level security;
revoke all on public.crm_distribution, public.crm_rules, public.crm_rule_runs, public.crm_api_keys, public.crm_webhooks,
  public.crm_webhook_deliveries, public.crm_forms, public.crm_form_submissions from anon;

create policy crm_dist_select on public.crm_distribution for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_dist_write on public.crm_distribution for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

create policy crm_rules_select on public.crm_rules for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_rules_write on public.crm_rules for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));

-- execuções: só leitura (gravadas pelas regras)
create policy crm_runs_select on public.crm_rule_runs for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));

-- chaves e webhooks guardam segredos: só administradores
create policy crm_keys_select on public.crm_api_keys for select to authenticated using (private.is_admin(agency_id));
create policy crm_keys_insert on public.crm_api_keys for insert to authenticated
  with check (private.is_admin(agency_id) and created_by = (select auth.uid()));
create policy crm_keys_update on public.crm_api_keys for update to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy crm_keys_delete on public.crm_api_keys for delete to authenticated using (private.is_admin(agency_id));
create policy crm_webhooks_admin on public.crm_webhooks for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy crm_deliveries_admin on public.crm_webhook_deliveries for select to authenticated using (private.is_admin(agency_id));

create policy crm_forms_select on public.crm_forms for select to authenticated using (private.can_access(agency_id, 'comercial', 'ver'));
create policy crm_forms_write on public.crm_forms for all to authenticated
  using (private.can_access(agency_id, 'comercial', 'editar')) with check (private.can_access(agency_id, 'comercial', 'editar'));
create policy crm_form_subs_select on public.crm_form_submissions for select to authenticated using (private.is_admin(agency_id));

-- =====================================================================
-- Agendador
-- =====================================================================
select cron.schedule('crm-regras-sem-contato', '7 * * * *', 'select private.crm_run_idle_rules()');
select cron.schedule('crm-webhooks-retorno', '*/5 * * * *', 'select private.crm_sync_deliveries()');
