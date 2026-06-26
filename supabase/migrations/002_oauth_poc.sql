-- OAuth proof-of-concept storage for Custom GPT account linking.
-- Raw authorization codes and access tokens are never stored.

create table public.oauth_login_states (
  id text primary key,
  client_id text not null,
  redirect_uri text not null,
  state text,
  scope text,
  code_verifier text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  scope text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index oauth_login_states_expires_at_idx on public.oauth_login_states(expires_at);
create index oauth_codes_user_id_idx on public.oauth_codes(user_id);
create index oauth_codes_expires_at_idx on public.oauth_codes(expires_at);
create index oauth_tokens_user_id_idx on public.oauth_tokens(user_id);
create index oauth_tokens_expires_at_idx on public.oauth_tokens(expires_at);

alter table public.oauth_login_states enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;

-- No authenticated user policies are created for OAuth internals.
-- The Cloudflare Worker accesses these tables with the Supabase service role.
