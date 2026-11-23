-- Mensalidades automáticas: todo dia 1, às 6h (Brasília), o sistema lança as mensalidades do mês
-- de todos os clientes ativos (mesma regra do botão "Gerar mensalidades"). E todo dia, às 9h, avisa
-- quem cuida do Financeiro sobre receitas que venceram ontem e não foram marcadas como recebidas.

create or replace function private.generate_monthly_fees_all(month date default (now() at time zone 'America/Sao_Paulo')::date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', month)::date;
  last_day int := extract(day from (date_trunc('month', month) + interval '1 month - 1 day'))::int;
  ag record;
  cat uuid;
  n int;
  total int := 0;
begin
  for ag in select id from public.agencies loop
    select id into cat from public.fin_categories where agency_id = ag.id and kind = 'receita' and name = 'Mensalidades';
    if cat is null then
      insert into public.fin_categories (agency_id, kind, name) values (ag.id, 'receita', 'Mensalidades') returning id into cat;
    end if;
    insert into public.fin_transactions (agency_id, kind, amount, description, category_id, client_id, due_date, source, competence)
    select ag.id, 'receita', c.monthly_fee, 'Mensalidade · ' || c.name, cat, c.id,
           m + (least(coalesce(c.billing_day, 1), last_day) - 1), 'mensalidade', m
      from public.clients c
     where c.agency_id = ag.id and c.status = 'ativo' and c.monthly_fee > 0
       and not exists (select 1 from public.fin_transactions t where t.client_id = c.id and t.source = 'mensalidade' and t.competence = m);
    get diagnostics n = row_count;
    total := total + n;
    if n > 0 then
      -- avisa os administradores
      insert into public.notifications (agency_id, recipient_id, title, body, link)
      select ag.id, am.user_id, 'Mensalidades do mês lançadas',
             n || ' mensalidade(s) de ' || to_char(m, 'MM/YYYY') || ' entraram no Financeiro.', '/financeiro/lancamentos'
        from public.agency_members am where am.agency_id = ag.id and am.role = 'admin';
    end if;
  end loop;
  return total;
end;
$$;
revoke all on function private.generate_monthly_fees_all(date) from public, anon, authenticated;

create or replace function private.notify_overdue_receivables()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  yesterday date := (now() at time zone 'America/Sao_Paulo')::date - 1;
  n int;
begin
  -- uma vez por receita: no dia seguinte ao vencimento
  insert into public.notifications (agency_id, recipient_id, title, body, link)
  select t.agency_id, am.user_id, 'Recebimento atrasado',
         t.description || ' · R$ ' || to_char(t.amount, 'FM999G999G990D00') || ' venceu em ' || to_char(t.due_date, 'DD/MM'),
         '/financeiro/lancamentos'
    from public.fin_transactions t
    join public.agency_members am on am.agency_id = t.agency_id
   where t.kind = 'receita' and not t.paid and t.due_date = yesterday
     and (am.role = 'admin' or exists (
       select 1 from public.member_module_access ma
        where ma.agency_id = t.agency_id and ma.user_id = am.user_id and ma.module = 'financeiro'
     ));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.notify_overdue_receivables() from public, anon, authenticated;

select cron.schedule('mensalidades-mensais', '0 9 1 * *', 'select private.generate_monthly_fees_all()');
select cron.schedule('recebimentos-atrasados', '0 12 * * *', 'select private.notify_overdue_receivables()');
