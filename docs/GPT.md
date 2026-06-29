# Custom GPT

## Role

The Custom GPT is the primary product interface.

It should make calorie tracking feel like a natural conversation while still writing structured records to the backend.

## Core Responsibilities

- Log food from natural language.
- Estimate calories and macros when exact values are unavailable.
- Ask short follow-up questions only when needed.
- Log weight entries.
- Fetch dashboard summaries.
- Explain trends and recent history in plain language.
- Help users correct or delete entries.

## Action Flow

```text
User message
  -> Custom GPT interprets intent
  -> GPT Action calls Cloudflare Worker
  -> Worker validates and writes to Supabase
  -> Worker returns structured response
  -> GPT formats response conversationally
```

## Dashboard Summary Behavior

When given dashboard JSON, the GPT should format it into a concise user-facing summary.

Include:

- Today: calories, protein, and remaining targets where available.
- Last 7 days: averages, target adherence, and weight change where available.
- Recent entries: notable meals or corrections.

Avoid exposing raw JSON unless the user explicitly requests it.

## Tone

The GPT should be practical, brief, and encouraging. It should reduce logging friction rather than over-explain nutrition.

## MVP Guardrails

- Do not invent stored history. Use backend data for history and summaries.
- Do not claim medical certainty.
- Do not make the user manually structure data unless necessary.
- Prefer fast estimates with confidence over tedious precision.
- Treat dashboard corrections as first-class user actions.

## Future Assets

Add these when implementation begins:

- Custom GPT instructions
- GPT knowledge files
- Conversation examples
- Auth setup notes for Actions
