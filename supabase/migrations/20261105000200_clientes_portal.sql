-- =====================================================================
-- Fase 2 — Clientes e Portal do Cliente
-- clientes, anotações, arquivos (Storage), Central Estratégica,
-- acesso ao portal (seções, logins de cliente, convites).
-- Equipe: precisa do módulo "clientes" (ver/editar). Excluir: só admin.
-- Cliente no portal: vê só o próprio cliente e só o que foi compartilhado.
-- =====================================================================

create type public.client_status as enum ('ativo', 'pausado', 'inativo', 'arquivado');

-- ---------- utilitário ----------
create or replace function private.uuid_or_null(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- ---------- Clientes ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status public.client_status not null default 'ativo',
  segment_icon text,
  cover_color text check (cover_color is null or cover_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_light_path text,
  logo_dark_path text,
  client_since date,
  notes text check (char_length(notes) <= 5000),
  auto_reminders boolean not null default true,
  contact_name text,
  email text,
  phone text,
  document text,
  address text,
  monthly_fee numeric(12, 2) check (monthly_fee is null or monthly_fee >= 0),
  billing_day smallint check (billing_day is null or billing_day between 1 and 31),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_agency_idx on public.clients (agency_id, status, name);
create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

-- ---------- Anotações ----------
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  shared_with_client boolean not null default false,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);
create trigger client_notes_updated_at before update on public.client_notes
  for each row execute function private.set_updated_at();

-- ---------- Arquivos (metadados; o conteúdo fica no Storage) ----------
create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  path text not null unique,
  name text not null check (char_length(name) between 1 and 255),
  size_bytes bigint not null check (size_bytes >= 0),
  mime_type text,
  shared_with_client boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (path like agency_id::text || '/' || client_id::text || '/arquivos/%')
);
create index client_files_client_idx on public.client_files (client_id, created_at desc);

-- ---------- Central Estratégica ----------
create table public.client_strategy (
  client_id uuid primary key references public.clients (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  persona text not null default '' check (char_length(persona) <= 10000),
  profile_audit text not null default '' check (char_length(profile_audit) <= 10000),
  competitors text not null default '' check (char_length(competitors) <= 10000),
  positioning text not null default '' check (char_length(positioning) <= 10000),
  visual_identity text not null default '' check (char_length(visual_identity) <= 10000),
  share_token_hash text unique,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger client_strategy_updated_at before update on public.client_strategy
  for each row execute function private.set_updated_at();

-- ---------- Portal do Cliente ----------
create table public.client_portal (
  client_id uuid primary key references public.clients (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$'),
  enabled boolean not null default true,
  sections text[] not null default '{}' check (
    sections <@ array['aprovacoes','calendario','em-andamento','mensagens','anotacoes','arquivos',
                      'metricas','relatorio','servicos','faturas','acessos']::text[]
  ),
  updated_at timestamptz not null default now()
);
create trigger client_portal_updated_at before update on public.client_portal
  for each row execute function private.set_updated_at();

create table public.client_users (
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  status public.member_status not null default 'ativo',
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index client_users_user_idx on public.client_users (user_id);

create table public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index client_invitations_open_idx on public.client_invitations (client_id, email)
  where accepted_at is null and revoked_at is null;

-- auditoria de mudanças sensíveis
create or replace function private.audit_generic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into public.audit_log (agency_id, actor_id, action, entity, entity_id, data)
  values (
    private.uuid_or_null(rec ->> 'agency_id'), (select auth.uid()), lower(tg_op), tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'client_id'),
    jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
  );
  return null;
end;
$$;
create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function private.audit_generic();
create trigger client_users_audit after insert or update or delete on public.client_users
  for each row execute function private.audit_generic();
create trigger client_portal_audit after insert or update or delete on public.client_portal
  for each row execute function private.audit_generic();

-- =====================================================================
-- Autorização do portal
-- =====================================================================
create or replace function private.is_client_user(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.client_users cu
    join public.client_portal p on p.client_id = cu.client_id
    where cu.client_id = c and cu.user_id = (select auth.uid()) and cu.status = 'ativo' and p.enabled
  );
$$;

create or replace function private.portal_section(c uuid, section text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_client_user(c) and exists (
    select 1 from public.client_portal p where p.client_id = c and section = any (p.sections)
  );
$$;

grant execute on function private.is_client_user(uuid), private.portal_section(uuid, text),
  private.uuid_or_null(text) to authenticated;

-- =====================================================================
-- RPCs
-- =====================================================================

-- convite de login do cliente (quem edita clientes pode convidar)
create or replace function public.create_client_invitation(c uuid, invite_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  a uuid;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select agency_id into a from public.clients where id = c;
  if a is null or not private.can_access(a, 'clientes', 'editar') then
    raise exception 'Sem permissão para convidar este cliente.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.client_portal where client_id = c) then
    raise exception 'Configure o endereço do portal antes de convidar.' using errcode = 'P0001';
  end if;
  update public.client_invitations set revoked_at = now()
    where client_id = c and email = lower(trim(invite_email)) and accepted_at is null and revoked_at is null;
  insert into public.client_invitations (agency_id, client_id, email, token_hash, invited_by)
  values (a, c, lower(trim(invite_email)), encode(extensions.digest(token, 'sha256'), 'hex'), (select auth.uid()));
  return token;
end;
$$;

create or replace function public.client_invitation_preview(token text)
returns table (client_name text, agency_name text, email text, slug text, valid boolean)
language sql stable security definer set search_path = '' as $$
  select c.name, a.name, i.email, p.slug,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.client_invitations i
  join public.clients c on c.id = i.client_id
  join public.agencies a on a.id = i.agency_id
  left join public.client_portal p on p.client_id = i.client_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;

create or replace function public.accept_client_invitation(token text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.client_invitations;
  s text;
begin
  if uid is null then
    raise exception 'Faça login para aceitar o convite.' using errcode = '42501';
  end if;
  select * into inv from public.client_invitations
    where token_hash = encode(extensions.digest(token, 'sha256'), 'hex') for update;
  if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'Convite inválido, já usado ou vencido.' using errcode = 'P0001';
  end if;
  if inv.email <> (select lower(u.email) from auth.users u where u.id = uid) then
    raise exception 'Este convite foi enviado para outro e-mail.' using errcode = '42501';
  end if;
  insert into public.client_users (client_id, user_id, agency_id)
  values (inv.client_id, uid, inv.agency_id)
  on conflict (client_id, user_id) do update set status = 'ativo';
  update public.client_invitations set accepted_at = now() where id = inv.id;
  select p.slug into s from public.client_portal p where p.client_id = inv.client_id;
  return s;
end;
$$;

-- link de compartilhamento da Central Estratégica (gera novo e invalida o anterior)
create or replace function public.share_client_strategy(c uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  a uuid;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select agency_id into a from public.clients where id = c;
  if a is null or not private.can_access(a, 'clientes', 'editar') then
    raise exception 'Sem permissão para compartilhar.' using errcode = '42501';
  end if;
  insert into public.client_strategy (client_id, agency_id, share_token_hash, updated_by)
  values (c, a, encode(extensions.digest(token, 'sha256'), 'hex'), (select auth.uid()))
  on conflict (client_id) do update set share_token_hash = excluded.share_token_hash;
  return token;
end;
$$;

create or replace function public.unshare_client_strategy(c uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  select agency_id into a from public.clients where id = c;
  if a is null or not private.can_access(a, 'clientes', 'editar') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.client_strategy set share_token_hash = null where client_id = c;
end;
$$;

-- leitura pública (somente com o link) da Central Estratégica
create or replace function public.shared_client_strategy(token text)
returns table (client_name text, agency_name text, persona text, profile_audit text, competitors text,
               positioning text, visual_identity text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.name, a.name, s.persona, s.profile_audit, s.competitors, s.positioning, s.visual_identity, s.updated_at
  from public.client_strategy s
  join public.clients c on c.id = s.client_id
  join public.agencies a on a.id = s.agency_id
  where s.share_token_hash is not null
    and s.share_token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;

-- portais a que a pessoa logada tem acesso (para redirecionar após o login)
create or replace function public.my_client_portals()
returns table (client_id uuid, client_name text, slug text, agency_name text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, p.slug, a.name
  from public.client_users cu
  join public.clients c on c.id = cu.client_id
  join public.agencies a on a.id = c.agency_id
  join public.client_portal p on p.client_id = cu.client_id
  where cu.user_id = (select auth.uid()) and cu.status = 'ativo' and p.enabled
  order by c.name;
$$;

revoke execute on function public.create_client_invitation(uuid, text), public.accept_client_invitation(text),
  public.share_client_strategy(uuid), public.unshare_client_strategy(uuid), public.my_client_portals() from public, anon;
grant execute on function public.create_client_invitation(uuid, text), public.accept_client_invitation(text),
  public.share_client_strategy(uuid), public.unshare_client_strategy(uuid), public.my_client_portals() to authenticated;
grant execute on function public.client_invitation_preview(text), public.shared_client_strategy(text) to anon, authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_files enable row level security;
alter table public.client_strategy enable row level security;
alter table public.client_portal enable row level security;
alter table public.client_users enable row level security;
alter table public.client_invitations enable row level security;

-- clientes
create policy clients_select on public.clients for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver') or private.is_client_user(id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.can_access(agency_id, 'clientes', 'editar'));
create policy clients_update on public.clients for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));
create policy clients_delete on public.clients for delete to authenticated
  using (private.is_admin(agency_id));

-- anotações
create policy notes_select on public.client_notes for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver')
         or (shared_with_client and private.portal_section(client_id, 'anotacoes')));
create policy notes_insert on public.client_notes for insert to authenticated
  with check (private.can_access(agency_id, 'clientes', 'editar')
              and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_notes.agency_id));
create policy notes_update on public.client_notes for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));
create policy notes_delete on public.client_notes for delete to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'));

-- arquivos
create policy files_select on public.client_files for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver')
         or (shared_with_client and private.portal_section(client_id, 'arquivos')));
create policy files_insert on public.client_files for insert to authenticated
  with check (private.can_access(agency_id, 'clientes', 'editar')
              and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_files.agency_id));
create policy files_update on public.client_files for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));
create policy files_delete on public.client_files for delete to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'));

-- central estratégica (só equipe; o link público passa pela RPC)
create policy strategy_select on public.client_strategy for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver'));
create policy strategy_insert on public.client_strategy for insert to authenticated
  with check (private.can_access(agency_id, 'clientes', 'editar')
              and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_strategy.agency_id));
create policy strategy_update on public.client_strategy for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));

-- portal
create policy portal_select on public.client_portal for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver') or private.is_client_user(client_id));
create policy portal_insert on public.client_portal for insert to authenticated
  with check (private.can_access(agency_id, 'clientes', 'editar')
              and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_portal.agency_id));
create policy portal_update on public.client_portal for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));

create policy client_users_select on public.client_users for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'ver') or user_id = (select auth.uid()));
create policy client_users_update on public.client_users for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));
create policy client_users_delete on public.client_users for delete to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'));

create policy client_inv_select on public.client_invitations for select to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'));
create policy client_inv_update on public.client_invitations for update to authenticated
  using (private.can_access(agency_id, 'clientes', 'editar'))
  with check (private.can_access(agency_id, 'clientes', 'editar'));

-- a equipe vê o perfil (nome, e-mail) dos logins de cliente da agência
create policy profiles_select_client_users on public.profiles for select to authenticated
  using (exists (
    select 1 from public.client_users cu
    where cu.user_id = profiles.id and private.can_access(cu.agency_id, 'clientes', 'ver')
  ));

revoke all on public.clients, public.client_notes, public.client_files, public.client_strategy,
  public.client_portal, public.client_users, public.client_invitations from anon;

-- =====================================================================
-- Storage: bucket privado "clientes"
-- caminho: <agency_id>/<client_id>/(arquivos|logo)/<arquivo>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('clientes', 'clientes', false, 52428800)
on conflict (id) do nothing;

create policy clientes_obj_select on storage.objects for select to authenticated
  using (
    bucket_id = 'clientes' and (
      private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'clientes', 'ver')
      or (
        (storage.foldername(name))[3] = 'logo'
        and private.is_client_user(private.uuid_or_null((storage.foldername(name))[2]))
      )
      or exists (
        select 1 from public.client_files f
        where f.path = name and f.shared_with_client and private.portal_section(f.client_id, 'arquivos')
      )
    )
  );
create policy clientes_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clientes'
    and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'clientes', 'editar')
    and exists (
      select 1 from public.clients c
      where c.id = private.uuid_or_null((storage.foldername(name))[2])
        and c.agency_id = private.uuid_or_null((storage.foldername(name))[1])
    )
    and (storage.foldername(name))[3] in ('arquivos', 'logo')
  );
create policy clientes_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'clientes' and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'clientes', 'editar'))
  with check (bucket_id = 'clientes' and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'clientes', 'editar'));
create policy clientes_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'clientes' and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'clientes', 'editar'));
