-- My Alumnus · slice 1 · hardening after code review (2026-10-03)
-- The gate device holds a session token in the browser, so anything the table privileges allow, it can do
-- directly through the database API, around the app. This migration makes the gate device work only
-- through functions that apply the gate rules, and stops it reading records it doesn't need.

-- 1. Visits: no direct edits. (Exits arrive in slice 3 as a function too.)
revoke update on public.visits from authenticated;

-- 2. Shifts: started and ended only through functions that check the guard belongs to this gate.
revoke insert, update on public.shifts from authenticated;

create or replace function public.gate_start_shift(p_guard uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me();
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  if not exists (select 1 from public.staff g where g.id = p_guard and g.role = 'guard' and g.active
                   and g.university_id = me.university_id and g.gate_id = me.gate_id) then
    raise exception 'that guard is not on this gate''s list' using errcode = '42501', hint = 'not_allowed';
  end if;
  update public.shifts set ended_at = now() where device_id = me.id and ended_at is null;
  insert into public.shifts (university_id, gate_id, device_id, guard_id) values (me.university_id, me.gate_id, me.id, p_guard);
end $$;

create or replace function public.gate_end_shift()
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me();
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  update public.shifts set ended_at = now() where device_id = me.id and ended_at is null;
end $$;

-- The guard on duty at this device (only a valid guard of this gate counts).
create or replace function public.gate_duty()
returns table (guard_id uuid, name text, shift_label text, started_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.shift_label, sh.started_at
    from public.shifts sh join public.staff g on g.id = sh.guard_id
   where sh.device_id = (private.me()).id and (private.me()).role = 'gate' and sh.ended_at is null
     and sh.gate_id = (private.me()).gate_id and g.role = 'guard' and g.active and g.gate_id = sh.gate_id
   order by sh.started_at desc limit 1
$$;

-- The names on this gate's picker.
create or replace function public.gate_guards()
returns table (id uuid, name text, shift_label text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.shift_label from public.staff g
   where (private.me()).role = 'gate' and g.role = 'guard' and g.active
     and g.university_id = (private.me()).university_id and g.gate_id = (private.me()).gate_id
   order by g.name
$$;

-- 3. People and staff: readable directly by admins only. The gate gets just what each screen needs,
--    through the gate_* functions (no students, phone numbers or staff emails).
alter policy uni_read on public.people using (university_id = private.my_university() and private.my_role() = 'admin');
alter policy uni_read on public.staff  using (university_id = private.my_university() and private.my_role() = 'admin');

-- The confirmation banner after a decision at this gate.
create or replace function public.gate_visit(p_visit uuid)
returns table (outcome public.visit_outcome, reason text, decided_at timestamptz, full_name text)
language sql stable security definer set search_path = '' as $$
  select v.outcome, v.reason, v.decided_at, p.full_name
    from public.visits v join public.people p on p.id = v.person_id
   where v.id = p_visit and (private.me()).role = 'gate' and v.gate_id = (private.me()).gate_id
$$;

-- Everyone with exactly this name (no row limit), for the "ask first" screen.
create or replace function public.gate_same_name(p_name text)
returns table (id uuid, full_name text, program text, batch_year int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.program, p.batch_year from public.people p
   where (private.me()).role = 'gate' and p.university_id = (private.me()).university_id
     and p.active and p.kind <> 'student' and lower(p.full_name) = lower(btrim(p_name))
   order by p.batch_year nulls last, p.program
$$;

-- Photo paths for search thumbnails (the app no longer reads people directly).
-- (Changing gate_search to return the path would need a DROP FUNCTION, which the database connector holds.)
create or replace function public.gate_photos(p_ids uuid[])
returns table (id uuid, photo_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.photo_path from public.people p
   where (private.me()).role = 'gate' and p.university_id = (private.me()).university_id
     and p.active and p.kind <> 'student' and p.id = any (p_ids[1:25])
$$;

-- 4. gate_decide: the guard must be a valid guard of this gate; a retried client_id must match this gate and
--    person; two simultaneous retries can't both insert.
create or replace function public.gate_decide(p_person uuid, p_approve boolean, p_purpose text default null,
                                              p_reason text default null, p_client uuid default null)
returns public.visits
language plpgsql volatile security definer set search_path = '' as $$
declare
  me    public.staff := private.me();
  guard uuid;
  p     public.people;
  tz    text;
  r     public.campus_rules;
  loc   time;
  v     public.visits;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device can record a gate decision' using errcode = '42501', hint = 'not_allowed';
  end if;

  if p_client is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_client::text, 1));
    select * into v from public.visits x where x.client_id = p_client;
    if found then
      if v.gate_id <> me.gate_id or v.person_id is distinct from p_person then
        raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
      end if;
      return v;                                            -- safe retry: already recorded
    end if;
  end if;

  select sh.guard_id into guard
    from public.shifts sh join public.staff g on g.id = sh.guard_id
   where sh.device_id = me.id and sh.ended_at is null and sh.gate_id = me.gate_id
     and g.role = 'guard' and g.active and g.gate_id = me.gate_id and g.university_id = me.university_id
   order by sh.started_at desc limit 1;
  if guard is null then
    raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift';
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
    loc := (now() at time zone tz)::time;
    if r.campus_id is null or not (loc >= r.open_time and loc < r.close_time) then
      raise exception 'outside visiting hours' using errcode = 'P0001', hint = 'outside_hours';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p.id::text, 0));
    if exists (select 1 from public.visits x where x.person_id = p.id and x.entered_at is not null and x.exited_at is null) then
      raise exception 'already inside' using errcode = 'P0001', hint = 'already_inside';
    end if;
  end if;

  insert into public.visits (university_id, gate_id, person_id, outcome, reason, purpose, decided_by,
                             decided_at, entered_at, client_id)
  values (me.university_id, me.gate_id, p.id,
          (case when p_approve then 'approved' else 'denied' end)::public.visit_outcome,
          case when p_approve then null else left(btrim(p_reason), 300) end,
          left(nullif(btrim(p_purpose), ''), 200),
          guard, now(), case when p_approve then now() end, p_client)
  returning * into v;
  return v;
end $$;

revoke all on function public.gate_start_shift(uuid), public.gate_end_shift(), public.gate_duty(), public.gate_guards(),
  public.gate_visit(uuid), public.gate_same_name(text), public.gate_photos(uuid[]) from public, anon;
grant execute on function public.gate_start_shift(uuid), public.gate_end_shift(), public.gate_duty(), public.gate_guards(),
  public.gate_visit(uuid), public.gate_same_name(text), public.gate_photos(uuid[]) to authenticated;
