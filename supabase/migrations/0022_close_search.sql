-- 0022 · Close spellings in the guard's search (Iteration 3, finding F1; owner 2026-10-08: ship it).
-- The function already exists on live: it was added on 2026-10-05 as evaluation evidence (0016, kept off the app).
-- This file records it in the repo, unchanged from live, so a fresh database gets it too. Idempotent; no DROP/DELETE.
-- When the exact search (gate_search) finds nobody, the app asks this one for up to 5 names whose words are close to
-- what was typed (trigram word similarity >= 0.5: "Kapor" finds Kapoor and Kapur; "Nayar" finds Nair).

create or replace function public.gate_search_close(p_q text)
returns table (id uuid, full_name text, kind public.person_kind, program text, batch_year int, has_photo boolean, expected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.staff := private.me();
  q  text := lower(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')));
  tz text;
begin
  if me.id is null or me.role <> 'gate' then
    raise exception 'only a gate device can search here' using errcode = '42501', hint = 'not_allowed';
  end if;
  if length(q) < 3 then return; end if;
  select u.timezone into tz from public.universities u where u.id = me.university_id;
  return query
    select p.id, p.full_name, p.kind, p.program, p.batch_year, p.photo_path is not null,
           (select min(e.expected_at) from public.expected_visits e
             where e.person_id = p.id and (e.gate_id is null or e.gate_id = me.gate_id)
               and (e.expected_at at time zone tz)::date = (now() at time zone tz)::date)
      from public.people p
     where p.university_id = me.university_id and p.active and p.kind <> 'student'
       and extensions.word_similarity(q, lower(p.full_name)) >= 0.5
     order by extensions.word_similarity(q, lower(p.full_name)) desc, p.full_name, p.batch_year nulls last
     limit 5;
end $$;
revoke all on function public.gate_search_close(text) from public, anon;
grant execute on function public.gate_search_close(text) to authenticated;
