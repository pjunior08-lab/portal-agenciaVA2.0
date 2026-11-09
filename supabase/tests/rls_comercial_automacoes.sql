-- Teste das automações e integrações do Comercial. Agência fictícia; termina com erro proposital que DESFAZ tudo
-- (inclusive os webhooks enfileirados, que não chegam a ser enviados).
begin;
create temp table r (v text, ok boolean) on commit drop;
create temp table k (name text primary key, val text) on commit drop;
grant all on r, k to authenticated, anon;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a8','adm8@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b8','vend8@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c8','leitor8@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000e8','outra8@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values
  ('00000000-0000-0000-0000-00000000a9f8','Agência Teste 8'),
  ('00000000-0000-0000-0000-00000000a9f9','Outra Agência 8');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a9f8','00000000-0000-0000-0000-0000000000a8','admin'),
  ('00000000-0000-0000-0000-00000000a9f8','00000000-0000-0000-0000-0000000000b8','colaborador'),
  ('00000000-0000-0000-0000-00000000a9f8','00000000-0000-0000-0000-0000000000c8','colaborador'),
  ('00000000-0000-0000-0000-00000000a9f9','00000000-0000-0000-0000-0000000000e8','admin');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000a9f8','00000000-0000-0000-0000-0000000000b8','comercial','editar'),
  ('00000000-0000-0000-0000-00000000a9f8','00000000-0000-0000-0000-0000000000c8','comercial','ver');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';

-- distribuição em rodízio para leads novos sem responsável
insert into public.crm_distribution (agency_id, members, auto_new)
values ('00000000-0000-0000-0000-00000000a9f8', array['00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000b8']::uuid[], true);
insert into public.crm_opportunities (agency_id, name, created_by) values ('00000000-0000-0000-0000-00000000a9f8','Lead A','00000000-0000-0000-0000-0000000000a8');
insert into public.crm_opportunities (agency_id, name, created_by) values ('00000000-0000-0000-0000-00000000a9f8','Lead B','00000000-0000-0000-0000-0000000000a8');
insert into r select 'rodízio alterna os responsáveis',
  (select owner_id from public.crm_opportunities where name = 'Lead A') = '00000000-0000-0000-0000-0000000000a8'
  and (select owner_id from public.crm_opportunities where name = 'Lead B') = '00000000-0000-0000-0000-0000000000b8';

-- regra de lead criado com condição de origem
insert into public.crm_rules (agency_id, name, trigger, conditions, actions) values
  ('00000000-0000-0000-0000-00000000a9f8','Instagram','lead_criado','{"origin":"instagram"}',
   '[{"type":"adicionar_tag","tag":"insta"},{"type":"proximo_passo","text":"Chamar no direct","days":1}]');
-- regra de etapa que move de novo (não pode virar cascata)
insert into public.crm_rules (agency_id, name, trigger, conditions, actions) values
  ('00000000-0000-0000-0000-00000000a9f8','Proposta → negociação','etapa_alterada','{"stage":"proposta"}','[{"type":"mover_etapa","stage":"negociacao"}]'),
  ('00000000-0000-0000-0000-00000000a9f8','Volta para proposta','etapa_alterada','{"stage":"negociacao"}','[{"type":"mover_etapa","stage":"proposta"}]'),
  ('00000000-0000-0000-0000-00000000a9f8','Quebrada','etapa_alterada','{"stage":"orcamento"}','[{"type":"definir_responsavel","user_id":"00000000-0000-0000-0000-0000000000e8"}]');

with ins as (
  insert into public.crm_opportunities (agency_id, name, origin, created_by)
  values ('00000000-0000-0000-0000-00000000a9f8','Lead Insta','Instagram','00000000-0000-0000-0000-0000000000a8') returning id)
insert into k select 'insta', id::text from ins;
insert into r select 'regra de lead criado aplica tag e próximo passo',
  'insta' = any (tags) and next_step = 'Chamar no direct' and next_step_at is not null
  from public.crm_opportunities where id = (select val from k where name = 'insta')::uuid;
insert into r select 'regra fora da condição não roda', not ('insta' = any (tags)) from public.crm_opportunities where name = 'Lead A';

update public.crm_opportunities set stage = 'proposta' where id = (select val from k where name = 'insta')::uuid;
insert into r select 'regra de etapa move uma vez, sem cascata', stage = 'negociacao' from public.crm_opportunities where id = (select val from k where name = 'insta')::uuid;
insert into r select 'execução registrada', count(*) = 1 from public.crm_rule_runs where rule_name = 'Proposta → negociação' and status = 'ok';

update public.crm_opportunities set stage = 'orcamento' where id = (select val from k where name = 'insta')::uuid;
insert into r select 'ação com erro fica registrada e não desfaz a mudança',
  (select stage from public.crm_opportunities where id = (select val from k where name = 'insta')::uuid) = 'orcamento'
  and exists (select 1 from public.crm_rule_runs where rule_name = 'Quebrada' and status = 'erro');

-- webhook: envio enfileirado e assinado
insert into public.crm_webhooks (agency_id, name, url, events, secret)
values ('00000000-0000-0000-0000-00000000a9f8','Planilha','https://exemplo.invalid/webhook', array['lead_criado','fechado'], 'segredo');
insert into public.crm_opportunities (agency_id, name, created_by) values ('00000000-0000-0000-0000-00000000a9f8','Lead W','00000000-0000-0000-0000-0000000000a8');
insert into r select 'lead criado enfileira o webhook', count(*) = 1 from public.crm_webhook_deliveries where event = 'lead_criado' and request_id is not null;
do $$ begin
  insert into public.crm_webhooks (agency_id, name, url, events, secret)
  values ('00000000-0000-0000-0000-00000000a9f8','x','http://inseguro.test', array['lead_criado'], 's');
  insert into r values ('webhook exige https', false);
exception when others then insert into r values ('webhook exige https', true); end $$;

-- chave de API e formulário
insert into public.crm_api_keys (agency_id, name, prefix, key_hash, created_by)
values ('00000000-0000-0000-0000-00000000a9f8','Make','va_teste', encode(extensions.digest('va_teste_chave', 'sha256'), 'hex'), '00000000-0000-0000-0000-0000000000a8');
insert into public.crm_forms (agency_id, name, token, title, fields, tags)
values ('00000000-0000-0000-0000-00000000a9f8','Site','form-teste-8','Fale com a gente','[{"key":"phone","required":true},{"key":"message","required":false}]', array['site']);

-- regra de "sem contato" (roda pelo agendador)
insert into public.crm_rules (agency_id, name, trigger, conditions, actions) values
  ('00000000-0000-0000-0000-00000000a9f8','Parado 3 dias','sem_contato','{"days":3}','[{"type":"adicionar_tag","tag":"parado"}]');

-- leitor: vê regras, não vê chaves nem webhooks, não cria regra
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c8","role":"authenticated"}';
insert into r select 'leitor vê regras e execuções', (select count(*) from public.crm_rules) = 5 and (select count(*) from public.crm_rule_runs) > 0;
insert into r select 'leitor não vê chaves nem webhooks', (select count(*) from public.crm_api_keys) = 0 and (select count(*) from public.crm_webhooks) = 0;
do $$ begin
  insert into public.crm_rules (agency_id, name, trigger, actions) values ('00000000-0000-0000-0000-00000000a9f8','x','lead_criado','[{"type":"distribuir"}]');
  insert into r values ('leitor não cria regra', false);
exception when others then insert into r values ('leitor não cria regra', true); end $$;

-- vendedor (editar) não é admin: não vê chaves
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
insert into r select 'quem edita mas não é admin não vê chaves', count(*) = 0 from public.crm_api_keys;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e8","role":"authenticated"}';
insert into r select 'outra agência não vê regras nem formulários', (select count(*) from public.crm_rules) = 0 and (select count(*) from public.crm_forms) = 0;

-- visitante sem login
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into k select 'api1', (public.crm_api_create_lead('va_teste_chave', '{"nome":"Via API","cnpj":"11.222.333/0001-81","valor_mensal":"900"}'))::text;
insert into r select 'API cria lead', (select val from k where name = 'api1')::jsonb ->> 'criado' = 'true';
insert into r select 'API com mesmo CNPJ não duplica', (public.crm_api_create_lead('va_teste_chave', '{"nome":"De novo","cnpj":"11222333000181"}')) ->> 'criado' = 'false';
do $$ begin
  perform public.crm_api_create_lead('chave-errada', '{"nome":"x"}');
  insert into r values ('API recusa chave errada', false);
exception when others then insert into r values ('API recusa chave errada', true); end $$;
do $$ begin
  perform public.crm_api_create_lead('va_teste_chave', '{"nome":""}');
  insert into r values ('API exige nome', false);
exception when others then insert into r values ('API exige nome', true); end $$;
insert into r select 'formulário público aparece', public.crm_form_public('form-teste-8') ->> 'title' = 'Fale com a gente';
insert into r select 'formulário inexistente não aparece', public.crm_form_public('nao-existe') is null;
do $$ begin
  perform public.crm_form_submit('form-teste-8', '{"nome":"Sem telefone"}', 'ip1');
  insert into r values ('formulário exige campo obrigatório', false);
exception when others then insert into r values ('formulário exige campo obrigatório', true); end $$;
insert into r select 'formulário cria lead', public.crm_form_submit('form-teste-8', '{"nome":"Visitante","telefone":"27 9999","etapa":"negociacao","origem":"hack"}', 'ip1');
do $$ begin
  perform public.crm_form_submit('form-teste-8', '{"nome":"V","telefone":"1"}', 'ip1');
  perform public.crm_form_submit('form-teste-8', '{"nome":"V","telefone":"1"}', 'ip1');
  perform public.crm_form_submit('form-teste-8', '{"nome":"V","telefone":"1"}', 'ip1');
  perform public.crm_form_submit('form-teste-8', '{"nome":"V","telefone":"1"}', 'ip1');
  perform public.crm_form_submit('form-teste-8', '{"nome":"V","telefone":"1"}', 'ip1');
  insert into r values ('formulário limita envios seguidos', false);
exception when others then insert into r values ('formulário limita envios seguidos', true); end $$;
do $$ begin
  perform count(*) from public.crm_api_keys;
  insert into r values ('visitante não lê tabelas', false);
exception when others then insert into r values ('visitante não lê tabelas', true); end $$;

reset role;
insert into r select 'lead do formulário: etapa, origem e tag do formulário (não do visitante)',
  stage = 'novo_lead' and origin = 'Formulário: Site' and source = 'formulario' and 'site' = any (tags) and owner_id is not null
  from public.crm_opportunities where name = 'Visitante';
insert into r select 'lead da API marcado com a fonte', source = 'api' and value = 900 from public.crm_opportunities where name = 'Via API';
update public.crm_opportunities set created_at = now() - interval '5 days' where name = 'Lead A';
insert into k select 'idle1', private.crm_run_idle_rules()::text;
insert into k select 'idle2', private.crm_run_idle_rules()::text;
insert into r select 'sem contato roda uma vez por pausa', (select val::int from k where name = 'idle1') >= 1 and (select val::int from k where name = 'idle2') = 0
  and (select 'parado' = any (tags) from public.crm_opportunities where name = 'Lead A');

do $$ begin
  raise exception 'RESULTADO FASE 7B (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
