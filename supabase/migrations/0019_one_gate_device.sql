-- 0019 · One gate, one device, no guard names (owner, 2026-10-08).
--
-- Before: a guard tapped their name on the gate iPad to start a shift; every decision was recorded under that guard.
-- Now:    each gate has one device and no guard names. The device opens a shift for the gate's "post" by itself the
--         first time it is needed, and never ends it. The post is the gate's first active guard record (created, named
--         after the gate, if the gate has none). Every existing gate function keeps working unchanged: they still
--         read the open shift. The consoles show the gate, never the post's name.
-- Trade-off (stated to the owner): a decision is recorded as "this gate, this time", not "this person". A university
-- that needs the person keeps its own duty roster.
-- Additive: one new function, one replaced (gate_insights: today at this gate instead of this guard's shift).
-- Backup of the replaced body: private.fn_backup tag '0019_0021' (saved 2026-10-08). No DROP/DELETE.

create or replace function public.gate_auto_duty()
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.me(); post uuid;
begin
  if me.id is null or me.role <> 'gate' or me.gate_id is null then
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  if private.shift_guard() is not null then return; end if;
  -- Two tabs on the same device may ask at once: one opens the shift, the other finds it open.
  perform pg_advisory_xact_lock(hashtext('ma_auto_duty:' || me.id::text));
  if private.shift_guard() is not null then return; end if;
  select g.id into post from public.staff g
   where g.role = 'guard' and g.active and g.gate_id = me.gate_id and g.university_id = me.university_id
   order by g.created_at, g.id limit 1;
  if post is null then
    insert into public.staff (university_id, name, role, gate_id)
    select me.university_id, gt.name, 'guard', gt.id from public.gates gt where gt.id = me.gate_id
    returning id into post;
  end if;
  update public.shifts set ended_at = now() where device_id = me.id and ended_at is null;   -- a stale shift for an inactive guard
  insert into public.shifts (university_id, gate_id, device_id, guard_id) values (me.university_id, me.gate_id, me.id, post);
end $$;
revoke all on function public.gate_auto_duty() from public, anon;
grant execute on function public.gate_auto_duty() to authenticated;

-- Insights: today at this gate (from midnight, university time), whoever decided. Same columns as before.
create or replace function public.gate_insights()
returns table (since timestamptz, approved int, denied int, held int, passed int, family int)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.me(); t0 timestamptz;
begin
  if me.id is null or me.role <> 'gate' then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  select (date_trunc('day', now() at time zone u.timezone)) at time zone u.timezone into t0
    from public.universities u where u.id = me.university_id;
  return query select t0,
    (select count(*)::int from public.visits v where v.gate_id = me.gate_id and v.decided_at >= t0 and v.outcome = 'approved'),
    (select count(*)::int from public.visits v where v.gate_id = me.gate_id and v.decided_at >= t0 and v.outcome = 'denied'),
    (select count(*)::int from public.cases c where c.gate_id = me.gate_id and c.created_at >= t0),
    (select count(*)::int from public.cases c where c.gate_id = me.gate_id and c.created_at >= t0 and c.passed_to_admin_at is not null),
    (select count(*)::int from public.family_visits f where f.gate_id = me.gate_id and f.entered_at >= t0);
end $$;
revoke all on function public.gate_insights() from public, anon;
grant execute on function public.gate_insights() to authenticated;
