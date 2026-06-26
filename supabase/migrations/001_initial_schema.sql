-- Initial public-alpha Supabase schema.
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

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  calorie_target integer not null default 2000 check (calorie_target > 0),
  protein_target_g numeric(8, 2) not null default 120 check (protein_target_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  consumption_date date not null,
  consumption_time time,
  meal_type text check (
    meal_type is null
    or meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'drink', 'other')
  ),
  entry_type text not null default 'Core' check (entry_type in ('Core', 'Junk', 'Alcohol', 'Eating Out')),
  description text not null check (length(trim(description)) > 0),
  calories integer not null check (calories >= 0),
  protein_g numeric(8, 2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(8, 2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(8, 2) not null default 0 check (fat_g >= 0),
  confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  source text not null default 'gpt' check (source in ('gpt', 'dashboard', 'import', 'system')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(8, 2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(8, 2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(8, 2) not null default 0 check (fat_g >= 0),
  junk_calories integer not null default 0 check (junk_calories >= 0),
  alcohol_calories integer not null default 0 check (alcohol_calories >= 0),
  eating_out_calories integer not null default 0 check (eating_out_calories >= 0),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  entries_count integer not null default 0 check (entries_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.api_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
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
  user_id uuid references public.users(id) on delete set null,
  email text,
  code text not null unique,
  status text not null default 'available' check (status in ('available', 'reserved', 'used', 'revoked')),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'used' and used_at is not null and user_id is not null)
    or (status <> 'used')
  )
);

create index users_email_idx on public.users(email);

create index food_entries_user_consumption_date_idx on public.food_entries(user_id, consumption_date);
create index food_entries_user_logged_at_idx on public.food_entries(user_id, logged_at desc);

create index weight_entries_user_date_idx on public.weight_entries(user_id, date);

create index daily_summaries_user_date_idx on public.daily_summaries(user_id, date);

create index api_logs_user_created_at_idx on public.api_logs(user_id, created_at);

create index invite_codes_user_id_idx on public.invite_codes(user_id);
create index invite_codes_email_idx on public.invite_codes(email);
create index invite_codes_status_idx on public.invite_codes(status);

create trigger set_users_updated_at
before update on public.users
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

create trigger set_invite_codes_updated_at
before update on public.invite_codes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    display_name,
    timezone,
    calorie_target,
    protein_target_g
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'Asia/Kolkata',
    2000,
    120
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.users.display_name, excluded.display_name),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.api_logs enable row level security;
alter table public.invite_codes enable row level security;

create policy "Users can read their own user row"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own user row"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

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
