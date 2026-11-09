-- Teste de permissões e regras do Comercial. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (name text primary key, val text) on commit drop;
grant all on r, k to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a7','adm7@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c7','leitor7@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d7','semacesso7@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000e7','outraagencia7@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values
  ('00000000-0000-0000-0000-00000000a9e7','Agência Teste 7'),
  ('00000000-0000-0000-0000-00000000a9e8','Outra Agência 7');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e7','00000000-0000-0000-0000-0000000000a7','admin'),
  ('00000000-0000-0000-0000-00000000a9e7','00000000-0000-0000-0000-0000000000c7','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e7','00000000-0000-0000-0000-0000000000d7','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e8','00000000-0000-0000-0000-0000000000e7','admin');
insert into public.member_module_access values ('00000000-0000-0000-0000-00000000a9e7','00000000-0000-0000-0000-0000000000c7','comercial','ver');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
insert into public.crm_settings (agency_id, cadence_days) values ('00000000-0000-0000-0000-00000000a9e7', '{2,5}');
with ins as (
  insert into public.crm_opportunities (agency_id, name, company, document, owner_id, value, created_by)
  values ('00000000-0000-0000-0000-00000000a9e7','Maria','Loja X','12.345.678/0001-99','00000000-0000-0000-0000-0000000000a7', 1500,'00000000-0000-0000-0000-0000000000a7')
  returning id, document)
insert into k select 'o1', id::text from ins where document = '12345678000199';
insert into r select 'criar oportunidade com retorno e documento só com dígitos', count(*) = 1 from k;
insert into r select 'entrada no funil fica no histórico', count(*) = 1 from public.crm_stage_history where opportunity_id = (select val from k where name='o1')::uuid;
do $$ begin
  insert into public.crm_opportunities (agency_id, name, document, created_by)
  values ('00000000-0000-0000-0000-00000000a9e7','Outra pessoa','12345678000199','00000000-0000-0000-0000-0000000000a7');
  insert into r values ('mesmo CNPJ não duplica', false);
exception when others then insert into r values ('mesmo CNPJ não duplica', true); end $$;
do $$ begin
  insert into public.crm_opportunities (agency_id, name, owner_id, created_by)
  values ('00000000-0000-0000-0000-00000000a9e7','X','00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-0000000000a7');
  insert into r values ('responsável precisa ser da agência', false);
exception when others then insert into r values ('responsável precisa ser da agência', true); end $$;
insert into public.crm_activities (agency_id, opportunity_id, channel, result, author_id, happened_at)
  values ('00000000-0000-0000-0000-00000000a9e7',(select val from k where name='o1')::uuid,'whatsapp','sem_resposta','00000000-0000-0000-0000-0000000000a7','2026-11-09 12:00-03');
insert into r select 'sem resposta agenda a 2ª tentativa no 1º intervalo', attempts = 1 and next_step_at = '2026-11-11' and last_contact_at is not null
  from public.crm_opportunities where id = (select val from k where name='o1')::uuid;
insert into public.crm_activities (agency_id, opportunity_id, channel, result, author_id, happened_at)
  values ('00000000-0000-0000-0000-00000000a9e7',(select val from k where name='o1')::uuid,'ligacao','sem_resposta','00000000-0000-0000-0000-0000000000a7','2026-11-11 12:00-03');
insert into r select 'segunda falta de resposta usa o 2º intervalo', attempts = 2 and next_step_at = '2026-11-16'
  from public.crm_opportunities where id = (select val from k where name='o1')::uuid;
insert into public.crm_activities (agency_id, opportunity_id, channel, result, author_id)
  values ('00000000-0000-0000-0000-00000000a9e7',(select val from k where name='o1')::uuid,'ligacao','respondeu','00000000-0000-0000-0000-0000000000a7');
insert into r select 'resposta zera as tentativas', attempts = 0 from public.crm_opportunities where id = (select val from k where name='o1')::uuid;
do $$ begin
  update public.crm_opportunities set stage = 'perdido' where id = (select val from k where name='o1')::uuid;
  insert into r values ('perder exige motivo', false);
exception when others then insert into r values ('perder exige motivo', true); end $$;
update public.crm_opportunities set stage = 'fechado' where id = (select val from k where name='o1')::uuid;
insert into r select 'fechar registra a data e o histórico', o.closed_at is not null and (select count(*) from public.crm_stage_history h where h.opportunity_id = o.id) = 2
  from public.crm_opportunities o where o.id = (select val from k where name='o1')::uuid;
do $$ begin
  insert into public.crm_stage_history (agency_id, opportunity_id, to_stage) values ('00000000-0000-0000-0000-00000000a9e7',(select val from k where name='o1')::uuid,'fechado');
  insert into r values ('histórico não aceita gravação direta', false);
exception when others then insert into r values ('histórico não aceita gravação direta', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
insert into r select 'leitor vê as oportunidades e atividades', (select count(*) from public.crm_opportunities) = 1 and (select count(*) from public.crm_activities) = 3;
update public.crm_opportunities set name = 'hack';
insert into r select 'leitor não edita', count(*) = 0 from public.crm_opportunities where name = 'hack';
do $$ begin
  insert into public.crm_activities (agency_id, opportunity_id, kind, note, author_id)
  values ('00000000-0000-0000-0000-00000000a9e7',(select val from k where name='o1')::uuid,'nota','x','00000000-0000-0000-0000-0000000000c7');
  insert into r values ('leitor não registra contato', false);
exception when others then insert into r values ('leitor não registra contato', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}';
insert into r select 'sem o módulo não vê nada do Comercial', (select count(*) from public.crm_opportunities) = 0 and (select count(*) from public.crm_settings) = 0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e7","role":"authenticated"}';
insert into r select 'outra agência não vê', count(*) = 0 from public.crm_opportunities;

do $$ begin
  raise exception 'RESULTADO FASE 7A (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
