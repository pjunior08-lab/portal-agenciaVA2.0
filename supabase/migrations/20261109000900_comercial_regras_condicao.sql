-- As condições das regras valem para a oportunidade como estava no momento do gatilho.
-- Assim, uma regra não faz outra do mesmo gatilho disparar na sequência (sem efeito dominó).
create or replace function private.crm_run_rules(oid uuid, trig text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.crm_opportunities;
  r public.crm_rules;
  msg text;
begin
  if coalesce(current_setting('app.crm_rules', true), '') = 'on' then return; end if;
  select * into o from public.crm_opportunities where id = oid;
  if o is null then return; end if;
  perform set_config('app.crm_rules', 'on', true);
  for r in select * from public.crm_rules where agency_id = o.agency_id and active and trigger = trig order by position, created_at loop
    continue when not private.crm_rule_matches(r, o);
    begin
      msg := private.crm_apply_actions(r, oid);
      insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail)
      values (o.agency_id, r.id, r.name, oid, trig, 'ok', msg);
    exception when others then
      insert into public.crm_rule_runs (agency_id, rule_id, rule_name, opportunity_id, trigger, status, detail)
      values (o.agency_id, r.id, r.name, oid, trig, 'erro', left(sqlerrm, 300));
    end;
  end loop;
  perform set_config('app.crm_rules', 'off', true);
end;
$$;
