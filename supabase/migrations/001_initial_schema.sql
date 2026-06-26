-- Initial public-alpha schema.
-- MVP identity model: one authenticated Supabase user is one nutrition profile.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  calorie_target integer check (calorie_target is null or calorie_target > 0),
  protein_target integer check (protein_target is null or protein_target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_type text check (
    meal_type is null
    or meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'drink', 'other')
  ),
  description text not null check (length(trim(description)) > 0),
  calories integer check (calories is null or calories >= 0),
  protein_g numeric(8, 2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(8, 2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(8, 2) check (fat_g is null or fat_g >= 0),
  source text not null default 'gpt' check (source in ('gpt', 'dashboard', 'import', 'system')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  raw_gpt_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight numeric(6, 2) not null check (weight > 0),
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(8, 2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(8, 2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(8, 2) not null default 0 check (fat_g >= 0),
  entries_count integer not null default 0 check (entries_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.api_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  route text not null,
  method text not null check (method in ('GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS')),
  status integer not null check (status between 100 and 599),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  request_source text check (
    request_source is null
    or request_source in ('gpt_action', 'dashboard', 'worker', 'system')
  ),
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  email text,
  code text not null unique,
  status text not null default 'available' check (status in ('available', 'reserved', 'used', 'revoked')),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'used' and used_at is not null)
    or (status <> 'used')
  )
);

create index user_settings_user_id_idx on public.user_settings(user_id);

create index food_entries_user_logged_at_idx on public.food_entries(user_id, logged_at desc);
create index food_entries_user_created_at_idx on public.food_entries(user_id, created_at desc);

create index weight_entries_user_logged_at_idx on public.weight_entries(user_id, logged_at desc);

create index daily_summaries_user_date_idx on public.daily_summaries(user_id, date desc);

create index api_logs_user_created_at_idx on public.api_logs(user_id, created_at desc);
create index api_logs_route_created_at_idx on public.api_logs(route, created_at desc);

create index invite_codes_email_idx on public.invite_codes(email);
create index invite_codes_status_idx on public.invite_codes(status);

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create trigger set_food_entries_updated_at
before update on public.food_entries
for each row execute function public.set_updated_at();

create trigger set_weight_entries_updated_at
before update on public.weight_entries
for each row execute function public.set_updated_at();

create trigger set_daily_summaries_updated_at
before update on public.daily_summaries
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.api_logs enable row level security;
alter table public.invite_codes enable row level security;

create policy "Users can read their own settings"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own settings"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own settings"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own settings"
on public.user_settings
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own food entries"
on public.food_entries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own food entries"
on public.food_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own food entries"
on public.food_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own food entries"
on public.food_entries
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own weight entries"
on public.weight_entries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own weight entries"
on public.weight_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own weight entries"
on public.weight_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own weight entries"
on public.weight_entries
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own daily summaries"
on public.daily_summaries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own daily summaries"
on public.daily_summaries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own daily summaries"
on public.daily_summaries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own daily summaries"
on public.daily_summaries
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own API logs"
on public.api_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own API logs"
on public.api_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can read their matching invite codes"
on public.invite_codes
for select
to authenticated
using (
  email is not null
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
