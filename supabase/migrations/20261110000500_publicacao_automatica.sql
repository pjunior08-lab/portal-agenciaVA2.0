-- Fase 9: publicação automática no Instagram e no Facebook (API oficial da Meta).
-- Fluxo: post aprovado pelo cliente com "publicação automática" -> uma publicação por rede ->
-- o agendador (pg_cron, a cada 5 min) chama o servidor, que publica com a conta conectada do cliente.
-- Chaves de acesso da Meta: criptografadas no servidor (AES-256-GCM) e guardadas no schema privado.


-- ---------- contas ----------
alter table public.social_accounts
  add column connection text not null default 'manual' check (connection in ('manual', 'conectada', 'erro')),
  add column external_id text,
  add column page_id text,
  add column picture_url text check (picture_url is null or picture_url ~* '^https://'),
  add column connected_by uuid references public.profiles (id) on delete set null,
  add column connected_at timestamptz,
  add column last_error text;
create unique index social_accounts_external_idx on public.social_accounts (agency_id, network, external_id) where external_id is not null;

-- chave de acesso de cada conta conectada (só o servidor lê, pelas funções abaixo)
create table private.social_tokens (
  account_id uuid primary key references public.social_accounts (id) on delete cascade,
  token_encrypted text not null,
  updated_at timestamptz not null default now()
);

-- contas encontradas na conexão, esperando a pessoa dizer de qual cliente é cada uma (vale 1 hora)
create table private.social_pending (
  key text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  network public.social_network not null,
  external_id text not null,
  page_id text,
  username text not null,
  picture_url text,
  token_encrypted text not null,
  created_at timestamptz not null default now()
);

-- ---------- publicações ----------
alter table public.social_publications drop constraint social_publications_post_id_key;
alter table public.social_publications
  add column attempts smallint not null default 0,
  add column last_error text,
  add column container_id text,
  add column external_id text,
  add column permalink text check (permalink is null or permalink ~* '^https://'),
  add column claimed_at timestamptz,
  -- só as publicações criadas pela aprovação do cliente (modo "automática") vão para o robô;
  -- os agendamentos manuais e os antigos continuam como calendário interno
  add column auto boolean not null default false;
create unique index social_publications_post_network_idx on public.social_publications (post_id, network) where post_id is not null;
create index social_publications_due_idx on public.social_publications (scheduled_at) where auto and status in ('agendado', 'publicando');

-- o status de publicado/erro só é dado pelo robô; a equipe agenda, cancela ou manda tentar de novo
create or replace function private.social_publication_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.social_accounts a where a.id = new.account_id and a.client_id = new.client_id and a.network = new.network
  ) then
    raise exception 'A conta não é deste cliente ou desta rede.' using errcode = '23514';
  end if;
  if coalesce(current_setting('app.social_robot', true), '') <> 'on' then
    if new.status::text in ('publicando', 'erro') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      raise exception 'Esse status é definido pela publicação automática.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.status::text = 'publicando' then
      raise exception 'A publicação está em andamento. Aguarde alguns minutos.' using errcode = '23514';
    end if;
    -- tentar de novo: volta para a fila e zera as tentativas
    if tg_op = 'UPDATE' and new.status = 'agendado' and old.status is distinct from new.status then
      new.attempts := 0; new.last_error := null; new.container_id := null;
    end if;
  end if;
  if new.status = 'publicado' and new.published_at is null then new.published_at := now(); end if;
  if new.status <> 'publicado' then new.published_at := null; end if;
  return new;
end;
$$;

-- Aprovação do cliente: agora cria uma publicação por rede (e atualiza a que ainda não saiu, se o post voltar aprovado).
create or replace function public.client_decide_post(p uuid, part approval_part, decision approval_decision, comment text default null)
returns approval_status language plpgsql security definer set search_path = '' as $function$
declare
  x public.posts;
  t public.approval_decision;
  m public.approval_decision;
  c public.approval_decision;
  result public.approval_status;
  msg text := nullif(trim(coalesce(comment, '')), '');
  net public.social_network;
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
    if result = 'aprovado' and x.kind = 'post' and x.publish_mode = 'automatica' and x.scheduled_at is not null then
      foreach net in array x.networks loop
        insert into public.social_publications (agency_id, client_id, post_id, network, title, caption, scheduled_at, created_by, auto, account_id)
        values (x.agency_id, x.client_id, p, net, x.title, x.caption, x.scheduled_at, x.created_by, net in ('instagram', 'facebook'),
                (select a.id from public.social_accounts a where a.client_id = x.client_id and a.network = net and a.connection = 'conectada' order by a.connected_at desc limit 1))
        on conflict (post_id, network) where post_id is not null do update
          set title = excluded.title, caption = excluded.caption, scheduled_at = excluded.scheduled_at, auto = excluded.auto,
              account_id = coalesce(public.social_publications.account_id, excluded.account_id)
          where public.social_publications.status in ('agendado', 'cancelado');
      end loop;
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
$function$;

-- ---------- conexão das contas (chamadas pela sessão de quem conecta) ----------
-- Guarda as contas encontradas na Meta (tokens já criptografados pelo servidor).
create or replace function public.social_store_pending(a uuid, items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not private.can_access(a, 'social', 'editar') then raise exception 'Sem permissão para conectar contas.' using errcode = '42501'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 300 then raise exception 'Lista inválida.' using errcode = '22023'; end if;
  delete from private.social_pending where user_id = (select auth.uid()) or created_at < now() - interval '1 hour';
  insert into private.social_pending (key, user_id, agency_id, network, external_id, page_id, username, picture_url, token_encrypted)
  select encode(extensions.gen_random_bytes(12), 'hex'), (select auth.uid()), a, (i ->> 'network')::public.social_network, left(i ->> 'external_id', 64),
         left(i ->> 'page_id', 64), left(coalesce(nullif(i ->> 'username', ''), '?'), 100),
         case when (i ->> 'picture_url') ~* '^https://' then left(i ->> 'picture_url', 1000) end, i ->> 'token_encrypted'
    from jsonb_array_elements(items) i
   where i ->> 'network' in ('instagram', 'facebook') and coalesce(i ->> 'external_id', '') <> '' and coalesce(i ->> 'token_encrypted', '') <> '';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Contas encontradas (sem as chaves), com a sugestão de cliente quando a conta já estava cadastrada.
create or replace function public.social_pending_list(a uuid)
returns table (key text, network public.social_network, username text, picture_url text, page_id text, suggested_client uuid)
language sql stable security definer set search_path = '' as $$
  select p.key, p.network, p.username, p.picture_url, p.page_id,
         (select s.client_id from public.social_accounts s
           where s.agency_id = a and s.network = p.network
             and (s.external_id = p.external_id or lower(ltrim(s.username, '@')) = lower(ltrim(p.username, '@')))
           order by (s.external_id = p.external_id) desc nulls last limit 1)
    from private.social_pending p
   where p.agency_id = a and p.user_id = (select auth.uid()) and p.created_at > now() - interval '1 hour'
     and private.can_access(a, 'social', 'editar')
   order by p.network, p.username;
$$;

-- Liga cada conta encontrada a um cliente (cria ou atualiza a conta e guarda a chave).
create or replace function public.social_link_accounts(a uuid, links jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  l jsonb;
  p private.social_pending;
  acc uuid;
  n integer := 0;
begin
  if not private.can_access(a, 'social', 'editar') then raise exception 'Sem permissão para conectar contas.' using errcode = '42501'; end if;
  for l in select * from jsonb_array_elements(coalesce(links, '[]')) loop
    select * into p from private.social_pending
     where key = l ->> 'key' and user_id = (select auth.uid()) and agency_id = a and created_at > now() - interval '1 hour';
    continue when p.key is null or coalesce(l ->> 'client_id', '') = '';
    if not exists (select 1 from public.clients c where c.id = (l ->> 'client_id')::uuid and c.agency_id = a) then
      raise exception 'Cliente inválido.' using errcode = '23514';
    end if;
    -- mesma conta já conectada: atualiza; senão aproveita o cadastro manual com o mesmo @; senão cria
    acc := null;
    select id into acc from public.social_accounts where agency_id = a and network = p.network and external_id = p.external_id;
    if acc is null then
      select id into acc from public.social_accounts
       where client_id = (l ->> 'client_id')::uuid and network = p.network and external_id is null
         and lower(ltrim(username, '@')) = lower(ltrim(p.username, '@'))
       limit 1;
    end if;
    if acc is null then
      insert into public.social_accounts (agency_id, client_id, network, username, created_by)
      values (a, (l ->> 'client_id')::uuid, p.network, p.username, (select auth.uid())) returning id into acc;
    end if;
    update public.social_accounts
       set client_id = (l ->> 'client_id')::uuid, username = p.username, external_id = p.external_id, page_id = p.page_id,
           picture_url = p.picture_url, connection = 'conectada', connected_by = (select auth.uid()), connected_at = now(), last_error = null,
           profile_url = case p.network when 'instagram' then 'https://www.instagram.com/' || p.username || '/' else 'https://www.facebook.com/' || p.external_id end
     where id = acc;
    insert into private.social_tokens (account_id, token_encrypted) values (acc, p.token_encrypted)
    on conflict (account_id) do update set token_encrypted = excluded.token_encrypted, updated_at = now();
    -- publicações já na fila deste cliente e rede passam a usar a conta conectada
    update public.social_publications set account_id = acc
     where client_id = (l ->> 'client_id')::uuid and network = p.network and status = 'agendado' and account_id is null;
    delete from private.social_pending where key = p.key;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Desconecta: apaga a chave e volta a conta para cadastro manual.
create or replace function public.social_disconnect(acc uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  select agency_id into a from public.social_accounts where id = acc;
  if a is null or not private.can_access(a, 'social', 'editar') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  delete from private.social_tokens where account_id = acc;
  update public.social_accounts set connection = 'manual', external_id = null, page_id = null, last_error = null where id = acc;
end;
$$;

-- ---------- robô de publicação (chamado pelo servidor com o segredo do agendador) ----------
create or replace function private.social_robot_ok(secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets s where s.name = 'social_cron_secret' and s.decrypted_secret = secret and length(secret) >= 32);
$$;

-- Pega o que está na hora (e o que está em andamento) e marca como "publicando".
create or replace function public.social_claim(secret text)
returns table (id uuid, network public.social_network, caption text, container_id text, attempts smallint, account_id uuid,
               external_id text, page_id text, token_encrypted text, media jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.social_robot_ok(secret) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  perform set_config('app.social_robot', 'on', true);
  -- travou no meio (sem resposta há 20 min): volta para a fila
  update public.social_publications s set status = 'agendado', claimed_at = null, container_id = null
   where s.auto and s.status = 'publicando' and s.claimed_at < now() - interval '20 minutes';
  return query
  with due as (
    select s.id from public.social_publications s
     where s.auto and s.network in ('instagram', 'facebook')
       and ((s.status = 'agendado' and s.scheduled_at <= now())
        or (s.status = 'publicando' and s.container_id is not null and s.claimed_at < now() - interval '1 minute'))
     order by s.scheduled_at
     -- poucas por rodada: cada chamada do servidor tem poucos segundos
     limit 4
     for update skip locked
  ), upd as (
    update public.social_publications s set status = 'publicando', claimed_at = now()
      from due where s.id = due.id
    returning s.*
  )
  select u.id, u.network, u.caption, u.container_id, u.attempts, a.id, a.external_id, a.page_id, t.token_encrypted,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'mime', m.mime_type) order by m.position)
                     from public.post_media m where m.post_id = u.post_id), '[]'::jsonb)
    from upd u
    left join public.social_accounts a on a.id = u.account_id and a.connection = 'conectada'
    left join private.social_tokens t on t.account_id = a.id;
end;
$$;

-- Resultado de cada tentativa: publicado, em andamento (vídeo processando) ou erro (até 3 tentativas, 10 min entre elas).
create or replace function public.social_report(secret text, pub uuid, outcome text, container text default null,
                                                media_id text default null, link text default null, error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.social_publications;
begin
  if not private.social_robot_ok(secret) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  perform set_config('app.social_robot', 'on', true);
  select * into s from public.social_publications where id = pub for update;
  if s.id is null then return; end if;
  if outcome = 'publicado' then
    update public.social_publications set status = 'publicado', external_id = left(media_id, 64),
           permalink = case when link ~* '^https://' then left(link, 500) end, last_error = null, claimed_at = null where id = pub;
    if s.created_by is not null then
      insert into public.notifications (agency_id, recipient_id, title, body, link)
      values (s.agency_id, s.created_by, 'Post publicado no ' || initcap(s.network::text), s.title, '/social');
    end if;
  elsif outcome = 'processando' then
    update public.social_publications set container_id = left(container, 64), claimed_at = now() where id = pub;
  else
    if s.attempts + 1 < 3 and coalesce(outcome, '') <> 'definitivo' then
      update public.social_publications set status = 'agendado', attempts = s.attempts + 1, last_error = left(error, 500),
             container_id = null, claimed_at = null, scheduled_at = now() + interval '10 minutes' where id = pub;
    else
      update public.social_publications set status = 'erro', attempts = s.attempts + 1, last_error = left(error, 500),
             container_id = null, claimed_at = null where id = pub;
      if s.created_by is not null then
        insert into public.notifications (agency_id, recipient_id, title, body, link)
        values (s.agency_id, s.created_by, 'Falha ao publicar no ' || initcap(s.network::text), s.title || ': ' || left(coalesce(error, ''), 200), '/social');
      end if;
      if s.account_id is not null and error ilike '%token%' then
        update public.social_accounts set connection = 'erro', last_error = left(error, 300) where id = s.account_id;
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.social_store_pending(uuid, jsonb), public.social_pending_list(uuid), public.social_link_accounts(uuid, jsonb),
  public.social_disconnect(uuid), public.social_claim(text), public.social_report(text, uuid, text, text, text, text, text) from public;
grant execute on function public.social_store_pending(uuid, jsonb), public.social_pending_list(uuid), public.social_link_accounts(uuid, jsonb),
  public.social_disconnect(uuid) to authenticated;
-- o robô roda sem login: as duas funções conferem o segredo do agendador
grant execute on function public.social_claim(text), public.social_report(text, uuid, text, text, text, text, text) to anon, authenticated;

-- Mídias de um post que está sendo publicado ficam legíveis por link assinado (a Meta busca o arquivo pela URL).
create or replace function public.social_media_is_publishing(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.post_media m join public.social_publications s on s.post_id = m.post_id
                  where m.path = object_name and s.status = 'publicando');
$$;
revoke all on function public.social_media_is_publishing(text) from public;
grant execute on function public.social_media_is_publishing(text) to anon;
create policy aprovacoes_robot_read on storage.objects for select to anon
  using (bucket_id = 'aprovacoes' and public.social_media_is_publishing(name));

-- Agendador: a cada 5 minutos chama o servidor (endereço e segredo ficam no cofre do Supabase).
select cron.schedule('social-publicar', '*/5 * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'social_site_url') || '/api/social/publicar',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000)
   where exists (select 1 from vault.decrypted_secrets where name = 'social_cron_secret')
     and exists (select 1 from public.social_publications where auto and status in ('agendado', 'publicando') and scheduled_at <= now());
$cron$);
