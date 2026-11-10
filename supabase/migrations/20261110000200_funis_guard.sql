-- A checagem da pasta passa a ter gatilho próprio no funil (o PL/pgSQL não interrompe o "and"
-- e o mapa mental não tem pasta).
create or replace function private.canvas_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.agency_id <> old.agency_id then raise exception 'Alteração não permitida.' using errcode = '42501'; end if;
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create or replace function private.funnel_folder_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.folder_id is not null and not exists (select 1 from public.funnel_folders f where f.id = new.folder_id and f.agency_id = new.agency_id) then
    raise exception 'Pasta inválida.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger funnels_folder_guard before insert or update on public.funnels for each row execute function private.funnel_folder_guard();
