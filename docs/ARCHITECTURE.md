# Architecture

## Overview

The public alpha uses ChatGPT as the primary user interface and a conventional backend stack for persistence, auth, and analytics.

```text
Custom GPT
  -> GPT Actions
  -> Cloudflare Worker
  -> Supabase
  -> Dashboard
```

The Custom GPT never connects directly to Supabase. All reads and writes go through the Cloudflare Worker so authentication, validation, logging, and response shaping stay centralized.

## Components

### Custom GPT

The Custom GPT is the user's primary nutrition interface. It should support natural language meal logging, weight logging, lightweight coaching, and concise summaries.

### GPT Actions

GPT Actions expose the product API to the Custom GPT through an OpenAPI schema. The schema is not implemented yet and should be added once endpoint contracts stabilize.

### Cloudflare Worker

The Worker is the only backend API layer. It will:

- Verify authenticated requests.
- Validate payloads from GPT Actions and the dashboard.
- Read and write Supabase records.
- Shape GPT-friendly responses.
- Produce dashboard aggregates.
- Log API activity for debugging and product metrics.

### Supabase

Supabase provides Google auth, Postgres storage, Row Level Security, and product data.

### Dashboard

The dashboard is a mobile-first web app for review and correction. It should make nutrition history easy to scan, but it should not compete with ChatGPT as the primary logging surface.

## MVP Boundaries

- One authenticated user maps to one profile.
- Google login is the only auth method.
- Food and weight logging are the primary write paths.
- Dashboard views prioritize today, last 7 days, weight, and recent entries.
- Analytics and coaching should rely on stored data, not hidden chat memory.

## Future Architecture Assets

Add these when implementation begins:

- `openapi/` for GPT Action schemas.
- `prompts/` for Custom GPT instructions and examples.
- Supabase migration files.
- Worker deployment configuration.
- Dashboard application configuration.
