# Worker

Placeholder for the Cloudflare Worker backend.

## Intended Responsibilities

- Serve as the only API layer between GPT Actions, the dashboard, and Supabase.
- Authenticate requests.
- Validate payloads.
- Read and write Supabase data.
- Return GPT-friendly and dashboard-friendly response shapes.
- Log API activity and latency.

## Planned Endpoints

- `GET /me`
- `GET /dashboard`
- `POST /food-entry`
- `PATCH /food-entry/{id}`
- `DELETE /food-entry/{id}`
- `POST /weight-entry`

## Not Yet Implemented

- Worker runtime setup
- `wrangler` configuration
- Route handlers
- Supabase client
- Auth verification
- Validation schemas
- Tests
