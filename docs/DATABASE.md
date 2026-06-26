# Database

## Database Choice

Supabase is the public-alpha database and auth provider.

The MVP should use Supabase Auth with Google login and Postgres tables protected by Row Level Security.

## MVP Entities

### Profiles

One profile belongs to one authenticated Supabase user.

Likely fields:

- `id`
- `user_id`
- `display_name`
- `timezone`
- `calorie_target`
- `protein_target`
- `created_at`
- `updated_at`

### Food Entries

Stores each logged meal, snack, or drink.

Likely fields:

- `id`
- `profile_id`
- `logged_at`
- `meal_type`
- `description`
- `calories`
- `protein_g`
- `carbs_g`
- `fat_g`
- `source`
- `confidence`
- `raw_gpt_notes`
- `created_at`
- `updated_at`

### Weight Entries

Stores user weight logs.

Likely fields:

- `id`
- `profile_id`
- `logged_at`
- `weight`
- `unit`
- `note`
- `created_at`
- `updated_at`

### Daily Summaries

Stores or materializes daily nutrition totals for faster dashboard and GPT summary responses.

Likely fields:

- `id`
- `profile_id`
- `date`
- `calories`
- `protein_g`
- `carbs_g`
- `fat_g`
- `entries_count`
- `created_at`
- `updated_at`

### API Logs

Tracks API requests for debugging, latency, and product metrics.

Likely fields:

- `id`
- `profile_id`
- `route`
- `method`
- `status`
- `latency_ms`
- `request_source`
- `created_at`

### Invite Codes Or Waitlist

Supports controlled public-alpha access if needed.

Likely fields:

- `id`
- `email`
- `code`
- `status`
- `used_at`
- `created_at`

## Row Level Security

RLS should ensure each authenticated user can access only records tied to their own profile.

Initial policy direction:

- Users can read and update their own profile.
- Users can read, create, update, and delete their own food entries.
- Users can read, create, update, and delete their own weight entries.
- Dashboard aggregates should only include the authenticated user's records.
- Service-role access should be limited to trusted server-side operations.

## Not Yet Implemented

- Supabase project configuration
- SQL migrations
- Seed data
- RLS policies
- Generated types
