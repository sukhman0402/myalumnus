-- 0017 · Flag & Hold: host first, then admin (owner, 2026-10-06: "Reverse the rules involving admin and host").
--
-- Before: a held visitor went to the admin first; after the campus limit (10 min) the guard called the host and decided.
-- Now:    the guard calls the host straight away and decides on the host's answer. If the host can't be reached
--         (the guard taps "pass to admin") or doesn't confirm within the limit, the case passes to the admin, who decides.
--
-- Stage names stay the same (case_status 'host' / 'admin'); only their order changes.
--   'host'  = stage 1, the guard is calling the host. The guard may approve or deny.
--   'admin' = stage 2, waiting for an admin. Only an admin may approve; the guard may still deny
--             (e.g. the visitor left), which is the conservative direction.
-- Cases created before this migration keep their old meaning: passed_to_host_at is set on them, never on new ones.
-- Additive: one new column, functions replaced. Nothing is removed.
-- Applied live 2026-10-07 after migration "backup_before_0017_0018", which saved the replaced function bodies in
-- private.fn_backup (tag '0017_0018'). Rollback: project doc build/migrations/rollback_0017_0018.sql.

alter table public.cases add column if not exists passed_to_admin_at timestamptz;
alter table public.cases alter column status set default 'host';

-- The stage a case is in right now, including a hand-off that is due but the minute job hasn't run yet.
create or replace function private.case_stage(c public.cases) returns text
language sql stable security definer set search_path = '' as $$
  select case when c.status = 'host' and c.passed_to_host_at is null and c.passed_to_admin_at is null
                   and now() >= private.handoff_at(c) then 'admin' else c.status::text end
$$;
-- When the case reached the admin (stage 2): set when passed; for a due-but-not-yet-moved case, the deadline.
create or replace function private.admin_since(c public.cases) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case when c.passed_to_admin_at is not null then c.passed_to_admin_at
              when c.status = 'host' and c.passed_to_host_at is null and now() >= private.handoff_at(c) then private.handoff_at(c)
              when c.status = 'admin' and c.passed_to_host_at is null then c.created_at   -- older cases that started with the admin
              else null end
$$;
revoke all on function private.case_stage(public.cases), private.admin_since(public.cases) from public;
grant execute on function private.case_stage(public.cases), private.admin_since(public.cases) to authenticated;

-- The minute job: host stage past the limit → admin.
create or replace function private.handoff_due_cases() returns void
language sql security definer set search_path = '' as $$
  update public.cases c set status = 'admin', passed_to_admin_at = private.handoff_at(c)
   where c.status = 'host' and c.passed_to_host_at is null and c.passed_to_admin_at is null and now() >= private.handoff_at(c)
$$;
revoke all on function private.handoff_due_cases() from public, anon, authenticated;

-- Hold: the case starts with the host.
create or replace function public.gate_hold(p_person uuid, p_name text, p_says text, p_reason text, p_purpose text, p_host text,
  p_host_phone text, p_visitor_phone text, p_client uuid)
returns public.cases language plpgsql security definer set search_path = '' as $$
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
          left(nullif(btrim(p_host_phone), ''), 24), left(nullif(btrim(p_visitor_phone), ''), 24), 'host', guard, p_client)
  returning * into c;
  return c;
end $$;

-- The guard couldn't reach the host (or the host didn't confirm): pass the case to the admin now.
create or replace function public.gate_pass_to_admin(p_case uuid) returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and gate_id = me.gate_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if private.shift_guard() is null then raise exception 'no guard on duty' using errcode = 'P0001', hint = 'no_shift'; end if;
  if c.status = 'host' and c.passed_to_host_at is null then
    update public.cases set status = 'admin', passed_to_admin_at = now() where id = c.id returning * into c;
  end if;
  return c;   -- already with the admin, or already decided: nothing to do
end $$;
revoke all on function public.gate_pass_to_admin(uuid) from public, anon;
grant execute on function public.gate_pass_to_admin(uuid) to authenticated;

-- Decide. Guard: approve or deny while the case is with the host; deny only once it is with the admin.
-- Admin: may decide at either stage (the university keeps the final say).
create or replace function public.decide_case(p_case uuid, p_approve boolean, p_note text default null)
returns public.cases language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases; decider uuid; stage text;
begin
  if me.id is null then raise exception 'not signed in' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if me.role = 'gate' and c.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if c.status not in ('admin', 'host') then
    return c;
  end if;
  stage := private.case_stage(c);
  if stage = 'admin' and c.status = 'host' and c.passed_to_host_at is null then   -- due: move it now, like the minute job
    update public.cases set status = 'admin', passed_to_admin_at = private.handoff_at(c) where id = c.id returning * into c;
  end if;
  if me.role = 'gate' then
    if stage = 'admin' and p_approve then
      raise exception 'only an admin can approve once the case is with the admin' using errcode = '42501', hint = 'with_admin';
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

-- The guard's view of one case. 'status' is the live stage; 'admin_since' is when it reached the admin.
create or replace function public.gate_case(p_case uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name_given', c.name_given, 'says', c.says, 'reason', c.reason, 'purpose', c.purpose,
    'host_name', c.host_name, 'host_phone', c.host_phone, 'person_id', c.person_id,
    'status', private.case_stage(c), 'legacy', c.passed_to_host_at is not null,
    'created_at', c.created_at, 'handoff_at', private.handoff_at(c), 'admin_since', private.admin_since(c),
    'passed_by_guard', c.passed_to_admin_at is not null and c.passed_to_admin_at < private.handoff_at(c),
    'decided_at', c.decided_at, 'note', c.note,
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

create or replace function public.gate_open_cases()
returns table (id uuid, name_given text, reason text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name_given, c.reason, private.case_stage(c), c.created_at
    from public.cases c
   where (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id and c.status in ('admin', 'host')
   order by c.created_at
$$;

-- Phone alerts go to admins when a case reaches them (stage 2), within 5 minutes of that moment.
create or replace function public.push_targets(p_case uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
    from public.cases c
    join public.push_subscriptions s on s.university_id = c.university_id
    join public.staff a on a.id = s.staff_id and a.role = 'admin' and a.active
   where c.id = p_case and (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id
     and private.case_stage(c) = 'admin' and coalesce(private.admin_since(c), c.created_at) > now() - interval '5 minutes'
$$;

-- This guard's shift so far, for the guard's Insights page.
create or replace function public.gate_insights()
returns table (since timestamptz, approved int, denied int, held int, passed int, family int)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.me(); g uuid := private.shift_guard(); t0 timestamptz;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if g is null then return; end if;
  select sh.started_at into t0 from public.shifts sh
   where sh.device_id = me.id and sh.guard_id = g and sh.ended_at is null order by sh.started_at desc limit 1;
  return query select t0,
    (select count(*)::int from public.visits v where v.gate_id = me.gate_id and v.decided_by = g and v.decided_at >= t0 and v.outcome = 'approved'),
    (select count(*)::int from public.visits v where v.gate_id = me.gate_id and v.decided_by = g and v.decided_at >= t0 and v.outcome = 'denied'),
    (select count(*)::int from public.cases c where c.gate_id = me.gate_id and c.held_by = g and c.created_at >= t0),
    (select count(*)::int from public.cases c where c.gate_id = me.gate_id and c.held_by = g and c.created_at >= t0 and c.passed_to_admin_at is not null),
    (select count(*)::int from public.family_visits f where f.gate_id = me.gate_id and f.logged_by = g and f.entered_at >= t0);
end $$;
revoke all on function public.gate_insights() from public, anon;
grant execute on function public.gate_insights() to authenticated;

-- Reports: "passed" now means passed to the admin; the admin's decision time counts from that moment.
create or replace function public.admin_report(p_from date, p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    'held_open', (select count(*) from c where status in ('admin', 'host')),
    'overstays', (select count(*) from v where is_over) + (select count(*) from f where is_over),
    'outcomes', jsonb_build_object(
       'gate_approved', (select count(*) from v where outcome = 'approved' and case_id is null),
       'held_approved', (select count(*) from v where outcome = 'approved' and case_id is not null),
       'gate_denied',   (select count(*) from v where outcome = 'denied' and case_id is null),
       'held_denied',   (select count(*) from v where outcome = 'denied' and case_id is not null)),
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
end $$;

-- Demo sample week: past held cases follow the new order.
--   Days 1 and 5: host unreachable, the guard passed it to the admin after 3 min; the admin approved.
--   Day 3: the guard called the host, who confirmed in 4 min; the guard approved.
--   Day 4: the host didn't confirm within 10 min; the admin denied.
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
  to_admin timestamptz; decided timestamptz; by_admin boolean;
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

    if i % 2 = 0 then
      t := ((d + time '12:40') at time zone tz);
      insert into public.visits (university_id, gate_id, walkin_name, outcome, reason, purpose, decided_by, decided_at)
      values (u, g1, case when i = 2 then 'Vivek Anand' else 'Sameer Khan' end, 'denied',
              'Not in the alumni list and could not show a university ID', 'Wanted to visit the hostel', ps, t);
    end if;

    if i in (1, 3, 4, 5) then
      t := ((d + time '13:10') at time zone tz) + make_interval(mins => i * 7);
      by_admin := i <> 3;
      to_admin := case when i in (1, 5) then t + interval '3 minutes' when i = 4 then t + interval '10 minutes' end;
      decided := case when i = 3 then t + interval '4 minutes' when i = 4 then t + interval '13 minutes'
                      else t + make_interval(mins => 5 + i) end;
      insert into public.cases (university_id, gate_id, person_id, name_given, says, reason, purpose, host_name, host_phone,
                                status, held_by, created_at, passed_to_admin_at, decided_at, decided_by, note)
      values (u, g1, case when i in (1, 5) then nophoto end,
              case when i in (1, 5) then 'Arjun Kapoor' when i = 3 then 'Rohan Mehra' else 'Imran Shaikh' end,
              case when i = 3 then 'B.Tech 2012, Civil' when i = 4 then 'MBA 2015' else 'B.Tech Civil 2009' end,
              case when i in (1, 5) then 'No photo on file' else 'Not found in the alumni list' end,
              case when i = 4 then 'Wants to meet the Dean' else 'Meeting Prof. S. Rao, Mechanical' end,
              case when i = 4 then 'Office of the Dean' else 'Prof. S. Rao' end, '+91 98765 43201',
              case when i = 4 then 'denied'::public.case_status else 'approved'::public.case_status end,
              ps, t, to_admin, decided, case when by_admin then adm else ps end,
              case when i = 4 then 'No meeting is booked with the Dean.' when i = 3 then 'Host confirmed by phone.' end)
      returning id into cid;
      if i <> 4 then
        insert into public.visits (university_id, gate_id, person_id, walkin_name, outcome, purpose, decided_by, case_id,
                                   decided_at, entered_at, exited_at)
        values (u, g1, case when i in (1, 5) then nophoto end, case when i = 3 then 'Rohan Mehra' end, 'approved',
                'Meeting Prof. S. Rao, Mechanical', case when by_admin then adm else ps end, cid,
                decided, decided + interval '2 minutes', t + interval '95 minutes');
      else
        insert into public.visits (university_id, gate_id, walkin_name, outcome, reason, purpose, decided_by, case_id, decided_at)
        values (u, g1, 'Imran Shaikh', 'denied', 'No meeting is booked with the Dean.', 'Wants to meet the Dean',
                adm, cid, decided);
      end if;
    end if;

    if i % 2 = 1 and coalesce(array_length(studs, 1), 0) > 0 then
      insert into public.family_visits (university_id, gate_id, student_id, guests, purpose, logged_by, entered_at, exited_at)
      values (u, g1, studs[1 + (i % array_length(studs, 1))], 2 + (i % 2), 'Parents visiting', ps,
              ((d + time '16:05') at time zone tz), ((d + time '17:20') at time zone tz));
    end if;
  end loop;
end $$;
