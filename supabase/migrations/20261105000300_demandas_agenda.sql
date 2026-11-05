-- =====================================================================
-- Fase 3 — Demandas, Agenda, Disponibilidade e Checklist
-- Demandas: módulo "demandas" (ver/editar); quem é responsável por uma
-- demanda sempre a vê. Agenda: módulo "agenda"; atividades privadas só
-- para o dono e participantes. Checklist: pessoal.
-- =====================================================================

create type public.task_type as enum ('post', 'demanda');
create type public.task_priority as enum ('alta', 'media', 'baixa');
create type public.card_image as enum ('miniatura', 'capa', 'sem');
create type public.attachment_kind as enum ('arquivo', 'link');
create type public.event_visibility as enum ('agencia', 'privado');

-- ---------- Quadros e colunas ----------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  card_image public.card_image not null default 'miniatura',
  position double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_agency_idx on public.boards (agency_id, position);
create trigger boards_updated_at before update on public.boards
  for each row execute function private.set_updated_at();

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color text not null default '#8e8e96' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position double precision not null default 0,
  -- coluna de "feito": mover a demanda para cá marca como concluída
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index board_columns_board_idx on public.board_columns (board_id, position);

-- ---------- Etiquetas ----------
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default '#feb800' check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique (agency_id, name)
);

-- ---------- Demandas ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  column_id uuid not null references public.board_columns (id) on delete restrict,
  client_id uuid references public.clients (id) on delete set null,
  label_id uuid references public.labels (id) on delete set null,
  type public.task_type not null default 'demanda',
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  caption text not null default '' check (char_length(caption) <= 5000),
  priority public.task_priority,
  start_date date,
  due_date date,
  publish_at timestamptz,
  position double precision not null default 0,
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or start_date <= due_date)
);
create index tasks_board_idx on public.tasks (board_id, column_id, position) where archived_at is null;
create index tasks_due_idx on public.tasks (agency_id, due_date) where archived_at is null;
create index tasks_client_idx on public.tasks (client_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

-- coluna e quadro precisam combinar; concluída = está numa coluna "feito"
create or replace function private.tasks_consistency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  col public.board_columns;
begin
  select * into col from public.board_columns where id = new.column_id;
  if col.id is null or col.board_id <> new.board_id or col.agency_id <> new.agency_id then
    raise exception 'A coluna não pertence a este quadro.' using errcode = '23514';
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id
  ) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if col.is_done and new.completed_at is null then
    new.completed_at := now();
  elsif not col.is_done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_consistency before insert or update of column_id, board_id, client_id on public.tasks
  for each row execute function private.tasks_consistency();

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind public.attachment_kind not null,
  name text not null check (char_length(name) between 1 and 255),
  url text check (url is null or url ~* '^https?://'),
  path text unique,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  mime_type text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null and path is null) or (kind = 'arquivo' and path is not null)),
  check (path is null or path like agency_id::text || '/' || task_id::text || '/%')
);
create index task_attachments_task_idx on public.task_attachments (task_id);

-- ---------- Agenda ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  location text check (char_length(location) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  visibility public.event_visibility not null default 'agencia',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index events_agency_idx on public.events (agency_id, starts_at);
create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  primary key (event_id, user_id)
);
create index event_attendees_user_idx on public.event_attendees (user_id);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index availability_user_idx on public.availability_rules (user_id, weekday);

-- ---------- Checklist pessoal ----------
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  due_date date,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index checklist_user_idx on public.checklist_items (user_id, done_at, position);

-- ---------- auditoria ----------
create trigger boards_audit after insert or update or delete on public.boards
  for each row execute function private.audit_generic();
create trigger tasks_audit after delete on public.tasks
  for each row execute function private.audit_generic();

-- =====================================================================
-- Funções de autorização
-- =====================================================================
create or replace function private.is_task_assignee(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_assignees a where a.task_id = t and a.user_id = (select auth.uid()));
$$;

create or replace function private.can_see_task(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks x
    where x.id = t and (private.can_access(x.agency_id, 'demandas', 'ver') or private.is_task_assignee(t))
      and private.is_member(x.agency_id)
  );
$$;

create or replace function private.can_see_event(e uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events ev
    where ev.id = e and private.is_member(ev.agency_id) and (
      ev.owner_id = (select auth.uid())
      or exists (select 1 from public.event_attendees a where a.event_id = e and a.user_id = (select auth.uid()))
      or (ev.visibility = 'agencia' and private.can_access(ev.agency_id, 'agenda', 'ver'))
    )
  );
$$;

grant execute on function private.is_task_assignee(uuid), private.can_see_task(uuid), private.can_see_event(uuid) to authenticated;

-- Cria um quadro com as colunas padrão (A fazer, Fazendo, Feito).
create or replace function public.create_board(a uuid, board_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b uuid;
begin
  if not private.can_access(a, 'demandas', 'editar') then
    raise exception 'Sem permissão para criar quadros.' using errcode = '42501';
  end if;
  insert into public.boards (agency_id, name, position, created_by)
  values (a, trim(board_name), extract(epoch from now()), (select auth.uid()))
  returning id into b;
  insert into public.board_columns (agency_id, board_id, name, color, position, is_done) values
    (a, b, 'A fazer', '#2f7be5', 1, false),
    (a, b, 'Fazendo', '#feb800', 2, false),
    (a, b, 'Feito', '#1f9d55', 3, true);
  return b;
end;
$$;

-- Portal do Cliente: demandas em andamento do próprio cliente (só campos não sensíveis).
create or replace function public.portal_tasks_in_progress(c uuid)
returns table (id uuid, title text, type public.task_type, column_name text, column_color text, due_date date, publish_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.title, t.type, col.name, col.color, t.due_date, t.publish_at
  from public.tasks t
  join public.board_columns col on col.id = t.column_id
  where t.client_id = c
    and t.archived_at is null
    and not col.is_done
    and (private.portal_section(c, 'em-andamento')
         or private.can_access((select agency_id from public.clients where id = c), 'clientes', 'ver'))
  order by t.due_date nulls last, t.created_at;
$$;

revoke execute on function public.create_board(uuid, text), public.portal_tasks_in_progress(uuid) from public, anon;
grant execute on function public.create_board(uuid, text), public.portal_tasks_in_progress(uuid) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_attachments enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.availability_rules enable row level security;
alter table public.checklist_items enable row level security;

-- quadros, colunas, etiquetas: ver = módulo ou ser responsável por alguma demanda do quadro
create policy boards_select on public.boards for select to authenticated
  using (private.can_access(agency_id, 'demandas', 'ver')
         or exists (select 1 from public.tasks t join public.task_assignees a on a.task_id = t.id
                    where t.board_id = boards.id and a.user_id = (select auth.uid())));
create policy boards_write on public.boards for update to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar')) with check (private.can_access(agency_id, 'demandas', 'editar'));
create policy boards_delete on public.boards for delete to authenticated using (private.is_admin(agency_id));

create policy columns_select on public.board_columns for select to authenticated
  using (private.can_access(agency_id, 'demandas', 'ver')
         or exists (select 1 from public.tasks t join public.task_assignees a on a.task_id = t.id
                    where t.column_id = board_columns.id and a.user_id = (select auth.uid())));
create policy columns_insert on public.board_columns for insert to authenticated
  with check (private.can_access(agency_id, 'demandas', 'editar')
              and exists (select 1 from public.boards b where b.id = board_id and b.agency_id = board_columns.agency_id));
create policy columns_update on public.board_columns for update to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar')) with check (private.can_access(agency_id, 'demandas', 'editar'));
create policy columns_delete on public.board_columns for delete to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar'));

create policy labels_select on public.labels for select to authenticated using (private.is_member(agency_id));
create policy labels_insert on public.labels for insert to authenticated with check (private.can_access(agency_id, 'demandas', 'editar'));
create policy labels_update on public.labels for update to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar')) with check (private.can_access(agency_id, 'demandas', 'editar'));
create policy labels_delete on public.labels for delete to authenticated using (private.can_access(agency_id, 'demandas', 'editar'));

-- demandas: responsável vê e pode mover/atualizar a própria demanda
create policy tasks_select on public.tasks for select to authenticated
  using (private.is_member(agency_id) and (private.can_access(agency_id, 'demandas', 'ver') or private.is_task_assignee(id)));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.can_access(agency_id, 'demandas', 'editar'));
create policy tasks_update on public.tasks for update to authenticated
  using (private.is_member(agency_id) and (private.can_access(agency_id, 'demandas', 'editar') or private.is_task_assignee(id)))
  with check (private.is_member(agency_id) and (private.can_access(agency_id, 'demandas', 'editar') or private.is_task_assignee(id)));
create policy tasks_delete on public.tasks for delete to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar'));

create policy assignees_select on public.task_assignees for select to authenticated using (private.can_see_task(task_id));
create policy assignees_insert on public.task_assignees for insert to authenticated
  with check (private.can_access(agency_id, 'demandas', 'editar')
              and exists (select 1 from public.tasks t where t.id = task_id and t.agency_id = task_assignees.agency_id)
              and exists (select 1 from public.agency_members m where m.user_id = task_assignees.user_id
                          and m.agency_id = task_assignees.agency_id and m.status = 'ativo'));
create policy assignees_delete on public.task_assignees for delete to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar'));

create policy attachments_select on public.task_attachments for select to authenticated using (private.can_see_task(task_id));
create policy attachments_insert on public.task_attachments for insert to authenticated
  with check (private.is_member(agency_id)
              and (private.can_access(agency_id, 'demandas', 'editar') or private.is_task_assignee(task_id))
              and exists (select 1 from public.tasks t where t.id = task_id and t.agency_id = task_attachments.agency_id));
create policy attachments_delete on public.task_attachments for delete to authenticated
  using (private.can_access(agency_id, 'demandas', 'editar') or created_by = (select auth.uid()));

-- agenda
create policy events_select on public.events for select to authenticated using (private.can_see_event(id));
create policy events_insert on public.events for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.can_access(agency_id, 'agenda', 'ver')
              and (client_id is null or exists (select 1 from public.clients c where c.id = client_id and c.agency_id = events.agency_id)));
create policy events_update on public.events for update to authenticated
  using (private.is_member(agency_id) and (owner_id = (select auth.uid())
         or (visibility = 'agencia' and private.can_access(agency_id, 'agenda', 'editar'))))
  with check (private.is_member(agency_id));
create policy events_delete on public.events for delete to authenticated
  using (private.is_member(agency_id) and (owner_id = (select auth.uid())
         or (visibility = 'agencia' and private.can_access(agency_id, 'agenda', 'editar'))));

create policy attendees_select on public.event_attendees for select to authenticated using (private.can_see_event(event_id));
create policy attendees_insert on public.event_attendees for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and e.agency_id = event_attendees.agency_id
                      and (e.owner_id = (select auth.uid()) or private.can_access(e.agency_id, 'agenda', 'editar')))
              and exists (select 1 from public.agency_members m where m.user_id = event_attendees.user_id
                          and m.agency_id = event_attendees.agency_id and m.status = 'ativo'));
create policy attendees_delete on public.event_attendees for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id
                 and (e.owner_id = (select auth.uid()) or private.can_access(e.agency_id, 'agenda', 'editar'))));

-- disponibilidade: a equipe vê a de todos; cada um edita a sua; admin edita qualquer uma
create policy availability_select on public.availability_rules for select to authenticated using (private.is_member(agency_id));
create policy availability_insert on public.availability_rules for insert to authenticated
  with check (private.is_member(agency_id) and (user_id = (select auth.uid()) or private.is_admin(agency_id)));
create policy availability_update on public.availability_rules for update to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(agency_id))
  with check (private.is_member(agency_id) and (user_id = (select auth.uid()) or private.is_admin(agency_id)));
create policy availability_delete on public.availability_rules for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(agency_id));

-- checklist: só a própria pessoa
create policy checklist_all on public.checklist_items for all to authenticated
  using (user_id = (select auth.uid()) and private.is_member(agency_id))
  with check (user_id = (select auth.uid()) and private.is_member(agency_id));

revoke all on public.boards, public.board_columns, public.labels, public.tasks, public.task_assignees,
  public.task_attachments, public.events, public.event_attendees, public.availability_rules,
  public.checklist_items from anon;

-- =====================================================================
-- Storage: bucket privado "demandas"  (<agency_id>/<task_id>/<arquivo>)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('demandas', 'demandas', false, 52428800)
on conflict (id) do nothing;

create policy demandas_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'demandas' and private.can_see_task(private.uuid_or_null((storage.foldername(name))[2])));
create policy demandas_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'demandas'
    and exists (
      select 1 from public.tasks t
      where t.id = private.uuid_or_null((storage.foldername(name))[2])
        and t.agency_id = private.uuid_or_null((storage.foldername(name))[1])
        and private.is_member(t.agency_id)
        and (private.can_access(t.agency_id, 'demandas', 'editar') or private.is_task_assignee(t.id))
    )
  );
create policy demandas_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'demandas'
         and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'demandas', 'editar'));
