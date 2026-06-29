# Supabase Migration Deployment

This repository deploys Supabase schema changes from migration files in `supabase/migrations`.

Deployment uses Supabase's native GitHub integration, not a custom GitHub Actions workflow.

## Current Deployment Model

Supabase is connected directly to:

```text
arundevanathan/nutrition-tracker
```

Production deploys are configured from:

```text
main
```

The Supabase working directory is:

```text
.
```

That is correct because the repository contains the `supabase/` folder at the repo root.

## How Deployment Works

When a migration file is pushed or merged to `main`, Supabase's GitHub integration detects changes under:

```text
supabase/migrations/
```

Supabase then applies pending migrations to the production database.

Do not add a second migration deploy system unless there is a specific reason. Running both Supabase's native integration and a GitHub Actions migration workflow can cause duplicate deploy attempts.

## Migration History

The existing manually-run migrations have been repaired and are visible in Supabase's migration history:

- `001_initial_schema.sql`
- `002_oauth_poc.sql`
- `003_oauth_service_role_grants.sql`
- `004_oauth_login_state_response_type.sql`
- `005_test_supabase_git_integration.sql`

The `005` migration was a safe no-op smoke test confirming Supabase's native GitHub integration can apply migrations from `main`.

## Creating New Migrations

From now on, make schema changes only through migration files. Do not make manual SQL Editor schema changes except for emergency repair work that is also captured in a migration.

Create a new migration with:

```bash
npx supabase migration new add_food_entries
```

Then edit the generated SQL file under:

```text
supabase/migrations/
```

## Deployment After Push

Future deployment flow:

1. Create a new migration file.
2. Edit and review the SQL.
3. Commit the migration.
4. Push or merge to `main`.
5. Supabase's native GitHub integration applies the pending migration.
6. Verify the migration appears in Supabase Database Migrations.

## Verification

You can verify migration state in the Supabase dashboard under Database Migrations.

You can also verify from the local repo:

```bash
npx supabase migration list --linked
```

## What Not To Do

- Do not use the SQL Editor for normal schema changes.
- Do not add a custom GitHub Actions migration deploy workflow while Supabase GitHub integration is active.
- Do not run `db reset` against production.
- Do not manually replay old migration SQL.
