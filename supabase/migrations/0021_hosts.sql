-- 0021 · Hosts list (owner, 2026-10-08). Additive: one new table and its sample rows. No function replaced, no DROP/DELETE.
--
-- Add visitor used to take the host's name and phone as free text. Now the admin picks a host from a list and the
-- phone comes with it. The list lives in the database only (owner: "a list that admin adds once, and remains in the
-- backend"): no screen in the console; people are added or removed by hand in the Supabase table editor
-- (active = false hides someone without deleting them). Expected visits still store the host's name and phone as
-- text, copied when the visit is added, so editing the list never rewrites past visits.
-- Reads: admins only, through row-level security. Console writes: none (no grants). Every change is still logged.

create table if not exists public.hosts (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  department    text check (department is null or char_length(department) <= 120),
  phone         text check (phone is null or phone ~ '^[+0-9 ()-]{7,24}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists hosts_university on public.hosts (university_id, name) where active;

alter table public.hosts enable row level security;
revoke all on public.hosts from anon, authenticated;
grant select on public.hosts to authenticated;
create policy admin_read on public.hosts for select to authenticated
  using (university_id = private.my_university() and (private.me()).role = 'admin');

create trigger audit_hosts after insert or update or delete on public.hosts
  for each row execute function private.audit();

-- Sample faculty for the demo university (made-up names and numbers, like the rest of the sample data).
insert into public.hosts (university_id, name, department, phone)
select u.id, h.name, h.dept, h.phone
  from public.universities u
  cross join (values
    ('Prof. S. Rao', 'Mechanical Engineering', '+91 98765 43210'),
    ('Dr. Meera Iyer', 'Computer Science', '+91 98765 43220'),
    ('Prof. Arvind Kulkarni', 'Physics', '+91 98765 43230'),
    ('Dr. Nandita Sen', 'Design', '+91 98765 43240'),
    ('Ms. Ritu Bansal', 'Placement Cell', '+91 98765 43250'),
    ('Mr. Karan Malhotra', 'Alumni Relations Office', '+91 98765 43260')
  ) as h(name, dept, phone)
 where u.name = 'Sample University'
   and not exists (select 1 from public.hosts x where x.university_id = u.id);
