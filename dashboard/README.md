# Dashboard

Placeholder for the mobile-first dashboard web app.

The future public app hostname is `https://app.calorie-track.com`.

Until the dashboard UI is implemented, Cloudflare Pages Functions in this folder proxy:

- `/oauth/*` to the existing Worker OAuth endpoints
- `/api/*` to the existing Worker API endpoints

Set the Pages environment variable `BACKEND_API_ORIGIN` to `https://api.calorie-track.com` unless the backend origin changes.

## Intended Responsibilities

- Show today's calories and macros.
- Show recent trends.
- Show weight history.
- Show recent entries.
- Support edit and delete flows for logged entries.

## Product Boundary

The dashboard is for review and correction. ChatGPT remains the primary logging interface for MVP.

## Not Yet Implemented

- App framework setup
- Supabase login flow
- Dashboard API client
- Mobile-first screens
- Edit and delete forms
- Tests
