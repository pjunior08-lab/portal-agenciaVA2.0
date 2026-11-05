-- Teste de permissões do núcleo (Fase 1) para um banco que JÁ tem a agência real (22 verificações).
-- Cria uma agência fictícia, testa e termina com um erro proposital que DESFAZ tudo e mostra o resultado.
-- Seguro para rodar no banco de produção (SQL Editor do Supabase).
begin;
create temp table resultado (verificacao text, ok boolean) on commit drop;
grant all on resultado to authenticated;
insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a1','admin@teste.local','{"full_name":"Admin Teste"}','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c1','colab@teste.local','{"full_name":"Colab Teste"}','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000e1','intruso@teste.local','{"full_name":"Intruso"}','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into resultado select 'perfil criado automaticamente', count(*) = 3 from public.profiles where id::text like '00000000-0000-0000-0000-0000000000%';
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9e0','Agência Teste');
insert into public.agency_members (agency_id, user_id, role) values ('00000000-0000-0000-0000-00000000a9e0','00000000-0000-0000-0000-0000000000a1','admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.bootstrap_agency('Outra'); insert into resultado values ('segunda agência recusada', false);
exception when others then insert into resultado values ('segunda agência recusada', true); end $$;
insert into resultado select 'admin vê só a própria agência', count(*) = 1 from public.agencies;
create temp table tok as select public.create_invitation('00000000-0000-0000-0000-00000000a9e0','colab@teste.local','colaborador','[{"module":"clientes","level":"editar"},{"module":"agenda","level":"ver"}]') t;
insert into resultado select 'convite salvo só como hash', count(*) = 1 from public.invitations where token_hash <> (select t from tok);
do $$ begin perform public.create_invitation('00000000-0000-0000-0000-00000000a9e0','x@teste.local','colaborador','[{"module":"inexistente","level":"ver"}]');
  insert into resultado values ('convite com módulo inválido recusado', false);
exception when others then insert into resultado values ('convite com módulo inválido recusado', true); end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
do $$ begin perform public.accept_invitation((select t from tok)); insert into resultado values ('convite de outro e-mail recusado', false);
exception when others then insert into resultado values ('convite de outro e-mail recusado', true); end $$;
insert into resultado select 'intruso não vê nenhuma agência', count(*) = 0 from public.agencies;
insert into resultado select 'intruso não vê equipe', count(*) = 0 from public.agency_members;
insert into resultado select 'intruso só vê o próprio perfil', count(*) = 1 from public.profiles;
insert into resultado select 'intruso não vê clientes', count(*) = 0 from public.clients;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select public.accept_invitation((select t from tok));
insert into resultado select 'colaborador entrou como colaborador', count(*) = 1 from public.agency_members where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'colaborador';
insert into resultado select 'colaborador edita clientes', private.can_access('00000000-0000-0000-0000-00000000a9e0','clientes','editar');
insert into resultado select 'colaborador só vê agenda', private.can_access('00000000-0000-0000-0000-00000000a9e0','agenda','ver') and not private.can_access('00000000-0000-0000-0000-00000000a9e0','agenda','editar');
insert into resultado select 'colaborador sem financeiro', not private.can_access('00000000-0000-0000-0000-00000000a9e0','financeiro','ver');
insert into resultado select 'colaborador não vê convites', count(*) = 0 from public.invitations;
update public.agency_members set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin insert into public.member_module_access values ('00000000-0000-0000-0000-00000000a9e0','00000000-0000-0000-0000-0000000000c1','financeiro','editar');
  insert into resultado values ('colaborador não se dá acesso', false);
exception when others then insert into resultado values ('colaborador não se dá acesso', true); end $$;
update public.agencies set name = 'Hackeada' where true;
insert into resultado select 'colaborador não altera a agência', (select name from public.agencies limit 1) = 'Agência Teste';
do $$ begin perform public.accept_invitation((select t from tok)); insert into resultado values ('convite usado só uma vez', false);
exception when others then insert into resultado values ('convite usado só uma vez', true); end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into resultado select 'promoção do colaborador bloqueada', count(*) = 1 from public.agency_members where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'colaborador';
update public.agency_members set status = 'desativado' where user_id = '00000000-0000-0000-0000-0000000000c1';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
insert into resultado select 'desativado perde o acesso', not private.can_access('00000000-0000-0000-0000-00000000a9e0','clientes','ver');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin update public.agency_members set role = 'colaborador' where user_id = '00000000-0000-0000-0000-0000000000a1';
  insert into resultado values ('último admin não pode ser rebaixado', false);
exception when others then insert into resultado values ('último admin não pode ser rebaixado', true); end $$;
insert into resultado select 'mudanças auditadas', count(*) >= 3 from public.audit_log where agency_id = '00000000-0000-0000-0000-00000000a9e0';
do $$ begin
  raise exception 'RESULTADO FASE 1 (desfeito): % de % OK | %', (select count(*) filter (where ok) from resultado), (select count(*) from resultado),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || verificacao, ' | ') from resultado);
end $$;
