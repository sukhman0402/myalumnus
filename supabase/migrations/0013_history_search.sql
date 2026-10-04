-- My Alumnus · slice 4 · History gets a name search (the record page links to "this person's visits").
-- admin_visits() is admin_history() plus p_q. The old function is switched off rather than dropped.

-- Visits (decided at a gate or after a hold) and family visits in one list. p_outcome: all | approved | denied | held.
-- p_kind: all | alumnus | faculty | placement | walkin | family. p_limit up to 10,000 (the CSV export).
create or replace function public.admin_visits(p_from timestamptz, p_to timestamptz, p_outcome text default 'all',
                                               p_kind text default 'all', p_gate uuid default null, p_q text default '',
                                               p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); q text := private.like_escape(lower(btrim(coalesce(p_q, '')))); res jsonb;
begin
  with allrows as (
    select 'visit'::text as type, v.id, v.decided_at as at, coalesce(p.full_name, v.walkin_name) as name,
           coalesce(p.kind::text, 'walkin') as kind, p.program, p.batch_year, p.photo_path, v.outcome::text as outcome,
           (v.case_id is not null) as held, g.name as gate, v.gate_id, v.reason, v.purpose, v.entered_at, v.exited_at,
           null::int as guests, d.name as by_name, d.role::text as by_role, v.recorded_offline as offline
      from public.visits v left join public.people p on p.id = v.person_id join public.gates g on g.id = v.gate_id
      left join public.staff d on d.id = v.decided_by
     where v.university_id = me.university_id and v.decided_at >= p_from and v.decided_at < p_to
    union all
    select 'family', f.id, f.entered_at, s.full_name, 'family', s.program, s.batch_year, s.photo_path, 'logged',
           false, g.name, f.gate_id, null, f.purpose, f.entered_at, f.exited_at, f.guests, d.name, d.role::text, false
      from public.family_visits f join public.people s on s.id = f.student_id join public.gates g on g.id = f.gate_id
      left join public.staff d on d.id = f.logged_by
     where f.university_id = me.university_id and f.entered_at >= p_from and f.entered_at < p_to
  ), f as (
    select * from allrows
     where (coalesce(p_outcome, 'all') = 'all' or (p_outcome = 'held' and allrows.held) or allrows.outcome = p_outcome)
       and (coalesce(p_kind, 'all') = 'all' or allrows.kind = p_kind)
       and (p_gate is null or allrows.gate_id = p_gate)
       and (q = '' or lower(allrows.name) like '%' || q || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc, x.id)
                        from (select * from f order by f.at desc, f.id limit least(greatest(coalesce(p_limit, 50), 1), 10000)
                              offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb),
    'gates', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name), '[]'::jsonb)
                from public.gates g where g.university_id = me.university_id))
  into res;
  return res;
end $$;

revoke all on function public.admin_visits(timestamptz, timestamptz, text, text, uuid, text, int, int) from public, anon;
grant execute on function public.admin_visits(timestamptz, timestamptz, text, text, uuid, text, int, int) to authenticated;
revoke execute on function public.admin_history(timestamptz, timestamptz, text, text, uuid, int, int) from authenticated;
