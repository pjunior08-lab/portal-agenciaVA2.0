-- Teste de permissões de Clientes e Portal (23 verificações).
-- Cria uma agência fictícia, testa e termina com um erro proposital que DESFAZ tudo
-- e mostra o resultado na mensagem. Seguro para rodar no banco de produção.
begin;
create temp table r (v text, ok boolean) on commit drop;
grant all on r to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a2','adm2@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c2','colab2@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d2','semclientes@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f2','cliente@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f3','outrocliente@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9e1', 'Agência Teste 2');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000000a2','admin'),
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000000c2','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000000d2','colaborador');
insert into public.member_module_access values ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000000c2','clientes','ver');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into public.clients (id, agency_id, name, monthly_fee, billing_day) values
  ('00000000-0000-0000-0000-0000000c1e01','00000000-0000-0000-0000-00000000a9e1','Cliente A', 1500, 10),
  ('00000000-0000-0000-0000-0000000c1e02','00000000-0000-0000-0000-00000000a9e1','Cliente B', 900, 5);
insert into public.client_portal (client_id, agency_id, slug, sections) values
  ('00000000-0000-0000-0000-0000000c1e01','00000000-0000-0000-0000-00000000a9e1','cliente-a', array['arquivos','anotacoes']),
  ('00000000-0000-0000-0000-0000000c1e02','00000000-0000-0000-0000-00000000a9e1','cliente-b', array['arquivos']);
insert into public.client_notes (agency_id, client_id, body, shared_with_client) values
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e01','nota interna', false),
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e01','nota compartilhada', true),
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e02','nota do B', true);
insert into public.client_files (agency_id, client_id, path, name, size_bytes, shared_with_client) values
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e01','00000000-0000-0000-0000-00000000a9e1/00000000-0000-0000-0000-0000000c1e01/arquivos/a.pdf','a.pdf',10,true),
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e01','00000000-0000-0000-0000-00000000a9e1/00000000-0000-0000-0000-0000000c1e01/arquivos/interno.pdf','interno.pdf',10,false);
insert into r select 'admin cria clientes', count(*) = 2 from public.clients;
create temp table tk as select public.create_client_invitation('00000000-0000-0000-0000-0000000c1e01','cliente@teste.local') t;
create temp table sh as select public.share_client_strategy('00000000-0000-0000-0000-0000000c1e01') t;
insert into r select 'link da central funciona', count(*) = 1 from public.shared_client_strategy((select t from sh));
do $$ begin
  insert into public.client_files (agency_id, client_id, path, name, size_bytes) values
  ('00000000-0000-0000-0000-00000000a9e1','00000000-0000-0000-0000-0000000c1e01','outra/pasta/x.pdf','x',1);
  insert into r values ('caminho de arquivo fora da pasta é recusado', false);
exception when others then insert into r values ('caminho de arquivo fora da pasta é recusado', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
insert into r select 'colaborador com "ver" lista clientes', count(*) = 2 from public.clients;
do $$ begin
  insert into public.clients (agency_id, name) values ('00000000-0000-0000-0000-00000000a9e1','Invasor');
  insert into r values ('colaborador "ver" não cria cliente', false);
exception when others then insert into r values ('colaborador "ver" não cria cliente', true); end $$;
update public.clients set name = 'X' where true;
insert into r select 'colaborador "ver" não edita cliente', count(*) = 0 from public.clients where name = 'X';
do $$ begin perform public.create_client_invitation('00000000-0000-0000-0000-0000000c1e01','x@teste.local');
  insert into r values ('colaborador "ver" não convida cliente', false);
exception when others then insert into r values ('colaborador "ver" não convida cliente', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
insert into r select 'colaborador sem o módulo não vê clientes', count(*) = 0 from public.clients;
insert into r select 'colaborador sem o módulo não vê arquivos', count(*) = 0 from public.client_files;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
do $$ begin perform public.accept_client_invitation((select t from tk));
  insert into r values ('convite do cliente recusa outro e-mail', false);
exception when others then insert into r values ('convite do cliente recusa outro e-mail', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
insert into r select 'cliente aceita convite e recebe o endereço do portal', public.accept_client_invitation((select t from tk)) = 'cliente-a';
insert into r select 'cliente vê só o próprio cliente', count(*) = 1 and min(name) = 'Cliente A' from public.clients;
insert into r select 'cliente vê só anotações compartilhadas', count(*) = 1 and min(body) = 'nota compartilhada' from public.client_notes;
insert into r select 'cliente vê só arquivos compartilhados', count(*) = 1 and min(name) = 'a.pdf' from public.client_files;
insert into r select 'cliente não vê a central estratégica', count(*) = 0 from public.client_strategy;
insert into r select 'cliente não vê a agência', count(*) = 0 from public.agencies;
insert into r select 'cliente não acessa módulos da equipe', not private.can_access('00000000-0000-0000-0000-00000000a9e1','clientes','ver');
update public.clients set name = 'Hack' where true;
insert into r select 'cliente não edita o cadastro', count(*) = 0 from public.clients where name = 'Hack';
insert into r select 'my_client_portals devolve o portal', (select slug from public.my_client_portals() limit 1) = 'cliente-a';

reset role;
update public.client_portal set sections = array['arquivos'] where client_id = '00000000-0000-0000-0000-0000000c1e01';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
insert into r select 'seção desligada esconde as anotações', count(*) = 0 from public.client_notes;
reset role;
update public.client_portal set enabled = false where client_id = '00000000-0000-0000-0000-0000000c1e01';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
insert into r select 'portal desligado bloqueia tudo', (select count(*) from public.clients) = 0 and (select count(*) from public.client_files) = 0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select public.unshare_client_strategy('00000000-0000-0000-0000-0000000c1e01');
insert into r select 'link desfeito deixa de funcionar', count(*) = 0 from public.shared_client_strategy((select t from sh));
insert into r select 'agência real não aparece para o admin de teste', count(*) = 1 from public.agencies;
do $$ begin
  raise exception 'RESULTADO (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
