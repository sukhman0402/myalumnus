-- NOT YET APPLIED. Performance lint only (multiple permissive SELECT policies).
-- Contains DROP POLICY, which the Supabase connector treats as destructive and holds for confirmation;
-- it timed out twice on 2026-10-02. Apply when the owner can confirm it in the Supabase prompt.

-- 2) One SELECT policy per table: split the admin "for all" policies into insert / update / delete.
drop policy admin_write on public.people;
drop policy admin_write on public.expected_visits;
drop policy admin_write on public.staff;

create policy admin_insert on public.people for insert to authenticated with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_update on public.people for update to authenticated using (university_id = private.my_university() and private.my_role() = 'admin') with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_delete on public.people for delete to authenticated using (university_id = private.my_university() and private.my_role() = 'admin');

create policy admin_insert on public.expected_visits for insert to authenticated with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_update on public.expected_visits for update to authenticated using (university_id = private.my_university() and private.my_role() = 'admin') with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_delete on public.expected_visits for delete to authenticated using (university_id = private.my_university() and private.my_role() = 'admin');

create policy admin_insert on public.staff for insert to authenticated with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_update on public.staff for update to authenticated using (university_id = private.my_university() and private.my_role() = 'admin') with check (university_id = private.my_university() and private.my_role() = 'admin');
create policy admin_delete on public.staff for delete to authenticated using (university_id = private.my_university() and private.my_role() = 'admin');
