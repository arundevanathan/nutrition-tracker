# Supabase Migration Deployment

This repository deploys Supabase schema changes from migration files in `supabase/migrations`.

GitHub Actions should be used only after the remote Supabase migration history matches the migrations that were already run manually in the SQL Editor.

## How Deployment Works

The workflow at `.github/workflows/supabase-deploy.yml` runs on pushes to `main`, but only when files under `supabase/migrations/**` change.

It does the following:

1. Checks out the repository.
2. Installs the Supabase CLI using `supabase/setup-cli`.
3. Links the project using `SUPABASE_PROJECT_REF`.
4. Applies only pending remote migrations with:

```bash
supabase migration up --linked
```

It does not run `db reset`, and it does not manually replay SQL outside the Supabase migration system.

## Required GitHub Secrets

Add these repository secrets before enabling deployment:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Do not commit these values to the repository.

## One-Time Repair Before First GitHub Deployment

Some existing migrations were already run manually in the Supabase SQL Editor. Those migrations must be marked as applied in Supabase migration history before GitHub Actions deploys future migrations.

Use this command format:

```bash
supabase migration repair --linked --status applied <migration_version>
```

Only run repair for migrations that were already manually applied in the Supabase SQL Editor. Do not repair a migration that has not actually been applied to the database.

## Migration Versions In This Repo

Migration versions come from the filename prefix before the first underscore.

Current migration files:

- `001_initial_schema.sql` -> `001`
- `002_oauth_poc.sql` -> `002`
- `003_oauth_service_role_grants.sql` -> `003`
- `004_oauth_login_state_response_type.sql` -> `004`

If all four were already manually applied, run:

```bash
supabase migration repair --linked --status applied 001
supabase migration repair --linked --status applied 002
supabase migration repair --linked --status applied 003
supabase migration repair --linked --status applied 004
```

If only some were manually applied, run only the matching commands.

## Verify Migration State

Before pushing a new migration, verify the linked project state:

```bash
supabase migration list --linked
```

The remote migration history should show manually applied migrations as applied. This prevents GitHub Actions from trying to apply SQL that is already present in the database.

## Creating New Migrations

From now on, make schema changes only through migration files. Do not make manual SQL Editor schema changes except for emergency repair work that is also captured in a migration.

Create a new migration with:

```bash
supabase migration new add_food_entries
```

Then edit the generated SQL file under `supabase/migrations`.

## Deployment After Push

After migration history has been repaired, future deployment is simple:

1. Create a new migration file.
2. Commit it.
3. Push to `main`.
4. GitHub Actions runs `supabase migration up --linked`.
5. Supabase applies only migrations that are pending on the linked remote project.

Do not push a new migration until the existing manually applied migrations have been repaired in Supabase migration history.
