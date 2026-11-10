-- A conversa do cliente guarda o nome do cliente: quem tem só a Comunicação (sem o módulo Clientes)
-- continua sabendo com quem está falando. O nome acompanha mudanças no cadastro.
create or replace function public.chat_client_conversation(c uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ag uuid;
  nm text;
  cid uuid;
begin
  select agency_id, left(name, 80) into ag, nm from public.clients where id = c;
  if ag is null then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;
  if not (private.can_access(ag, 'comunicacao', 'ver') or private.portal_section(c, 'mensagens')) then
    raise exception 'Sem acesso a esta conversa.' using errcode = '42501';
  end if;
  select id into cid from public.chat_conversations where client_id = c and kind = 'cliente';
  if cid is null then
    insert into public.chat_conversations (agency_id, kind, client_id, name, created_by)
    values (ag, 'cliente', c, nm, (select auth.uid()))
    on conflict do nothing returning id into cid;
    if cid is null then select id into cid from public.chat_conversations where client_id = c and kind = 'cliente'; end if;
  end if;
  return cid;
end;
$$;

create or replace function private.chat_client_renamed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_conversations set name = left(new.name, 80) where client_id = new.id and kind = 'cliente';
  return null;
end;
$$;
create trigger chat_client_renamed after update of name on public.clients
  for each row execute function private.chat_client_renamed();
