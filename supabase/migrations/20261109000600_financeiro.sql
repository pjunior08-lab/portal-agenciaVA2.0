-- =====================================================================
-- Fase 6 — Financeiro
-- Módulo "financeiro" (ver/editar). Contas, categorias (com meta mensal),
-- lançamentos (receita, despesa, transferência) e mensalidades dos clientes.
-- Exclusão restrita: conta ou categoria em uso não é apagada.
-- O cliente vê as próprias faturas no portal só pela função portal_invoices.
-- =====================================================================

create type public.fin_kind as enum ('receita', 'despesa', 'transferencia');
create type public.fin_subtype as enum ('fixa', 'variavel', 'imposto', 'pessoa');
create type public.fin_account_kind as enum ('corrente', 'poupanca', 'caixa', 'investimento', 'outro');

create table public.fin_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind public.fin_account_kind not null default 'corrente',
  initial_balance numeric(14, 2) not null default 0,
  color text not null default '#2F7BE5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, name)
);
create trigger fin_accounts_updated_at before update on public.fin_accounts
  for each row execute function private.set_updated_at();

create table public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  kind public.fin_kind not null check (kind <> 'transferencia'),
  -- só para despesas: em qual tipo a categoria aparece (vazio = todos)
  subtype public.fin_subtype check (subtype is null or kind = 'despesa'),
  name text not null check (char_length(trim(name)) between 1 and 60),
  monthly_goal numeric(14, 2) check (monthly_goal is null or monthly_goal > 0),
  created_at timestamptz not null default now(),
  unique (agency_id, kind, name)
);

create table public.fin_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  kind public.fin_kind not null,
  subtype public.fin_subtype,
  amount numeric(14, 2) not null check (amount > 0 and amount <= 999999999),
  description text not null check (char_length(trim(description)) between 1 and 200),
  account_id uuid references public.fin_accounts (id) on delete restrict,
  to_account_id uuid references public.fin_accounts (id) on delete restrict,
  category_id uuid references public.fin_categories (id) on delete restrict,
  client_id uuid references public.clients (id) on delete restrict,
  contract_id uuid references public.contracts (id) on delete set null,
  person text check (char_length(person) <= 120),
  notes text check (char_length(notes) <= 2000),
  due_date date not null,
  paid boolean not null default false,
  paid_at date,
  -- repetição: lançamentos da mesma série compartilham recurrence_id
  recurrence_id uuid,
  installment smallint check (installment is null or installment >= 1),
  installments smallint check (installments is null or installments between 2 and 120),
  source text not null default 'manual' check (source in ('manual', 'mensalidade')),
  -- mês de referência da mensalidade (dia 1)
  competence date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'despesa') = (subtype is not null)),
  check (kind <> 'transferencia' or (account_id is not null and to_account_id is not null and account_id <> to_account_id and category_id is null)),
  check (kind = 'transferencia' or to_account_id is null),
  check (source <> 'mensalidade' or (kind = 'receita' and client_id is not null and competence is not null))
);
create index fin_transactions_agency_due_idx on public.fin_transactions (agency_id, due_date);
create index fin_transactions_client_idx on public.fin_transactions (client_id, due_date);
create index fin_transactions_recurrence_idx on public.fin_transactions (recurrence_id);
create unique index fin_transactions_fee_idx on public.fin_transactions (client_id, competence) where source = 'mensalidade';
create trigger fin_transactions_updated_at before update on public.fin_transactions
  for each row execute function private.set_updated_at();

-- tudo da mesma agência; categoria do mesmo tipo; data de pagamento coerente
create or replace function private.fin_transactions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.account_id is not null and not exists (select 1 from public.fin_accounts a where a.id = new.account_id and a.agency_id = new.agency_id) then
    raise exception 'Conta inválida.' using errcode = '23514';
  end if;
  if new.to_account_id is not null and not exists (select 1 from public.fin_accounts a where a.id = new.to_account_id and a.agency_id = new.agency_id) then
    raise exception 'Conta de destino inválida.' using errcode = '23514';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.fin_categories c where c.id = new.category_id and c.agency_id = new.agency_id and c.kind = new.kind
  ) then
    raise exception 'Categoria inválida para este tipo de lançamento.' using errcode = '23514';
  end if;
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if new.contract_id is not null and not exists (select 1 from public.contracts k where k.id = new.contract_id and k.agency_id = new.agency_id) then
    raise exception 'Contrato inválido.' using errcode = '23514';
  end if;
  if new.kind = 'transferencia' then new.paid := true; end if;
  if new.paid then
    new.paid_at := coalesce(new.paid_at, (now() at time zone 'America/Sao_Paulo')::date);
  else
    new.paid_at := null;
  end if;
  return new;
end;
$$;
create trigger fin_transactions_guard before insert or update on public.fin_transactions
  for each row execute function private.fin_transactions_guard();

create or replace function private.fin_categories_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.kind <> old.kind and exists (select 1 from public.fin_transactions t where t.category_id = old.id) then
    raise exception 'Categoria em uso não pode mudar de tipo.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger fin_categories_guard before update on public.fin_categories
  for each row execute function private.fin_categories_guard();

create trigger fin_transactions_audit after insert or update or delete on public.fin_transactions
  for each row execute function private.audit_generic();
create trigger fin_accounts_audit after insert or update or delete on public.fin_accounts
  for each row execute function private.audit_generic();
create trigger fin_categories_audit after insert or update or delete on public.fin_categories
  for each row execute function private.audit_generic();

-- Saldo de cada conta (só o que já foi pago/recebido). Respeita a RLS de quem consulta.
create view public.fin_account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.agency_id,
  a.initial_balance
    + coalesce(sum(case when t.kind = 'receita' and t.account_id = a.id then t.amount end), 0)
    - coalesce(sum(case when t.kind = 'despesa' and t.account_id = a.id then t.amount end), 0)
    - coalesce(sum(case when t.kind = 'transferencia' and t.account_id = a.id then t.amount end), 0)
    + coalesce(sum(case when t.kind = 'transferencia' and t.to_account_id = a.id then t.amount end), 0) as balance
from public.fin_accounts a
left join public.fin_transactions t
  on t.paid and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;

-- Gera as mensalidades do mês para os clientes ativos com mensalidade.
-- Vencimento no dia de cobrança do cliente (ajustado ao fim do mês) ou dia 1.
-- Não duplica: um lançamento de mensalidade por cliente e mês.
create or replace function public.generate_monthly_fees(a uuid, month date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', month)::date;
  last_day int := extract(day from (date_trunc('month', month) + interval '1 month - 1 day'))::int;
  cat uuid;
  n int;
begin
  if not private.can_access(a, 'financeiro', 'editar') then
    raise exception 'Você não tem permissão para editar o Financeiro.' using errcode = '42501';
  end if;
  select id into cat from public.fin_categories where agency_id = a and kind = 'receita' and name = 'Mensalidades';
  if cat is null then
    insert into public.fin_categories (agency_id, kind, name) values (a, 'receita', 'Mensalidades') returning id into cat;
  end if;
  insert into public.fin_transactions (agency_id, kind, amount, description, category_id, client_id, due_date, source, competence, created_by)
  select a, 'receita', c.monthly_fee, 'Mensalidade · ' || c.name, cat, c.id,
         m + (least(coalesce(c.billing_day, 1), last_day) - 1), 'mensalidade', m, (select auth.uid())
    from public.clients c
   where c.agency_id = a and c.status = 'ativo' and c.monthly_fee > 0
     and not exists (select 1 from public.fin_transactions t where t.client_id = c.id and t.source = 'mensalidade' and t.competence = m);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Faturas do cliente no portal (seção "faturas"): só o necessário, sem conta nem observações.
create or replace function public.portal_invoices(c uuid)
returns table (id uuid, description text, amount numeric, due_date date, paid boolean, paid_at date)
language sql stable security definer set search_path = '' as $$
  select t.id, t.description, t.amount, t.due_date, t.paid, t.paid_at
    from public.fin_transactions t
   where t.client_id = c and t.kind = 'receita' and private.portal_section(c, 'faturas')
   order by t.due_date desc
   limit 120;
$$;

revoke execute on function public.generate_monthly_fees(uuid, date), public.portal_invoices(uuid) from public, anon;
grant execute on function public.generate_monthly_fees(uuid, date), public.portal_invoices(uuid) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.fin_accounts enable row level security;
alter table public.fin_categories enable row level security;
alter table public.fin_transactions enable row level security;
revoke all on public.fin_accounts, public.fin_categories, public.fin_transactions, public.fin_account_balances from anon;

create policy fin_accounts_select on public.fin_accounts for select to authenticated using (private.can_access(agency_id, 'financeiro', 'ver'));
create policy fin_accounts_write on public.fin_accounts for all to authenticated
  using (private.can_access(agency_id, 'financeiro', 'editar')) with check (private.can_access(agency_id, 'financeiro', 'editar'));

create policy fin_categories_select on public.fin_categories for select to authenticated using (private.can_access(agency_id, 'financeiro', 'ver'));
create policy fin_categories_write on public.fin_categories for all to authenticated
  using (private.can_access(agency_id, 'financeiro', 'editar')) with check (private.can_access(agency_id, 'financeiro', 'editar'));

create policy fin_transactions_select on public.fin_transactions for select to authenticated using (private.can_access(agency_id, 'financeiro', 'ver'));
create policy fin_transactions_insert on public.fin_transactions for insert to authenticated
  with check (private.can_access(agency_id, 'financeiro', 'editar') and created_by = (select auth.uid()));
create policy fin_transactions_update on public.fin_transactions for update to authenticated
  using (private.can_access(agency_id, 'financeiro', 'editar')) with check (private.can_access(agency_id, 'financeiro', 'editar'));
create policy fin_transactions_delete on public.fin_transactions for delete to authenticated
  using (private.can_access(agency_id, 'financeiro', 'editar'));
