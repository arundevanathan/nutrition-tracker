-- Service-role-only grants for OAuth proof-of-concept tables.
-- Required when Supabase Data API table exposure is restricted.

grant usage on schema public to service_role;

grant select, insert, update on table public.oauth_login_states to service_role;
grant select, insert, update on table public.oauth_codes to service_role;
grant select, insert, update on table public.oauth_tokens to service_role;

-- These OAuth tables do not use sequences. IDs are text or gen_random_uuid().
