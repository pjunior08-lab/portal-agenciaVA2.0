-- Rascunho: só a equipe vê. "Enviar ao cliente" muda para "enviado" (rodada 1) e aí o cliente passa a ver.

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
      -- a equipe cria como rascunho ou já envia; nunca com decisão do cliente
      if new.status is distinct from 'rascunho' then new.status := 'enviado'; end if;
      new.theme_decision := null; new.media_decision := null; new.caption_decision := null;
      new.decided_at := null; new.round := 1; new.sent_at := now();
    elsif new.status is distinct from old.status
       or new.theme_decision is distinct from old.theme_decision
       or new.media_decision is distinct from old.media_decision
       or new.caption_decision is distinct from old.caption_decision
       or new.decided_at is distinct from old.decided_at then
      if old.status = 'rascunho' and new.status = 'enviado' and new.round = old.round
         and new.theme_decision is null and new.media_decision is null and new.caption_decision is null
         and new.decided_at is null then
        null; -- primeiro envio do rascunho
      -- a equipe só pode reenviar (nova rodada) depois de uma decisão
      elsif not (new.status = 'enviado' and old.status in ('alteracoes', 'reprovado', 'aprovado')
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

-- o cliente (portal) não vê rascunho, nem as mídias dele
create or replace function private.can_see_post(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts x
    where x.id = p and (
      (private.is_member(x.agency_id) and (private.can_access(x.agency_id, 'aprovacoes', 'ver') or x.created_by = (select auth.uid())))
      or (x.status <> 'rascunho' and private.portal_section(x.client_id, 'aprovacoes'))
      or (private.portal_section(x.client_id, 'calendario') and x.status = 'aprovado')
    )
  );
$$;

drop policy posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (
    (private.is_member(agency_id) and (private.can_access(agency_id, 'aprovacoes', 'ver') or created_by = (select auth.uid())))
    or (status <> 'rascunho' and private.portal_section(client_id, 'aprovacoes'))
    or (status = 'aprovado' and private.portal_section(client_id, 'calendario'))
  );

create or replace function public.client_open_post(p uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  x public.posts;
begin
  select * into x from public.posts where id = p;
  if x.id is null or x.status = 'rascunho' or not private.portal_section(x.client_id, 'aprovacoes') then
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
