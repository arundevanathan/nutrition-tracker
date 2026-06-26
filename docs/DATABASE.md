# Database

## Database Choice

Supabase is the public-alpha database and auth provider.

The MVP uses Supabase Auth with Google login and Postgres tables protected by Row Level Security.

## MVP Assumption

One authenticated Supabase user is one tracked nutrition profile.

There is no separate multi-profile or family model in the MVP. Every user-owned table uses `user_id` and ultimately ties back to `auth.users.id` through `public.users.id`.

## MVP Schema

### Users

Stores public application settings for the authenticated Supabase user.

- `id` uuid primary key, references `auth.users(id)`
- `email` text
- `display_name` text
- `timezone` text, default `Asia/Kolkata`
- `calorie_target` integer, default target for daily calories
- `protein_target_g` numeric, default target for daily protein grams
- `created_at` timestamptz
- `updated_at` timestamptz

### Food Entries

Stores each logged meal, snack, drink, alcohol entry, or eating-out entry.

- `id` uuid primary key
- `user_id` uuid, references `public.users(id)`
- `logged_at` timestamptz, when the entry was recorded
- `consumption_date` date, the local date the food was consumed
- `consumption_time` time, optional local time the food was consumed
- `meal_type` text, optional meal bucket
- `entry_type` text, one of `Core`, `Junk`, `Alcohol`, `Eating Out`
- `description` text
- `calories` integer, required and non-negative
- `protein_g` numeric, required, defaults to `0`, non-negative
- `carbs_g` numeric, required, defaults to `0`, non-negative
- `fat_g` numeric, required, defaults to `0`, non-negative
- `confidence` text, one of `high`, `medium`, `low`
- `source` text
- `notes` text
- `created_at` timestamptz
- `updated_at` timestamptz

### Weight Entries

Stores one weight entry per user per date.

- `id` uuid primary key
- `user_id` uuid, references `public.users(id)`
- `date` date
- `weight_kg` numeric
- `note` text
- `created_at` timestamptz
- `updated_at` timestamptz

### Daily Summaries

Stores one system-maintained dashboard summary row per user per date.

- `id` uuid primary key
- `user_id` uuid, references `public.users(id)`
- `date` date
- `calories` integer
- `protein_g` numeric
- `carbs_g` numeric
- `fat_g` numeric
- `junk_calories` integer
- `alcohol_calories` integer
- `eating_out_calories` integer
- `weight_kg` numeric, optional latest weight for the date
- `entries_count` integer
- `created_at` timestamptz
- `updated_at` timestamptz

### API Logs

Tracks API requests for debugging, latency, and product metrics.

- `id` uuid primary key
- `user_id` uuid, references `public.users(id)`
- `route` text
- `method` text
- `status` integer
- `latency_ms` integer
- `request_source` text
- `created_at` timestamptz

### Invite Codes

Supports controlled public-alpha access if needed.

Invite codes are not directly exposed to authenticated users in the MVP. Access will be handled later through the API/Worker using trusted service-role operations.

- `id` uuid primary key
- `user_id` uuid, optional reference to `public.users(id)` when claimed
- `email` text
- `code` text
- `status` text
- `used_at` timestamptz
- `created_at` timestamptz
- `updated_at` timestamptz

### OAuth Login States

Stores short-lived PKCE login state for the Custom GPT OAuth proof of concept.

- `id` text primary key
- `client_id` text
- `redirect_uri` text
- `state` text
- `scope` text
- `code_verifier` text
- `expires_at` timestamptz
- `used_at` timestamptz
- `created_at` timestamptz

### OAuth Codes

Stores short-lived authorization codes for the Custom GPT OAuth proof of concept. Raw codes are never stored.

- `id` uuid primary key
- `code_hash` text
- `user_id` uuid, references `public.users(id)`
- `client_id` text
- `redirect_uri` text
- `scope` text
- `expires_at` timestamptz
- `used_at` timestamptz
- `created_at` timestamptz

### OAuth Tokens

Stores access tokens for the Custom GPT OAuth proof of concept. Raw tokens are never stored.

- `id` uuid primary key
- `token_hash` text
- `user_id` uuid, references `public.users(id)`
- `scope` text
- `expires_at` timestamptz
- `revoked_at` timestamptz
- `created_at` timestamptz

## Row Level Security

RLS is enabled on all MVP tables.

Authenticated users can only access rows tied to their own `auth.uid()`:

- Users can read and update their own `public.users` row.
- Users can read, create, update, and delete their own food entries.
- Users can read, create, update, and delete their own weight entries.
- Users can read their own daily summaries.
- Users can read and create their own API logs.
- Daily summaries are system-maintained by the API/Worker using service-role access.
- Invite codes have RLS enabled but no authenticated user policies yet.
- OAuth internal tables have RLS enabled but no authenticated user policies.

The Worker can later use trusted server-side credentials for administrative operations that should bypass user RLS.

## Migration

Initial schema lives in `supabase/migrations/001_initial_schema.sql`.

OAuth proof-of-concept storage lives in `supabase/migrations/002_oauth_poc.sql`.

## Not Yet Implemented

- Supabase project configuration
- Generated database types
- Worker data access code
