# Worker

Cloudflare Worker API for the nutrition tracker.

## Current Scope

This folder implements the Custom GPT OAuth flow and the MVP nutrition API surface:

- `GET /health`
- `GET /oauth/authorize`
- `GET /oauth/supabase/callback`
- `POST /oauth/token`
- `GET /api/me`
- `GET /api/dashboard`
- `POST /api/food-entry`
- `PATCH /api/food-entry/{id}`
- `DELETE /api/food-entry/{id}`
- `POST /api/weight-entry`
- `PATCH /api/weight-entry/{id}`
- `DELETE /api/weight-entry/{id}`
- `POST /api/delete-all-data`

The Worker also accepts the older top-level product paths without `/api` during the domain transition.

## Intended Responsibilities

- Serve as the only API layer between GPT Actions, the dashboard, and Supabase.
- Authenticate requests.
- Validate payloads.
- Read and write Supabase data through server-side credentials where appropriate.
- Return GPT-friendly and dashboard-friendly response shapes.
- Log API activity and latency.

## Local Development

Install dependencies from this folder, then run:

```bash
npm run dev
```

Required configuration is documented in `../docs/OAUTH.md` and `../.env.example`.

## Not Yet Implemented

- Production OAuth hardening
- Dedicated automated route tests
