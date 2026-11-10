-- Fase 8B: Mapa Mental (por cliente, a partir de modelos) e Funil (desenho de funis com pastas e lixeira).
-- O desenho (blocos e ligações) fica em JSON; o formato é validado no servidor antes de gravar.

create table public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  template text not null default 'em_branco' check (template in ('em_branco', 'campanha', 'briefing', 'pilares')),
  nodes jsonb not null default '[]' check (jsonb_typeof(nodes) = 'array'),
  edges jsonb not null default '[]' check (jsonb_typeof(edges) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(nodes::text) + octet_length(edges::text) < 600000)
);
create index mind_maps_agency_idx on public.mind_maps (agency_id, client_id, updated_at desc);
create trigger mind_maps_updated_at before update on public.mind_maps for each row execute function private.set_updated_at();

create table public.funnel_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (agency_id, name)
);

create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  folder_id uuid references public.funnel_folders (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  template text not null default 'em_branco',
  nodes jsonb not null default '[]' check (jsonb_typeof(nodes) = 'array'),
  edges jsonb not null default '[]' check (jsonb_typeof(edges) = 'array'),
  -- lixeira: some da lista, pode ser restaurado; some de vez depois de 30 dias
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(nodes::text) + octet_length(edges::text) < 600000)
);
create index funnels_agency_idx on public.funnels (agency_id, deleted_at, updated_at desc);
create trigger funnels_updated_at before update on public.funnels for each row execute function private.set_updated_at();

-- pasta e cliente precisam ser da mesma agência
create or replace function private.canvas_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if tg_table_name = 'funnels' and new.folder_id is not null
     and not exists (select 1 from public.funnel_folders f where f.id = new.folder_id and f.agency_id = new.agency_id) then
    raise exception 'Pasta inválida.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.agency_id <> old.agency_id then raise exception 'Alteração não permitida.' using errcode = '42501'; end if;
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger mind_maps_guard before insert or update on public.mind_maps for each row execute function private.canvas_guard();
create trigger funnels_guard before insert or update on public.funnels for each row execute function private.canvas_guard();

alter table public.mind_maps enable row level security;
alter table public.funnel_folders enable row level security;
alter table public.funnels enable row level security;
revoke all on public.mind_maps, public.funnel_folders, public.funnels from anon;

create policy mind_maps_select on public.mind_maps for select to authenticated using (private.can_access(agency_id, 'mapa-mental', 'ver'));
create policy mind_maps_write on public.mind_maps for all to authenticated
  using (private.can_access(agency_id, 'mapa-mental', 'editar')) with check (private.can_access(agency_id, 'mapa-mental', 'editar'));

create policy funnel_folders_select on public.funnel_folders for select to authenticated using (private.can_access(agency_id, 'funil', 'ver'));
create policy funnel_folders_write on public.funnel_folders for all to authenticated
  using (private.can_access(agency_id, 'funil', 'editar')) with check (private.can_access(agency_id, 'funil', 'editar'));
create policy funnels_select on public.funnels for select to authenticated using (private.can_access(agency_id, 'funil', 'ver'));
create policy funnels_write on public.funnels for all to authenticated
  using (private.can_access(agency_id, 'funil', 'editar')) with check (private.can_access(agency_id, 'funil', 'editar'));

-- limpa a lixeira dos funis (mais de 30 dias)
select cron.schedule('funis-lixeira', '17 4 * * *', $$delete from public.funnels where deleted_at < now() - interval '30 days'$$);
