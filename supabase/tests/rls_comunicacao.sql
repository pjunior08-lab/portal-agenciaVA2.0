-- Teste do chat. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (name text primary key, val text) on commit drop;
grant all on r, k to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a9','adm9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b9','colab9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c9','leitor9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d9','semacesso9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f9','cliente9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9a9','Agência Teste 9');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000a9','admin'),
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000b9','colaborador'),
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000c9','colaborador'),
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000d9','colaborador');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000b9','comunicacao','editar'),
  ('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000c9','comunicacao','ver');
insert into public.clients (id, agency_id, name) values ('00000000-0000-0000-0000-0000000c1a09','00000000-0000-0000-0000-00000000a9a9','Cliente 9');
insert into public.client_portal (client_id, agency_id, slug, sections) values ('00000000-0000-0000-0000-0000000c1a09','00000000-0000-0000-0000-00000000a9a9','cliente-9', array['mensagens']);
insert into public.client_users (client_id, user_id, agency_id) values ('00000000-0000-0000-0000-0000000c1a09','00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-00000000a9a9');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
insert into k select 'dm', public.chat_open_direct('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000b9')::text;
insert into r select 'abrir conversa direta duas vezes dá a mesma', public.chat_open_direct('00000000-0000-0000-0000-00000000a9a9','00000000-0000-0000-0000-0000000000b9')::text = (select val from k where name = 'dm');
with m as (insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'dm')::uuid, '00000000-0000-0000-0000-0000000000a9', '  Oi!  ') returning body)
insert into r select 'mensagem com retorno e texto aparado', body = 'Oi!' from m;
insert into k select 'grp', public.chat_save_group('00000000-0000-0000-0000-00000000a9a9', null, 'Time', array['00000000-0000-0000-0000-0000000000c9']::uuid[])::text;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}';
insert into r select 'quem recebe vê a não lida', (select unread from public.chat_unread('00000000-0000-0000-0000-00000000a9a9') where conversation_id = (select val from k where name = 'dm')::uuid) = 1;
select public.chat_mark_read((select val from k where name = 'dm')::uuid);
insert into r select 'marcar como lida zera', not exists (select 1 from public.chat_unread('00000000-0000-0000-0000-00000000a9a9') where conversation_id = (select val from k where name = 'dm')::uuid);
insert into r select 'fora do grupo não vê o grupo', count(*) = 0 from public.chat_conversations where id = (select val from k where name = 'grp')::uuid;
do $$ begin
  insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'grp')::uuid, '00000000-0000-0000-0000-0000000000b9', 'intruso');
  insert into r values ('fora do grupo não escreve no grupo', false);
exception when others then insert into r values ('fora do grupo não escreve no grupo', true); end $$;
do $$ begin
  insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'dm')::uuid, '00000000-0000-0000-0000-0000000000a9', 'falso');
  insert into r values ('não escreve em nome de outra pessoa', false);
exception when others then insert into r values ('não escreve em nome de outra pessoa', true); end $$;
insert into k select 'cli', public.chat_client_conversation('00000000-0000-0000-0000-0000000c1a09')::text;
insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'cli')::uuid, '00000000-0000-0000-0000-0000000000b9', 'Olá, cliente');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated"}';
insert into r select 'leitor vê o grupo e a conversa do cliente', (select count(*) from public.chat_conversations) = 2;
insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'grp')::uuid, '00000000-0000-0000-0000-0000000000c9', 'no grupo');
insert into r select 'leitor escreve no grupo interno', true;
do $$ begin
  insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'cli')::uuid, '00000000-0000-0000-0000-0000000000c9', 'ao cliente');
  insert into r values ('leitor não responde ao cliente', false);
exception when others then insert into r values ('leitor não responde ao cliente', true); end $$;
insert into r select 'leitor não vê a conversa direta dos outros', count(*) = 0 from public.chat_messages where conversation_id = (select val from k where name = 'dm')::uuid;
select public.chat_leave_group((select val from k where name = 'grp')::uuid);
insert into r select 'quem sai do grupo deixa de ver', count(*) = 0 from public.chat_conversations where id = (select val from k where name = 'grp')::uuid;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}';
insert into r select 'cliente vê só a própria conversa', (select count(*) from public.chat_conversations) = 1 and (select count(*) from public.chat_messages) = 1;
insert into r select 'cliente abre a mesma conversa', public.chat_client_conversation('00000000-0000-0000-0000-0000000c1a09')::text = (select val from k where name = 'cli');
with m as (insert into public.chat_messages (conversation_id, author_id, body) values ((select val from k where name = 'cli')::uuid, '00000000-0000-0000-0000-0000000000f9', 'Oi, agência') returning id)
insert into k select 'climsg', id::text from m;
update public.chat_messages set deleted_at = now() where id = (select val from k where name = 'climsg')::uuid;
insert into r select 'apagar limpa o texto', (select body = '' and deleted_at is not null from public.chat_messages where id = (select val from k where name = 'climsg')::uuid);
update public.chat_messages set deleted_at = now() where author_id = '00000000-0000-0000-0000-0000000000b9';
insert into r select 'não apaga mensagem dos outros', (select deleted_at is null from public.chat_messages where body = 'Olá, cliente');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d9","role":"authenticated"}';
insert into r select 'sem o módulo não vê nada', (select count(*) from public.chat_conversations) = 0 and (select count(*) from public.chat_messages) = 0;
do $$ begin
  perform public.chat_client_conversation('00000000-0000-0000-0000-0000000c1a09');
  insert into r values ('sem o módulo não abre conversa de cliente', false);
exception when others then insert into r values ('sem o módulo não abre conversa de cliente', true); end $$;

reset role;
update public.client_portal set sections = '{}' where client_id = '00000000-0000-0000-0000-0000000c1a09';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}';
insert into r select 'sem a seção Mensagens o cliente não vê', count(*) = 0 from public.chat_messages;

do $$ begin
  raise exception 'RESULTADO FASE 8A CHAT (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
