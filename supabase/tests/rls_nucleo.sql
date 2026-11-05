-- Teste de permissões do núcleo. Roda dentro de uma transação e desfaz tudo (rollback).
-- Uso: colar no SQL Editor do Supabase ou rodar com psql. Resultado: uma linha por verificação.
begin;

create temp table resultado (verificacao text, ok boolean) on commit drop;
grant all on resultado to authenticated;

-- três pessoas fictícias de teste
insert into auth.users (id, email, raw_user_meta_data, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local', '{"full_name":"Admin Teste"}', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c1', 'colab@teste.local', '{"full_name":"Colab Teste"}', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000e1', 'intruso@teste.local', '{"full_name":"Intruso"}', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into resultado select 'perfil criado automaticamente', count(*) = 3 from public.profiles
  where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1');

-- ===== admin cria a agência e convida o colaborador =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

create temp table ctx as select public.bootstrap_agency('Agência Teste') as agency_id;

insert into resultado select 'admin vê a agência', count(*) = 1 from public.agencies;

create temp table tok as
  select public.create_invitation((select agency_id from ctx), 'colab@teste.local', 'colaborador',
    '[{"module":"clientes","level":"editar"},{"module":"agenda","level":"ver"}]') as t;

insert into resultado select 'admin vê o convite (só o hash fica salvo)', count(*) = 1 from public.invitations
  where token_hash <> (select t from tok);

-- segunda agência é recusada
do $$ begin
  perform public.bootstrap_agency('Outra');
  insert into resultado values ('segunda agência recusada', false);
exception when others then
  insert into resultado values ('segunda agência recusada', true);
end $$;

-- ===== colaborador aceita o convite =====
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select public.accept_invitation((select t from tok));

insert into resultado select 'colaborador virou membro com papel colaborador', count(*) = 1
  from public.agency_members where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'colaborador';
insert into resultado select 'colaborador recebeu 2 acessos', count(*) = 2 from public.member_module_access;
insert into resultado select 'colaborador edita clientes',
  private.can_access((select agency_id from ctx), 'clientes', 'editar');
insert into resultado select 'colaborador só vê agenda (não edita)',
  private.can_access((select agency_id from ctx), 'agenda', 'ver')
  and not private.can_access((select agency_id from ctx), 'agenda', 'editar');
insert into resultado select 'colaborador não acessa financeiro',
  not private.can_access((select agency_id from ctx), 'financeiro', 'ver');
insert into resultado select 'colaborador acessa Início (sempre liberado)',
  private.can_access((select agency_id from ctx), 'inicio', 'ver');
insert into resultado select 'colaborador não vê convites', count(*) = 0 from public.invitations;

-- colaborador não consegue se promover nem se dar acesso
update public.agency_members set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  insert into public.member_module_access (agency_id, user_id, module, level)
  values ((select agency_id from ctx), '00000000-0000-0000-0000-0000000000c1', 'financeiro', 'editar');
  insert into resultado values ('colaborador não se dá acesso', false);
exception when others then
  insert into resultado values ('colaborador não se dá acesso', true);
end $$;

-- convite reutilizado é recusado
do $$ begin
  perform public.accept_invitation((select t from tok));
  insert into resultado values ('convite não pode ser usado duas vezes', false);
exception when others then
  insert into resultado values ('convite não pode ser usado duas vezes', true);
end $$;

-- ===== intruso (logado, sem convite) =====
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
insert into resultado select 'intruso não vê agência', count(*) = 0 from public.agencies;
insert into resultado select 'intruso não vê equipe', count(*) = 0 from public.agency_members;
insert into resultado select 'intruso não vê perfis alheios', count(*) = 1 from public.profiles;
insert into resultado select 'intruso não acessa módulos',
  not private.can_access((select agency_id from ctx), 'inicio', 'ver');

-- ===== admin: não pode deixar a agência sem administrador =====
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into resultado select 'colaborador continua colaborador (promoção bloqueada)', count(*) = 1
  from public.agency_members where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'colaborador';
do $$ begin
  update public.agency_members set role = 'colaborador' where user_id = '00000000-0000-0000-0000-0000000000a1';
  insert into resultado values ('último admin não pode ser rebaixado', false);
exception when others then
  insert into resultado values ('último admin não pode ser rebaixado', true);
end $$;
insert into resultado select 'mudanças da equipe auditadas', count(*) >= 3 from public.audit_log;

reset role;
select verificacao, ok from resultado;
rollback;
