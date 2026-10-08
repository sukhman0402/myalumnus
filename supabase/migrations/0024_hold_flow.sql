-- 0024 · Hold flow (Iteration 3, owner 2026-10-08). Functions only; additive; no DROP/DELETE.
--   1. Host list for the gate (NEW-3): gate_hosts() lets the gate device read the active hosts (name, department, phone),
--      so the hold form picks the host instead of typing a name and number. Read-only, this university only. The
--      table's own policy stays admin-only; the gate reads through this function. (Owner accepted that faculty phone
--      numbers are visible on the gate device, which already calls them.)
--   2. No admin to pass to (NEW-2): when the university has no active admin who has signed in, a held case stays with
--      the guard and the host: no automatic hand-off at the limit, and "pass to admin" is refused (hint no_admin).
--      A host who calls back late can still get the visitor in.
--   3. Left before a decision (NEW-5): gate_case_left() closes an open case as 'left' and logs a visit with outcome
--      'left' (no entry time), so History keeps it but it is not a denial. gate_closed_today() replaces
--      gate_denied_today() on Home (denied and left, with the status). gate_denied_today stays for older app versions.
--   4. admin_report: adds held_left and outcomes.held_left; everything else unchanged.
-- Backup of the replaced bodies: private.fn_backup tag '0022_0024' (saved first on live).

-- 2 · Is there an admin who could take a case? (active, and has signed in at least once)
create or replace function private.admin_available(p_university uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff a where a.university_id = p_university and a.role = 'admin' and a.active and a.user_id is not null)
$$;
revoke all on function private.admin_available(uuid) from public;
grant execute on function private.admin_available(uuid) to authenticated;

create or replace function private.case_stage(c public.cases) returns text
language sql stable security definer set search_path = '' as $$
  select case when c.status = 'host' and c.passed_to_host_at is null and c.passed_to_admin_at is null
                   and now() >= private.handoff_at(c) and private.admin_available(c.university_id) then 'admin' else c.status::text end
$$;
create or replace function private.admin_since(c public.cases) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case when c.passed_to_admin_at is not null then c.passed_to_admin_at
              when c.status = 'host' and c.passed_to_host_at is null and now() >= private.handoff_at(c)
                   and private.admin_available(c.university_id) then private.handoff_at(c)
              when c.status = 'admin' and c.passed_to_host_at is null then c.created_at
              else null end
$$;
create or replace function private.handoff_due_cases() returns void
language sql security definer set search_path = '' as $$
  update public.cases c set status = 'admin', passed_to_admin_at = private.handoff_at(c)
   where c.status = 'host' and c.passed_to_host_at is null and c.passed_to_admin_at is null and now() >= private.handoff_at(c)
     and private.admin_available(c.university_id)
$$;
revoke all on function private.handoff_due_cases() from public, anon, authenticated;

create or replace function public.gate_pass_to_admin(p_case uuid) returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and gate_id = me.gate_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if private.shift_guard() is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  if c.status = 'host' and c.passed_to_host_at is null then
    if not private.admin_available(c.university_id) then
      raise exception 'no admin to pass to' using errcode = 'P0001', hint = 'no_admin';
    end if;
    update public.cases set status = 'admin', passed_to_admin_at = now() where id = c.id returning * into c;
  end if;
  return c;
end $$;
revoke all on function public.gate_pass_to_admin(uuid) from public, anon;
grant execute on function public.gate_pass_to_admin(uuid) to authenticated;

-- 1 · Hosts for the gate's hold form.
create or replace function public.gate_hosts()
returns table (id uuid, name text, department text, phone text)
language sql stable security definer set search_path = '' as $$
  select h.id, h.name, h.department, h.phone from public.hosts h
   where (private.me()).role = 'gate' and h.university_id = (private.me()).university_id and h.active
   order by h.name
$$;
revoke all on function public.gate_hosts() from public, anon;
grant execute on function public.gate_hosts() to authenticated;

-- 3 · The visitor walked away before anyone decided. The gate (its own cases) or an admin may close it.
create or replace function public.gate_case_left(p_case uuid) returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases; decider uuid;
begin
  if me.id is null or me.role not in ('gate', 'admin') then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if me.role = 'gate' and c.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if c.status not in ('admin', 'host') then return c; end if;   -- already closed: nothing to do (a double tap)
  if me.role = 'gate' then
    decider := private.shift_guard();
    if decider is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  else
    decider := me.id;
  end if;
  update public.cases set status = 'left', decided_at = now(), decided_by = decider, note = 'Left before a decision'
   where id = c.id returning * into c;
  insert into public.visits (university_id, gate_id, person_id, walkin_name, outcome, reason, purpose, decided_by, case_id, decided_at)
  values (c.university_id, c.gate_id, c.person_id, case when c.person_id is null then c.name_given end,
          'left', c.note, c.purpose, decider, c.id, now());
  return c;
end $$;
revoke all on function public.gate_case_left(uuid) from public, anon;
grant execute on function public.gate_case_left(uuid) to authenticated;

-- Home's On hold panel: held visitors closed today at this gate, denied or left.
create or replace function public.gate_closed_today()
returns table (id uuid, name_given text, person_id uuid, photo_path text, status text, decided_at timestamptz, by_admin boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(p.full_name, c.name_given), c.person_id, p.photo_path, c.status::text, c.decided_at, d.role = 'admin'
    from public.cases c
    join public.universities u on u.id = c.university_id
    left join public.people p on p.id = c.person_id
    left join public.staff d on d.id = c.decided_by
   where (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id and c.status in ('denied', 'left')
     and c.decided_at >= (date_trunc('day', now() at time zone u.timezone)) at time zone u.timezone
   order by c.decided_at desc
$$;
revoke all on function public.gate_closed_today() from public, anon;
grant execute on function public.gate_closed_today() to authenticated;

-- 4 · Reports: count held visitors who left, apart from denials (same body as live, two keys added).
create or replace function public.admin_report(p_from date, p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  me public.staff := private.admin();
  tz text;
  n  int := least(greatest(coalesce(p_days, 7), 1), 31);
  t0 timestamptz;
  t1 timestamptz;
  res jsonb;
begin
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  t0 := p_from::timestamp at time zone tz;
  t1 := (p_from + n)::timestamp at time zone tz;
  with v as (
    select x.*, p.kind::text as pkind,
           (x.entered_at is not null and coalesce(x.exited_at, now()) > private.closing_for(x.gate_id, x.entered_at)) as is_over
      from public.visits x left join public.people p on p.id = x.person_id
     where x.university_id = me.university_id and x.decided_at >= t0 and x.decided_at < t1
  ), f as (
    select y.*, (coalesce(y.exited_at, now()) > private.closing_for(y.gate_id, y.entered_at)) as is_over
      from public.family_visits y where y.university_id = me.university_id and y.entered_at >= t0 and y.entered_at < t1
  ), c as (
    select z.*, d.role::text as by_role, private.admin_since(z) as to_admin_at
      from public.cases z left join public.staff d on d.id = z.decided_by
     where z.university_id = me.university_id and z.created_at >= t0 and z.created_at < t1
  ), arr as (
    select entered_at from v where entered_at is not null union all select entered_at from f
  )
  select jsonb_build_object(
    'from', p_from, 'days', n,
    'visits', (select count(*) from v where outcome = 'approved'),
    'family_groups', (select count(*) from f), 'family_guests', (select coalesce(sum(guests), 0) from f),
    'family_overstays', (select count(*) from f where is_over),
    'held', (select count(*) from c),
    'held_approved', (select count(*) from c where status = 'approved'),
    'held_denied', (select count(*) from c where status = 'denied'),
    'held_left', (select count(*) from c where status::text = 'left'),
    'held_open', (select count(*) from c where status in ('admin', 'host')),
    'overstays', (select count(*) from v where is_over) + (select count(*) from f where is_over),
    'outcomes', jsonb_build_object(
       'gate_approved', (select count(*) from v where outcome = 'approved' and case_id is null),
       'held_approved', (select count(*) from v where outcome = 'approved' and case_id is not null),
       'gate_denied',   (select count(*) from v where outcome = 'denied' and case_id is null),
       'held_denied',   (select count(*) from v where outcome = 'denied' and case_id is not null),
       'held_left',     (select count(*) from v where outcome::text = 'left')),
    'admin_decided', (select count(*) from c where by_role = 'admin' and decided_at is not null),
    'median_admin_seconds', (select round(percentile_cont(0.5) within group (order by extract(epoch from decided_at - coalesce(to_admin_at, created_at))))
                               from c where by_role = 'admin' and decided_at is not null),
    'passed_to_admin', (select count(*) from c where to_admin_at is not null and passed_to_host_at is null),
    'passed_to_host', (select count(*) from c where passed_to_host_at is not null),
    'escalations', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name_given, 'created_at', c.created_at,
                      'decided_at', c.decided_at, 'to_admin_at', c.to_admin_at, 'passed_at', c.passed_to_host_at,
                      'status', c.status, 'by_role', c.by_role)
                      order by c.created_at), '[]'::jsonb) from c),
    'by_day', (select jsonb_agg(jsonb_build_object('d', d::date,
                 'n', (select count(*) from arr where (arr.entered_at at time zone tz)::date = d::date)) order by d)
                 from generate_series(p_from::timestamp, (p_from + n - 1)::timestamp, interval '1 day') d),
    'by_hour', (select jsonb_agg(jsonb_build_object('h', h,
                  'n', (select count(*) from arr where extract(hour from arr.entered_at at time zone tz) = h)) order by h)
                  from generate_series(0, 23) h),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('type', t.k, 'visits', t.vis, 'held', t.held, 'denied', t.den, 'overstays', t.ovr)
                   order by t.ord), '[]'::jsonb)
                  from (select coalesce(pkind, 'walkin') as k,
                               min(case coalesce(pkind, 'walkin') when 'alumnus' then 1 when 'faculty' then 2 when 'placement' then 3 else 4 end) as ord,
                               count(*) filter (where outcome = 'approved') as vis, count(*) filter (where case_id is not null) as held,
                               count(*) filter (where outcome = 'denied') as den, count(*) filter (where is_over) as ovr
                          from v group by 1) t),
    'hours', (select jsonb_build_object('open', r.open_time, 'close', r.close_time, 'escalate_minutes', r.escalate_minutes)
                from public.campus_rules r where r.university_id = me.university_id order by r.campus_id limit 1))
  into res;
  return res;
end $function$;
