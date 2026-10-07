-- 0018 · Admin console changes (owner, 2026-10-06). Read-only functions; additive. Needs 0017 (passed_to_admin_at).
--   admin_visit: the case part also returns when it reached the admins (History → visit detail trail, host first).
--   admin_expected_one: one expected visit with all its details, for the new Visitors → visit page
--                       (the Visitors list now shows only When, Visitor and Visiting).

create or replace function public.admin_visit(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  select jsonb_build_object(
           'type', 'visit', 'id', v.id, 'outcome', v.outcome, 'reason', v.reason, 'purpose', v.purpose, 'gate', g.name,
           'decided_at', v.decided_at, 'entered_at', v.entered_at, 'exited_at', v.exited_at, 'offline', v.recorded_offline,
           'synced_at', v.synced_at, 'walkin_name', v.walkin_name, 'by_name', d.name, 'by_role', d.role,
           'closes_at', private.closing_for(v.gate_id, coalesce(v.entered_at, v.decided_at)),
           'person', case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'kind', p.kind,
                       'program', p.program, 'batch_year', p.batch_year, 'roll_no', p.roll_no, 'photo_path', p.photo_path) end,
           'case', case when c.id is null then null else jsonb_build_object('id', c.id, 'name_given', c.name_given, 'says', c.says,
                       'reason', c.reason, 'host_name', c.host_name, 'host_phone', c.host_phone, 'created_at', c.created_at,
                       'passed_to_host_at', c.passed_to_host_at, 'passed_to_admin_at', private.admin_since(c),
                       'passed_by_guard', c.passed_to_admin_at is not null and c.passed_to_admin_at < private.handoff_at(c),
                       'decided_at', c.decided_at, 'note', c.note, 'held_by', h.name, 'status', c.status) end)
    into res
    from public.visits v join public.gates g on g.id = v.gate_id left join public.people p on p.id = v.person_id
    left join public.staff d on d.id = v.decided_by left join public.cases c on c.id = v.case_id
    left join public.staff h on h.id = c.held_by
   where v.id = p_id and v.university_id = me.university_id;
  if res is null then
    select jsonb_build_object(
             'type', 'family', 'id', f.id, 'guests', f.guests, 'purpose', f.purpose, 'gate', g.name, 'entered_at', f.entered_at,
             'exited_at', f.exited_at, 'by_name', d.name, 'by_role', d.role,
             'closes_at', private.closing_for(f.gate_id, f.entered_at),
             'person', jsonb_build_object('id', s.id, 'full_name', s.full_name, 'kind', s.kind, 'program', s.program,
                       'batch_year', s.batch_year, 'roll_no', s.roll_no, 'photo_path', s.photo_path))
      into res
      from public.family_visits f join public.gates g on g.id = f.gate_id join public.people s on s.id = f.student_id
      left join public.staff d on d.id = f.logged_by
     where f.id = p_id and f.university_id = me.university_id;
  end if;
  return res;
end $$;

create or replace function public.admin_expected_one(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); tz text; res jsonb;
begin
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  select jsonb_build_object(
           'id', e.id, 'expected_at', e.expected_at, 'purpose', e.purpose, 'host_name', e.host_name, 'host_phone', e.host_phone,
           'gate', g.name, 'created_at', e.created_at,
           'person', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'kind', p.kind, 'program', p.program,
                                        'batch_year', p.batch_year, 'photo_path', p.photo_path),
           'arrived_at', (select min(v.entered_at) from public.visits v
                           where v.person_id = e.person_id and v.entered_at is not null
                             and (v.entered_at at time zone tz)::date = (e.expected_at at time zone tz)::date))
    into res
    from public.expected_visits e join public.people p on p.id = e.person_id left join public.gates g on g.id = e.gate_id
   where e.id = p_id and e.university_id = me.university_id;
  return res;
end $$;
revoke all on function public.admin_expected_one(uuid) from public, anon;
grant execute on function public.admin_expected_one(uuid) to authenticated;
