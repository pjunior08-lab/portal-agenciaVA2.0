-- =====================================================================
-- Fase 1 — Núcleo: agência, perfis, equipe, acessos, convites,
-- preferências, notificações e auditoria. Tudo protegido por RLS.
-- Papéis: admin (acesso total) e colaborador (acesso por módulo,
-- concedido por um admin).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------- Tipos ----------
create type public.app_role as enum ('admin', 'colaborador');
create type public.member_status as enum ('ativo', 'desativado');
create type public.access_level as enum ('ver', 'editar');

-- ---------- Função genérica de updated_at ----------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Módulos (catálogo usado nos acessos) ----------
create table public.modules (
  slug text primary key,
  label text not null,
  -- módulos pessoais ficam sempre liberados para todo membro ativo
  always_allowed boolean not null default false,
  position smallint not null
);

insert into public.modules (slug, label, always_allowed, position) values
  ('inicio', 'Início', true, 1),
  ('meu-dia', 'Meu Dia', true, 2),
  ('maestro', 'Assistente IA', false, 3),
  ('agenda', 'Agenda', false, 4),
  ('demandas', 'Demandas', false, 5),
  ('aprovacoes', 'Aprovação', false, 6),
  ('social', 'Social', false, 7),
  ('clientes', 'Clientes', false, 8),
  ('propostas', 'Propostas', false, 9),
  ('contratos', 'Contratos', false, 10),
  ('financeiro', 'Financeiro', false, 11),
  ('plano-de-midia', 'Plano de Mídia', false, 12),
  ('mapa-mental', 'Mapa Mental', false, 13),
  ('funil', 'Funil', false, 14),
  ('comercial', 'Comercial', false, 15),
  ('comunicacao', 'Comunicação', false, 16),
  ('projetos', 'Projetos', false, 17),
  ('servicos', 'Tabela de Serviços', false, 18),
  ('squads', 'Squads', false, 19),
  ('onboarding', 'Onboarding', false, 20),
  ('desempenho', 'Desempenho', false, 21),
  ('notas', 'Notas', false, 22),
  ('checklist', 'Checklist', false, 23),
  ('timesheet', 'Timesheet', false, 24),
  ('drive', 'Drive', false, 25),
  ('ferramentas', 'Ferramentas', false, 26);

-- ---------- Agência ----------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  legal_name text,
  cnpj text,
  email text,
  phone text,
  address text,
  pix_key text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger agencies_updated_at before update on public.agencies
  for each row execute function private.set_updated_at();

-- ---------- Perfis (1:1 com auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null,
  phone text,
  cpf text,
  avatar_path text,
  job_title text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- cria o perfil quando a pessoa se cadastra
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), lower(new.email));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- mantém o e-mail do perfil igual ao da conta
create or replace function private.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------- Membros da agência ----------
create table public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null default 'colaborador',
  status public.member_status not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);
create trigger agency_members_updated_at before update on public.agency_members
  for each row execute function private.set_updated_at();

-- ---------- Acesso por módulo (só para colaboradores) ----------
create table public.member_module_access (
  agency_id uuid not null,
  user_id uuid not null,
  module text not null references public.modules (slug) on delete cascade,
  level public.access_level not null default 'ver',
  primary key (agency_id, user_id, module),
  foreign key (agency_id, user_id) references public.agency_members (agency_id, user_id) on delete cascade
);

-- ---------- Convites ----------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  role public.app_role not null default 'colaborador',
  -- [{ "module": "clientes", "level": "editar" }, ...]
  module_access jsonb not null default '[]'::jsonb check (jsonb_typeof(module_access) = 'array'),
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_open_email_idx on public.invitations (agency_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------- Preferências do membro ----------
create table public.member_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sidebar jsonb not null default '{}'::jsonb,
  finance_emails boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger member_preferences_updated_at before update on public.member_preferences
  for each row execute function private.set_updated_at();

-- ---------- Notificações ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- nulo = notificação geral para toda a equipe
  recipient_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now()
);
create index notifications_agency_idx on public.notifications (agency_id, created_at desc);

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ---------- Auditoria ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- sem chave estrangeira: o histórico sobrevive à exclusão do que registrou
  agency_id uuid,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_agency_idx on public.audit_log (agency_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- =====================================================================
-- Funções de autorização (security definer, search_path vazio)
-- =====================================================================

create or replace function private.is_member(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = (select auth.uid()) and m.status = 'ativo'
  );
$$;

create or replace function private.is_admin(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = (select auth.uid()) and m.status = 'ativo' and m.role = 'admin'
  );
$$;

-- admin: tudo; colaborador: módulo liberado no nível pedido (editar inclui ver)
create or replace function private.can_access(a uuid, mod text, need public.access_level default 'ver')
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin(a)
    or (
      private.is_member(a) and (
        exists (select 1 from public.modules x where x.slug = mod and x.always_allowed)
        or exists (
          select 1 from public.member_module_access ma
          where ma.agency_id = a and ma.user_id = (select auth.uid()) and ma.module = mod
            and (need = 'ver' or ma.level = 'editar')
        )
      )
    );
$$;

-- duas pessoas são da mesma agência (para ver nome/foto de colegas)
create or replace function private.shares_agency(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members me
    join public.agency_members them on them.agency_id = me.agency_id
    where me.user_id = (select auth.uid()) and me.status = 'ativo' and them.user_id = other
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid), private.is_admin(uuid),
  private.can_access(uuid, text, public.access_level), private.shares_agency(uuid) to authenticated;

-- =====================================================================
-- Regras de integridade
-- =====================================================================

-- nunca deixar a agência sem administrador ativo
create or replace function private.keep_one_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  a uuid := old.agency_id;
  loses_admin boolean;
begin
  if tg_op = 'DELETE' then
    loses_admin := true;
  else
    loses_admin := new.role <> 'admin' or new.status <> 'ativo';
  end if;
  if loses_admin
     and old.role = 'admin' and old.status = 'ativo'
     and not exists (
       select 1 from public.agency_members m
       where m.agency_id = a and m.role = 'admin' and m.status = 'ativo' and m.user_id <> old.user_id
     ) then
    raise exception 'A agência precisa ter pelo menos um administrador ativo.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger agency_members_keep_admin before update or delete on public.agency_members
  for each row execute function private.keep_one_admin();

-- auditoria de mudanças na equipe
create or replace function private.audit_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (agency_id, actor_id, action, entity, entity_id, data)
  values (
    coalesce(new.agency_id, old.agency_id), (select auth.uid()),
    lower(tg_op), tg_table_name,
    coalesce(new.user_id, old.user_id)::text,
    jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
  );
  return null;
end;
$$;
create trigger agency_members_audit after insert or update or delete on public.agency_members
  for each row execute function private.audit_members();
create trigger member_module_access_audit after insert or update or delete on public.member_module_access
  for each row execute function private.audit_members();

-- =====================================================================
-- RPCs chamadas pelo app
-- =====================================================================

-- Cria a agência e torna quem chamou o primeiro administrador.
-- Só funciona enquanto não existe nenhuma agência (sistema de uma agência só).
create or replace function public.bootstrap_agency(agency_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception 'Faça login para criar a agência.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(4242);
  if exists (select 1 from public.agencies) then
    raise exception 'A agência já foi criada. Peça um convite a um administrador.' using errcode = '42501';
  end if;
  insert into public.agencies (name) values (trim(agency_name)) returning id into new_id;
  insert into public.agency_members (agency_id, user_id, role) values (new_id, uid, 'admin');
  return new_id;
end;
$$;

-- Diz à tela de cadastro se ainda é possível criar a agência (não expõe dados).
create or replace function public.agency_exists()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agencies);
$$;

-- Cria convite. O token em claro só é devolvido aqui; o banco guarda apenas o hash.
create or replace function public.create_invitation(
  a uuid, invite_email text, invite_role public.app_role, access jsonb default '[]'::jsonb
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.is_admin(a) then
    raise exception 'Só administradores podem convidar.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.agency_members m join public.profiles p on p.id = m.user_id
    where m.agency_id = a and p.email = lower(trim(invite_email))
  ) then
    raise exception 'Essa pessoa já faz parte da equipe.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(access, '[]'::jsonb)) <> 'array' or exists (
    select 1 from jsonb_array_elements(coalesce(access, '[]'::jsonb)) e
    where not exists (select 1 from public.modules x where x.slug = e ->> 'module')
       or coalesce(e ->> 'level', 'ver') not in ('ver', 'editar')
  ) then
    raise exception 'Lista de acessos inválida.' using errcode = '22023';
  end if;
  -- substitui convite aberto anterior para o mesmo e-mail
  update public.invitations set revoked_at = now()
    where agency_id = a and email = lower(trim(invite_email)) and accepted_at is null and revoked_at is null;
  insert into public.invitations (agency_id, email, role, module_access, token_hash, invited_by)
  values (
    a, lower(trim(invite_email)), invite_role,
    case when invite_role = 'admin' then '[]'::jsonb else coalesce(access, '[]'::jsonb) end,
    encode(extensions.digest(token, 'sha256'), 'hex'), (select auth.uid())
  );
  return token;
end;
$$;

-- Dados públicos mínimos do convite (para a tela de aceite), sem exigir login.
create or replace function public.invitation_preview(token text)
returns table (agency_name text, email text, role public.app_role, valid boolean)
language sql stable security definer set search_path = '' as $$
  select a.name, i.email, i.role,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.invitations i join public.agencies a on a.id = i.agency_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;

-- Aceita o convite com a conta logada (o e-mail precisa ser o convidado).
create or replace function public.accept_invitation(token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.invitations;
  item jsonb;
begin
  if uid is null then
    raise exception 'Faça login para aceitar o convite.' using errcode = '42501';
  end if;
  select * into inv from public.invitations
    where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
    for update;
  if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'Convite inválido, já usado ou vencido.' using errcode = 'P0001';
  end if;
  if inv.email <> (select lower(u.email) from auth.users u where u.id = uid) then
    raise exception 'Este convite foi enviado para outro e-mail.' using errcode = '42501';
  end if;

  insert into public.agency_members (agency_id, user_id, role)
  values (inv.agency_id, uid, inv.role)
  on conflict (agency_id, user_id) do update set role = excluded.role, status = 'ativo';

  if inv.role = 'colaborador' then
    for item in select * from jsonb_array_elements(inv.module_access) loop
      insert into public.member_module_access (agency_id, user_id, module, level)
      values (inv.agency_id, uid, item ->> 'module', coalesce((item ->> 'level')::public.access_level, 'ver'))
      on conflict (agency_id, user_id, module) do update set level = excluded.level;
    end loop;
  end if;

  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.agency_id;
end;
$$;

-- Registra um acesso (login) no histórico do próprio usuário.
create or replace function public.log_access(user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then return; end if;
  insert into public.audit_log (agency_id, actor_id, action, entity, data)
  select m.agency_id, uid, 'login', 'auth', jsonb_build_object('user_agent', left(user_agent, 300))
  from public.agency_members m where m.user_id = uid
  union all
  select null, uid, 'login', 'auth', jsonb_build_object('user_agent', left(user_agent, 300))
  where not exists (select 1 from public.agency_members m where m.user_id = uid)
  limit 1;
end;
$$;

revoke execute on function public.bootstrap_agency(text), public.create_invitation(uuid, text, public.app_role, jsonb),
  public.accept_invitation(text), public.log_access(text) from public, anon;
grant execute on function public.bootstrap_agency(text), public.create_invitation(uuid, text, public.app_role, jsonb),
  public.accept_invitation(text), public.log_access(text) to authenticated;
grant execute on function public.agency_exists(), public.invitation_preview(text) to anon, authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.modules enable row level security;
alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.agency_members enable row level security;
alter table public.member_module_access enable row level security;
alter table public.invitations enable row level security;
alter table public.member_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.audit_log enable row level security;

-- módulos: catálogo de leitura para quem está logado
create policy modules_select on public.modules for select to authenticated using (true);

-- agência
create policy agencies_select on public.agencies for select to authenticated
  using (private.is_member(id));
create policy agencies_update on public.agencies for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- perfis: o próprio e os colegas de agência
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_agency(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- membros: todos da agência veem a equipe; só admin altera
create policy members_select on public.agency_members for select to authenticated
  using (private.is_member(agency_id) or user_id = (select auth.uid()));
create policy members_update on public.agency_members for update to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy members_delete on public.agency_members for delete to authenticated
  using (private.is_admin(agency_id));

-- acessos por módulo: a pessoa vê os próprios; admin vê e altera todos
create policy access_select on public.member_module_access for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(agency_id));
create policy access_insert on public.member_module_access for insert to authenticated
  with check (private.is_admin(agency_id));
create policy access_update on public.member_module_access for update to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy access_delete on public.member_module_access for delete to authenticated
  using (private.is_admin(agency_id));

-- convites: só admin lê e revoga (criação só pela RPC)
create policy invitations_select on public.invitations for select to authenticated
  using (private.is_admin(agency_id));
create policy invitations_update on public.invitations for update to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- preferências: só as próprias
create policy prefs_all on public.member_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- notificações: gerais da agência ou endereçadas à pessoa
create policy notifications_select on public.notifications for select to authenticated
  using (private.is_member(agency_id) and (recipient_id is null or recipient_id = (select auth.uid())));
create policy notifications_insert on public.notifications for insert to authenticated
  with check (private.is_member(agency_id));
create policy reads_all on public.notification_reads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- auditoria: admin vê a da agência; cada um vê os próprios acessos
create policy audit_select on public.audit_log for select to authenticated
  using ((agency_id is not null and private.is_admin(agency_id)) or actor_id = (select auth.uid()));

-- anon não acessa nenhuma tabela diretamente
revoke all on all tables in schema public from anon;
