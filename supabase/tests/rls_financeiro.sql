-- Teste de permissões do Financeiro. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (name text primary key, val text) on commit drop;
grant all on r, k to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a6','adm6@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c6','leitor6@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d6','semacesso6@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f8','cliente6@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9e6','Agência Teste 6');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e6','00000000-0000-0000-0000-0000000000a6','admin'),
  ('00000000-0000-0000-0000-00000000a9e6','00000000-0000-0000-0000-0000000000c6','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e6','00000000-0000-0000-0000-0000000000d6','colaborador');
insert into public.member_module_access values ('00000000-0000-0000-0000-00000000a9e6','00000000-0000-0000-0000-0000000000c6','financeiro','ver');
insert into public.clients (id, agency_id, name, status, monthly_fee, billing_day) values
  ('00000000-0000-0000-0000-0000000c1e07','00000000-0000-0000-0000-00000000a9e6','Cliente 7','ativo', 2500, 31),
  ('00000000-0000-0000-0000-0000000c1e08','00000000-0000-0000-0000-00000000a9e6','Cliente 8','pausado', 900, 5);
insert into public.client_portal (client_id, agency_id, slug, sections) values
  ('00000000-0000-0000-0000-0000000c1e07','00000000-0000-0000-0000-00000000a9e6','cliente-7-teste', array['faturas']);
insert into public.client_users (client_id, user_id, agency_id) values
  ('00000000-0000-0000-0000-0000000c1e07','00000000-0000-0000-0000-0000000000f8','00000000-0000-0000-0000-00000000a9e6');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
with ins as (insert into public.fin_accounts (agency_id, name, initial_balance) values ('00000000-0000-0000-0000-00000000a9e6','Banco', 1000) returning id)
insert into k select 'acc', id::text from ins;
with ins as (insert into public.fin_accounts (agency_id, name) values ('00000000-0000-0000-0000-00000000a9e6','Caixa') returning id)
insert into k select 'cx', id::text from ins;
with ins as (insert into public.fin_categories (agency_id, kind, subtype, name, monthly_goal) values ('00000000-0000-0000-0000-00000000a9e6','despesa','fixa','Ferramentas', 300) returning id)
insert into k select 'cat', id::text from ins;
insert into r select 'criar conta e categoria com retorno', count(*) = 3 from k;
with ins as (
  insert into public.fin_transactions (agency_id, kind, subtype, amount, description, account_id, category_id, due_date, paid, created_by)
  values ('00000000-0000-0000-0000-00000000a9e6','despesa','fixa', 200, 'Software', (select val from k where name='acc')::uuid,
          (select val from k where name='cat')::uuid, '2026-11-10', true, '00000000-0000-0000-0000-0000000000a6')
  returning id, paid_at)
insert into r select 'lançamento pago com retorno registra a data de pagamento', paid_at is not null from ins;
insert into public.fin_transactions (agency_id, kind, amount, description, account_id, due_date, paid, created_by)
  values ('00000000-0000-0000-0000-00000000a9e6','receita', 500, 'Serviço avulso', (select val from k where name='acc')::uuid, '2026-11-12', true, '00000000-0000-0000-0000-0000000000a6'),
         ('00000000-0000-0000-0000-00000000a9e6','receita', 800, 'A receber', (select val from k where name='acc')::uuid, '2026-11-20', false, '00000000-0000-0000-0000-0000000000a6');
insert into public.fin_transactions (agency_id, kind, amount, description, account_id, to_account_id, due_date, created_by)
  values ('00000000-0000-0000-0000-00000000a9e6','transferencia', 100, 'Para o caixa', (select val from k where name='acc')::uuid, (select val from k where name='cx')::uuid, '2026-11-12', '00000000-0000-0000-0000-0000000000a6');
insert into r select 'saldo considera só o pago e as transferências', (select balance from public.fin_account_balances where account_id = (select val from k where name='acc')::uuid) = 1200
  and (select balance from public.fin_account_balances where account_id = (select val from k where name='cx')::uuid) = 100;
do $$ begin
  insert into public.fin_transactions (agency_id, kind, amount, description, category_id, due_date, created_by)
  values ('00000000-0000-0000-0000-00000000a9e6','receita', 10, 'x', (select val from k where name='cat')::uuid, '2026-11-01', '00000000-0000-0000-0000-0000000000a6');
  insert into r values ('categoria de despesa não vale para receita', false);
exception when others then insert into r values ('categoria de despesa não vale para receita', true); end $$;
do $$ begin
  insert into public.fin_transactions (agency_id, kind, amount, description, due_date, created_by)
  values ('00000000-0000-0000-0000-00000000a9e6','despesa', 10, 'x', '2026-11-01', '00000000-0000-0000-0000-0000000000a6');
  insert into r values ('despesa exige o tipo (fixa, variável, imposto, pessoa)', false);
exception when others then insert into r values ('despesa exige o tipo (fixa, variável, imposto, pessoa)', true); end $$;
do $$ begin
  delete from public.fin_accounts where id = (select val from k where name='acc')::uuid;
  insert into r values ('conta com lançamentos não é apagada', false);
exception when others then insert into r values ('conta com lançamentos não é apagada', true); end $$;
insert into r select 'gera mensalidade só de cliente ativo', public.generate_monthly_fees('00000000-0000-0000-0000-00000000a9e6', '2026-11-15') = 1;
insert into r select 'mensalidade vence no dia de cobrança ajustado ao fim do mês', due_date = '2026-11-30' and amount = 2500
  from public.fin_transactions where source = 'mensalidade';
insert into r select 'não duplica a mensalidade do mês', public.generate_monthly_fees('00000000-0000-0000-0000-00000000a9e6', '2026-11-01') = 0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}';
insert into r select 'leitor vê os lançamentos', count(*) = 5 from public.fin_transactions;
update public.fin_transactions set amount = 1 where true;
insert into r select 'leitor não edita', count(*) = 0 from public.fin_transactions where amount = 1;
do $$ begin
  perform public.generate_monthly_fees('00000000-0000-0000-0000-00000000a9e6', '2026-12-01');
  insert into r values ('leitor não gera mensalidades', false);
exception when others then insert into r values ('leitor não gera mensalidades', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}';
insert into r select 'sem o módulo não vê nada do Financeiro', (select count(*) from public.fin_transactions) = 0
  and (select count(*) from public.fin_accounts) = 0 and (select count(*) from public.fin_account_balances) = 0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f8","role":"authenticated"}';
insert into r select 'cliente não lê a tabela de lançamentos', count(*) = 0 from public.fin_transactions;
insert into r select 'cliente vê só as próprias faturas no portal', count(*) = 1 and bool_and(description like 'Mensalidade%')
  from public.portal_invoices('00000000-0000-0000-0000-0000000c1e07');
insert into r select 'cliente não vê faturas de outro cliente', count(*) = 0 from public.portal_invoices('00000000-0000-0000-0000-0000000c1e08');

do $$ begin
  raise exception 'RESULTADO FASE 6 (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
