-- Preserve the original ChatGPT OAuth response_type across Supabase login.

alter table public.oauth_login_states
add column if not exists response_type text not null default 'code';
