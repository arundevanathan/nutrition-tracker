# Architecture Decisions

This log captures product and architecture decisions for the public-alpha nutrition tracker.

## ADR 001: Use Supabase Instead Of Airtable For Public Alpha

Decision: Use Supabase for public-alpha auth, Postgres storage, Row Level Security, and database-backed dashboard queries.

Rationale: The public product needs user auth, user-scoped data, relational constraints, and a path toward production infrastructure. Airtable remains outside this public-alpha product.

## ADR 002: Use Cloudflare Worker As The Only Backend API Layer

Decision: Route GPT Actions and dashboard requests through a Cloudflare Worker.

Rationale: The GPT and dashboard should not talk directly to Supabase. A single API layer keeps authentication, validation, logging, and response shaping centralized.

## ADR 003: Use One User Equals One Profile For MVP

Decision: Treat one authenticated Supabase user as one tracked nutrition profile.

Rationale: The MVP should avoid account, household, and profile-switching complexity until the core logging behavior is validated.

## ADR 004: Use ChatGPT As Primary Interface And Dashboard As Review Surface

Decision: Keep ChatGPT as the main logging and coaching interface. Keep the dashboard focused on review, history, trends, edits, and deletes.

Rationale: Conversation is the product. The dashboard should support trust and visibility without becoming the main data-entry surface.

## ADR 005: Defer Multi-Profile And Family Support

Decision: Do not build multi-profile, family, or household support for the public-alpha MVP.

Rationale: These features add data-model and UI complexity before there is enough usage evidence to justify them.

## ADR 006: Defer WHOOP And Workout Integrations

Decision: Do not build WHOOP, workout, or wearable integrations in the public-alpha MVP.

Rationale: The first validation target is low-friction meal and weight logging. Integrations can be revisited after retention and user behavior are clearer.
