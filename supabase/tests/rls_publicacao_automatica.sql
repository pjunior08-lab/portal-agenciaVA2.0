-- Teste da publicação automática (conexão de contas, aprovação -> fila, robô). Agência fictícia;
-- termina com erro proposital que DESFAZ tudo. O segredo do agendador é lido do cofre (não fica no arquivo).
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (secret text) on commit drop;
insert into k select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret';
grant all on r, k to authenticated, anon;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000009a1','adm9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000009e1','editor9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000009b1','ver9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000009f1','cliente9@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a909','Agência Teste 9');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009a1','admin'),
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009e1','colaborador'),
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009b1','colaborador');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009e1','aprovacoes','editar'),
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009e1','social','editar'),
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000009b1','social','ver');
insert into public.clients (id, agency_id, name) values
  ('00000000-0000-0000-0000-0000000c1909','00000000-0000-0000-0000-00000000a909','Cliente 9');
insert into public.client_portal (client_id, agency_id, slug, sections) values
  ('00000000-0000-0000-0000-0000000c1909','00000000-0000-0000-0000-00000000a909','cliente-9-teste', array['aprovacoes']);
insert into public.client_users (client_id, user_id, agency_id) values
  ('00000000-0000-0000-0000-0000000c1909','00000000-0000-0000-0000-0000000009f1','00000000-0000-0000-0000-00000000a909');
-- cadastro manual antigo do Instagram do cliente (deve ser aproveitado na conexão)
insert into public.social_accounts (id, agency_id, client_id, network, username) values
  ('00000000-0000-0000-0000-0000000ac909','00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000c1909','instagram','cliente9');

set local role authenticated;

-- ---------- conexão ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009b1","role":"authenticated"}';
do $$ begin
  perform public.social_store_pending('00000000-0000-0000-0000-00000000a909', '[{"network":"instagram","external_id":"1","username":"x","token_encrypted":"v1.x"}]');
  insert into r values ('Social só "ver" não conecta contas', false);
exception when others then insert into r values ('Social só "ver" não conecta contas', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}';
insert into r select 'guarda as contas encontradas', public.social_store_pending('00000000-0000-0000-0000-00000000a909',
  '[{"network":"instagram","external_id":"ig-909","page_id":"pg-909","username":"Cliente9","token_encrypted":"v1.a.b.c"},
    {"network":"facebook","external_id":"pg-909","page_id":"pg-909","username":"Cliente 9 Página","token_encrypted":"v1.a.b.c"},
    {"network":"tiktok","external_id":"t","username":"t","token_encrypted":"v1"}]') = 2;
insert into r select 'lista sem as chaves e sugere o cliente do cadastro com o mesmo @',
  count(*) = 2 and bool_or(network = 'instagram' and suggested_client = '00000000-0000-0000-0000-0000000c1909')
  from public.social_pending_list('00000000-0000-0000-0000-00000000a909');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}';
insert into r select 'cada pessoa vê só as contas que ela conectou', count(*) = 0 from public.social_pending_list('00000000-0000-0000-0000-00000000a909');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}';
insert into r select 'liga as contas ao cliente', public.social_link_accounts('00000000-0000-0000-0000-00000000a909',
  (select jsonb_agg(jsonb_build_object('key', key, 'client_id', '00000000-0000-0000-0000-0000000c1909'))
     from public.social_pending_list('00000000-0000-0000-0000-00000000a909'))) = 2;
insert into r select 'aproveita o cadastro manual do Instagram', count(*) = 1 and bool_and(id = '00000000-0000-0000-0000-0000000ac909' and connection = 'conectada')
  from public.social_accounts where network = 'instagram' and client_id = '00000000-0000-0000-0000-0000000c1909';
insert into r select 'Facebook conectado', count(*) = 1 from public.social_accounts where network = 'facebook' and connection = 'conectada' and page_id = 'pg-909';
do $$ begin
  perform 1 from private.social_tokens;
  insert into r values ('equipe não lê as chaves', false);
exception when others then insert into r values ('equipe não lê as chaves', true); end $$;

-- ---------- aprovação -> fila ----------
insert into public.posts (id, agency_id, client_id, title, caption, mode, publish_mode, networks, scheduled_at, created_by) values
  ('00000000-0000-0000-0000-0000000bb909','00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000c1909','Post automático','Legenda',
   'rapida','automatica', array['instagram','facebook','tiktok']::public.social_network[], now() - interval '1 minute','00000000-0000-0000-0000-0000000009e1');
-- agendamento manual vencido: continua só no calendário
insert into public.social_publications (agency_id, client_id, network, title, scheduled_at, created_by) values
  ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000c1909','instagram','Manual', now() - interval '1 hour','00000000-0000-0000-0000-0000000009e1');
do $$ begin
  insert into public.social_publications (agency_id, client_id, network, title, scheduled_at, status) values
    ('00000000-0000-0000-0000-00000000a909','00000000-0000-0000-0000-0000000c1909','instagram','x', now(), 'erro');
  insert into r values ('equipe não cria com status do robô', false);
exception when others then insert into r values ('equipe não cria com status do robô', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009f1","role":"authenticated"}';
select public.client_decide_post('00000000-0000-0000-0000-0000000bb909', 'geral', 'aprovado');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}';
insert into r select 'aprovação cria uma publicação por rede', count(*) = 3 from public.social_publications where post_id = '00000000-0000-0000-0000-0000000bb909';
insert into r select 'Instagram e Facebook automáticos e com a conta conectada', count(*) = 2 and bool_and(account_id is not null)
  from public.social_publications where post_id = '00000000-0000-0000-0000-0000000bb909' and auto;
insert into r select 'TikTok fica só no calendário', not auto from public.social_publications where post_id = '00000000-0000-0000-0000-0000000bb909' and network = 'tiktok';

-- ---------- robô ----------
set local role anon;
do $$ begin
  perform public.social_claim('segredo-errado-segredo-errado-segredo-errado');
  insert into r values ('robô sem o segredo não entra', false);
exception when others then insert into r values ('robô sem o segredo não entra', true); end $$;
create temp table c on commit drop as select * from public.social_claim((select secret from k));
grant select on c to authenticated;
insert into r select 'robô pega só as automáticas vencidas, com chave', count(*) = 2 and bool_and(token_encrypted = 'v1.a.b.c') from c;
insert into r select 'segunda chamada não pega de novo', count(*) = 0 from public.social_claim((select secret from k));

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}';
do $$ begin
  update public.social_publications set caption = 'mexi' where status = 'publicando';
  insert into r values ('não edita publicação em andamento', false);
exception when others then insert into r values ('não edita publicação em andamento', true); end $$;

set local role anon;
select public.social_report((select secret from k), (select id from c where network = 'instagram'), 'publicado', null, 'm1', 'https://www.instagram.com/p/x/');
select public.social_report((select secret from k), (select id from c where network = 'facebook'), 'erro', null, null, null, 'Falha temporária');

set local role authenticated;
insert into r select 'publicado com link', status = 'publicado' and permalink is not null and published_at is not null
  from public.social_publications where id = (select id from c where network = 'instagram');
insert into r select 'erro temporário volta para a fila em 10 min', status = 'agendado' and attempts = 1 and scheduled_at > now() + interval '9 minutes'
  from public.social_publications where id = (select id from c where network = 'facebook');
insert into r select 'avisa quem criou', count(*) = 1 from public.notifications where title = 'Post publicado no Instagram' and recipient_id = '00000000-0000-0000-0000-0000000009e1';

set local role anon;
select public.social_report((select secret from k), (select id from c where network = 'facebook'), 'definitivo', null, null, null, 'Chave de acesso (token) inválida');
set local role authenticated;
insert into r select 'erro definitivo marca como falhou', status = 'erro' and last_error is not null
  from public.social_publications where id = (select id from c where network = 'facebook');
insert into r select 'chave inválida pede reconexão', connection = 'erro' from public.social_accounts where network = 'facebook' and page_id = 'pg-909';
update public.social_publications set status = 'agendado' where id = (select id from c where network = 'facebook');
insert into r select 'tentar de novo zera as tentativas', attempts = 0 and last_error is null
  from public.social_publications where id = (select id from c where network = 'facebook');

select public.social_disconnect('00000000-0000-0000-0000-0000000ac909');
insert into r select 'desconectar volta para manual', connection = 'manual' and external_id is null from public.social_accounts where id = '00000000-0000-0000-0000-0000000ac909';
reset role;
insert into r select 'desconectar apaga a chave', count(*) = 0 from private.social_tokens where account_id = '00000000-0000-0000-0000-0000000ac909';

do $$ declare t text; begin
  select string_agg(case when ok then 'OK   ' else 'FALHA' end || ' ' || v, E'\n') into t from r;
  raise exception E'%\n(%/% ok)', t, (select count(*) filter (where ok) from r), (select count(*) from r);
end $$;
