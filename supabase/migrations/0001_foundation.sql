-- My Alumnus · slice 0 · foundation schema (planning/02 D4–D7, D9)
-- Every row carries university_id (D4). Row-level security is on for every table (D6).
-- Decisions on held cases go through one function so the first decision wins (D9).
-- The audit log is append-only: written by triggers, readable by admins, never updated or deleted (D7).

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- types ----------
create type public.staff_role   as enum ('admin', 'gate', 'guard');   -- gate = a signed-in gate device (Q1)
create type public.person_kind  as enum ('alumnus', 'faculty', 'placement', 'student');
create type public.case_status  as enum ('admin', 'host', 'approved', 'denied');
create type public.visit_outcome as enum ('approved', 'denied');

-- ---------- tenancy and campus ----------
create table public.universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Asia/Kolkata',
  languages   text[] not null default '{en,hi}',
  created_at  timestamptz not null default now()
);

create table public.campuses (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  name          text not null
);

create table public.campus_rules (
  campus_id        uuid primary key references public.campuses on delete cascade,
  university_id    uuid not null references public.universities on delete cascade,
  open_time        time not null default '10:00',
  close_time       time not null default '18:00',
  escalate_minutes int  not null default 10 check (escalate_minutes between 1 and 60),
  updated_at       timestamptz not null default now(),
  check (open_time < close_time)
);

create table public.gates (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  campus_id     uuid not null references public.campuses on delete cascade,
  name          text not null
);

-- ---------- people who use the consoles ----------
create table public.staff (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  user_id       uuid unique references auth.users on delete set null,  -- admins and gate devices sign in; guards don't (Q1)
  email         text,
  name          text not null,
  role          public.staff_role not null,
  gate_id       uuid references public.gates on delete set null,
  shift_label   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (role = 'guard' or email is not null),
  check (role = 'admin' or gate_id is not null)
);
create unique index staff_email_unique on public.staff (lower(email)) where email is not null;

create table public.shifts (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  gate_id       uuid not null references public.gates on delete cascade,
  device_id     uuid not null references public.staff on delete cascade,   -- the gate device account
  guard_id      uuid not null references public.staff on delete cascade,   -- who tapped their name
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index shifts_open on public.shifts (device_id) where ended_at is null;

-- ---------- records the guard looks up ----------
create table public.people (
  id             uuid primary key default gen_random_uuid(),
  university_id  uuid not null references public.universities on delete cascade,
  kind           public.person_kind not null,
  full_name      text not null,
  program        text,
  batch_year     int check (batch_year between 1950 and 2100),
  roll_no        text,
  phone          text,
  email          text,
  photo_path     text,
  photo_added_on date,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index people_roll_unique on public.people (university_id, roll_no) where roll_no is not null;
create index people_name_trgm on public.people using gin (full_name extensions.gin_trgm_ops);

create table public.expected_visits (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  person_id     uuid not null references public.people on delete cascade,
  gate_id       uuid references public.gates on delete set null,
  expected_at   timestamptz not null,
  purpose       text,
  host_name     text,
  host_phone    text,
  created_at    timestamptz not null default now()
);

-- ---------- what happens at the gate ----------
create table public.cases (
  id             uuid primary key default gen_random_uuid(),
  university_id  uuid not null references public.universities on delete cascade,
  gate_id        uuid not null references public.gates,
  person_id      uuid references public.people,
  name_given     text not null,
  says           text,
  reason         text not null,
  purpose        text,
  host_name      text not null,
  host_phone     text,
  visitor_phone  text,                                  -- optional (Q6)
  status         public.case_status not null default 'admin',
  held_by        uuid references public.staff,          -- the guard on duty
  created_at     timestamptz not null default now(),
  passed_to_host_at timestamptz,
  decided_at     timestamptz,
  decided_by     uuid references public.staff,
  note           text,
  client_id      uuid unique,                           -- safe replay of offline entries (D11)
  check (status in ('admin','host') or decided_at is not null),
  check (status <> 'denied' or nullif(btrim(note), '') is not null)
);
create index cases_open on public.cases (university_id, status) where status in ('admin','host');

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  gate_id       uuid not null references public.gates,
  person_id     uuid references public.people,
  walkin_name   text,
  outcome       public.visit_outcome not null,
  reason        text,                                   -- required when denied
  purpose       text,
  decided_by    uuid references public.staff,
  case_id       uuid references public.cases,
  decided_at    timestamptz not null default now(),
  entered_at    timestamptz,                            -- null when denied
  exited_at     timestamptz,
  client_id     uuid unique,
  check (person_id is not null or walkin_name is not null),
  check (outcome = 'approved' or nullif(btrim(reason), '') is not null),
  check (exited_at is null or (entered_at is not null and exited_at >= entered_at))
);
create index visits_inside on public.visits (university_id, gate_id) where entered_at is not null and exited_at is null;

create table public.family_visits (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  gate_id       uuid not null references public.gates,
  student_id    uuid not null references public.people,
  guests        int  not null check (guests between 1 and 20),
  purpose       text,
  logged_by     uuid references public.staff,
  entered_at    timestamptz not null default now(),
  exited_at     timestamptz,
  client_id     uuid unique
);

-- ---------- audit log (append-only) ----------
create table public.audit_events (
  id            bigint generated always as identity primary key,
  university_id uuid not null,
  at            timestamptz not null default now(),
  actor_user    uuid,
  table_name    text not null,
  row_id        uuid,
  action        text not null,
  before        jsonb,
  after         jsonb
);
create index audit_by_row on public.audit_events (table_name, row_id);
create index audit_by_time on public.audit_events (university_id, at desc);

create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (university_id, actor_user, table_name, row_id, action, before, after)
  values (
    coalesce((to_jsonb(new) ->> 'university_id')::uuid, (to_jsonb(old) ->> 'university_id')::uuid, (to_jsonb(new) ->> 'id')::uuid),
    auth.uid(), tg_table_name,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid, (to_jsonb(new) ->> 'campus_id')::uuid),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['universities','campuses','campus_rules','gates','staff','shifts','people',
                           'expected_visits','cases','visits','family_visits'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function private.audit()', t);
  end loop;
end $$;

-- ---------- who is calling? (used by every policy) ----------
create or replace function private.me() returns public.staff
language sql stable security definer set search_path = '' as $$
  select s.* from public.staff s where s.user_id = (select auth.uid()) and s.active limit 1
$$;
create or replace function private.my_university() returns uuid
language sql stable security definer set search_path = '' as $$ select (private.me()).university_id $$;
create or replace function private.my_role() returns public.staff_role
language sql stable security definer set search_path = '' as $$ select (private.me()).role $$;
create or replace function private.my_gate() returns uuid
language sql stable security definer set search_path = '' as $$ select (private.me()).gate_id $$;
grant usage on schema private to authenticated;
grant execute on function private.me(), private.my_university(), private.my_role(), private.my_gate() to authenticated;

-- ---------- link a new sign-in to its invited staff row ----------
create or replace function private.link_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.staff set user_id = new.id
   where user_id is null and email is not null and lower(email) = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.link_staff();

-- Is this email allowed to request a sign-in code? (admins and gate devices only)
create or replace function public.can_sign_in(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff
                 where lower(email) = lower(btrim(p_email)) and active and role in ('admin','gate'))
$$;
revoke all on function public.can_sign_in(text) from public;
grant execute on function public.can_sign_in(text) to anon, authenticated;

-- The signed-in person's profile for the app shell
create or replace function public.my_profile() returns table (
  staff_id uuid, name text, role public.staff_role, university_id uuid, university_name text,
  gate_id uuid, gate_name text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.role, s.university_id, u.name, s.gate_id, g.name
    from public.staff s join public.universities u on u.id = s.university_id
    left join public.gates g on g.id = s.gate_id
   where s.user_id = (select auth.uid()) and s.active
$$;
revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

-- ---------- row-level security ----------
alter table public.universities    enable row level security;
alter table public.campuses        enable row level security;
alter table public.campus_rules    enable row level security;
alter table public.gates           enable row level security;
alter table public.staff           enable row level security;
alter table public.shifts          enable row level security;
alter table public.people          enable row level security;
alter table public.expected_visits enable row level security;
alter table public.cases           enable row level security;
alter table public.visits          enable row level security;
alter table public.family_visits   enable row level security;
alter table public.audit_events    enable row level security;

-- Nothing is readable without signing in.
revoke all on all tables in schema public from anon;

-- read: same university
create policy uni_read on public.universities  for select to authenticated using (id = private.my_university());
create policy uni_read on public.campuses      for select to authenticated using (university_id = private.my_university());
create policy uni_read on public.campus_rules  for select to authenticated using (university_id = private.my_university());
create policy uni_read on public.gates         for select to authenticated using (university_id = private.my_university());
create policy uni_read on public.staff         for select to authenticated using (university_id = private.my_university());
create policy uni_read on public.people        for select to authenticated using (university_id = private.my_university());
create policy uni_read on public.expected_visits for select to authenticated using (university_id = private.my_university());

-- gate devices see their own gate's activity; admins see everything in the university
create policy gate_or_admin_read on public.cases for select to authenticated
  using (university_id = private.my_university() and (private.my_role() = 'admin' or gate_id = private.my_gate()));
create policy gate_or_admin_read on public.visits for select to authenticated
  using (university_id = private.my_university() and (private.my_role() = 'admin' or gate_id = private.my_gate()));
create policy gate_or_admin_read on public.family_visits for select to authenticated
  using (university_id = private.my_university() and (private.my_role() = 'admin' or gate_id = private.my_gate()));
create policy gate_or_admin_read on public.shifts for select to authenticated
  using (university_id = private.my_university() and (private.my_role() = 'admin' or gate_id = private.my_gate()));
create policy admin_read on public.audit_events for select to authenticated
  using (university_id = private.my_university() and private.my_role() = 'admin');

-- admin writes: records, rules, staff
create policy admin_write on public.people for all to authenticated
  using (university_id = private.my_university() and private.my_role() = 'admin')
  with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_write on public.expected_visits for all to authenticated
  using (university_id = private.my_university() and private.my_role() = 'admin')
  with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_write on public.staff for all to authenticated
  using (university_id = private.my_university() and private.my_role() = 'admin')
  with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_update on public.campus_rules for update to authenticated
  using (university_id = private.my_university() and private.my_role() = 'admin')
  with check (university_id = private.my_university() and private.my_role() = 'admin');

-- gate writes: entries at its own gate
create policy gate_insert on public.visits for insert to authenticated
  with check (university_id = private.my_university() and private.my_role() = 'gate' and gate_id = private.my_gate());
create policy gate_update on public.visits for update to authenticated
  using (university_id = private.my_university() and private.my_role() = 'gate' and gate_id = private.my_gate())
  with check (university_id = private.my_university() and gate_id = private.my_gate());
create policy gate_insert on public.family_visits for insert to authenticated
  with check (university_id = private.my_university() and private.my_role() = 'gate' and gate_id = private.my_gate());
create policy gate_update on public.family_visits for update to authenticated
  using (university_id = private.my_university() and private.my_role() = 'gate' and gate_id = private.my_gate())
  with check (university_id = private.my_university() and gate_id = private.my_gate());
create policy gate_insert on public.cases for insert to authenticated
  with check (university_id = private.my_university() and private.my_role() = 'gate'
              and gate_id = private.my_gate() and status = 'admin' and decided_at is null);
create policy gate_insert on public.shifts for insert to authenticated
  with check (university_id = private.my_university() and private.my_role() = 'gate'
              and gate_id = private.my_gate() and device_id = (private.me()).id);
create policy gate_update on public.shifts for update to authenticated
  using (private.my_role() = 'gate' and device_id = (private.me()).id)
  with check (device_id = (private.me()).id);
-- No update policy on cases: decisions go through public.decide_case() (first decision wins).
-- No insert/update/delete policy on audit_events: only the trigger writes it.

-- the audit log can never be edited, by anyone using the API
revoke insert, update, delete, truncate on public.audit_events from authenticated, anon;

-- ---------- decide a held case: first decision wins (D9) ----------
create or replace function public.decide_case(p_case uuid, p_approve boolean, p_note text default null)
returns public.cases
language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.me(); c public.cases;
begin
  if me.id is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into c from public.cases where id = p_case and university_id = me.university_id for update;
  if not found then raise exception 'case not found' using errcode = 'P0002'; end if;
  if c.status not in ('admin','host') then
    return c;                                            -- already decided: caller shows who decided
  end if;
  if me.role = 'gate' and (c.status <> 'host' or c.gate_id <> me.gate_id) then
    raise exception 'the guard decides only after the case passes to the host' using errcode = '42501';
  end if;
  if me.role not in ('admin','gate') then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_approve and nullif(btrim(p_note), '') is null then
    raise exception 'a reason is required to deny' using errcode = '23514';
  end if;
  update public.cases
     set status = case when p_approve then 'approved'::public.case_status else 'denied'::public.case_status end,
         decided_at = now(), decided_by = me.id, note = nullif(btrim(p_note), '')
   where id = p_case
  returning * into c;
  return c;
end $$;
revoke all on function public.decide_case(uuid, boolean, text) from public;
grant execute on function public.decide_case(uuid, boolean, text) to authenticated;
