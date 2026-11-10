-- Fase 8A: Comunicação — chat interno (conversas diretas e grupos) e chat com clientes pelo Portal.

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  kind text not null check (kind in ('direta', 'grupo', 'cliente')),
  name text check (char_length(trim(name)) between 1 and 80),
  client_id uuid references public.clients (id) on delete cascade,
  -- conversa direta: os dois participantes em ordem (evita duplicar)
  dm_key text unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  check (kind <> 'grupo' or name is not null),
  check (kind <> 'cliente' or client_id is not null),
  check (kind <> 'direta' or dm_key is not null)
);
create unique index chat_conversations_client_idx on public.chat_conversations (client_id) where kind = 'cliente';
create index chat_conversations_agency_idx on public.chat_conversations (agency_id, last_message_at desc nulls last);

create table public.chat_participants (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- em conversas de cliente, a linha só guarda até onde a pessoa leu
  member boolean not null default true,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index chat_participants_user_idx on public.chat_participants (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or char_length(trim(body)) >= 1)
);
create index chat_messages_conv_idx on public.chat_messages (conversation_id, created_at desc);

-- =====================================================================
-- Quem vê e quem escreve
-- =====================================================================
-- Conversas internas: participantes com acesso ao módulo. Conversas de cliente: a equipe com acesso
-- ao módulo e as pessoas do cliente com a seção "Mensagens" liberada no Portal.
create or replace function private.chat_can_see(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_conversations c
     where c.id = conv
       and (
         (c.kind in ('direta', 'grupo') and private.can_access(c.agency_id, 'comunicacao', 'ver')
            and exists (select 1 from public.chat_participants p where p.conversation_id = c.id and p.user_id = (select auth.uid()) and p.member))
         or (c.kind = 'cliente' and (private.can_access(c.agency_id, 'comunicacao', 'ver') or private.portal_section(c.client_id, 'mensagens')))
       )
  );
$$;

-- Escrever: internas, qualquer participante; com cliente, a equipe com edição no módulo e o próprio cliente.
create or replace function private.chat_can_post(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_conversations c
     where c.id = conv
       and (
         (c.kind in ('direta', 'grupo') and private.chat_can_see(c.id))
         or (c.kind = 'cliente' and (private.can_access(c.agency_id, 'comunicacao', 'editar') or private.portal_section(c.client_id, 'mensagens')))
       )
  );
$$;
grant execute on function private.chat_can_see(uuid), private.chat_can_post(uuid) to authenticated;

create or replace function private.chat_messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.agency_id := (select c.agency_id from public.chat_conversations c where c.id = new.conversation_id);
    new.created_at := now();
    new.deleted_at := null;
    new.body := trim(new.body);
  else
    -- só dá para apagar (o texto some); editar não existe
    if new.body is distinct from old.body and new.deleted_at is null then
      raise exception 'Mensagens não podem ser editadas.' using errcode = '42501';
    end if;
    if new.conversation_id <> old.conversation_id or new.author_id is distinct from old.author_id or new.created_at <> old.created_at then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
    if new.deleted_at is not null then new.body := ''; end if;
  end if;
  return new;
end;
$$;
create trigger chat_messages_guard before insert or update on public.chat_messages
  for each row execute function private.chat_messages_guard();

create or replace function private.chat_after_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.chat_conversations
       set last_message_at = new.created_at, last_message_preview = left(new.body, 140)
     where id = new.conversation_id;
    -- quem escreve já leu
    insert into public.chat_participants (conversation_id, user_id, agency_id, member, last_read_at)
    values (new.conversation_id, new.author_id, new.agency_id, false, new.created_at)
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  elsif new.deleted_at is not null and old.deleted_at is null then
    update public.chat_conversations c
       set last_message_preview = (select left(m.body, 140) from public.chat_messages m
                                    where m.conversation_id = c.id and m.deleted_at is null order by m.created_at desc limit 1)
     where c.id = new.conversation_id;
  end if;
  return null;
end;
$$;
create trigger chat_after_message after insert or update of deleted_at on public.chat_messages
  for each row execute function private.chat_after_message();

-- =====================================================================
-- Abrir conversas
-- =====================================================================
create or replace function public.chat_open_direct(a uuid, other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  k text;
  cid uuid;
begin
  if not private.can_access(a, 'comunicacao', 'ver') then raise exception 'Sem acesso à Comunicação.' using errcode = '42501'; end if;
  if other = me then raise exception 'Escolha outra pessoa.' using errcode = '22023'; end if;
  if not exists (select 1 from public.agency_members m where m.agency_id = a and m.user_id = other and m.status = 'ativo') then
    raise exception 'Pessoa não encontrada na equipe.' using errcode = '22023';
  end if;
  k := a::text || ':' || least(me, other)::text || ':' || greatest(me, other)::text;
  select id into cid from public.chat_conversations where dm_key = k;
  if cid is null then
    insert into public.chat_conversations (agency_id, kind, dm_key, created_by) values (a, 'direta', k, me) returning id into cid;
    insert into public.chat_participants (conversation_id, user_id, agency_id) values (cid, me, a), (cid, other, a);
  end if;
  return cid;
end;
$$;

-- Cria ou atualiza um grupo (nome e participantes). Só quem criou ou administradores alteram.
create or replace function public.chat_save_group(a uuid, conv uuid, group_name text, members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  cid uuid := conv;
  owner uuid;
begin
  if not private.can_access(a, 'comunicacao', 'ver') then raise exception 'Sem acesso à Comunicação.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(group_name, ''))) not between 1 and 80 then raise exception 'Dê um nome ao grupo.' using errcode = '22023'; end if;
  if cardinality(coalesce(members, '{}')) > 100 then raise exception 'Até 100 pessoas por grupo.' using errcode = '22023'; end if;
  members := array(select distinct u from unnest(coalesce(members, '{}') || me) u
                    where exists (select 1 from public.agency_members m where m.agency_id = a and m.user_id = u and m.status = 'ativo'));
  if cardinality(members) < 2 then raise exception 'Escolha ao menos uma pessoa.' using errcode = '22023'; end if;
  if cid is null then
    insert into public.chat_conversations (agency_id, kind, name, created_by) values (a, 'grupo', trim(group_name), me) returning id into cid;
  else
    select created_by into owner from public.chat_conversations where id = cid and agency_id = a and kind = 'grupo';
    if not found then raise exception 'Grupo não encontrado.' using errcode = 'P0002'; end if;
    if owner is distinct from me and not private.is_admin(a) then raise exception 'Só quem criou o grupo ou um administrador pode alterá-lo.' using errcode = '42501'; end if;
    update public.chat_conversations set name = trim(group_name) where id = cid;
  end if;
  update public.chat_participants set member = false where conversation_id = cid and not (user_id = any (members));
  insert into public.chat_participants (conversation_id, user_id, agency_id, member)
  select cid, u, a, true from unnest(members) u
  on conflict (conversation_id, user_id) do update set member = true;
  return cid;
end;
$$;

-- Sair de um grupo.
create or replace function public.chat_leave_group(conv uuid)
returns void language sql security definer set search_path = '' as $$
  update public.chat_participants p set member = false
    from public.chat_conversations c
   where c.id = p.conversation_id and c.id = conv and c.kind = 'grupo' and p.user_id = (select auth.uid());
$$;

-- Conversa do cliente (uma por cliente), aberta pela equipe ou pelo próprio cliente.
create or replace function public.chat_client_conversation(c uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ag uuid;
  cid uuid;
begin
  select agency_id into ag from public.clients where id = c;
  if ag is null then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;
  if not (private.can_access(ag, 'comunicacao', 'ver') or private.portal_section(c, 'mensagens')) then
    raise exception 'Sem acesso a esta conversa.' using errcode = '42501';
  end if;
  select id into cid from public.chat_conversations where client_id = c and kind = 'cliente';
  if cid is null then
    insert into public.chat_conversations (agency_id, kind, client_id, created_by)
    values (ag, 'cliente', c, (select auth.uid()))
    on conflict do nothing returning id into cid;
    if cid is null then select id into cid from public.chat_conversations where client_id = c and kind = 'cliente'; end if;
  end if;
  return cid;
end;
$$;

-- Marca como lida até agora.
create or replace function public.chat_mark_read(conv uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.chat_can_see(conv) then return; end if;
  insert into public.chat_participants (conversation_id, user_id, agency_id, member, last_read_at)
  select conv, (select auth.uid()), c.agency_id, false, now() from public.chat_conversations c where c.id = conv
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

-- Não lidas por conversa (mensagens de outras pessoas depois da última leitura).
create or replace function public.chat_unread(a uuid)
returns table (conversation_id uuid, unread integer) language sql stable security definer set search_path = '' as $$
  select c.id, count(m.id)::int
    from public.chat_conversations c
    left join public.chat_participants p on p.conversation_id = c.id and p.user_id = (select auth.uid())
    join public.chat_messages m on m.conversation_id = c.id and m.deleted_at is null
         and m.author_id is distinct from (select auth.uid()) and m.created_at > coalesce(p.last_read_at, '-infinity')
   where c.agency_id = a and private.chat_can_see(c.id)
   group by c.id;
$$;

revoke all on function public.chat_open_direct(uuid, uuid), public.chat_save_group(uuid, uuid, text, uuid[]), public.chat_leave_group(uuid),
  public.chat_client_conversation(uuid), public.chat_mark_read(uuid), public.chat_unread(uuid) from public, anon;
grant execute on function public.chat_open_direct(uuid, uuid), public.chat_save_group(uuid, uuid, text, uuid[]), public.chat_leave_group(uuid),
  public.chat_client_conversation(uuid), public.chat_mark_read(uuid), public.chat_unread(uuid) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_conversations, public.chat_participants, public.chat_messages from anon;

-- conversas e participantes: só leitura direta; mudanças pelas funções acima
create policy chat_conv_select on public.chat_conversations for select to authenticated using (private.chat_can_see(id));
create policy chat_part_select on public.chat_participants for select to authenticated using (private.chat_can_see(conversation_id));

create policy chat_msg_select on public.chat_messages for select to authenticated using (private.chat_can_see(conversation_id));
create policy chat_msg_insert on public.chat_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and private.chat_can_post(conversation_id));
-- apagar a própria mensagem (o texto é limpo pelo gatilho)
create policy chat_msg_update on public.chat_messages for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null and private.chat_can_see(conversation_id))
  with check (author_id = (select auth.uid()));

-- Tempo real: mensagens novas chegam sem recarregar (respeitando as políticas acima).
alter publication supabase_realtime add table public.chat_messages;
