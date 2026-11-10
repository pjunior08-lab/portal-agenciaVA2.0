-- Correção: a marca "app.social_robot" vale até o fim da transação; desliga ao sair das funções do robô
-- para que nada depois delas (na mesma transação) passe pela trava da equipe.
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
  perform set_config('app.social_robot', 'off', true);
end;
$$;

create or replace function public.social_report(secret text, pub uuid, outcome text, container text default null,
                                                media_id text default null, link text default null, error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.social_publications;
begin
  if not private.social_robot_ok(secret) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  select * into s from public.social_publications where id = pub for update;
  if s.id is null then return; end if;
  perform set_config('app.social_robot', 'on', true);
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
  perform set_config('app.social_robot', 'off', true);
end;
$$;
