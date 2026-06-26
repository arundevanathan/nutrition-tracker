# Supabase

This folder contains the database foundation for the public-alpha MVP.

## Migration

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor for the target project.

Manual steps:

1. Open the Supabase project.
2. Go to SQL Editor.
3. Paste the full contents of `supabase/migrations/001_initial_schema.sql`.
4. Run the script.
5. Confirm the tables and RLS policies were created.

The script is intended for a new project. If it is run against an existing project, review existing tables, functions, triggers, and policies first.

## Tables Created

- `public.users`
- `public.food_entries`
- `public.weight_entries`
- `public.daily_summaries`
- `public.api_logs`
- `public.invite_codes`

## Auth User Trigger

The migration adds a trigger on `auth.users`.

When a new Supabase auth user is created, the trigger inserts a matching row in `public.users` with:

- Supabase auth user id
- Email
- Display name when available from auth metadata
- Default timezone of `UTC`
- Default calorie target of `2000`
- Default protein target of `120`

## Row Level Security

RLS is enabled on all MVP tables.

Authenticated users can only access records tied to their own `auth.uid()`. The public application tables are scoped through `user_id`, while `public.users.id` directly references `auth.users(id)`.

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
