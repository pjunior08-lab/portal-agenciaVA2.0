-- Teste de permissões de Propostas e Contratos. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (name text primary key, val text) on commit drop;
grant all on r, k to authenticated, anon;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a5','adm5@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c5','editor5@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d5','semacesso5@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000f7','cliente5@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name, legal_name, cnpj) values ('00000000-0000-0000-0000-00000000a9e5','Agência Teste 5','Agência Teste 5 Ltda','00000000000100');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9e5','00000000-0000-0000-0000-0000000000a5','admin'),
  ('00000000-0000-0000-0000-00000000a9e5','00000000-0000-0000-0000-0000000000c5','colaborador'),
  ('00000000-0000-0000-0000-00000000a9e5','00000000-0000-0000-0000-0000000000d5','colaborador');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a9e5','00000000-0000-0000-0000-0000000000c5','propostas','editar'),
  ('00000000-0000-0000-0000-00000000a9e5','00000000-0000-0000-0000-0000000000c5','contratos','editar');
insert into public.clients (id, agency_id, name, document) values
  ('00000000-0000-0000-0000-0000000c1e06','00000000-0000-0000-0000-00000000a9e5','Cliente 6','12345678000199');
insert into public.client_portal (client_id, agency_id, slug, sections) values
  ('00000000-0000-0000-0000-0000000c1e06','00000000-0000-0000-0000-00000000a9e5','cliente-6-teste', array['servicos']);
insert into public.client_users (client_id, user_id, agency_id) values
  ('00000000-0000-0000-0000-0000000c1e06','00000000-0000-0000-0000-0000000000f7','00000000-0000-0000-0000-00000000a9e5');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
with ins as (
  insert into public.proposals (agency_id, number, title, client_id, created_by, share_token_hash, decision_name)
  values ('00000000-0000-0000-0000-00000000a9e5', '', 'Gestão de redes', '00000000-0000-0000-0000-0000000c1e06',
          '00000000-0000-0000-0000-0000000000c5', 'forjado', 'forjado')
  returning id, number, share_token_hash, decision_name)
insert into k select 'p1', id::text from ins
  where number = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-001' and share_token_hash is null and decision_name is null;
insert into r select 'criar proposta com retorno, número automático e sem token forjado', count(*) = 1 from k where name = 'p1';
with ins as (
  insert into public.proposals (agency_id, number, title, client_id, created_by)
  values ('00000000-0000-0000-0000-00000000a9e5', '', 'Rascunho', '00000000-0000-0000-0000-0000000c1e06', '00000000-0000-0000-0000-0000000000c5')
  returning number)
insert into r select 'segundo número automático é o seguinte', number like '%-002' from ins;
do $$ begin
  perform public.share_proposal((select val from k where name = 'p1')::uuid);
  insert into r values ('não envia proposta sem itens', false);
exception when others then insert into r values ('não envia proposta sem itens', true); end $$;
insert into public.proposal_items (agency_id, proposal_id, service, quantity, unit_price, cadence)
  values ('00000000-0000-0000-0000-00000000a9e5', (select val from k where name = 'p1')::uuid, 'Social media', 1, 2500, 'mensal');
insert into k values ('ptoken', public.share_proposal((select val from k where name = 'p1')::uuid));
insert into r select 'enviar gera o link e muda para "enviada"', status = 'enviada' and sent_at is not null
  from public.proposals where id = (select val from k where name = 'p1')::uuid;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}';
insert into r select 'sem o módulo não vê propostas', count(*) = 0 from public.proposals;
do $$ begin
  perform public.share_proposal((select val from k where name = 'p1')::uuid);
  insert into r values ('sem o módulo não gera link', false);
exception when others then insert into r values ('sem o módulo não gera link', true); end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}';
insert into r select 'cliente no portal não vê proposta ainda não aceita', count(*) = 0 from public.proposals;

-- visitante sem login com o link
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  perform count(*) from public.proposals;
  insert into r values ('sem login não lê a tabela de propostas', false);
exception when others then insert into r values ('sem login não lê a tabela de propostas', true); end $$;
insert into r select 'link mostra a proposta com itens', (public.public_proposal((select val from k where name = 'ptoken'))->'items'->0->>'service') = 'Social media';
insert into r select 'link errado não mostra nada', public.public_proposal('token-errado') is null;
do $$ begin
  perform public.public_proposal_decide('token-errado', 'aceita', 'Maria Silva');
  insert into r values ('link errado não aceita', false);
exception when others then insert into r values ('link errado não aceita', true); end $$;
insert into r select 'cliente aceita pelo link', public.public_proposal_decide((select val from k where name = 'ptoken'), 'aceita', 'Maria Silva', 'Ok', '200.1.1.1') = 'aceita';
do $$ begin
  perform public.public_proposal_decide((select val from k where name = 'ptoken'), 'recusada', 'Maria Silva');
  insert into r values ('não responde duas vezes', false);
exception when others then insert into r values ('não responde duas vezes', true); end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}';
insert into r select 'cliente no portal vê a proposta aceita e os itens', (select count(*) from public.proposals) = 1 and (select count(*) from public.proposal_items) = 1;
update public.proposals set title = 'hack';
insert into r select 'cliente não edita proposta', count(*) = 0 from public.proposals where title = 'hack';

-- contratos
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
insert into r select 'equipe recebe aviso do aceite', count(*) = 1 from public.notifications where recipient_id = '00000000-0000-0000-0000-0000000000c5' and title = 'Proposta aceita';
with ins as (
  insert into public.contracts (agency_id, title, client_id, proposal_id, body_html, status, created_by)
  values ('00000000-0000-0000-0000-00000000a9e5', 'Contrato de social media', '00000000-0000-0000-0000-0000000c1e06',
          (select val from k where name = 'p1')::uuid, '<p>{{contratante.nome}} contrata {{contratada.nome}}.</p>', 'assinado',
          '00000000-0000-0000-0000-0000000000c5')
  returning id, status)
insert into k select 'c1', id::text from ins where status = 'rascunho';
insert into r select 'criar contrato com retorno; nasce rascunho mesmo pedindo "assinado"', count(*) = 1 from k where name = 'c1';
do $$ begin
  update public.contracts set status = 'assinado' where id = (select val from k where name = 'c1')::uuid;
  insert into r values ('equipe não marca como assinado', false);
exception when others then insert into r values ('equipe não marca como assinado', true); end $$;
insert into k values ('ctoken', public.send_contract((select val from k where name = 'c1')::uuid, '<p>Cliente 6 contrata Agência Teste 5 Ltda.</p>'));
insert into r select 'enviar congela o texto com hash', status = 'aguardando' and length(document_hash) = 64 and rendered_html like '<p>Cliente 6%'
  from public.contracts where id = (select val from k where name = 'c1')::uuid;
do $$ begin
  update public.contracts set rendered_html = 'alterado' where id = (select val from k where name = 'c1')::uuid;
  update public.contracts set value = 999 where id = (select val from k where name = 'c1')::uuid;
  insert into r values ('contrato enviado não muda', false);
exception when others then insert into r values ('contrato enviado não muda', true); end $$;
insert into r select 'texto congelado continua o mesmo', rendered_html like '<p>Cliente 6%' from public.contracts where id = (select val from k where name = 'c1')::uuid;
do $$ begin
  perform public.sign_contract_as_agency((select val from k where name = 'c1')::uuid, 'Editor Teste', '12345678901');
  insert into r values ('colaborador não assina pela agência', false);
exception when others then insert into r values ('colaborador não assina pela agência', true); end $$;
do $$ begin
  insert into public.contract_signatures (agency_id, contract_id, party, signer_name, signer_document, document_hash)
  values ('00000000-0000-0000-0000-00000000a9e5', (select val from k where name = 'c1')::uuid, 'contratante', 'Falso', '12345678901', 'x');
  insert into r values ('ninguém grava assinatura direto na tabela', false);
exception when others then insert into r values ('ninguém grava assinatura direto na tabela', true); end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  perform public.public_contract_sign((select val from k where name = 'ctoken'), 'Maria Silva', '123');
  insert into r values ('assinatura exige CPF ou CNPJ', false);
exception when others then insert into r values ('assinatura exige CPF ou CNPJ', true); end $$;
insert into r select 'cliente assina pelo link', public.public_contract_sign((select val from k where name = 'ctoken'), 'Maria Silva', '123.456.789-01', 'maria@teste.local', '200.1.1.1', 'teste') = 'aguardando';
do $$ begin
  perform public.public_contract_sign((select val from k where name = 'ctoken'), 'Outra Pessoa', '98765432100');
  insert into r values ('cliente não assina duas vezes', false);
exception when others then insert into r values ('cliente não assina duas vezes', true); end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
do $$ begin
  update public.contracts set status = 'rascunho' where id = (select val from k where name = 'c1')::uuid;
  insert into r values ('com assinatura não volta para rascunho', false);
exception when others then insert into r values ('com assinatura não volta para rascunho', true); end $$;
insert into r select 'administrador assina e o contrato fica assinado',
  public.sign_contract_as_agency((select val from k where name = 'c1')::uuid, 'Admin Teste', '11.222.333/0001-81', '10.0.0.1', 'teste') = 'assinado';
insert into r select 'assinaturas guardam o hash do documento', count(*) = 2 and bool_and(s.document_hash = c.document_hash)
  from public.contract_signatures s join public.contracts c on c.id = s.contract_id;
delete from public.contracts where id = (select val from k where name = 'c1')::uuid;
insert into r select 'contrato assinado não é apagado', count(*) = 1 from public.contracts where id = (select val from k where name = 'c1')::uuid;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into r select 'link mostra assinaturas com documento mascarado',
  (public.public_contract((select val from k where name = 'ctoken'))->'signatures'->0->>'document') like '***%'
  and (public.public_contract((select val from k where name = 'ctoken'))->>'status') = 'assinado';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}';
insert into r select 'cliente vê o contrato no portal, mas não o documento de quem assinou', (select count(*) from public.contracts) = 1 and (select count(*) from public.contract_signatures) = 0;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}';
insert into r select 'sem o módulo não vê contratos nem assinaturas', (select count(*) from public.contracts) = 0 and (select count(*) from public.contract_signatures) = 0;

do $$ begin
  raise exception 'RESULTADO FASE 5 (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
