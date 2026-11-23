-- Tabela de Serviços e Checklists (modelos aplicados em demandas e clientes).
-- Também tira do cadastro os módulos cortados do menu em 23/11.

delete from public.modules where slug in ('projetos', 'squads', 'notas', 'drive', 'timesheet', 'ferramentas', 'onboarding');

-- ---------- Tabela de Serviços ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  cadence public.item_cadence not null default 'mensal',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0 and unit_price <= 99999999),
  scope_html text not null default '' check (char_length(scope_html) <= 20000),
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index services_name_idx on public.services (agency_id, lower(trim(name)));
create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();

alter table public.services enable row level security;
revoke all on public.services from anon;
-- quem monta proposta também precisa ler a tabela
create policy services_select on public.services for select to authenticated
  using (private.can_access(agency_id, 'servicos', 'ver') or private.can_access(agency_id, 'propostas', 'ver'));
create policy services_write on public.services for all to authenticated
  using (private.can_access(agency_id, 'servicos', 'editar'))
  with check (private.can_access(agency_id, 'servicos', 'editar'));
create trigger services_audit after insert or update or delete on public.services
  for each row execute function private.audit_generic();

-- ---------- Checklist: modelos ----------
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  -- onde costuma ser usado: numa demanda ou no perfil de um cliente
  applies_to text not null default 'demanda' check (applies_to in ('demanda', 'cliente')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index checklist_templates_name_idx on public.checklist_templates (agency_id, lower(trim(name)));
create trigger checklist_templates_updated_at before update on public.checklist_templates
  for each row execute function private.set_updated_at();

alter table public.checklist_templates enable row level security;
revoke all on public.checklist_templates from anon;
-- quem aplica em demanda/cliente precisa ver os modelos
create policy checklist_templates_select on public.checklist_templates for select to authenticated
  using (private.can_access(agency_id, 'checklist', 'ver') or private.can_access(agency_id, 'demandas', 'ver')
         or private.can_access(agency_id, 'clientes', 'ver'));
create policy checklist_templates_write on public.checklist_templates for all to authenticated
  using (private.can_access(agency_id, 'checklist', 'editar'))
  with check (private.can_access(agency_id, 'checklist', 'editar'));

-- ---------- Checklist aplicado (numa demanda ou num cliente) ----------
-- items: [{ "text": "...", "done": bool, "done_by": uuid|null, "done_at": timestamptz|null }]
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  template_id uuid references public.checklist_templates (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  task_id uuid references public.tasks (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((task_id is null) <> (client_id is null))
);
create index checklists_task_idx on public.checklists (task_id) where task_id is not null;
create index checklists_client_idx on public.checklists (client_id) where client_id is not null;
create trigger checklists_updated_at before update on public.checklists
  for each row execute function private.set_updated_at();

-- a demanda/cliente precisa ser da mesma agência
create or replace function private.checklists_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is not null and not exists (select 1 from public.tasks t where t.id = new.task_id and t.agency_id = new.agency_id) then
    raise exception 'Demanda inválida.' using errcode = '23514';
  end if;
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if new.template_id is not null and not exists (
    select 1 from public.checklist_templates x where x.id = new.template_id and x.agency_id = new.agency_id
  ) then
    raise exception 'Modelo inválido.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.task_id is distinct from old.task_id or new.client_id is distinct from old.client_id) then
    raise exception 'Não dá para mudar o checklist de lugar.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger checklists_guard before insert or update on public.checklists
  for each row execute function private.checklists_guard();

alter table public.checklists enable row level security;
revoke all on public.checklists from anon;
create policy checklists_select on public.checklists for select to authenticated
  using (
    (task_id is not null and private.can_see_task(task_id))
    or (client_id is not null and private.can_access(agency_id, 'clientes', 'ver'))
  );
-- marcar itens: quem pode mexer na demanda (inclusive responsável) ou editar o cliente
create policy checklists_write on public.checklists for all to authenticated
  using (
    private.is_member(agency_id) and (
      (task_id is not null and (private.can_access(agency_id, 'demandas', 'editar') or private.is_task_assignee(task_id)))
      or (client_id is not null and private.can_access(agency_id, 'clientes', 'editar'))
    )
  )
  with check (
    private.is_member(agency_id) and (
      (task_id is not null and (private.can_access(agency_id, 'demandas', 'editar') or private.is_task_assignee(task_id)))
      or (client_id is not null and private.can_access(agency_id, 'clientes', 'editar'))
    )
  );
