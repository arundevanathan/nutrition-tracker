# Nutrition Tracker

The easiest calorie tracker ever - native to ChatGPT, backed by a database and dashboard.

This repository contains the public-alpha foundation for a nutrition tracker where ChatGPT is the primary logging interface, Cloudflare Worker is the API boundary, Supabase is the system of record, and the dashboard is a mobile-first review surface.

## Product Direction

Users should be able to log meals and weight naturally in ChatGPT, then review structured history, trends, and summaries in a dedicated dashboard.

The MVP keeps the product intentionally small:

- One user has one nutrition profile.
- Google login is handled through Supabase Auth.
- The Custom GPT uses GPT Actions to call the Cloudflare Worker.
- The GPT never talks directly to Supabase.
- The dashboard is for review, edits, and trends, not primary logging.

## Repository Structure

```text
.
├── docs/
│   ├── PROJECT_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   └── GPT.md
├── worker/
│   └── README.md
├── dashboard/
│   └── README.md
├── .gitignore
└── README.md
```

## Planned Stack

- Primary interface: Custom GPT with GPT Actions
- Backend: Cloudflare Worker
- Database: Supabase
- Auth: Google login via Supabase
- Dashboard: mobile-first web app

## Current Status

Initial repository scaffold only. Full implementation, package setup, deployment config, database migrations, OpenAPI schemas, and UI code are intentionally deferred.

## Docs

- [Project Plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Custom GPT](docs/GPT.md)
