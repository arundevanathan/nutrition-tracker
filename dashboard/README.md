# Dashboard

Mobile-first dashboard web app for reviewing and correcting nutrition logs.

The future public app hostname is `https://app.calorie-track.com`.

Cloudflare Pages Functions in this folder proxy:

- `/oauth/*` to the existing Worker OAuth endpoints
- `/api/*` to the existing Worker API endpoints

Set the Pages environment variable `BACKEND_API_ORIGIN` to `https://api.calorie-track.com` unless the backend origin changes.

## Cloudflare Pages Build Settings

- Framework preset: `Vite`
- Root directory: `dashboard`
- Build command: `npm run build`
- Build output directory: `dist`

Required Pages environment variables:

- `BACKEND_API_ORIGIN=https://api.calorie-track.com`
- `VITE_SUPABASE_URL=<your Supabase URL>`
- `VITE_SUPABASE_ANON_KEY=<your Supabase anon key>`
- `VITE_WORKER_API_URL=/api`

## Intended Responsibilities

- Show today's calories and macros.
- Show recent trends.
- Show weight history.
- Show recent entries.
- Support edit and delete flows for logged entries.

## Product Boundary

The dashboard is for review and correction. ChatGPT remains the primary logging interface for MVP.

## Implemented

- Supabase Google login
- Today, trends, entries, settings, and day drilldown screens
- Food edit/delete and manual add flow
- Weight add/update/delete flow
- Delete-all-data confirmation flow
