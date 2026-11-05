-- =====================================================================
-- Fase 4 — Aprovação e Social
-- Aprovação: módulo "aprovacoes". O cliente vê os envios do próprio
-- cliente pela seção "aprovacoes" do portal e registra a decisão só pela
-- função client_decide_post (a equipe não grava decisão em nome dele).
-- Social: módulo "social". Sem publicação real nas redes até as
-- integrações (Fase 9): os agendamentos são um calendário interno.
-- =====================================================================

create type public.approval_kind as enum ('post', 'demanda');
create type public.approval_mode as enum ('rapida', 'detalhada');
create type public.approval_status as enum ('enviado', 'em_analise', 'aprovado', 'alteracoes', 'reprovado');
create type public.approval_part as enum ('geral', 'tema', 'midias', 'legenda');
create type public.approval_decision as enum ('aprovado', 'alteracoes', 'reprovado');
create type public.publish_mode as enum ('manual', 'automatica');
create type public.social_network as enum ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin');
create type public.publication_status as enum ('agendado', 'publicado', 'cancelado');

-- ---------- Envios para aprovação ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  kind public.approval_kind not null default 'post',
  -- "tema" do post ou título da demanda
  title text not null check (char_length(trim(title)) between 1 and 200),
  -- legenda do post ou descrição da demanda
  caption text not null default '' check (char_length(caption) <= 5000),
  mode public.approval_mode not null default 'rapida',
  status public.approval_status not null default 'enviado',
  theme_decision public.approval_decision,
  media_decision public.approval_decision,
  caption_decision public.approval_decision,
  publish_mode public.publish_mode not null default 'manual',
  networks public.social_network[] not null default '{}',
  scheduled_at timestamptz,
  round smallint not null default 1,
  sent_at timestamptz not null default now(),
  decided_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- demanda é sempre aprovação rápida
  check (kind = 'post' or mode = 'rapida')
);
create index posts_agency_idx on public.posts (agency_id, status, sent_at desc);
create index posts_client_idx on public.posts (client_id, sent_at desc);
create trigger posts_updated_at before update on public.posts
  for each row execute function private.set_updated_at();

-- cliente da agência; decisão só pela função do cliente
create or replace function private.posts_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.agency_id = new.agency_id
  ) then
    raise exception 'Demanda de origem inválida.' using errcode = '23514';
  end if;
  if coalesce(current_setting('app.client_decision', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.status := 'enviado';
      new.theme_decision := null; new.media_decision := null; new.caption_decision := null;
      new.decided_at := null; new.round := 1; new.sent_at := now();
    elsif new.status is distinct from old.status
       or new.theme_decision is distinct from old.theme_decision
       or new.media_decision is distinct from old.media_decision
       or new.caption_decision is distinct from old.caption_decision
       or new.decided_at is distinct from old.decided_at then
      -- a equipe só pode reenviar (nova rodada) depois de uma decisão
      if not (new.status = 'enviado' and old.status in ('alteracoes', 'reprovado', 'aprovado')
              and new.theme_decision is null and new.media_decision is null and new.caption_decision is null
              and new.decided_at is null and new.round = old.round + 1) then
        raise exception 'A decisão de aprovação é registrada pelo cliente.' using errcode = '42501';
      end if;
      new.sent_at := now();
    elsif new.round is distinct from old.round then
      raise exception 'Rodada inválida.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger posts_guard before insert or update on public.posts
  for each row execute function private.posts_guard();

-- ---------- Mídias ----------
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  path text not null unique,
  name text not null check (char_length(name) between 1 and 255),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  check (path like agency_id::text || '/' || post_id::text || '/%')
);
create index post_media_post_idx on public.post_media (post_id, position);

-- ---------- Histórico ----------
create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_side text not null check (actor_side in ('equipe', 'cliente')),
  event text not null check (event in ('enviado', 'reenviado', 'em_analise', 'decisao')),
  part public.approval_part,
  decision public.approval_decision,
  round smallint not null default 1,
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  check ((event = 'decisao') = (decision is not null and part is not null))
);
create index approval_events_post_idx on public.approval_events (post_id, created_at);

-- ---------- Legendas padrão ----------
create table public.caption_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(body) between 1 and 5000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index caption_templates_agency_idx on public.caption_templates (agency_id, title);

-- ---------- Social ----------
-- conta da rede do cliente. token_ref fica vazio até a integração (Fase 9):
-- o token nunca é guardado aqui, só a referência ao cofre.
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  network public.social_network not null,
  username text not null check (char_length(trim(username)) between 1 and 100),
  profile_url text check (profile_url is null or profile_url ~* '^https?://'),
  token_ref text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, network, username)
);
create index social_accounts_client_idx on public.social_accounts (client_id);

create table public.social_publications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  post_id uuid unique references public.posts (id) on delete set null,
  account_id uuid references public.social_accounts (id) on delete set null,
  network public.social_network not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  caption text not null default '' check (char_length(caption) <= 5000),
  scheduled_at timestamptz not null,
  status public.publication_status not null default 'agendado',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_publications_agency_idx on public.social_publications (agency_id, scheduled_at);
create trigger social_publications_updated_at before update on public.social_publications
  for each row execute function private.set_updated_at();

create or replace function private.social_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.social_publication_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.social_accounts a where a.id = new.account_id and a.client_id = new.client_id and a.network = new.network
  ) then
    raise exception 'A conta não é deste cliente ou desta rede.' using errcode = '23514';
  end if;
  if new.status = 'publicado' and new.published_at is null then new.published_at := now(); end if;
  if new.status <> 'publicado' then new.published_at := null; end if;
  return new;
end;
$$;
create trigger social_accounts_guard before insert or update on public.social_accounts
  for each row execute function private.social_guard();
create trigger social_publications_guard before insert or update on public.social_publications
  for each row execute function private.social_guard();
create trigger social_publications_check before insert or update on public.social_publications
  for each row execute function private.social_publication_guard();

-- ---------- auditoria ----------
create trigger posts_audit after delete on public.posts
  for each row execute function private.audit_generic();
create trigger social_accounts_audit after insert or update or delete on public.social_accounts
  for each row execute function private.audit_generic();

-- =====================================================================
-- Autorização
-- =====================================================================
create or replace function private.can_see_post(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts x
    where x.id = p and (
      (private.is_member(x.agency_id) and (private.can_access(x.agency_id, 'aprovacoes', 'ver') or x.created_by = (select auth.uid())))
      or private.portal_section(x.client_id, 'aprovacoes')
      or (private.portal_section(x.client_id, 'calendario') and x.status = 'aprovado')
    )
  );
$$;
grant execute on function private.can_see_post(uuid) to authenticated;

-- Cliente abriu o envio: passa para "Cliente analisando".
create or replace function public.client_open_post(p uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  x public.posts;
begin
  select * into x from public.posts where id = p;
  if x.id is null or not private.portal_section(x.client_id, 'aprovacoes') then
    raise exception 'Envio não encontrado.' using errcode = '42501';
  end if;
  if x.status = 'enviado' then
    perform set_config('app.client_decision', 'on', true);
    update public.posts set status = 'em_analise' where id = p;
    perform set_config('app.client_decision', 'off', true);
    insert into public.approval_events (agency_id, post_id, actor_id, actor_side, event, round)
    values (x.agency_id, p, (select auth.uid()), 'cliente', 'em_analise', x.round);
  end if;
end;
$$;

-- Decisão do cliente. Rápida: parte "geral". Detalhada: tema, mídias e
-- legenda, cada uma com a sua decisão; o resultado sai quando as três
-- estão decididas (uma reprovada reprova; uma com alterações pede ajuste).
create or replace function public.client_decide_post(p uuid, part public.approval_part, decision public.approval_decision, comment text default null)
returns public.approval_status language plpgsql security definer set search_path = '' as $$
declare
  x public.posts;
  t public.approval_decision;
  m public.approval_decision;
  c public.approval_decision;
  result public.approval_status;
  msg text := nullif(trim(coalesce(comment, '')), '');
begin
  select * into x from public.posts where id = p for update;
  if x.id is null or not private.portal_section(x.client_id, 'aprovacoes') then
    raise exception 'Envio não encontrado.' using errcode = '42501';
  end if;
  if x.status not in ('enviado', 'em_analise') then
    raise exception 'Este envio já foi decidido.' using errcode = '23514';
  end if;
  if decision <> 'aprovado' and msg is null then
    raise exception 'Escreva o que precisa mudar.' using errcode = '23514';
  end if;
  if char_length(coalesce(msg, '')) > 2000 then
    raise exception 'Comentário muito longo.' using errcode = '23514';
  end if;

  t := x.theme_decision; m := x.media_decision; c := x.caption_decision;
  if x.mode = 'rapida' then
    if part <> 'geral' then raise exception 'Aprovação rápida decide o envio inteiro.' using errcode = '23514'; end if;
    result := decision::text::public.approval_status;
  else
    if part = 'geral' then raise exception 'Aprovação detalhada decide tema, mídias e legenda.' using errcode = '23514'; end if;
    if part = 'tema' then t := decision; elsif part = 'midias' then m := decision; else c := decision; end if;
    if t is null or m is null or c is null then
      result := 'em_analise';
    elsif 'reprovado' in (t, m, c) then
      result := 'reprovado';
    elsif 'alteracoes' in (t, m, c) then
      result := 'alteracoes';
    else
      result := 'aprovado';
    end if;
  end if;

  perform set_config('app.client_decision', 'on', true);
  update public.posts
     set status = result, theme_decision = t, media_decision = m, caption_decision = c,
         decided_at = case when result in ('aprovado', 'alteracoes', 'reprovado') then now() end
   where id = p;
  perform set_config('app.client_decision', 'off', true);

  insert into public.approval_events (agency_id, post_id, actor_id, actor_side, event, part, decision, round, comment)
  values (x.agency_id, p, (select auth.uid()), 'cliente', 'decisao', part, decision, x.round, msg);

  if result in ('aprovado', 'alteracoes', 'reprovado') then
    -- agendamento automático depois da aprovação (calendário interno do Social)
    if result = 'aprovado' and x.kind = 'post' and x.publish_mode = 'automatica' and x.scheduled_at is not null
       and cardinality(x.networks) > 0 then
      insert into public.social_publications (agency_id, client_id, post_id, network, title, caption, scheduled_at, created_by)
      values (x.agency_id, x.client_id, p, x.networks[1], x.title, x.caption, x.scheduled_at, x.created_by)
      on conflict (post_id) do nothing;
    end if;
    if x.created_by is not null then
      insert into public.notifications (agency_id, recipient_id, title, body, link)
      values (x.agency_id, x.created_by,
              case result when 'aprovado' then 'Aprovado pelo cliente' when 'alteracoes' then 'Cliente pediu alterações' else 'Reprovado pelo cliente' end,
              x.title, '/aprovacoes?envio=' || p);
    end if;
  end if;
  return result;
end;
$$;

revoke execute on function public.client_open_post(uuid), public.client_decide_post(uuid, public.approval_part, public.approval_decision, text) from public, anon;
grant execute on function public.client_open_post(uuid), public.client_decide_post(uuid, public.approval_part, public.approval_decision, text) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.approval_events enable row level security;
alter table public.caption_templates enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_publications enable row level security;
revoke all on public.posts, public.post_media, public.approval_events, public.caption_templates,
  public.social_accounts, public.social_publications from anon;

-- usa as colunas da própria linha (e não can_see_post): no INSERT ... RETURNING a linha nova
-- ainda não aparece para uma busca na tabela
create policy posts_select on public.posts for select to authenticated
  using (
    (private.is_member(agency_id) and (private.can_access(agency_id, 'aprovacoes', 'ver') or created_by = (select auth.uid())))
    or private.portal_section(client_id, 'aprovacoes')
    or (status = 'aprovado' and private.portal_section(client_id, 'calendario'))
  );
create policy posts_insert on public.posts for insert to authenticated
  with check (private.can_access(agency_id, 'aprovacoes', 'editar') and created_by = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'editar'))
  with check (private.can_access(agency_id, 'aprovacoes', 'editar'));
create policy posts_delete on public.posts for delete to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'editar'));

create policy post_media_select on public.post_media for select to authenticated using (private.can_see_post(post_id));
create policy post_media_insert on public.post_media for insert to authenticated
  with check (private.can_access(agency_id, 'aprovacoes', 'editar')
              and exists (select 1 from public.posts x where x.id = post_id and x.agency_id = post_media.agency_id));
create policy post_media_update on public.post_media for update to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'editar')) with check (private.can_access(agency_id, 'aprovacoes', 'editar'));
create policy post_media_delete on public.post_media for delete to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'editar'));

-- histórico: leitura para quem vê o envio; a equipe registra envio/reenvio; o cliente grava pelas funções
create policy approval_events_select on public.approval_events for select to authenticated
  using (private.can_see_post(post_id) and (private.is_member(agency_id) or exists (
    select 1 from public.posts x where x.id = post_id and private.portal_section(x.client_id, 'aprovacoes'))));
create policy approval_events_insert on public.approval_events for insert to authenticated
  with check (private.can_access(agency_id, 'aprovacoes', 'editar') and actor_side = 'equipe'
              and actor_id = (select auth.uid()) and event in ('enviado', 'reenviado')
              and exists (select 1 from public.posts x where x.id = post_id and x.agency_id = approval_events.agency_id));

create policy caption_templates_select on public.caption_templates for select to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'ver'));
create policy caption_templates_write on public.caption_templates for all to authenticated
  using (private.can_access(agency_id, 'aprovacoes', 'editar'))
  with check (private.can_access(agency_id, 'aprovacoes', 'editar'));

create policy social_accounts_select on public.social_accounts for select to authenticated
  using (private.can_access(agency_id, 'social', 'ver') or private.can_access(agency_id, 'aprovacoes', 'ver'));
create policy social_accounts_write on public.social_accounts for all to authenticated
  using (private.can_access(agency_id, 'social', 'editar'))
  with check (private.can_access(agency_id, 'social', 'editar'));

-- calendário do portal: o cliente vê os agendamentos dele (sem cancelados)
create policy social_publications_select on public.social_publications for select to authenticated
  using (private.can_access(agency_id, 'social', 'ver')
         or (status <> 'cancelado' and private.portal_section(client_id, 'calendario')));
create policy social_publications_write on public.social_publications for all to authenticated
  using (private.can_access(agency_id, 'social', 'editar'))
  with check (private.can_access(agency_id, 'social', 'editar'));

-- =====================================================================
-- Storage: bucket privado "aprovacoes"  (<agency_id>/<post_id>/<arquivo>)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('aprovacoes', 'aprovacoes', false, 104857600)
on conflict (id) do nothing;

create policy aprovacoes_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'aprovacoes' and private.can_see_post(private.uuid_or_null((storage.foldername(name))[2])));
create policy aprovacoes_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aprovacoes'
    and exists (
      select 1 from public.posts x
      where x.id = private.uuid_or_null((storage.foldername(name))[2])
        and x.agency_id = private.uuid_or_null((storage.foldername(name))[1])
        and private.can_access(x.agency_id, 'aprovacoes', 'editar')
    )
  );
create policy aprovacoes_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'aprovacoes'
         and private.can_access(private.uuid_or_null((storage.foldername(name))[1]), 'aprovacoes', 'editar'));
