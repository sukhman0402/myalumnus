-- Sample data only: each day, the fictional "Sample University" gets the same four expected visitors as the
-- prototype (Expected today needs someone to show until the admin Visitors screen exists in slice 4).
-- Remove this job before any real university's data is loaded.
create or replace function private.sample_expected_today() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid; d date;
begin
  select id into u from public.universities where name = 'Sample University';
  if u is null then return; end if;
  d := (now() at time zone 'Asia/Kolkata')::date;
  if exists (select 1 from public.expected_visits e where e.university_id = u
               and (e.expected_at at time zone 'Asia/Kolkata')::date = d) then return; end if;
  insert into public.expected_visits (university_id, person_id, expected_at, purpose, host_name, host_phone)
  select u, p.id, ((d + v.t) at time zone 'Asia/Kolkata'), v.purpose, v.host, v.phone
    from (values ('Dr. Anjali Mehta', time '10:30', 'Research meeting', 'Prof. S. Rao', '+91 98765 43201'),
                 ('Rahul Verma', time '11:30', 'Meeting Prof. S. Rao, Mechanical', 'Prof. S. Rao', '+91 98765 43201'),
                 ('Kiran Desai', time '14:00', 'Campus interviews', 'Placement Cell', '+91 98765 43202'),
                 ('Farah Siddiqui', time '15:30', 'Thesis review', 'Dr. K. Menon', '+91 98765 43203')) as v(name, t, purpose, host, phone)
    join public.people p on p.university_id = u and p.full_name = v.name;
end $$;
revoke all on function private.sample_expected_today() from public, anon, authenticated;
select cron.schedule('ma-sample-expected', '35 18 * * *', 'select private.sample_expected_today()'); -- 00:05 IST daily
select private.sample_expected_today();
