-- Applied 2026-10-02 as migration 0003a_revoke_anon_rpc (security advisor fix)
-- 1) Only signed-in users may call these. can_sign_in stays callable before sign-in on purpose:
--    the sign-in page asks it whether an email may receive a code.
revoke execute on function public.decide_case(uuid, boolean, text) from anon;
revoke execute on function public.my_profile() from anon;

