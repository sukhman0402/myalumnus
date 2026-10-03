-- My Alumnus · slice 1 · the gate: search → record → Approve / Deny (planning/00 stage 8)
-- Every gate decision goes through public.gate_decide(), so the database itself enforces:
--   · a guard must be on shift (the decision is recorded under that guard, not the device);
--   · Approve is impossible outside visiting hours, or while the same person is already inside;
--   · Deny needs a reason;
--   · a repeated request with the same client_id records nothing new (safe retry, D11).
-- Error hints (read by the app to show the right message): no_shift, not_found, reason_required,
-- outside_hours, already_inside, not_allowed.

-- ---------- search (D10: contains-match on every word, after 3 letters) ----------
create or replace function public.gate_search(p_q text)
returns table (id uuid, full_name text, kind public.person_kind, program text, batch_year int,
               has_photo boolean, expected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.staff := private.me();
  q  text := lower(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')));
  tz text;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device can search here' using errcode = '42501', hint = 'not_allowed';
  end if;
  if length(q) < 3 then return; end if;
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  return query
    select p.id, p.full_name, p.kind, p.program, p.batch_year, p.photo_path is not null,
           (select min(e.expected_at) from public.expected_visits e
             where e.person_id = p.id and (e.gate_id is null or e.gate_id = me.gate_id)
               and (e.expected_at at time zone tz)::date = (now() at time zone tz)::date)
      from public.people p
     where p.university_id = me.university_id and p.active and p.kind <> 'student'
       and not exists (select 1 from unnest(string_to_array(q, ' ')) w where strpos(lower(p.full_name), w) = 0)
     -- names where a word starts with what was typed come first ("rah": Rahul before Farah),
     -- then people expected at this gate today (mockup g03), then A–Z
     order by ((' ' || lower(p.full_name)) like '% ' || q || '%') desc, 7 nulls last, p.full_name, p.batch_year nulls last
     limit 25;
end $$;

-- ---------- one record, with what the guard needs to decide ----------
create or replace function public.gate_person(p_person uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.staff := private.me();
  p  public.people;
  tz text;
  r  public.campus_rules;
  loc timestamp;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device can open records here' using errcode = '42501', hint = 'not_allowed';
  end if;
  select * into p from public.people x
   where x.id = p_person and x.university_id = me.university_id and x.active and x.kind <> 'student';
  if not found then return null; end if;
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  select cr.* into r from public.campus_rules cr join public.gates g on g.campus_id = cr.campus_id where g.id = me.gate_id;
  loc := now() at time zone tz;
  return jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'kind', p.kind, 'program', p.program, 'batch_year', p.batch_year,
    'photo_path', p.photo_path, 'photo_added_on', p.photo_added_on,
    'same_name', (select count(*) from public.people o
                   where o.university_id = p.university_id and o.active and o.kind <> 'student'
                     and lower(o.full_name) = lower(p.full_name)),
    'expected', (select jsonb_build_object('at', e.expected_at, 'purpose', e.purpose, 'host', e.host_name)
                   from public.expected_visits e
                  where e.person_id = p.id and (e.gate_id is null or e.gate_id = me.gate_id)
                    and (e.expected_at at time zone tz)::date = loc::date
                  order by e.expected_at limit 1),
    'inside', (select jsonb_build_object('since', v.entered_at, 'gate', g.name)
                 from public.visits v join public.gates g on g.id = v.gate_id
                where v.person_id = p.id and v.entered_at is not null and v.exited_at is null
                order by v.entered_at desc limit 1),
    'hours', jsonb_build_object('open', to_char(r.open_time, 'HH24:MI'), 'close', to_char(r.close_time, 'HH24:MI'),
                                'in_hours', coalesce(loc::time >= r.open_time and loc::time < r.close_time, false)));
end $$;

-- ---------- Approve / Deny at the gate ----------
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

  -- Safe retry: the same client_id never records twice.
  if p_client is not null then
    select * into v from public.visits x where x.client_id = p_client;
    if found then
      if v.university_id <> me.university_id then
        raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
      end if;
      return v;
    end if;
  end if;

  select sh.guard_id into guard from public.shifts sh
   where sh.device_id = me.id and sh.ended_at is null order by sh.started_at desc limit 1;
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
    -- Two gates approving the same person at once: the second waits, then sees the first.
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

-- ---------- the "Today" tiles for this gate ----------
create or replace function public.gate_today()
returns table (expected int, inside int, flagged int, visits int)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.me(); tz text; today date;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  today := (now() at time zone tz)::date;
  return query select
    (select count(distinct e.person_id)::int from public.expected_visits e
      where e.university_id = me.university_id and (e.gate_id is null or e.gate_id = me.gate_id)
        and (e.expected_at at time zone tz)::date = today),
    (select count(*)::int from public.visits v
      where v.gate_id = me.gate_id and v.entered_at is not null and v.exited_at is null)
    + (select count(*)::int from public.family_visits f where f.gate_id = me.gate_id and f.exited_at is null),
    (select count(*)::int from public.cases c where c.gate_id = me.gate_id and c.status in ('admin', 'host')),
    (select count(*)::int from public.visits v
      where v.gate_id = me.gate_id and v.outcome = 'approved' and (v.decided_at at time zone tz)::date = today)
    + (select count(*)::int from public.family_visits f
      where f.gate_id = me.gate_id and (f.entered_at at time zone tz)::date = today);
end $$;

revoke all on function public.gate_search(text), public.gate_person(uuid),
  public.gate_decide(uuid, boolean, text, text, uuid), public.gate_today() from public, anon;
grant execute on function public.gate_search(text), public.gate_person(uuid),
  public.gate_decide(uuid, boolean, text, text, uuid), public.gate_today() to authenticated;

-- Gate entries now go only through gate_decide(): no direct inserts from the API.
-- (The gate_insert policy stays but no longer has an insert privilege to act on.)
revoke insert on public.visits from authenticated;
