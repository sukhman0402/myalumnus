-- My Alumnus · slices 2 + 3 · fixes after code review (2026-10-04)
-- 1. Expected visits (with host phones) are read directly by admins only; the gate uses gate_expected().
alter policy uni_read on public.expected_visits using (university_id = private.my_university() and private.my_role() = 'admin');

-- 2. A phone number is shown only while the person is still inside (the overstay follow-up), not for past visits.
create or replace function public.gate_inside_visit(p_visit uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'name', coalesce(p.full_name, v.walkin_name), 'person_id', v.person_id, 'kind', p.kind, 'program', p.program,
    'batch_year', p.batch_year, 'photo_path', p.photo_path, 'photo_added_on', p.photo_added_on,
    'entered_at', v.entered_at, 'exited_at', v.exited_at, 'purpose', v.purpose,
    'phone', case when v.exited_at is null then coalesce(p.phone, c.visitor_phone) end,
    'closes_at', private.closing_for(v.gate_id, v.entered_at),
    'over_minutes', greatest(0, floor(extract(epoch from now() - private.closing_for(v.gate_id, v.entered_at)) / 60))::int)
  from public.visits v left join public.people p on p.id = v.person_id left join public.cases c on c.id = v.case_id
  where v.id = p_visit and (private.me()).role = 'gate' and v.gate_id = (private.me()).gate_id and v.entered_at is not null
$$;

-- 3. decide_case checks the gate before returning anything, including an already-decided case.
create or replace function public.decide_case(p_case uuid, p_approve boolean, p_note text default null)
returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases; decider uuid;
begin
  if me.id is null then raise exception 'not signed in' using errcode = '42501', hint = 'not_allowed'; end if;
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002', hint = 'not_found'; end if;
  -- A gate may act only on its own gate's cases, even just to read back a decided one.
  if me.role = 'gate' and c.gate_id <> me.gate_id then raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed'; end if;
  if c.status not in ('admin', 'host') then
    return c;                                                     -- already decided: the caller shows who decided
  end if;
  if me.role = 'gate' then
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
