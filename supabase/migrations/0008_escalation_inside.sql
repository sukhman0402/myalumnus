-- My Alumnus · slices 2 + 3 · Flag & Hold escalation, Inside now, exits, overstay, expected today, family visits
-- (planning/00 stages 9–10; planning/02 D9, Q4, Q6). Same rule as slice 1: the gate device acts only through
-- gate_* functions that check its gate, its guard on shift and the university.
-- Error hints: no_shift, not_found, not_allowed, name_required, host_required, reason_required,
-- already_inside, already_decided, not_inside, student_required.

-- ---------- helpers ----------
-- The valid guard on shift at the calling gate device (null if none).
create or replace function private.shift_guard() returns uuid
language sql stable security definer set search_path = '' as $$
  select sh.guard_id from public.shifts sh join public.staff g on g.id = sh.guard_id
   where sh.device_id = (private.me()).id and (private.me()).role = 'gate' and sh.ended_at is null
     and sh.gate_id = (private.me()).gate_id and g.role = 'guard' and g.active and g.gate_id = sh.gate_id
   order by sh.started_at desc limit 1
$$;

-- When a held case passes to the host: created_at + the campus's escalation minutes.
create or replace function private.handoff_at(c public.cases) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select c.created_at + make_interval(mins => coalesce(r.escalate_minutes, 10))
    from public.gates g left join public.campus_rules r on r.campus_id = g.campus_id where g.id = c.gate_id
$$;

-- When visiting hours ended on the day a visit started (for the overstay flag, Q4).
create or replace function private.closing_for(p_gate uuid, p_entered timestamptz) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select (((p_entered at time zone u.timezone)::date + r.close_time) at time zone u.timezone)
    from public.gates g join public.universities u on u.id = g.university_id
    join public.campus_rules r on r.campus_id = g.campus_id where g.id = p_gate
$$;
revoke all on function private.shift_guard(), private.handoff_at(public.cases), private.closing_for(uuid, timestamptz) from public;
grant execute on function private.shift_guard(), private.handoff_at(public.cases), private.closing_for(uuid, timestamptz) to authenticated;

-- ---------- 1. Flag & Hold ----------
-- Gate devices no longer insert cases directly either.
revoke insert, update on public.cases from authenticated;

create or replace function public.gate_hold(p_person uuid, p_name text, p_says text, p_reason text, p_purpose text,
                                            p_host text, p_host_phone text, p_visitor_phone text, p_client uuid)
returns public.cases
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me(); guard uuid := private.shift_guard(); c public.cases;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if p_client is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_client::text, 2));
    select * into c from public.cases x where x.client_id = p_client;
    if found then
      if c.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
      return c;
    end if;
  end if;
  if guard is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  if p_person is not null and not exists (select 1 from public.people x where x.id = p_person and x.university_id = me.university_id
                                            and x.active and x.kind <> 'student') then
    raise exception 'record not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  if nullif(btrim(p_name), '') is null then raise exception 'name required' using errcode = '23514', hint = 'name_required'; end if;
  if nullif(btrim(p_host), '') is null then raise exception 'host required' using errcode = '23514', hint = 'host_required'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'reason required' using errcode = '23514', hint = 'reason_required'; end if;
  insert into public.cases (university_id, gate_id, person_id, name_given, says, reason, purpose, host_name, host_phone,
                            visitor_phone, status, held_by, client_id)
  values (me.university_id, me.gate_id, p_person, left(btrim(p_name), 120), left(nullif(btrim(p_says), ''), 160),
          left(btrim(p_reason), 120), left(nullif(btrim(p_purpose), ''), 200), left(btrim(p_host), 120),
          left(nullif(btrim(p_host_phone), ''), 24), left(nullif(btrim(p_visitor_phone), ''), 24), 'admin', guard, p_client)
  returning * into c;
  return c;
end $$;

-- ---------- 2. Deciding a case: first decision wins, and the decision becomes a visit ----------
create or replace function public.decide_case(p_case uuid, p_approve boolean, p_note text default null)
returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases; decider uuid;
begin
  if me.id is null then raise exception 'not signed in' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if c.status not in ('admin', 'host') then
    return c;                                                     -- already decided: the caller shows who decided
  end if;
  if me.role = 'gate' then
    if c.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
    -- The guard decides only once the case has passed to the host (D9). The scheduler moves it every minute;
    -- this also moves it here, so a slow scheduler never blocks the guard.
    if c.status = 'admin' and now() >= private.handoff_at(c) then
      update public.cases set status = 'host', passed_to_host_at = now() where id = c.id returning * into c;
    end if;
    if c.status <> 'host' then
      raise exception 'the guard decides only after the case passes to the host' using errcode = '42501', hint = 'not_allowed';
    end if;
    decider := private.shift_guard();
    if decider is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  elsif me.role = 'admin' then
    decider := me.id;
  else
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  if not p_approve and nullif(btrim(p_note), '') is null then
    raise exception 'a reason is required to deny' using errcode = '23514', hint = 'reason_required';
  end if;
  if p_approve and c.person_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(c.person_id::text, 0));
    if exists (select 1 from public.visits x where x.person_id = c.person_id and x.entered_at is not null and x.exited_at is null) then
      raise exception 'already inside' using errcode = 'P0001', hint = 'already_inside';
    end if;
  end if;
  update public.cases
     set status = case when p_approve then 'approved'::public.case_status else 'denied'::public.case_status end,
         decided_at = now(), decided_by = decider, note = left(nullif(btrim(p_note), ''), 300)
   where id = p_case
  returning * into c;
  insert into public.visits (university_id, gate_id, person_id, walkin_name, outcome, reason, purpose, decided_by,
                             case_id, decided_at, entered_at)
  values (c.university_id, c.gate_id, c.person_id, case when c.person_id is null then c.name_given end,
          (case when p_approve then 'approved' else 'denied' end)::public.visit_outcome,
          case when p_approve then null else c.note end, c.purpose, decider, c.id, now(),
          case when p_approve then now() end);
  return c;
end $$;

-- The case as the gate sees it (only its own gate's cases).
create or replace function public.gate_case(p_case uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name_given', c.name_given, 'says', c.says, 'reason', c.reason, 'purpose', c.purpose,
    'host_name', c.host_name, 'host_phone', c.host_phone, 'person_id', c.person_id,
    'status', case when c.status = 'admin' and now() >= private.handoff_at(c) then 'host' else c.status::text end,
    'created_at', c.created_at, 'handoff_at', private.handoff_at(c), 'decided_at', c.decided_at, 'note', c.note,
    'decided_by_name', d.name, 'decided_by_role', d.role,
    'admins', (select count(*) from public.staff a where a.university_id = c.university_id and a.role = 'admin' and a.active),
    'first_admin', (select a.name from public.staff a where a.university_id = c.university_id and a.role = 'admin' and a.active order by a.created_at limit 1),
    'escalate_minutes', (select r.escalate_minutes from public.gates g join public.campus_rules r on r.campus_id = g.campus_id where g.id = c.gate_id))
  from public.cases c left join public.staff d on d.id = c.decided_by
  where c.id = p_case and (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id
$$;

-- Open cases at this gate (the "Flagged & hold" tile).
create or replace function public.gate_open_cases()
returns table (id uuid, name_given text, reason text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name_given, c.reason,
         case when c.status = 'admin' and now() >= private.handoff_at(c) then 'host' else c.status::text end, c.created_at
    from public.cases c
   where (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id and c.status in ('admin', 'host')
   order by c.created_at
$$;

-- The scheduler: every minute, cases nobody decided pass to the host (D9). The audit trigger records it.
create extension if not exists pg_cron;
create or replace function private.handoff_due_cases() returns void
language sql security definer set search_path = '' as $$
  update public.cases c set status = 'host', passed_to_host_at = now()
   where c.status = 'admin' and now() >= private.handoff_at(c)
$$;
select cron.schedule('ma-case-handoff', '* * * * *', 'select private.handoff_due_cases()');

-- ---------- 3. Inside now, exits, overstay (Q4: overstay = still inside after visiting hours end) ----------
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
  select 'family', f.id, f.student_id, s.full_name, s.kind, s.program, null, s.photo_path, f.entered_at, f.purpose, f.guests, 0
    from public.family_visits f join public.people s on s.id = f.student_id
   where (private.me()).role = 'gate' and f.gate_id = (private.me()).gate_id and f.exited_at is null
  order by 9
$$;

-- One open visit, with the phone for the overstay follow-up (Q6: shown only to that gate and admins).
create or replace function public.gate_inside_visit(p_visit uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'name', coalesce(p.full_name, v.walkin_name), 'person_id', v.person_id, 'kind', p.kind, 'program', p.program,
    'batch_year', p.batch_year, 'photo_path', p.photo_path, 'photo_added_on', p.photo_added_on,
    'entered_at', v.entered_at, 'exited_at', v.exited_at, 'purpose', v.purpose,
    'phone', coalesce(p.phone, c.visitor_phone),
    'closes_at', private.closing_for(v.gate_id, v.entered_at),
    'over_minutes', greatest(0, floor(extract(epoch from now() - private.closing_for(v.gate_id, v.entered_at)) / 60))::int)
  from public.visits v left join public.people p on p.id = v.person_id left join public.cases c on c.id = v.case_id
  where v.id = p_visit and (private.me()).role = 'gate' and v.gate_id = (private.me()).gate_id and v.entered_at is not null
$$;

create or replace function public.gate_exit(p_visit uuid)
returns public.visits
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me(); v public.visits;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if private.shift_guard() is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  select * into v from public.visits x where x.id = p_visit and x.gate_id = me.gate_id for update;
  if not found or v.entered_at is null then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if v.exited_at is not null then return v; end if;              -- already marked: a double tap changes nothing
  update public.visits set exited_at = now() where id = v.id returning * into v;
  return v;
end $$;

-- ---------- 4. Expected today ----------
create or replace function public.gate_expected()
returns table (person_id uuid, full_name text, kind public.person_kind, program text, photo_path text,
               expected_at timestamptz, purpose text, host_name text, arrived_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select m.*, u.timezone tz from public.staff m join public.universities u on u.id = m.university_id
               where m.id = (private.me()).id and m.role = 'gate')
  select p.id, p.full_name, p.kind, p.program, p.photo_path, e.expected_at, e.purpose, e.host_name,
         (select min(v.entered_at) from public.visits v where v.person_id = p.id
            and (v.entered_at at time zone me.tz)::date = (now() at time zone me.tz)::date)
    from me join public.expected_visits e on e.university_id = me.university_id and (e.gate_id is null or e.gate_id = me.gate_id)
    join public.people p on p.id = e.person_id and p.active
   where (e.expected_at at time zone me.tz)::date = (now() at time zone me.tz)::date
   order by e.expected_at
$$;

-- ---------- 5. Student-family visits ----------
create or replace function public.gate_students(p_q text)
returns table (id uuid, full_name text, program text, roll_no text, photo_path text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.full_name, s.program, s.roll_no, s.photo_path from public.people s
   where (private.me()).role = 'gate' and s.university_id = (private.me()).university_id and s.active and s.kind = 'student'
     and length(btrim(coalesce(p_q, ''))) >= 3
     and (strpos(lower(s.full_name), lower(btrim(p_q))) > 0 or lower(s.roll_no) = lower(btrim(p_q)))
   order by s.full_name limit 25
$$;

create or replace function public.gate_student(p_student uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'full_name', s.full_name, 'program', s.program, 'roll_no', s.roll_no,
                            'photo_path', s.photo_path, 'photo_added_on', s.photo_added_on)
    from public.people s
   where s.id = p_student and (private.me()).role = 'gate' and s.university_id = (private.me()).university_id
     and s.active and s.kind = 'student'
$$;

create or replace function public.gate_family_log(p_student uuid, p_guests int, p_purpose text, p_client uuid)
returns public.family_visits
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me(); guard uuid := private.shift_guard(); f public.family_visits;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if p_client is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_client::text, 3));
    select * into f from public.family_visits x where x.client_id = p_client;
    if found then
      if f.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
      return f;
    end if;
  end if;
  if guard is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  if not exists (select 1 from public.people s where s.id = p_student and s.university_id = me.university_id
                   and s.active and s.kind = 'student') then
    raise exception 'student required' using errcode = 'P0002', hint = 'student_required';
  end if;
  insert into public.family_visits (university_id, gate_id, student_id, guests, purpose, logged_by, client_id)
  values (me.university_id, me.gate_id, p_student, least(greatest(coalesce(p_guests, 1), 1), 20),
          left(nullif(btrim(p_purpose), ''), 200), guard, p_client)
  returning * into f;
  return f;
end $$;

create or replace function public.gate_family(p_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'guests', f.guests, 'purpose', f.purpose, 'entered_at', f.entered_at,
                            'exited_at', f.exited_at, 'student', s.full_name, 'program', s.program, 'roll_no', s.roll_no)
    from public.family_visits f join public.people s on s.id = f.student_id
   where f.id = p_id and (private.me()).role = 'gate' and f.gate_id = (private.me()).gate_id
$$;

create or replace function public.gate_family_close(p_id uuid)
returns public.family_visits
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me(); f public.family_visits;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if private.shift_guard() is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  select * into f from public.family_visits x where x.id = p_id and x.gate_id = me.gate_id for update;
  if not found then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if f.exited_at is not null then return f; end if;
  update public.family_visits set exited_at = now() where id = f.id returning * into f;
  return f;
end $$;

-- Family visits too: only through the functions above.
revoke insert, update on public.family_visits from authenticated;

-- ---------- 6. Admin: similar names for a held case (pg_trgm, D10) ----------
create or replace function public.admin_similar_names(p_name text)
returns table (id uuid, full_name text, kind public.person_kind, program text, batch_year int, photo_path text, score real)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.kind, p.program, p.batch_year, p.photo_path, extensions.similarity(lower(p.full_name), lower(btrim(p_name)))
    from public.people p
   where (private.me()).role = 'admin' and p.university_id = (private.me()).university_id and p.active and p.kind <> 'student'
     and extensions.similarity(lower(p.full_name), lower(btrim(p_name))) > 0.3
   order by 7 desc, p.full_name limit 5
$$;

-- ---------- grants ----------
revoke all on function public.gate_hold(uuid, text, text, text, text, text, text, text, uuid), public.gate_case(uuid),
  public.gate_open_cases(), public.gate_inside(), public.gate_inside_visit(uuid), public.gate_exit(uuid), public.gate_expected(),
  public.gate_students(text), public.gate_student(uuid), public.gate_family_log(uuid, int, text, uuid), public.gate_family(uuid),
  public.gate_family_close(uuid), public.admin_similar_names(text) from public, anon;
grant execute on function public.gate_hold(uuid, text, text, text, text, text, text, text, uuid), public.gate_case(uuid),
  public.gate_open_cases(), public.gate_inside(), public.gate_inside_visit(uuid), public.gate_exit(uuid), public.gate_expected(),
  public.gate_students(text), public.gate_student(uuid), public.gate_family_log(uuid, int, text, uuid), public.gate_family(uuid),
  public.gate_family_close(uuid), public.admin_similar_names(text) to authenticated;
revoke all on function private.handoff_due_cases() from public, anon, authenticated;
