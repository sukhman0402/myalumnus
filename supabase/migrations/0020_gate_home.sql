-- 0020 · Guard Home (owner, 2026-10-08). Read-only functions; one replaced, two new. No DROP/DELETE.
--   gate_inside: family visits get the overstay rule too (still inside after visiting hours), like other visits.
--   gate_denied_today: held visitors at this gate denied today, by the admin or the gate. Before, an admin's
--                      deny never reached the guard; now it shows under On hold on Home, below the open holds.
--   gate_on_hold: the open holds with the visitor's photo when they have a record (owner, 2026-10-08: no flag icon
--                 on the row, the status chip already says it is a hold). Replaces gate_open_cases on Home, which stays
--                 for older app versions until the next cleanup.
-- Backup of the replaced body: private.fn_backup tag '0019_0021' (saved 2026-10-08).

create or replace function public.gate_inside()
returns table (kind text, id uuid, person_id uuid, name text, person_kind public.person_kind, program text, batch_year int,
               photo_path text, entered_at timestamptz, purpose text, guests int, over_minutes int)
language sql stable security definer set search_path = '' as $$
  select 'visit', v.id, v.person_id, coalesce(p.full_name, v.walkin_name), p.kind, p.program, p.batch_year, p.photo_path,
         v.entered_at, v.purpose, null::int,
         greatest(0, floor(extract(epoch from now() - private.closing_for(v.gate_id, v.entered_at)) / 60))::int
    from public.visits v left join public.people p on p.id = v.person_id
   where (private.me()).role = 'gate' and v.gate_id = (private.me()).gate_id and v.entered_at is not null and v.exited_at is null
  union all
  select 'family', f.id, f.student_id, s.full_name, s.kind, s.program, null, s.photo_path, f.entered_at, f.purpose, f.guests,
         greatest(0, floor(extract(epoch from now() - private.closing_for(f.gate_id, f.entered_at)) / 60))::int
    from public.family_visits f join public.people s on s.id = f.student_id
   where (private.me()).role = 'gate' and f.gate_id = (private.me()).gate_id and f.exited_at is null
  order by 9
$$;

create or replace function public.gate_denied_today()
returns table (id uuid, name_given text, person_id uuid, photo_path text, decided_at timestamptz, by_admin boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(p.full_name, c.name_given), c.person_id, p.photo_path, c.decided_at, d.role = 'admin'
    from public.cases c
    join public.universities u on u.id = c.university_id
    left join public.people p on p.id = c.person_id
    left join public.staff d on d.id = c.decided_by
   where (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id and c.status = 'denied'
     and c.decided_at >= (date_trunc('day', now() at time zone u.timezone)) at time zone u.timezone
   order by c.decided_at desc
$$;
revoke all on function public.gate_denied_today() from public, anon;
grant execute on function public.gate_denied_today() to authenticated;

create or replace function public.gate_on_hold()
returns table (id uuid, name_given text, person_id uuid, photo_path text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(p.full_name, c.name_given), c.person_id, p.photo_path, private.case_stage(c), c.created_at
    from public.cases c left join public.people p on p.id = c.person_id
   where (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id and c.status in ('admin', 'host')
   order by c.created_at
$$;
revoke all on function public.gate_on_hold() from public, anon;
grant execute on function public.gate_on_hold() to authenticated;
