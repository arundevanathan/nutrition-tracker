# Worker

Cloudflare Worker API for the nutrition tracker.

## Current Scope

This folder currently implements only the minimum Custom GPT OAuth proof of concept:

- `GET /health`
- `GET /oauth/authorize`
- `GET /oauth/supabase/callback`
- `POST /oauth/token`
- `GET /me`

It does not implement dashboard routes, nutrition logging, food APIs, or weight APIs yet.

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

- Nutrition logging routes
- Dashboard aggregation routes
- Food and weight APIs
- Production OAuth hardening
- Tests
