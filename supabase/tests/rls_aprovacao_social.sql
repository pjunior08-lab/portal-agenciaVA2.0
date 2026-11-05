-- Teste de permissões de Aprovação e Social. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
grant all on r to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a4','adm4@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c4','editor4@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d4','semacesso4@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f5','cliente4@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f6','outrocliente4@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values ('00000000-0000-0000-0000-00000000a9e4','Agência Teste 4');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000000a4','admin'),
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000000c4','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000000d4','colaborador');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000000c4','aprovacoes','editar'),
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000000c4','social','ver');
insert into public.clients (id, agency_id, name) values
  ('00000000-0000-0000-0000-0000000c1e04','00000000-0000-0000-0000-00000000a9e4','Cliente 4'),
  ('00000000-0000-0000-0000-0000000c1e05','00000000-0000-0000-0000-00000000a9e4','Cliente 5');
insert into public.client_portal (client_id, agency_id, slug, sections) values
  ('00000000-0000-0000-0000-0000000c1e04','00000000-0000-0000-0000-00000000a9e4','cliente-4-teste', array['aprovacoes','calendario']),
  ('00000000-0000-0000-0000-0000000c1e05','00000000-0000-0000-0000-00000000a9e4','cliente-5-teste', array['arquivos']);
insert into public.client_users (client_id, user_id, agency_id) values
  ('00000000-0000-0000-0000-0000000c1e04','00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-00000000a9e4'),
  ('00000000-0000-0000-0000-0000000c1e05','00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-00000000a9e4');

set local role authenticated;
-- editor envia: rápida (agendamento automático), detalhada e um post de outro cliente
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
insert into public.posts (id, agency_id, client_id, title, caption, mode, publish_mode, networks, scheduled_at, created_by, status) values
  ('00000000-0000-0000-0000-0000000bb001','00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e04','Post rápido','Legenda', 'rapida','automatica', array['instagram']::public.social_network[], now() + interval '2 days','00000000-0000-0000-0000-0000000000c4','aprovado'),
  ('00000000-0000-0000-0000-0000000bb002','00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e04','Post detalhado','Legenda', 'detalhada','manual', '{}', null,'00000000-0000-0000-0000-0000000000c4','enviado'),
  ('00000000-0000-0000-0000-0000000bb003','00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e05','Post de outro cliente','', 'rapida','manual', '{}', null,'00000000-0000-0000-0000-0000000000c4','enviado');
insert into r select 'envio nasce como "enviado" mesmo se pedir outro status', status = 'enviado' from public.posts where id = '00000000-0000-0000-0000-0000000bb001';
do $$ begin
  update public.posts set status = 'aprovado' where id = '00000000-0000-0000-0000-0000000bb002';
  insert into r values ('equipe não aprova em nome do cliente', false);
exception when others then insert into r values ('equipe não aprova em nome do cliente', true); end $$;
do $$ begin
  perform public.client_decide_post('00000000-0000-0000-0000-0000000bb002', 'geral', 'aprovado');
  insert into r values ('equipe não usa a função de decisão do cliente', false);
exception when others then insert into r values ('equipe não usa a função de decisão do cliente', true); end $$;
do $$ begin
  insert into public.social_accounts (agency_id, client_id, network, username) values
    ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e04','instagram','cliente4');
  insert into r values ('Social só "ver" não cadastra conta', false);
exception when others then insert into r values ('Social só "ver" não cadastra conta', true); end $$;

-- colaborador sem os módulos
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
insert into r select 'sem o módulo não vê envios', count(*) = 0 from public.posts;
do $$ begin
  insert into public.posts (agency_id, client_id, title, created_by) values
    ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e04','x','00000000-0000-0000-0000-0000000000d4');
  insert into r values ('sem o módulo não envia', false);
exception when others then insert into r values ('sem o módulo não envia', true); end $$;

-- cliente 4 no portal
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}';
insert into r select 'cliente vê só os envios dele', count(*) = 2 and bool_and(client_id = '00000000-0000-0000-0000-0000000c1e04') from public.posts;
select public.client_open_post('00000000-0000-0000-0000-0000000bb001');
insert into r select 'abrir o envio passa para "Cliente analisando"', status = 'em_analise' from public.posts where id = '00000000-0000-0000-0000-0000000bb001';
do $$ begin
  perform public.client_decide_post('00000000-0000-0000-0000-0000000bb001', 'geral', 'alteracoes', '');
  insert into r values ('pedir alteração exige comentário', false);
exception when others then insert into r values ('pedir alteração exige comentário', true); end $$;
insert into r select 'aprovação rápida aprova o envio', public.client_decide_post('00000000-0000-0000-0000-0000000bb001', 'geral', 'aprovado') = 'aprovado';
insert into r select 'aprovado com agendamento automático vai para o calendário', count(*) = 1
  from public.social_publications where post_id = '00000000-0000-0000-0000-0000000bb001';
do $$ begin
  perform public.client_decide_post('00000000-0000-0000-0000-0000000bb001', 'geral', 'reprovado', 'mudei de ideia');
  insert into r values ('não decide de novo um envio já decidido', false);
exception when others then insert into r values ('não decide de novo um envio já decidido', true); end $$;
insert into r select 'detalhada: uma parte decidida mantém em análise',
  public.client_decide_post('00000000-0000-0000-0000-0000000bb002', 'tema', 'aprovado') = 'em_analise';
select public.client_decide_post('00000000-0000-0000-0000-0000000bb002', 'midias', 'aprovado');
insert into r select 'detalhada: legenda com alteração pede ajuste no envio',
  public.client_decide_post('00000000-0000-0000-0000-0000000bb002', 'legenda', 'alteracoes', 'Trocar a chamada') = 'alteracoes';
insert into r select 'cliente vê o histórico do envio', count(*) = 3 from public.approval_events where post_id = '00000000-0000-0000-0000-0000000bb002';
do $$ begin
  perform public.client_decide_post('00000000-0000-0000-0000-0000000bb003', 'geral', 'aprovado');
  insert into r values ('cliente não decide envio de outro cliente', false);
exception when others then insert into r values ('cliente não decide envio de outro cliente', true); end $$;
update public.posts set title = 'hackeado' where id = '00000000-0000-0000-0000-0000000bb002';
insert into r select 'cliente não edita o envio', count(*) = 0 from public.posts where title = 'hackeado';
insert into r select 'cliente não vê contas sociais', count(*) = 0 from public.social_accounts;

-- outro cliente sem a seção de aprovações
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}';
insert into r select 'cliente sem a seção não vê envios', count(*) = 0 from public.posts;
insert into r select 'cliente sem a seção não vê calendário', count(*) = 0 from public.social_publications;

-- editor reenvia o post que pediu alteração
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
insert into r select 'equipe recebe notificação da decisão', count(*) = 2 from public.notifications
  where recipient_id = '00000000-0000-0000-0000-0000000000c4' and agency_id = '00000000-0000-0000-0000-00000000a9e4';
update public.posts set status = 'enviado', theme_decision = null, media_decision = null, caption_decision = null,
  decided_at = null, round = round + 1, caption = 'Nova legenda'
  where id = '00000000-0000-0000-0000-0000000bb002';
insert into r select 'reenvio abre nova rodada', status = 'enviado' and round = 2 from public.posts where id = '00000000-0000-0000-0000-0000000bb002';
insert into r select 'Social "ver" lê o calendário', count(*) = 1 from public.social_publications;

-- admin cadastra conta e agenda
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
insert into public.social_accounts (agency_id, client_id, network, username) values
  ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e05','tiktok','cliente5');
do $$ begin
  insert into public.social_publications (agency_id, client_id, account_id, network, title, scheduled_at) values
    ('00000000-0000-0000-0000-00000000a9e4','00000000-0000-0000-0000-0000000c1e04',(select id from public.social_accounts where username = 'cliente5'),'tiktok','x', now());
  insert into r values ('agendamento não usa conta de outro cliente', false);
exception when others then insert into r values ('agendamento não usa conta de outro cliente', true); end $$;
update public.social_publications set status = 'publicado' where post_id = '00000000-0000-0000-0000-0000000bb001';
insert into r select 'marcar publicado registra a data', published_at is not null from public.social_publications where post_id = '00000000-0000-0000-0000-0000000bb001';

do $$ begin
  raise exception 'RESULTADO FASE 4 (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
