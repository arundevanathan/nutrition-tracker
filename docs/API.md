# API

## API Boundary

The Cloudflare Worker is the only backend API layer. Both GPT Actions and the dashboard should call the Worker, not Supabase directly.

The public app hostname is `https://app.calorie-track.com`. GPT-facing product endpoints are exposed under `/api/*`; OAuth endpoints stay under `/oauth/*`.

## Authentication

MVP auth is Google login via Supabase.

The Worker accepts two bearer-token forms before reading or writing user data:

- Opaque tokens issued by the Custom GPT OAuth flow.
- Supabase access tokens issued to the dashboard browser session.

Both auth modes resolve to the same server-side `user_id`; request bodies must never supply ownership.

## Minimum API Surface

### `GET /api/me`

Returns the authenticated user's settings and basic setup state.

### `GET /api/dashboard`

Returns dashboard-ready summary data.

Expected content:

- Today totals
- Last 7 days averages
- Recent food entries
- Recent weight entries
- Dashboard metadata

### `GET /api/day?date=YYYY-MM-DD`

Returns one day's totals, food entries, and weight entry for dashboard drilldown.

### `POST /api/food-entry`

Creates a food entry from GPT or dashboard input.

### `PATCH /api/food-entry/{id}`

Updates a food entry owned by the authenticated user.

### `DELETE /api/food-entry/{id}`

Deletes a food entry owned by the authenticated user.

### `POST /api/weight-entry`

Creates a weight entry.

### `PATCH /api/weight-entry/{id}`

Updates a weight entry owned by the authenticated user.

### `DELETE /api/weight-entry/{id}`

Deletes a weight entry owned by the authenticated user.

### `POST /api/delete-all-data`

Deletes all nutrition tracking data owned by the authenticated user after explicit confirmation.

Required body:

```json
{ "confirmation": "DELETE ALL MY DATA" }
```

## Response Shape Principles

- GPT responses should be concise and easy to summarize in chat.
- Dashboard responses should be structured for direct rendering.
- Raw JSON should not be shown to users in ChatGPT unless they explicitly ask for it.
- Errors should be clear enough for the GPT to explain and recover.

## Validation Principles

- Validate all request payloads at the Worker boundary.
- Treat GPT-generated nutrition estimates as user data with confidence metadata.
- Keep timestamps timezone-aware.
- Never trust client-supplied user ownership.

## Not Yet Implemented

- Rate limiting
