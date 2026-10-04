-- My Alumnus · slice 5 · admin web push (planning/02 D13, Q2) and offline search at the gate (D11, Q3)

-- ---------- 1. Web push subscriptions (one per admin browser or Home Screen app) ----------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  staff_id      uuid not null references public.staff on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists push_by_staff on public.push_subscriptions (staff_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;
create policy own_read on public.push_subscriptions for select to authenticated using (staff_id = (private.me()).id);

-- An admin's browser registers (or re-registers) for alerts.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = ''
     or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'not a push subscription' using errcode = '22023', hint = 'kind_invalid';
  end if;
  insert into public.push_subscriptions (university_id, staff_id, endpoint, p256dh, auth)
  values (me.university_id, me.id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set university_id = excluded.university_id, staff_id = excluded.staff_id,
                                       p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

-- Remove one subscription: the admin turning alerts off, or the server pruning one the push service says is gone.
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and university_id = private.my_university()
$$;

-- Who to alert about a case just held at this gate: active admins' subscriptions. Only the gate that holds the case,
-- only while it is waiting for an admin, and only in its first 5 minutes (so this can't be used to list them later).
create or replace function public.push_targets(p_case uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
    from public.cases c
    join public.push_subscriptions s on s.university_id = c.university_id
    join public.staff a on a.id = s.staff_id and a.role = 'admin' and a.active
   where c.id = p_case and (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id
     and c.status = 'admin' and c.created_at > now() - interval '5 minutes'
$$;

-- The held-case screen names the admins who will see the alert: only admins who have signed in at least once
-- (sample admins on .invalid addresses never can). Same output as before otherwise.
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
    'escalate_minutes', (select r.escalate_minutes from public.gates g join public.campus_rules r on r.campus_id = g.campus_id where g.id = c.gate_id))
  from public.cases c left join public.staff d on d.id = c.decided_by
  where c.id = p_case and (private.me()).role = 'gate' and c.gate_id = (private.me()).gate_id
$$;

-- ---------- 2. Offline search at the gate (Q3: minimal list, no photos, no phone numbers) ----------
-- The list the iPad keeps for when the network drops: who can be searched, and nothing else.
create or replace function public.gate_roster()
returns table (id uuid, full_name text, kind public.person_kind, program text, batch_year int)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.me();
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device' using errcode = '42501', hint = 'not_allowed';
  end if;
  return query
    select p.id, p.full_name, p.kind, p.program, p.batch_year from public.people p
     where p.university_id = me.university_id and p.active and p.kind <> 'student'
     order by p.full_name
     limit 50000;
end $$;

-- A decision the guard made while offline, sent when the network is back. Same rules as gate_decide, but checked
-- at the moment it was made (p_at, at most 12 hours ago, never in the future), for the guard who was on shift then.
-- Marked recorded_offline, so History shows it. A replay with the same client id returns the saved visit.
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
  if t < now() - interval '12 hours' then
    raise exception 'too old to record' using errcode = '22023', hint = 'too_old';
  end if;
  if not exists (select 1 from public.shifts sh join public.staff g on g.id = sh.guard_id
                  where sh.device_id = me.id and sh.guard_id = p_guard and sh.gate_id = me.gate_id
                    and g.role = 'guard' and g.active
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
                             decided_at, entered_at, client_id, recorded_offline)
  values (me.university_id, me.gate_id, p.id,
          (case when p_approve then 'approved' else 'denied' end)::public.visit_outcome,
          case when p_approve then null else left(btrim(p_reason), 300) end,
          left(nullif(btrim(p_purpose), ''), 200), p_guard, t, case when p_approve then t end, p_client, true)
  returning * into v;
  return v;
end $$;

revoke all on function public.save_push_subscription(text, text, text), public.delete_push_subscription(text),
  public.push_targets(uuid), public.gate_roster(), public.gate_decide_offline(uuid, boolean, text, text, uuid, timestamptz, uuid)
from public, anon;
grant execute on function public.save_push_subscription(text, text, text), public.delete_push_subscription(text),
  public.push_targets(uuid), public.gate_roster(), public.gate_decide_offline(uuid, boolean, text, text, uuid, timestamptz, uuid)
to authenticated;
