-- Teste de Mapa Mental e Funil. Agência fictícia; termina com erro proposital que DESFAZ tudo.
begin;
create temp table r (v text, ok boolean) on commit drop;
grant all on r to authenticated;
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000aa','adm10@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000ca','leitor10@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000ea','outra10@teste.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.agencies (id, name) values
  ('00000000-0000-0000-0000-00000000aa10','Agência Teste 10'), ('00000000-0000-0000-0000-00000000aa11','Outra 10');
insert into public.agency_members (agency_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000aa10','00000000-0000-0000-0000-0000000000aa','admin'),
  ('00000000-0000-0000-0000-00000000aa10','00000000-0000-0000-0000-0000000000ca','colaborador'),
  ('00000000-0000-0000-0000-00000000aa11','00000000-0000-0000-0000-0000000000ea','admin');
insert into public.member_module_access values
  ('00000000-0000-0000-0000-00000000aa10','00000000-0000-0000-0000-0000000000ca','mapa-mental','ver');
insert into public.clients (id, agency_id, name) values
  ('00000000-0000-0000-0000-0000000c1a10','00000000-0000-0000-0000-00000000aa10','Cliente 10'),
  ('00000000-0000-0000-0000-0000000c1a11','00000000-0000-0000-0000-00000000aa11','Cliente outra');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
with m as (insert into public.mind_maps (agency_id, client_id, title, nodes) values ('00000000-0000-0000-0000-00000000aa10','00000000-0000-0000-0000-0000000c1a10','Campanha','[{"id":"1"}]') returning id, updated_by)
insert into r select 'criar mapa com retorno e autor', updated_by = '00000000-0000-0000-0000-0000000000aa' from m;
do $$ begin
  insert into public.mind_maps (agency_id, client_id, title) values ('00000000-0000-0000-0000-00000000aa10','00000000-0000-0000-0000-0000000c1a11','x');
  insert into r values ('mapa não usa cliente de outra agência', false);
exception when others then insert into r values ('mapa não usa cliente de outra agência', true); end $$;
insert into public.funnel_folders (agency_id, name) values ('00000000-0000-0000-0000-00000000aa10','Lançamentos');
with f as (insert into public.funnels (agency_id, name, folder_id) values ('00000000-0000-0000-0000-00000000aa10','Captação',(select id from public.funnel_folders limit 1)) returning id)
insert into r select 'criar funil em pasta', count(*) = 1 from f;
update public.funnels set deleted_at = now();
insert into r select 'mandar funil para a lixeira', count(*) = 1 from public.funnels where deleted_at is not null;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ca","role":"authenticated"}';
insert into r select 'leitor vê mapas', count(*) = 1 from public.mind_maps;
update public.mind_maps set title = 'hack';
insert into r select 'leitor não edita mapa', count(*) = 0 from public.mind_maps where title = 'hack';
insert into r select 'sem o módulo Funil não vê funis', (select count(*) from public.funnels) = 0 and (select count(*) from public.funnel_folders) = 0;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ea","role":"authenticated"}';
insert into r select 'outra agência não vê', (select count(*) from public.mind_maps) = 0 and (select count(*) from public.funnels) = 0;

do $$ begin
  raise exception 'RESULTADO FASE 8B (desfeito): % de % OK | %', (select count(*) filter (where ok) from r), (select count(*) from r),
    (select string_agg(case when ok then 'OK ' else 'FALHA ' end || v, ' | ') from r);
end $$;
