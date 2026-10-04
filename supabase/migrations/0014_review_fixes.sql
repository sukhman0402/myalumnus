-- My Alumnus · slices 4–5 · fixes after the independent code review (2026-10-04)

-- 1. Offline entries: at most 4 hours old (was 12), and the moment each one reached the server is kept, so History
--    shows "saved offline at 5:55 PM, recorded at 8:02 PM" and a backdated entry is visible to admins.
alter table public.visits add column if not exists synced_at timestamptz;

create or replace function public.gate_decide_offline(p_person uuid, p_approve boolean, p_purpose text, p_reason text,
                                                      p_client uuid, p_at timestamptz, p_guard uuid)
returns public.visits
language plpgsql volatile security definer set search_path = '' as $$
declare
  me  public.staff := private.me();
  t   timestamptz := least(p_at, now());
  p   public.people;
  tz  text;
  r   public.campus_rules;
  loc time;
  v   public.visits;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device' using errcode = '42501', hint = 'not_allowed';
  end if;
  if p_client is null or p_at is null then
    raise exception 'missing entry id or time' using errcode = '22023', hint = 'not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client::text, 1));
  select * into v from public.visits x where x.client_id = p_client;
  if found then
    if v.gate_id <> me.gate_id or v.person_id is distinct from p_person then
      raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
    end if;
    return v;
  end if;
  if t < now() - interval '4 hours' then
    raise exception 'too old to record' using errcode = '22023', hint = 'too_old';
  end if;
  if not exists (select 1 from public.shifts sh join public.staff g on g.id = sh.guard_id
                  where sh.device_id = me.id and sh.guard_id = p_guard and sh.gate_id = me.gate_id and g.role = 'guard'
                    and sh.started_at <= t + interval '1 minute' and (sh.ended_at is null or sh.ended_at >= t - interval '1 minute')) then
    raise exception 'that guard was not on duty then' using errcode = 'P0001', hint = 'no_shift';
  end if;
  select * into p from public.people x
   where x.id = p_person and x.university_id = me.university_id and x.active and x.kind <> 'student';
  if not found then
    raise exception 'record not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  if not p_approve and nullif(btrim(p_reason), '') is null then
    raise exception 'a reason is required to deny' using errcode = '23514', hint = 'reason_required';
  end if;
  if p_approve then
    select u.timezone into tz from public.universities u where u.id = me.university_id;
    select cr.* into r from public.campus_rules cr join public.gates g on g.campus_id = cr.campus_id where g.id = me.gate_id;
    loc := (t at time zone tz)::time;
    if r.campus_id is null or not (loc >= r.open_time and loc < r.close_time) then
      raise exception 'outside visiting hours' using errcode = 'P0001', hint = 'outside_hours';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
    if exists (select 1 from public.visits x where x.person_id = p.id and x.entered_at is not null and x.exited_at is null) then
      raise exception 'already inside' using errcode = 'P0001', hint = 'already_inside';
    end if;
  end if;
  insert into public.visits (university_id, gate_id, person_id, outcome, reason, purpose, decided_by,
                             decided_at, entered_at, client_id, recorded_offline, synced_at)
  values (me.university_id, me.gate_id, p.id,
          (case when p_approve then 'approved' else 'denied' end)::public.visit_outcome,
          case when p_approve then null else left(btrim(p_reason), 300) end,
          left(nullif(btrim(p_purpose), ''), 200), p_guard, t, case when p_approve then t end, p_client, true, now())
  returning * into v;
  return v;
end $$;
-- (A guard deactivated after their shift still has their offline entries recorded: the active check is dropped
--  for the shift lookup above; the shift itself proves they were on duty.)

-- 2. Alerts: an account can remove only its own browser subscriptions (a gate token could otherwise switch off
--    every admin's alerts). Dead subscriptions found while alerting are simply skipped.
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and staff_id = (private.me()).id
$$;

-- 3. Photos: a gate device may sign links only for current photos of active people at its university
--    (no old replaced files, no hidden records). Signing still needs the exact path.
--    (A definer helper does the lookup: the gate can't read the people table directly.)
create or replace function private.is_current_photo(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.people p where p.photo_path = p_name
                   and p.university_id = private.my_university() and p.active)
$$;
create index if not exists people_photo_path on public.people (photo_path) where photo_path is not null;
revoke all on function private.is_current_photo(text) from public;
grant execute on function private.is_current_photo(text) to authenticated;
alter policy "photos: gate devices read their university" on storage.objects
  using (bucket_id = 'photos' and private.my_role() = 'gate' and private.is_current_photo(name));

-- 4. The held-case screen says who was actually alerted: admins with alerts turned on. Admins without them still
--    see the case on the dashboard; the gate wording covers that (app).
create or replace function public.gate_case(p_case uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name_given', c.name_given, 'says', c.says, 'reason', c.reason, 'purpose', c.purpose,
    'host_name', c.host_name, 'host_phone', c.host_phone, 'person_id', c.person_id,
    'status', case when c.status = 'admin' and now() >= private.handoff_at(c) then 'host' else c.status::text end,
    'created_at', c.created_at, 'handoff_at', private.handoff_at(c), 'decided_at', c.decided_at, 'note', c.note,
    'decided_by_name', d.name, 'decided_by_role', d.role,
    'admins', (select count(*) from public.staff a where a.university_id = c.university_id and a.role = 'admin' and a.active and a.user_id is not null),
    'first_admin', (select a.name from public.staff a where a.university_id = c.university_id and a.role = 'admin' and a.active
                      and a.user_id is not null order by a.created_at limit 1),
    'alerted', (select count(distinct a.id) from public.staff a join public.push_subscriptions s on s.staff_id = a.id
                 where a.university_id = c.university_id and a.role = 'admin' and a.active),
    'first_alerted', (select a.name from public.staff a where a.university_id = c.university_id and a.role = 'admin' and a.active
                        and exists (select 1 from public.push_subscriptions s where s.staff_id = a.id) order by a.created_at limit 1),
    'escalate_minutes', (select r.escalate_minutes from public.gates g join public.campus_rules r on r.campus_id = g.campus_id where g.id = c.gate_id))
  from public.cases c left join public.staff d on d.id = c.decided_by
  where c.id = p_case and (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id
$$;

-- 5. Bulk upload: roll numbers match whatever their letter case ("19bme112" = "19BME112"), and an upload no longer
--    un-hides a record an admin hid on purpose.
create index if not exists people_roll_ci on public.people (university_id, upper(roll_no)) where roll_no is not null;

create or replace function public.admin_roll_lookup(p_rolls text[])
returns table (roll_no text, id uuid, kind public.person_kind, full_name text, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  return query
    select p.roll_no, p.id, p.kind, p.full_name, p.photo_path from public.people p
     where p.university_id = me.university_id and p.roll_no is not null
       and upper(p.roll_no) = any (select upper(x) from unnest(p_rolls[1:5000]) x);
end $$;

create or replace function public.admin_bulk_people(p_kind text, p_rows jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me   public.staff := private.admin();
  k    public.person_kind;
  r    jsonb;
  i    int := 0;
  ins  int := 0;
  upd  int := 0;
  nm   text; roll text; prog text; yr int;
begin
  if p_kind not in ('alumnus', 'student') then
    raise exception 'bulk upload is for alumni or current students' using errcode = '22023', hint = 'kind_invalid';
  end if;
  k := p_kind::public.person_kind;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'send at most 1,000 rows at a time' using errcode = '22023', hint = 'too_many';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    nm := left(nullif(btrim(r ->> 'full_name'), ''), 120);
    roll := left(nullif(btrim(r ->> 'roll_no'), ''), 40);
    prog := left(nullif(btrim(r ->> 'program'), ''), 120);
    yr := case when btrim(coalesce(r ->> 'batch_year', '')) ~ '^[0-9]{4}$' then btrim(r ->> 'batch_year')::int end;
    if nm is null or roll is null or prog is null or yr is null or yr not between 1950 and 2100 then
      raise exception 'row % is incomplete', i using errcode = '23514', hint = 'row_invalid';
    end if;
    update public.people
       set full_name = nm, program = prog, batch_year = yr, kind = k, updated_at = now(),
           email = coalesce(left(nullif(btrim(r ->> 'email'), ''), 200), email),
           phone = coalesce(left(nullif(btrim(r ->> 'phone'), ''), 30), phone)
     where university_id = me.university_id and roll_no is not null and upper(roll_no) = upper(roll);
    if found then
      upd := upd + 1;
    else
      insert into public.people (university_id, kind, full_name, program, batch_year, roll_no, email, phone)
      values (me.university_id, k, nm, prog, yr, roll, left(nullif(btrim(r ->> 'email'), ''), 200),
              left(nullif(btrim(r ->> 'phone'), ''), 30));
      ins := ins + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
end $$;

-- 6. Visit detail shows when an offline entry reached the server.
create or replace function public.admin_visit(p_id uuid)
returns jsonb
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
                       'passed_to_host_at', c.passed_to_host_at, 'decided_at', c.decided_at, 'note', c.note, 'held_by', h.name,
                       'status', c.status) end)
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
