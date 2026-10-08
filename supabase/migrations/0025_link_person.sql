-- 0025 · "This is them" on a held case (Iteration 3, finding CW4). Function only; additive; no DROP/DELETE.
-- When the guard found no record, the admin's case page lists similar names. The admin can now link the case to one
-- of those records before deciding, so an approval is logged against the right person (not a walk-in name).
-- Admins only, same university, open cases only, and only a record shown at the gate (active, not a student).
create or replace function public.admin_link_person(p_case uuid, p_person uuid) returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.admin(); c public.cases;
begin
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if c.status not in ('admin', 'host') then raise exception 'already decided' using errcode = 'P0001', hint = 'decided'; end if;
  if not exists (select 1 from public.people p where p.id = p_person and p.university_id = me.university_id and p.active and p.kind <> 'student') then
    raise exception 'record not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  update public.cases set person_id = p_person where id = c.id returning * into c;
  return c;
end $$;
revoke all on function public.admin_link_person(uuid, uuid) from public, anon;
grant execute on function public.admin_link_person(uuid, uuid) to authenticated;
