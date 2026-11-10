-- Nome de quem escreveu fica gravado na mensagem: equipe e cliente veem o nome
-- sem precisar ler o perfil um do outro.
alter table public.chat_messages add column author_name text;

create or replace function private.chat_messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.agency_id := (select c.agency_id from public.chat_conversations c where c.id = new.conversation_id);
    new.created_at := now();
    new.deleted_at := null;
    new.body := trim(new.body);
    new.author_name := (select coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = new.author_id);
  else
    if new.body is distinct from old.body and new.deleted_at is null then
      raise exception 'Mensagens não podem ser editadas.' using errcode = '42501';
    end if;
    if new.conversation_id <> old.conversation_id or new.author_id is distinct from old.author_id or new.created_at <> old.created_at
       or new.author_name is distinct from old.author_name then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
    if new.deleted_at is not null then new.body := ''; end if;
  end if;
  return new;
end;
$$;
