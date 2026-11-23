-- Plano de Mídia: campanhas de tráfego pago por cliente, com verba planejada e investido.
-- O investido é lançado à mão; external_id fica reservado para puxar das plataformas no futuro.

create table public.media_campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  platform text not null check (platform in ('meta', 'google', 'tiktok', 'linkedin', 'outra')),
  objective text not null check (objective in ('reconhecimento', 'alcance', 'trafego', 'engajamento', 'mensagens', 'leads', 'vendas', 'outro')),
  status text not null default 'planejada' check (status in ('planejada', 'ativa', 'pausada', 'encerrada')),
  start_date date not null,
  end_date date not null,
  planned_budget numeric(14, 2) not null check (planned_budget >= 0 and planned_budget <= 99999999),
  spent numeric(14, 2) not null default 0 check (spent >= 0 and spent <= 99999999),
  spent_updated_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 2000),
  external_id text check (char_length(external_id) <= 64),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);
create index media_campaigns_client_idx on public.media_campaigns (agency_id, client_id, start_date);
create index media_campaigns_period_idx on public.media_campaigns (agency_id, start_date, end_date);
create trigger media_campaigns_updated_at before update on public.media_campaigns
  for each row execute function private.set_updated_at();

create or replace function private.media_campaigns_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.spent is distinct from old.spent then
    new.spent_updated_at := now();
  end if;
  return new;
end;
$$;
create trigger media_campaigns_guard before insert or update on public.media_campaigns
  for each row execute function private.media_campaigns_guard();

alter table public.media_campaigns enable row level security;
revoke all on public.media_campaigns from anon;
create policy media_campaigns_select on public.media_campaigns for select to authenticated
  using (private.can_access(agency_id, 'plano-de-midia', 'ver'));
create policy media_campaigns_write on public.media_campaigns for all to authenticated
  using (private.can_access(agency_id, 'plano-de-midia', 'editar'))
  with check (private.can_access(agency_id, 'plano-de-midia', 'editar'));
create trigger media_campaigns_audit after insert or update or delete on public.media_campaigns
  for each row execute function private.audit_generic();
