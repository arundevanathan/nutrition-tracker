# Project Plan

## Vision

Build the easiest calorie tracker ever.

Users should not have to choose between ChatGPT and a structured nutrition tracker. ChatGPT should handle conversation, estimation, coaching, and low-friction logging, while the database and dashboard provide history, trends, and analytics.

## Public Alpha Goal

Ship a simple public alpha to friends, family, and early public users, then observe real behavior.

Success means learning whether users naturally replace existing calorie tracking apps with a ChatGPT-native workflow.

## Success Criteria

- Acquire first public users.
- Observe real meal and weight logging behavior.
- Measure retention and friction.
- Track whether users keep logging after the first day and first week.
- Identify where the GPT, API, auth, or dashboard feels confusing.

## Locked Technical Decisions

- Separate this public product from any personal tracker.
- Use Supabase for the public alpha database and auth.
- Use Google Sign-In only for MVP.
- Keep one user mapped to one profile.
- Keep ChatGPT as the primary interface.
- Keep the dashboard focused on review, edits, and trends.
- Use a Cloudflare Worker as the only backend API layer.
- Store all product code in this repository.
- Build the dashboard mobile first.

## MVP Workstreams

1. Repository foundation
   - Documentation
   - Worker placeholder
   - Dashboard placeholder
   - Future OpenAPI and prompt assets

2. Supabase
   - Auth configuration
   - Tables
   - Row Level Security policies
   - Seed data

3. Cloudflare Worker
   - Authentication
   - Request validation
   - API endpoints
   - API logging
   - Dashboard aggregation

4. Custom GPT
   - GPT instructions
   - Knowledge files
   - Conversation examples
   - OpenAPI schema
   - Action testing

5. Dashboard
   - Today view
   - Last 7 days view
   - Weight trend
   - Recent entries
   - Edit and delete flows

6. Testing
   - Meal logging
   - Weight logging
   - Authentication
   - Error handling
   - Latency
   - Dashboard consistency

## Metrics To Track

- Sign-ups
- Connected GPT accounts
- Meals logged per day
- Day-1 retention
- Day-7 retention
- Average logging latency
- Dashboard usage
- User feedback

## Deferred Decisions

- Multi-profile or family support
- WHOOP integration
- Workout tracking
- Blood test integration
- Dashboard images in chat
- AI API versus ChatGPT-only architecture
- Migration away from Supabase
- Paid plans
- Public mobile app

## Guiding Principles

- Optimize for the easiest possible logging experience.
- Conversation is the product.
- Dashboard is the system of record.
- Keep the architecture simple.
- Validate user behavior before adding features.
- Every new feature should reduce friction or improve insight.
