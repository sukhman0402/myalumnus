-- My Alumnus · slice 4 · the admin console (planning/00 stage 11; planning/02 D5–D8, Q9)
-- Alumni records and bulk upload, photos, expected visitors, History and visit detail, Security users,
-- Campus rules, the weekly report (slice 5) and the change log.
-- Same rule as the gate: admins change records only through admin_* functions, which check the role,
-- the university and the data. Error hints: not_allowed, not_found, name_required, kind_invalid,
-- batch_invalid, batch_required, roll_required, roll_taken, row_invalid, too_many, path_invalid,
-- host_required, date_past, email_required, email_taken, email_locked, gate_required, role_locked,
-- self_lock, hours_invalid, minutes_invalid.

-- ---------- helpers ----------
-- The calling admin, or an error. Every admin_* function starts with it.
create or replace function private.admin() returns public.staff
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.me();
begin
  if me.id is null or me.role <> 'admin' then
    raise exception 'admins only' using errcode = '42501', hint = 'not_allowed';
  end if;
  return me;
end $$;

-- "rao_%" typed in a search box must match those characters literally, not as LIKE wildcards.
create or replace function private.like_escape(p text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;
revoke all on function private.admin(), private.like_escape(text) from public;
-- Entries saved on a gate iPad while it was offline, then synced (planning/02 D11): marked in History.
alter table public.visits add column if not exists recorded_offline boolean not null default false;
grant execute on function private.admin(), private.like_escape(text) to authenticated;

-- Admins change records only through the functions below (validation lives in one place).
revoke insert, update, delete on public.people, public.staff, public.expected_visits, public.campus_rules from authenticated;

-- ---------- 1. Alumni records ----------
-- One page (50) of records, with the counts the page header needs.
create or replace function public.admin_people(p_q text default '', p_kind text default 'all', p_batch int default null,
                                               p_status text default 'active', p_page int default 1)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.staff := private.admin();
  q  text := private.like_escape(lower(btrim(coalesce(p_q, ''))));
  res jsonb;
begin
  with f as (
    select p.id, p.kind, p.full_name, p.program, p.batch_year, p.roll_no, p.photo_path, p.active
      from public.people p
     where p.university_id = me.university_id
       and (coalesce(p_status, 'active') = 'all' or (coalesce(p_status, 'active') = 'hidden') = (not p.active))
       and (coalesce(p_kind, 'all') = 'all' or p.kind::text = p_kind)
       and (p_batch is null or p.batch_year = p_batch)
       and (q = '' or lower(p.full_name) like '%' || q || '%' or lower(coalesce(p.roll_no, '')) like q || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.full_name, x.id)
                        from (select * from f order by f.full_name, f.id limit 50
                              offset (greatest(coalesce(p_page, 1), 1) - 1) * 50) x), '[]'::jsonb),
    'all', (select count(*) from public.people p where p.university_id = me.university_id and p.active),
    'no_photo', (select count(*) from public.people p where p.university_id = me.university_id and p.active
                   and p.photo_path is null and p.kind in ('alumnus', 'student')),
    'batches', coalesce((select jsonb_agg(b order by b desc) from (select distinct p.batch_year b from public.people p
                   where p.university_id = me.university_id and p.batch_year is not null) y), '[]'::jsonb))
  into res;
  return res;
end $$;

-- One record for the edit form, plus how many visits it has (records with history are hidden, never deleted).
create or replace function public.admin_person(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  select to_jsonb(p) || jsonb_build_object('visits', (select count(*) from public.visits v where v.person_id = p.id))
    into res
    from public.people p where p.id = p_id and p.university_id = me.university_id;
  return res;
end $$;

-- Add (p_id null) or edit a record. Returns its id.
create or replace function public.admin_save_person(p_id uuid, p_kind text, p_name text, p_program text, p_batch int,
                                                    p_roll text, p_phone text, p_email text, p_active boolean default true)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me   public.staff := private.admin();
  k    public.person_kind;
  v_id uuid;
  roll text := nullif(btrim(p_roll), '');
begin
  if nullif(btrim(p_name), '') is null then
    raise exception 'a name is required' using errcode = '23514', hint = 'name_required';
  end if;
  if p_kind not in ('alumnus', 'faculty', 'placement', 'student') then
    raise exception 'unknown record type' using errcode = '22023', hint = 'kind_invalid';
  end if;
  k := p_kind::public.person_kind;
  if p_batch is not null and (p_batch < 1950 or p_batch > 2100) then
    raise exception 'batch year out of range' using errcode = '23514', hint = 'batch_invalid';
  end if;
  if k = 'alumnus' and p_batch is null then
    raise exception 'alumni need a batch year' using errcode = '23514', hint = 'batch_required';
  end if;
  if k = 'student' and roll is null then
    raise exception 'students need a roll number' using errcode = '23514', hint = 'roll_required';
  end if;
  begin
    if p_id is null then
      insert into public.people (university_id, kind, full_name, program, batch_year, roll_no, phone, email, active)
      values (me.university_id, k, left(btrim(p_name), 120), left(nullif(btrim(p_program), ''), 120), p_batch, left(roll, 40),
              left(nullif(btrim(p_phone), ''), 30), left(nullif(btrim(p_email), ''), 200), coalesce(p_active, true))
      returning id into v_id;
    else
      update public.people
         set kind = k, full_name = left(btrim(p_name), 120), program = left(nullif(btrim(p_program), ''), 120),
             batch_year = p_batch, roll_no = left(roll, 40), phone = left(nullif(btrim(p_phone), ''), 30),
             email = left(nullif(btrim(p_email), ''), 200), active = coalesce(p_active, true), updated_at = now()
       where id = p_id and university_id = me.university_id
      returning id into v_id;
      if v_id is null then
        raise exception 'record not found' using errcode = 'P0002', hint = 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'roll number already used' using errcode = '23505', hint = 'roll_taken';
  end;
  return v_id;
end $$;

-- Point a record at a newly uploaded photo. Returns the previous path, which the app then deletes.
create or replace function public.admin_set_photo(p_person uuid, p_path text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin(); old text; done uuid;
begin
  if p_path is not null and p_path !~ ('^' || me.university_id::text || '/[0-9a-f-]{36}-[0-9]+\.jpg$') then
    raise exception 'photo path not allowed' using errcode = '22023', hint = 'path_invalid';
  end if;
  select photo_path into old from public.people where id = p_person and university_id = me.university_id;
  update public.people
     set photo_path = p_path, photo_added_on = case when p_path is null then null else current_date end, updated_at = now()
   where id = p_person and university_id = me.university_id
  returning id into done;
  if done is null then
    raise exception 'record not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  return case when old like 'sample/%' then null else old end;   -- sample faces ship with the app; nothing to delete
end $$;

-- For the bulk-upload preview: which roll numbers already exist (and as what).
create or replace function public.admin_roll_lookup(p_rolls text[])
returns table (roll_no text, id uuid, kind public.person_kind, full_name text, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  return query
    select p.roll_no, p.id, p.kind, p.full_name, p.photo_path from public.people p
     where p.university_id = me.university_id and p.roll_no = any (p_rolls[1:5000]);
end $$;

-- Bulk upload (Q9): up to 1,000 rows per call. A matching roll number updates that record, which is how a
-- current student becomes an alumnus when their batch is uploaded. All rows or none: one bad row rejects the call.
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
       set full_name = nm, program = prog, batch_year = yr, kind = k, active = true, updated_at = now(),
           email = coalesce(left(nullif(btrim(r ->> 'email'), ''), 200), email),
           phone = coalesce(left(nullif(btrim(r ->> 'phone'), ''), 30), phone)
     where university_id = me.university_id and roll_no = roll;
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

-- Photos (D8): a private bucket. Files live under <university id>/; admins manage them, gate devices may read
-- them (the app shows each through a 5-minute signed link). JPEG only: the browser resizes to 480 × 640 first.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

create policy "photos: admins manage their university" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = private.my_university()::text and private.my_role() = 'admin')
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = private.my_university()::text and private.my_role() = 'admin');
create policy "photos: gate devices read their university" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = private.my_university()::text and private.my_role() = 'gate');

-- ---------- 2. Expected visitors ----------
create or replace function public.admin_expected(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); tz text; res jsonb;
begin
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'expected_at', e.expected_at, 'purpose', e.purpose, 'host_name', e.host_name, 'host_phone', e.host_phone,
           'gate', g.name,
           'person', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'kind', p.kind, 'program', p.program,
                                        'batch_year', p.batch_year, 'photo_path', p.photo_path),
           'arrived_at', (select min(v.entered_at) from public.visits v
                           where v.person_id = e.person_id and v.entered_at is not null
                             and (v.entered_at at time zone tz)::date = (e.expected_at at time zone tz)::date))
         order by e.expected_at), '[]'::jsonb)
    into res
    from public.expected_visits e join public.people p on p.id = e.person_id left join public.gates g on g.id = e.gate_id
   where e.university_id = me.university_id and e.expected_at >= p_from and e.expected_at < p_to;
  return res;
end $$;

-- Existing records to pick when adding an expected visitor (not students).
create or replace function public.admin_lookup_people(p_q text)
returns table (id uuid, full_name text, kind public.person_kind, program text, batch_year int, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); q text := lower(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')));
begin
  if length(q) < 3 then return; end if;
  return query
    select p.id, p.full_name, p.kind, p.program, p.batch_year, p.photo_path from public.people p
     where p.university_id = me.university_id and p.active and p.kind <> 'student'
       and not exists (select 1 from unnest(string_to_array(q, ' ')) w where strpos(lower(p.full_name), w) = 0)
     order by p.full_name, p.batch_year nulls last limit 8;
end $$;

-- Add an expected visitor: an existing record (p_person) or a new one made from p_name and p_kind.
create or replace function public.admin_add_expected(p_person uuid, p_name text, p_kind text, p_program text, p_at timestamptz,
                                                     p_gate uuid, p_purpose text, p_host text, p_host_phone text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin(); tz text; pid uuid; v_id uuid;
begin
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  if p_at is null or (p_at at time zone tz)::date < (now() at time zone tz)::date then
    raise exception 'pick today or a later date' using errcode = '23514', hint = 'date_past';
  end if;
  if nullif(btrim(p_host), '') is null then
    raise exception 'the host is required' using errcode = '23514', hint = 'host_required';
  end if;
  if p_gate is not null and not exists (select 1 from public.gates g where g.id = p_gate and g.university_id = me.university_id) then
    raise exception 'gate not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  if p_person is not null then
    select p.id into pid from public.people p
     where p.id = p_person and p.university_id = me.university_id and p.active and p.kind <> 'student';
    if pid is null then raise exception 'record not found' using errcode = 'P0002', hint = 'not_found'; end if;
  else
    if nullif(btrim(p_name), '') is null then
      raise exception 'a name is required' using errcode = '23514', hint = 'name_required';
    end if;
    if p_kind not in ('alumnus', 'faculty', 'placement') then
      raise exception 'unknown visitor type' using errcode = '22023', hint = 'kind_invalid';
    end if;
    insert into public.people (university_id, kind, full_name, program)
    values (me.university_id, p_kind::public.person_kind, left(btrim(p_name), 120), left(nullif(btrim(p_program), ''), 120))
    returning id into pid;
  end if;
  insert into public.expected_visits (university_id, person_id, gate_id, expected_at, purpose, host_name, host_phone)
  values (me.university_id, pid, p_gate, p_at, left(nullif(btrim(p_purpose), ''), 200), left(btrim(p_host), 120),
          left(nullif(btrim(p_host_phone), ''), 30))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_cancel_expected(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  delete from public.expected_visits where id = p_id and university_id = me.university_id;
  if not found then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
end $$;

-- ---------- 3. History and visit detail ----------
-- Visits (decided at a gate or after a hold) and family visits in one list. p_outcome: all | approved | denied | held.
-- p_kind: all | alumnus | faculty | placement | walkin | family. p_limit up to 10,000 (the CSV export).
create or replace function public.admin_history(p_from timestamptz, p_to timestamptz, p_outcome text default 'all',
                                                p_kind text default 'all', p_gate uuid default null,
                                                p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  with allrows as (
    select 'visit'::text as type, v.id, v.decided_at as at, coalesce(p.full_name, v.walkin_name) as name,
           coalesce(p.kind::text, 'walkin') as kind, p.program, p.batch_year, p.photo_path, v.outcome::text as outcome,
           (v.case_id is not null) as held, g.name as gate, v.gate_id, v.reason, v.purpose, v.entered_at, v.exited_at,
           null::int as guests, d.name as by_name, d.role::text as by_role, v.recorded_offline as offline
      from public.visits v left join public.people p on p.id = v.person_id join public.gates g on g.id = v.gate_id
      left join public.staff d on d.id = v.decided_by
     where v.university_id = me.university_id and v.decided_at >= p_from and v.decided_at < p_to
    union all
    select 'family', f.id, f.entered_at, s.full_name, 'family', s.program, s.batch_year, s.photo_path, 'logged',
           false, g.name, f.gate_id, null, f.purpose, f.entered_at, f.exited_at, f.guests, d.name, d.role::text, false
      from public.family_visits f join public.people s on s.id = f.student_id join public.gates g on g.id = f.gate_id
      left join public.staff d on d.id = f.logged_by
     where f.university_id = me.university_id and f.entered_at >= p_from and f.entered_at < p_to
  ), f as (
    select * from allrows
     where (coalesce(p_outcome, 'all') = 'all' or (p_outcome = 'held' and allrows.held) or allrows.outcome = p_outcome)
       and (coalesce(p_kind, 'all') = 'all' or allrows.kind = p_kind)
       and (p_gate is null or allrows.gate_id = p_gate)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc, x.id)
                        from (select * from f order by f.at desc, f.id limit least(greatest(coalesce(p_limit, 50), 1), 10000)
                              offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb),
    'gates', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name), '[]'::jsonb)
                from public.gates g where g.university_id = me.university_id))
  into res;
  return res;
end $$;

-- One visit or family visit with everything its trail needs.
create or replace function public.admin_visit(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  select jsonb_build_object(
           'type', 'visit', 'id', v.id, 'outcome', v.outcome, 'reason', v.reason, 'purpose', v.purpose, 'gate', g.name,
           'decided_at', v.decided_at, 'entered_at', v.entered_at, 'exited_at', v.exited_at, 'offline', v.recorded_offline,
           'walkin_name', v.walkin_name, 'by_name', d.name, 'by_role', d.role,
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

-- The change log for one row (records, rules, staff): who changed which fields, newest first.
create or replace function public.admin_changes(p_table text, p_row uuid)
returns table (at timestamptz, action text, actor text, changed jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  if p_table not in ('people', 'staff', 'campus_rules', 'expected_visits') then
    raise exception 'not allowed' using errcode = '42501', hint = 'not_allowed';
  end if;
  return query
    select a.at, a.action, coalesce(s.name, 'System'),
           case when a.action = 'UPDATE' then
             (select coalesce(jsonb_object_agg(e.key, jsonb_build_array(a.before -> e.key, e.value)), '{}'::jsonb)
                from jsonb_each(a.after) e
               where e.key not in ('updated_at', 'user_id') and (a.before -> e.key) is distinct from e.value)
           else null end
      from public.audit_events a left join public.staff s on s.user_id = a.actor_user
     where a.university_id = me.university_id and a.table_name = p_table and a.row_id = p_row
     order by a.at desc limit 20;
end $$;

-- ---------- 4. Security users ----------
create or replace function public.admin_staff()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  select jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'role', s.role, 'email', s.email, 'gate_id', s.gate_id, 'gate', g.name,
               'shift_label', s.shift_label, 'active', s.active, 'signed_in', s.user_id is not null, 'me', s.id = me.id,
               'on_shift', exists (select 1 from public.shifts sh where sh.guard_id = s.id and sh.ended_at is null))
             order by s.active desc, case s.role when 'guard' then 1 when 'gate' then 2 else 3 end, g.name nulls last, s.name)
             from public.staff s left join public.gates g on g.id = s.gate_id where s.university_id = me.university_id), '[]'::jsonb),
    'gates', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name), '[]'::jsonb)
                from public.gates g where g.university_id = me.university_id))
  into res;
  return res;
end $$;

-- Add (p_id null) or edit a console user. Guards: name, gate, shift. Gate devices: name, gate, email. Admins: name, email.
-- The role can't change after creation, and an email can't change once that person has signed in.
create or replace function public.admin_save_staff(p_id uuid, p_role text, p_name text, p_email text, p_gate uuid, p_shift text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me    public.staff := private.admin();
  cur   public.staff;
  role_ public.staff_role;
  em    text := lower(nullif(btrim(p_email), ''));
  v_id  uuid;
begin
  if nullif(btrim(p_name), '') is null then
    raise exception 'a name is required' using errcode = '23514', hint = 'name_required';
  end if;
  if p_id is not null then
    select * into cur from public.staff where id = p_id and university_id = me.university_id;
    if cur.id is null then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
    if p_role is distinct from cur.role::text then
      raise exception 'the role can''t change' using errcode = '22023', hint = 'role_locked';
    end if;
    if cur.user_id is not null and em is distinct from lower(cur.email) then
      raise exception 'email locked after first sign-in' using errcode = '22023', hint = 'email_locked';
    end if;
  end if;
  if p_role not in ('admin', 'gate', 'guard') then
    raise exception 'unknown role' using errcode = '22023', hint = 'kind_invalid';
  end if;
  role_ := p_role::public.staff_role;
  if role_ in ('admin', 'gate') and em is null then
    raise exception 'an email is required' using errcode = '23514', hint = 'email_required';
  end if;
  if role_ in ('gate', 'guard') and (p_gate is null or not exists (select 1 from public.gates g where g.id = p_gate and g.university_id = me.university_id)) then
    raise exception 'pick a gate' using errcode = '23514', hint = 'gate_required';
  end if;
  begin
    if p_id is null then
      insert into public.staff (university_id, email, name, role, gate_id, shift_label)
      values (me.university_id, case when role_ = 'guard' then null else left(em, 200) end, left(btrim(p_name), 80), role_,
              case when role_ = 'admin' then null else p_gate end,
              case when role_ = 'guard' then left(nullif(btrim(p_shift), ''), 40) end)
      returning id into v_id;
    else
      -- a guard moved to another gate finishes any open shift at the old one
      if role_ = 'guard' and cur.gate_id is distinct from p_gate then
        update public.shifts set ended_at = now() where guard_id = cur.id and ended_at is null;
      end if;
      update public.staff
         set name = left(btrim(p_name), 80),
             email = case when role_ = 'guard' then null else left(em, 200) end,
             gate_id = case when role_ = 'admin' then null else p_gate end,
             shift_label = case when role_ = 'guard' then left(nullif(btrim(p_shift), ''), 40) end
       where id = p_id
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'email already used' using errcode = '23505', hint = 'email_taken';
  end;
  return v_id;
end $$;

-- Deactivate or reactivate. A deactivated person loses access at once (private.me() requires active),
-- their open shift ends, and their past decisions stay in History. Nobody can deactivate themselves.
create or replace function public.admin_set_staff_active(p_id uuid, p_active boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  if p_id = me.id then
    raise exception 'you can''t deactivate yourself' using errcode = '22023', hint = 'self_lock';
  end if;
  update public.staff set active = p_active where id = p_id and university_id = me.university_id;
  if not found then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
  if not p_active then
    update public.shifts set ended_at = now() where (guard_id = p_id or device_id = p_id) and ended_at is null;
  end if;
end $$;

-- ---------- 5. Campus rules (two rules, on purpose: visiting hours and the escalation time) ----------
create or replace function public.admin_rules()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.admin(); res jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'campus_id', c.id, 'campus', c.name, 'open_time', r.open_time, 'close_time', r.close_time,
           'escalate_minutes', r.escalate_minutes, 'updated_at', r.updated_at,
           'gates', (select coalesce(jsonb_agg(g.name order by g.name), '[]'::jsonb) from public.gates g where g.campus_id = c.id))
         order by c.name), '[]'::jsonb)
    into res
    from public.campuses c join public.campus_rules r on r.campus_id = c.id
   where c.university_id = me.university_id;
  return res;
end $$;

create or replace function public.admin_save_rules(p_campus uuid, p_open time, p_close time, p_minutes int)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me public.staff := private.admin();
begin
  if p_open is null or p_close is null or p_open >= p_close then
    raise exception 'opening must be before closing' using errcode = '23514', hint = 'hours_invalid';
  end if;
  if p_minutes is null or p_minutes not between 1 and 60 then
    raise exception 'escalation time is 1 to 60 minutes' using errcode = '23514', hint = 'minutes_invalid';
  end if;
  update public.campus_rules set open_time = p_open, close_time = p_close, escalate_minutes = p_minutes, updated_at = now()
   where campus_id = p_campus and university_id = me.university_id;
  if not found then raise exception 'not found' using errcode = 'P0002', hint = 'not_found'; end if;
end $$;

-- ---------- 6. The weekly review (Reports, slice 5) ----------
-- p_from is a campus-local date; the report covers p_days days from it.
create or replace function public.admin_report(p_from date, p_days int default 7)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
    select z.*, d.role::text as by_role from public.cases z left join public.staff d on d.id = z.decided_by
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
    'median_admin_seconds', (select round(percentile_cont(0.5) within group (order by extract(epoch from decided_at - created_at)))
                               from c where by_role = 'admin' and decided_at is not null),
    'passed_to_host', (select count(*) from c where passed_to_host_at is not null),
    'escalations', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name_given, 'created_at', c.created_at,
                      'decided_at', c.decided_at, 'passed_at', c.passed_to_host_at, 'status', c.status, 'by_role', c.by_role)
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

-- ---------- grants ----------
revoke all on function
  public.admin_people(text, text, int, text, int), public.admin_person(uuid),
  public.admin_save_person(uuid, text, text, text, int, text, text, text, boolean), public.admin_set_photo(uuid, text),
  public.admin_roll_lookup(text[]), public.admin_bulk_people(text, jsonb),
  public.admin_expected(timestamptz, timestamptz), public.admin_lookup_people(text),
  public.admin_add_expected(uuid, text, text, text, timestamptz, uuid, text, text, text), public.admin_cancel_expected(uuid),
  public.admin_history(timestamptz, timestamptz, text, text, uuid, int, int), public.admin_visit(uuid),
  public.admin_changes(text, uuid), public.admin_staff(), public.admin_save_staff(uuid, text, text, text, uuid, text),
  public.admin_set_staff_active(uuid, boolean), public.admin_rules(), public.admin_save_rules(uuid, time, time, int),
  public.admin_report(date, int)
from public, anon;
grant execute on function
  public.admin_people(text, text, int, text, int), public.admin_person(uuid),
  public.admin_save_person(uuid, text, text, text, int, text, text, text, boolean), public.admin_set_photo(uuid, text),
  public.admin_roll_lookup(text[]), public.admin_bulk_people(text, jsonb),
  public.admin_expected(timestamptz, timestamptz), public.admin_lookup_people(text),
  public.admin_add_expected(uuid, text, text, text, timestamptz, uuid, text, text, text), public.admin_cancel_expected(uuid),
  public.admin_history(timestamptz, timestamptz, text, text, uuid, int, int), public.admin_visit(uuid),
  public.admin_changes(text, uuid), public.admin_staff(), public.admin_save_staff(uuid, text, text, text, uuid, text),
  public.admin_set_staff_active(uuid, boolean), public.admin_rules(), public.admin_save_rules(uuid, time, time, int),
  public.admin_report(date, int)
to authenticated;
