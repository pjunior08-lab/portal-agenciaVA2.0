-- Teste de permissões de Demandas, Agenda e Checklist. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
grant all on r to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a3','adm3@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c3','editor3@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d3','resp3@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000e3','fora3@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f4','cliente3@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9e3','Agência Teste 3');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000a3','admin'),
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000d3','colaborador');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','demandas','editar'),
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','agenda','ver');
insert into public.clients (id, agency_id, name) values ('00000000-0000-0000-0000-0000000c1e03','00000000-0000-0000-0000-00000000a9e3','Cliente 3');
insert into public.client_portal (client_id, agency_id, slug, sections) values ('00000000-0000-0000-0000-0000000c1e03','00000000-0000-0000-0000-00000000a9e3','cliente-3-teste', array['em-andamento']);
insert into public.client_users (client_id, user_id, agency_id) values ('00000000-0000-0000-0000-0000000c1e03','00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-00000000a9e3');

set local role authenticated;
-- editor cria quadro e demandas
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
create temp table b as select public.create_board('00000000-0000-0000-0000-00000000a9e3', 'Quadro principal') id;
insert into r select 'quadro nasce com 3 colunas', count(*) = 3 from public.board_columns where board_id = (select id from b);
create temp table cols as select id, name, is_done from public.board_columns where board_id = (select id from b);
insert into public.tasks (id, agency_id, board_id, column_id, client_id, title, due_date) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-00000000a9e3',(select id from b),(select id from cols where name='A fazer'),'00000000-0000-0000-0000-0000000c1e03','Post do cliente', current_date),
  ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-00000000a9e3',(select id from b),(select id from cols where name='A fazer'),null,'Interna', current_date);
insert into public.task_assignees values ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-00000000a9e3');
update public.tasks set column_id = (select id from cols where name='Feito') where id = '00000000-0000-0000-0000-00000000aa02';
insert into r select 'mover para "Feito" marca como concluída', completed_at is not null from public.tasks where id = '00000000-0000-0000-0000-00000000aa02';
update public.tasks set column_id = (select id from cols where name='Fazendo') where id = '00000000-0000-0000-0000-00000000aa02';
insert into r select 'sair de "Feito" desmarca', completed_at is null from public.tasks where id = '00000000-0000-0000-0000-00000000aa02';
do $$ begin
  insert into public.task_assignees values ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-00000000a9e3');
  insert into r values ('não atribui quem não é da equipe', false);
exception when others then insert into r values ('não atribui quem não é da equipe', true); end $$;
do $$ begin
  insert into public.tasks (agency_id, board_id, column_id, title) values
    ('00000000-0000-0000-0000-00000000a9e3', (select id from b), gen_random_uuid(), 'x');
  insert into r values ('coluna de outro quadro é recusada', false);
exception when others then insert into r values ('coluna de outro quadro é recusada', true); end $$;
insert into public.events (agency_id, owner_id, title, starts_at, ends_at, visibility) values
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','Reunião aberta', now(), now() + interval '1 hour', 'agencia'),
  ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','Consulta privada', now(), now() + interval '1 hour', 'privado');
insert into public.checklist_items (agency_id, user_id, title) values ('00000000-0000-0000-0000-00000000a9e3','00000000-0000-0000-0000-0000000000c3','Meu item');

-- responsável sem o módulo Demandas
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
insert into r select 'responsável vê só a própria demanda', count(*) = 1 and min(title) = 'Post do cliente' from public.tasks;
insert into r select 'responsável vê o quadro da demanda', count(*) = 1 from public.boards;
update public.tasks set column_id = (select id from cols where name='Fazendo') where id = '00000000-0000-0000-0000-00000000aa01';
insert into r select 'responsável move a própria demanda', count(*) = 1 from public.tasks where id = '00000000-0000-0000-0000-00000000aa01' and column_id = (select id from cols where name='Fazendo');
do $$ begin
  insert into public.tasks (agency_id, board_id, column_id, title) values
    ('00000000-0000-0000-0000-00000000a9e3', (select id from b), (select id from cols where name='A fazer'), 'nova');
  insert into r values ('sem o módulo não cria demanda', false);
exception when others then insert into r values ('sem o módulo não cria demanda', true); end $$;
insert into r select 'sem o módulo Agenda não vê atividades', count(*) = 0 from public.events;
insert into r select 'não vê o checklist dos outros', count(*) = 0 from public.checklist_items;

-- editor de demandas com agenda "ver"
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
insert into r select 'dono vê as duas atividades (inclusive privada)', count(*) = 2 from public.events;

-- admin
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
insert into r select 'admin vê todas as demandas', count(*) = 2 from public.tasks;
insert into r select 'admin não vê atividade privada de outra pessoa', count(*) = 1 and min(title) = 'Reunião aberta' from public.events;
insert into r select 'admin não vê checklist alheio', count(*) = 0 from public.checklist_items;

-- de fora da agência
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
insert into r select 'quem é de fora não vê nada', (select count(*) from public.tasks) + (select count(*) from public.boards) + (select count(*) from public.events) = 0;

-- cliente no portal
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}';
insert into r select 'cliente não lê a tabela de demandas', count(*) = 0 from public.tasks;
insert into r select 'portal mostra só a demanda do cliente em andamento', count(*) = 1 and min(title) = 'Post do cliente'
  from public.portal_tasks_in_progress('00000000-0000-0000-0000-0000000c1e03');
insert into r select 'portal de outro cliente não devolve nada', count(*) = 0
  from public.portal_tasks_in_progress('00000000-0000-0000-0000-00000000dead');

do $$ begin
  raise exception 'RESULTADO FASE 3 (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
