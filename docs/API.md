# API

## API Boundary

The Cloudflare Worker is the only backend API layer. Both GPT Actions and the dashboard should call the Worker, not Supabase directly.

## Authentication

MVP auth is Google login via Supabase.

Implementation details are still open, but the Worker should verify authenticated requests before reading or writing user data.

## Minimum API Surface

### `GET /me`

Returns the authenticated user's profile and basic setup state.

### `GET /dashboard`

Returns dashboard-ready summary data.

Expected content:

- Today totals
- Remaining calories and protein where targets exist
- Last 7 days averages
- Recent food entries
- Recent weight entries
- Dashboard metadata

### `POST /food-entry`

Creates a food entry from GPT or dashboard input.

### `PATCH /food-entry/{id}`

Updates a food entry owned by the authenticated user.

### `DELETE /food-entry/{id}`

Deletes a food entry owned by the authenticated user.

### `POST /weight-entry`

Creates a weight entry.

## Response Shape Principles

- GPT responses should be concise and easy to summarize in chat.
- Dashboard responses should be structured for direct rendering.
- Raw JSON should not be shown to users in ChatGPT unless they explicitly ask for it.
- Errors should be clear enough for the GPT to explain and recover.

## Validation Principles

- Validate all request payloads at the Worker boundary.
- Treat GPT-generated nutrition estimates as user data with confidence metadata.
- Keep timestamps timezone-aware.
- Never trust client-supplied profile ownership.

## Not Yet Implemented

- OpenAPI schema
- Request and response DTOs
- Worker route handlers
- Auth middleware
- Error format
- Rate limiting
