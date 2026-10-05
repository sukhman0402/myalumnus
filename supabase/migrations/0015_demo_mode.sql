-- My Alumnus · demo mode for the public case-study prototype (owner, 2026-10-05)
-- Viewers pick "Guard" or "Admin" on the sign-in page and are signed in to one of two fixed demo accounts.
-- The demo accounts themselves (auth users and their passwords) are created outside this file, so no
-- password is ever in the repo. Applied live in four parts (demo_mode_1..3 via the connector; part 4, the
-- reset, pasted by the owner in the SQL Editor because the connector holds statements containing DELETE). This migration adds:
--   1. staff.demo, the two demo staff rows, and P. Singh marked as the demo guard
--   2. locks: demo accounts can't be edited, deactivated or deleted; demo users can't change photos
--   3. a baseline snapshot of the sample people, staff and campus rules
--   4. private.demo_reset(): restores the baseline and writes a realistic past week of gate activity
--   5. private.demo_sample_morning(): today's first few visits (two still inside)
--   6. nightly reset (03:30 IST) and a morning top-up (10:50 IST)
-- Remove the cron jobs and the demo rows before any real university's data is loaded.

-- ---------- 1. Demo accounts ----------
alter table public.staff add column if not exists demo boolean not null default false;

do $$
declare u uuid; g1 uuid;
begin
  select id into u from public.universities where name = 'Sample University';
  if u is null then raise exception 'Sample University not found'; end if;
  select id into g1 from public.gates where university_id = u and name = 'Gate 1';
  insert into public.staff (university_id, email, name, role, demo)
    values (u, 'admin.demo@example.com', 'Campus Admin', 'admin', true) on conflict do nothing;
  insert into public.staff (university_id, email, name, role, gate_id, demo)
    values (u, 'guard.demo@example.com', 'Gate 1 demo iPad', 'gate', g1, true) on conflict do nothing;
  update public.staff set demo = true where university_id = u and role = 'guard' and name = 'P. Singh';
end $$;

-- Is the signed-in person one of the demo accounts?
create or replace function private.is_demo_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.demo)
$$;
revoke all on function private.is_demo_user() from public;
grant execute on function private.is_demo_user() to authenticated;

create or replace function private.in_demo_reset() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('ma.demo_reset', true), '') = '1'
$$;

-- ---------- 2. Locks ----------
-- Demo accounts: only the sign-in link (user_id) may change.
create or replace function private.staff_demo_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.in_demo_reset() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.demo then raise exception 'demo account is locked' using errcode = '42501', hint = 'demo_locked'; end if;
    return old;
  end if;
  if old.demo and (new.name, new.email, new.role, new.gate_id, new.shift_label, new.active, new.demo, new.university_id)
       is distinct from (old.name, old.email, old.role, old.gate_id, old.shift_label, old.active, old.demo, old.university_id) then
    raise exception 'demo account is locked' using errcode = '42501', hint = 'demo_locked';
  end if;
  if not old.demo and new.demo then
    raise exception 'demo flag is fixed' using errcode = '42501', hint = 'demo_locked';
  end if;
  return new;
end $$;
create trigger staff_demo_lock before update or delete on public.staff
  for each row execute function private.staff_demo_lock();

-- Photos: demo viewers can't add, replace or remove a photo (no strangers' images in the public demo).
create or replace function private.people_demo_photo_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.in_demo_reset() then return new; end if;
  if new.photo_path is distinct from old.photo_path and private.is_demo_user() then
    raise exception 'photos are locked in the demo' using errcode = '42501', hint = 'demo_photo';
  end if;
  return new;
end $$;
create trigger people_demo_photo_lock before update on public.people
  for each row execute function private.people_demo_photo_lock();

-- Storage: a restrictive policy is ANDed with the existing ones, so demo users can't upload or delete files.
create policy "photos: no uploads from demo accounts" on storage.objects as restrictive for insert to authenticated
  with check (not private.is_demo_user());
create policy "photos: no deletes from demo accounts" on storage.objects as restrictive for delete to authenticated
  using (not private.is_demo_user());
create policy "photos: no updates from demo accounts" on storage.objects as restrictive for update to authenticated
  using (not private.is_demo_user());

-- ---------- 3. Baseline snapshot ----------
create schema if not exists demo;
revoke all on schema demo from public, anon, authenticated;
create table if not exists demo.people_base as
  select p.* from public.people p join public.universities u on u.id = p.university_id and u.name = 'Sample University';
create table if not exists demo.staff_base as
  select s.* from public.staff s join public.universities u on u.id = s.university_id and u.name = 'Sample University';
create table if not exists demo.rules_base as
  select r.* from public.campus_rules r join public.universities u on u.id = r.university_id and u.name = 'Sample University';

-- ---------- 4/5. Sample activity ----------
-- A past week of gate activity, so the dashboard, History and Reports have something to show.
create or replace function private.demo_sample_week(u uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tz text := 'Asia/Kolkata';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  g1 uuid; g2 uuid; ps uuid; rs uuid; my uuid; adm uuid;
  ppl uuid[]; studs uuid[]; nophoto uuid;
  purposes text[] := array['Meeting Prof. S. Rao, Mechanical', 'Alumni office', 'Library visit', 'Guest lecture, Room 204',
                           'Placement Cell', 'Convocation documents', 'Department visit', 'Research meeting'];
  i int; j int; n int; d date; t timestamptz; gate uuid; guard uuid; pid uuid; cid uuid; stay int;
begin
  select id into g1 from public.gates where university_id = u and name = 'Gate 1';
  select id into g2 from public.gates where university_id = u and name = 'Gate 2';
  select id into ps from public.staff where university_id = u and role = 'guard' and name = 'P. Singh';
  select id into rs from public.staff where university_id = u and role = 'guard' and name = 'R. Sharma';
  select id into my from public.staff where university_id = u and role = 'guard' and name = 'M. Yadav';
  select id into adm from public.staff where university_id = u and role = 'admin' and demo;
  rs := coalesce(rs, ps); my := coalesce(my, rs);
  select array_agg(id order by full_name) into ppl from public.people
   where university_id = u and active and kind <> 'student' and photo_path is not null;
  select array_agg(id order by full_name) into studs from public.people where university_id = u and active and kind = 'student';
  select id into nophoto from public.people where university_id = u and active and kind = 'alumnus' and photo_path is null
   order by full_name limit 1;
  if g1 is null or ps is null or adm is null or coalesce(array_length(ppl, 1), 0) = 0 then return; end if;

  for i in 1..6 loop
    d := today - i;
    -- approved visits, all exited before closing except one late exit on day 3
    n := 5 + (i % 4);
    for j in 1..n loop
      pid := ppl[1 + ((i * 3 + j) % array_length(ppl, 1))];
      gate := case when j % 3 = 0 and g2 is not null then g2 else g1 end;
      guard := case when gate = g1 then ps when j % 2 = 0 then rs else my end;
      t := ((d + time '10:05') at time zone tz) + make_interval(mins => (j * 53 + i * 17) % 400);
      stay := 40 + (j * 37 + i * 11) % 150;
      insert into public.visits (university_id, gate_id, person_id, outcome, purpose, decided_by, decided_at, entered_at, exited_at)
      values (u, gate, pid, 'approved', purposes[1 + (i + j) % array_length(purposes, 1)], guard, t, t,
              case when i = 3 and j = 1 then ((d + time '18:25') at time zone tz)
                   else least(t + make_interval(mins => stay), ((d + time '17:55') at time zone tz)) end);
    end loop;

    -- a denial every other day
    if i % 2 = 0 then
      t := ((d + time '12:40') at time zone tz);
      insert into public.visits (university_id, gate_id, walkin_name, outcome, reason, purpose, decided_by, decided_at)
      values (u, g1, case when i = 2 then 'Vivek Anand' else 'Sameer Khan' end, 'denied',
              'Not in the alumni list and could not show a university ID', 'Wanted to visit the hostel', ps, t);
    end if;

    -- Flag & Hold: approved by admin (days 1, 5), approved after the host confirmed (day 3), denied (day 4)
    if i in (1, 3, 4, 5) then
      t := ((d + time '13:10') at time zone tz) + make_interval(mins => i * 7);
      insert into public.cases (university_id, gate_id, person_id, name_given, says, reason, purpose, host_name, host_phone,
                                status, held_by, created_at, passed_to_host_at, decided_at, decided_by, note)
      values (u, g1, case when i in (1, 5) then nophoto end,
              case when i in (1, 5) then 'Arjun Kapoor' when i = 3 then 'Rohan Mehra' else 'Imran Shaikh' end,
              case when i = 3 then 'B.Tech 2012, Civil' when i = 4 then 'MBA 2015' else 'B.Tech Civil 2009' end,
              case when i in (1, 5) then 'No photo on file' else 'Not found in the alumni list' end,
              case when i = 4 then 'Wants to meet the Dean' else 'Meeting Prof. S. Rao, Mechanical' end,
              case when i = 4 then 'Office of the Dean' else 'Prof. S. Rao' end, '+91 98765 43201',
              case when i = 4 then 'denied'::public.case_status else 'approved'::public.case_status end,
              ps, t,
              case when i = 3 then t + interval '10 minutes' end,
              t + case when i = 3 then interval '16 minutes' else make_interval(mins => 2 + i) end,
              case when i = 3 then ps else adm end,
              case when i = 4 then 'No meeting is booked with the Dean.' when i = 3 then 'Host confirmed by phone.' end)
      returning id into cid;
      if i <> 4 then
        insert into public.visits (university_id, gate_id, person_id, walkin_name, outcome, purpose, decided_by, case_id,
                                   decided_at, entered_at, exited_at)
        values (u, g1, case when i in (1, 5) then nophoto end, case when i = 3 then 'Rohan Mehra' end, 'approved',
                'Meeting Prof. S. Rao, Mechanical', case when i = 3 then ps else adm end, cid,
                t + case when i = 3 then interval '16 minutes' else make_interval(mins => 2 + i) end,
                t + interval '20 minutes', t + interval '95 minutes');
      else
        insert into public.visits (university_id, gate_id, walkin_name, outcome, reason, purpose, decided_by, case_id, decided_at)
        values (u, g1, 'Imran Shaikh', 'denied', 'No meeting is booked with the Dean.', 'Wants to meet the Dean',
                adm, cid, t + make_interval(mins => 2 + i));
      end if;
    end if;

    -- a student's family every other day
    if i % 2 = 1 and coalesce(array_length(studs, 1), 0) > 0 then
      insert into public.family_visits (university_id, gate_id, student_id, guests, purpose, logged_by, entered_at, exited_at)
      values (u, g1, studs[1 + (i % array_length(studs, 1))], 2 + (i % 2), 'Parents visiting', ps,
              ((d + time '16:05') at time zone tz), ((d + time '17:20') at time zone tz));
    end if;
  end loop;
end $$;
revoke all on function private.demo_sample_week(uuid) from public, anon, authenticated;

-- Today's first visits (two still inside), once visiting hours have started. Safe to run more than once.
create or replace function private.demo_sample_morning() returns void
language plpgsql security definer set search_path = '' as $$
declare
  tz text := 'Asia/Kolkata';
  u uuid; today date := (now() at time zone 'Asia/Kolkata')::date;
  g1 uuid; ps uuid; ppl uuid[]; j int; t timestamptz;
begin
  select id into u from public.universities where name = 'Sample University';
  if u is null then return; end if;
  if (now() at time zone tz)::time < time '10:50' then return; end if;
  if exists (select 1 from public.visits v where v.university_id = u and (v.decided_at at time zone tz)::date = today) then return; end if;
  select id into g1 from public.gates where university_id = u and name = 'Gate 1';
  select id into ps from public.staff where university_id = u and role = 'guard' and name = 'P. Singh';
  select array_agg(id order by full_name desc) into ppl from public.people
   where university_id = u and active and kind = 'alumnus' and photo_path is not null;
  if g1 is null or ps is null or coalesce(array_length(ppl, 1), 0) < 4 then return; end if;
  for j in 1..4 loop
    t := ((today + time '10:05') at time zone tz) + make_interval(mins => j * 9);
    insert into public.visits (university_id, gate_id, person_id, outcome, purpose, decided_by, decided_at, entered_at, exited_at)
    values (u, g1, ppl[j], 'approved', case when j % 2 = 0 then 'Alumni office' else 'Library visit' end, ps, t, t,
            case when j <= 2 then t + interval '35 minutes' end);
  end loop;
end $$;
revoke all on function private.demo_sample_morning() from public, anon, authenticated;

-- ---------- 4. Reset ----------
create or replace function private.demo_reset() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  select id into u from public.universities where name = 'Sample University';
  if u is null then return; end if;
  perform set_config('ma.demo_reset', '1', true);

  -- activity
  delete from public.visits where university_id = u;
  delete from public.family_visits where university_id = u;
  delete from public.cases where university_id = u;
  delete from public.shifts where university_id = u;
  delete from public.expected_visits where university_id = u;
  delete from public.push_subscriptions ps using public.staff s where s.id = ps.staff_id and s.university_id = u and s.demo;

  -- people: back to the snapshot
  delete from public.people p where p.university_id = u and not exists (select 1 from demo.people_base b where b.id = p.id);
  update public.people p set kind = b.kind, full_name = b.full_name, program = b.program, batch_year = b.batch_year,
         roll_no = b.roll_no, phone = b.phone, email = b.email, photo_path = b.photo_path,
         photo_added_on = b.photo_added_on, active = b.active, updated_at = b.updated_at
    from demo.people_base b where b.id = p.id;
  insert into public.people select b.* from demo.people_base b where not exists (select 1 from public.people p where p.id = b.id);

  -- staff: back to the snapshot (sign-in links are kept)
  delete from public.staff s where s.university_id = u and s.user_id is null
    and not exists (select 1 from demo.staff_base b where b.id = s.id);
  update public.staff s set email = b.email, name = b.name, role = b.role, gate_id = b.gate_id, shift_label = b.shift_label,
         active = b.active, demo = b.demo
    from demo.staff_base b where b.id = s.id;

  -- campus rules
  update public.campus_rules r set open_time = b.open_time, close_time = b.close_time, escalate_minutes = b.escalate_minutes,
         updated_at = b.updated_at
    from demo.rules_base b where b.campus_id = r.campus_id;

  perform private.demo_sample_week(u);
  perform private.sample_expected_today();
  perform private.demo_sample_morning();
  delete from public.audit_events where university_id = u;
  perform set_config('ma.demo_reset', '', true);
end $$;
revoke all on function private.demo_reset() from public, anon, authenticated;

-- ---------- 6. Schedule ----------
select cron.schedule('ma-demo-reset', '0 22 * * *', 'select private.demo_reset()');            -- 03:30 IST nightly
select cron.schedule('ma-demo-morning', '20 5 * * *', 'select private.demo_sample_morning()'); -- 10:50 IST daily

-- First run: restore the baseline and write the sample week now.
select private.demo_reset();
