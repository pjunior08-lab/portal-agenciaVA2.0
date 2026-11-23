-- Teste de permissões: Tabela de Serviços e Checklists. Agência fictícia; termina com erro proposital
-- que DESFAZ tudo. Resultado esperado: 10/10.
begin;
create temp table r (v text, ok boolean) on commit drop;
grant all on r to authenticated, anon;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-00000000aa01','adm@t.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000aa02','ver@t.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000aa03','resp@t.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000aa04','fora@t.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into agencies (id, name) values ('00000000-0000-0000-0000-00000000ab01','Teste A'),('00000000-0000-0000-0000-00000000ab02','Teste B');
insert into agency_members (agency_id, user_id, role) values
 ('00000000-0000-0000-0000-00000000ab01','00000000-0000-0000-0000-00000000aa01','admin'),
 ('00000000-0000-0000-0000-00000000ab01','00000000-0000-0000-0000-00000000aa02','colaborador'),
 ('00000000-0000-0000-0000-00000000ab01','00000000-0000-0000-0000-00000000aa03','colaborador'),
 ('00000000-0000-0000-0000-00000000ab02','00000000-0000-0000-0000-00000000aa04','admin');
insert into member_module_access values
 ('00000000-0000-0000-0000-00000000ab01','00000000-0000-0000-0000-00000000aa02','servicos','ver'),
 ('00000000-0000-0000-0000-00000000ab01','00000000-0000-0000-0000-00000000aa02','checklist','ver');
insert into clients (id, agency_id, name) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-00000000ab01','Cliente T');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated"}';
insert into services (agency_id, name, unit_price) values ('00000000-0000-0000-0000-00000000ab01','Gestão',1800);
insert into checklist_templates (id, agency_id, name, items) values ('00000000-0000-0000-0000-00000000ad01','00000000-0000-0000-0000-00000000ab01','Antes', '["a","b"]');
select create_board('00000000-0000-0000-0000-00000000ab01','Quadro T');
insert into tasks (id, agency_id, board_id, column_id, title)
 select '00000000-0000-0000-0000-00000000ae01', b.agency_id, b.id, (select id from board_columns c where c.board_id=b.id order by position limit 1), 'T1'
 from boards b where b.agency_id='00000000-0000-0000-0000-00000000ab01' limit 1;
reset role;
insert into task_assignees (task_id, user_id, agency_id) values ('00000000-0000-0000-0000-00000000ae01','00000000-0000-0000-0000-00000000aa03','00000000-0000-0000-0000-00000000ab01');
set local role authenticated;
insert into checklists (id, agency_id, name, task_id, items) values ('00000000-0000-0000-0000-00000000af01','00000000-0000-0000-0000-00000000ab01','Antes','00000000-0000-0000-0000-00000000ae01','[{"text":"a","done":false}]');
insert into checklists (agency_id, name, client_id, items) values ('00000000-0000-0000-0000-00000000ab01','Cliente novo','00000000-0000-0000-0000-00000000ac01','[]');
insert into r select 'admin cria serviço/modelo/checklists', (select count(*) from services where agency_id='00000000-0000-0000-0000-00000000ab01')=1 and (select count(*) from checklists where agency_id='00000000-0000-0000-0000-00000000ab01')=2;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aa02","role":"authenticated"}';
insert into r select 'só ver: lê serviços e modelos', (select count(*) from services)=1 and (select count(*) from checklist_templates)=1;
do $$ begin insert into services (agency_id, name) values ('00000000-0000-0000-0000-00000000ab01','X'); insert into r values ('só ver não cria serviço', false);
exception when others then insert into r values ('só ver não cria serviço', true); end $$;
update checklist_templates set name='mudou';
insert into r select 'só ver não edita modelo', (select name from checklist_templates)='Antes';
insert into r select 'sem acesso a demandas/clientes não vê checklists', (select count(*) from checklists)=0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aa03","role":"authenticated"}';
update checklists set items='[{"text":"a","done":true}]' where id='00000000-0000-0000-0000-00000000af01';
reset role;
insert into r select 'responsável marca checklist da demanda dele', (select items->0->>'done' from checklists where id='00000000-0000-0000-0000-00000000af01')='true';
set local role authenticated;
insert into r select 'responsável não vê checklist de cliente', (select count(*) from checklists where client_id is not null)=0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aa04","role":"authenticated"}';
insert into r select 'outra agência não vê nada', (select count(*) from services)+(select count(*) from checklist_templates)+(select count(*) from checklists)=0;
do $$ begin insert into checklists (agency_id, name, client_id, items) values ('00000000-0000-0000-0000-00000000ab02','x','00000000-0000-0000-0000-00000000ac01','[]'); insert into r values ('não aplica em cliente de outra agência', false);
exception when others then insert into r values ('não aplica em cliente de outra agência', true); end $$;

set local role anon;
do $$ begin perform 1 from services; insert into r values ('anon bloqueado', false);
exception when others then insert into r values ('anon bloqueado', true); end $$;
reset role;
do $$ declare t text; begin
  select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, E'\n') into t from r;
  raise exception E'%\n(%/% ok)', t, (select count(*) filter (where ok) from r), (select count(*) from r);
end $$;
