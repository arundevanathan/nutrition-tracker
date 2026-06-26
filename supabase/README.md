# Supabase

This folder contains the database foundation for the public-alpha MVP.

## Migration

Run migrations in the Supabase SQL Editor for the target project.

Manual steps:

1. Open the Supabase project.
2. Go to SQL Editor.
3. Paste and run the full contents of `supabase/migrations/001_initial_schema.sql`.
4. Paste and run the full contents of `supabase/migrations/002_oauth_poc.sql`.
5. Paste and run the full contents of `supabase/migrations/003_oauth_service_role_grants.sql`.
6. Paste and run the full contents of `supabase/migrations/004_oauth_login_state_response_type.sql`.
7. Confirm the tables, RLS policies, and service-role grants were created.

The scripts are intended for a new project. If they are run against an existing project, review existing tables, functions, triggers, and policies first.

## Tables Created

- `public.users`
- `public.food_entries`
- `public.weight_entries`
- `public.daily_summaries`
- `public.api_logs`
- `public.invite_codes`
- `public.oauth_login_states`
- `public.oauth_codes`
- `public.oauth_tokens`

## Auth User Trigger

The migration adds a trigger on `auth.users`.

When a new Supabase auth user is created, the trigger inserts a matching row in `public.users` with:

- Supabase auth user id
- Email
- Display name when available from auth metadata
- Default timezone of `Asia/Kolkata`
- Default calorie target of `2000`
- Default protein target of `120`

## Row Level Security

RLS is enabled on all MVP tables.

Authenticated users can only access records tied to their own `auth.uid()`. The public application tables are scoped through `user_id`, while `public.users.id` directly references `auth.users(id)`.

Daily summaries are system-maintained by the API/Worker using service-role access. Authenticated users can read their own daily summaries, but they cannot insert, update, or delete them directly.

Invite codes are not directly exposed to authenticated users yet. RLS is enabled on `public.invite_codes`, but no authenticated user read or update policies are created for that table.

OAuth proof-of-concept tables are internal to the Worker. RLS is enabled on `public.oauth_login_states`, `public.oauth_codes`, and `public.oauth_tokens`, but no authenticated user policies are created for those tables.

When Supabase Data API table exposure is restricted, run `supabase/migrations/003_oauth_service_role_grants.sql` so only the `service_role` used by the Worker can access OAuth internals. This migration does not grant `anon` or `authenticated` access to OAuth tables.

Food entries require a non-negative `calories` value. Macro fields are required, non-negative, and default to `0`.

Future Worker server-side operations may use trusted Supabase service credentials where administrative access is required. Those credentials must never be exposed to the dashboard or Custom GPT.

## Seed Data

`supabase/seed.sql` contains commented-out sample inserts only. It does not include real user data.

## Environment Variables Needed Later

These are not needed to run the SQL migration, but the Worker and dashboard will need them later:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

Do not commit real secrets to this repository.
