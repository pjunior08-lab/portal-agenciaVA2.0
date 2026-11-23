-- Desempenho: números do mês por pessoa, calculados das Demandas e Aprovações.
-- Administrador vê toda a equipe; colaborador com acesso ao módulo vê só os próprios números.

create or replace function public.performance_report(a uuid, month date)
returns table (
  user_id uuid,
  full_name text,
  delivered integer,
  with_due integer,
  on_time integer,
  open_overdue integer,
  posts_decided integer,
  approved_first integer,
  avg_approval_hours numeric
)
language plpgsql stable security definer set search_path = '' as $$
declare
  m_start timestamptz := (date_trunc('month', month)::timestamp at time zone 'America/Sao_Paulo');
  m_end timestamptz := ((date_trunc('month', month) + interval '1 month')::timestamp at time zone 'America/Sao_Paulo');
  everyone boolean := private.is_admin(a);
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not private.can_access(a, 'desempenho', 'ver') then
    raise exception 'Sem acesso ao Desempenho.' using errcode = '42501';
  end if;
  return query
  with people as (
    select am.user_id, p.full_name
      from public.agency_members am
      join public.profiles p on p.id = am.user_id
     where am.agency_id = a and (everyone or am.user_id = (select auth.uid()))
  ),
  done as (
    select ta.user_id,
           count(*)::int as delivered,
           count(*) filter (where t.due_date is not null)::int as with_due,
           count(*) filter (where t.due_date is not null and (t.completed_at at time zone 'America/Sao_Paulo')::date <= t.due_date)::int as on_time
      from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
     where t.agency_id = a and t.completed_at >= m_start and t.completed_at < m_end
     group by ta.user_id
  ),
  late as (
    select ta.user_id, count(*)::int as open_overdue
      from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
     where t.agency_id = a and t.completed_at is null and t.archived_at is null and t.due_date < today
     group by ta.user_id
  ),
  appr as (
    select x.created_by as user_id,
           count(*)::int as posts_decided,
           count(*) filter (where x.status = 'aprovado' and x.round = 1)::int as approved_first,
           round(avg(extract(epoch from (x.decided_at - x.sent_at)) / 3600)::numeric, 1) as avg_hours
      from public.posts x
     where x.agency_id = a and x.decided_at >= m_start and x.decided_at < m_end and x.created_by is not null
     group by x.created_by
  )
  select pe.user_id, pe.full_name,
         coalesce(d.delivered, 0), coalesce(d.with_due, 0), coalesce(d.on_time, 0), coalesce(l.open_overdue, 0),
         coalesce(ap.posts_decided, 0), coalesce(ap.approved_first, 0), ap.avg_hours
    from people pe
    left join done d on d.user_id = pe.user_id
    left join late l on l.user_id = pe.user_id
    left join appr ap on ap.user_id = pe.user_id
   order by coalesce(d.delivered, 0) desc, pe.full_name;
end;
$$;
revoke all on function public.performance_report(uuid, date) from public, anon;
grant execute on function public.performance_report(uuid, date) to authenticated;
