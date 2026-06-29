# One-time data migration - Airtable to Supabase

Generated from Airtable base `Arun's Calorie Tracker`.

## Source tables

- `Detailed Data`: 44 rows total
  - Arun: 35 rows
  - Ishita: 9 rows excluded from Supabase-ready import
- `Daily Summary`: 8 rows total
  - Arun rows with weight values: 2 rows
  - Daily calorie/protein summaries intentionally not imported

## Files

- `supabase_food_entries_arun.csv`
  - Import into `public.food_entries`.
  - Replace `REPLACE_WITH_SUPABASE_USER_ID` with the target `public.users.id` before import.
- `supabase_weight_entries_arun.csv`
  - Import into `public.weight_entries`.
  - Replace `REPLACE_WITH_SUPABASE_USER_ID` with the target `public.users.id` before import.

## Import notes

- Do not import Airtable daily calorie/protein summaries. The Worker computes totals live from entries.
- `source` is set to `import`.
- `confidence` is left blank.
- Airtable record IDs are preserved in `notes` for traceability.
- `meal_type` values are lowercased to match Supabase constraints.

