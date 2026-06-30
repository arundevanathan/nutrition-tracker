# OAuth For Custom GPT Actions

This flow lets a Custom GPT Action link a user account through OAuth and call protected Cloudflare Worker endpoints.

## Goal

Prove this flow:

```text
Custom GPT
  -> GPT Action OAuth
  -> Cloudflare Worker OAuth endpoints
  -> Supabase Google login
  -> Cloudflare Worker protected product endpoints
  -> Supabase public.users row
```

## Endpoints

### `GET /health`

Returns:

```json
{ "ok": true }
```

### `GET /oauth/authorize`

Accepts standard OAuth query parameters:

- `response_type`
- `client_id`
- `redirect_uri`
- `state`
- `scope`

For MVP, `response_type` must be `code`. The Worker accepts any `client_id` but only allows ChatGPT Action callback redirects matching:

```text
https://chat.openai.com/aip/g-*/oauth/callback
https://chatgpt.com/aip/g-*/oauth/callback
```

If the user is not authenticated with Supabase, the Worker stores the original ChatGPT OAuth parameters server-side, then redirects to Supabase Google login using a PKCE flow.

The Worker passes the Supabase auth redirect URL as:

```text
https://app.calorie-track.com/oauth/supabase/callback
```

After Supabase redirects to that Worker callback, the Worker validates the Supabase code, identifies the Supabase user, creates a short-lived authorization code tied to that user id, and redirects back to the original ChatGPT `redirect_uri` with:

- `code`
- `state`

Authorization codes expire after 5 minutes by default.

### `POST /oauth/token`

Accepts the OAuth `authorization_code` grant.

Returns:

```json
{
  "access_token": "opaque-token",
  "token_type": "Bearer",
  "expires_in": 2592000
}
```

The Worker stores only a SHA-256 hash of the access token. Access tokens expire after 30 days by default.

### `GET /api/me`

Requires:

```text
Authorization: Bearer <access_token>
```

Returns:

```json
{
  "user_id": "supabase-user-id",
  "email": "user@example.com",
  "display_name": "Example User",
  "timezone": "Asia/Kolkata"
}
```

## Supabase Storage

Run these migrations before testing:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_oauth_poc.sql`
3. `supabase/migrations/003_oauth_service_role_grants.sql`
4. `supabase/migrations/004_oauth_login_state_response_type.sql`

OAuth storage tables:

- `public.oauth_login_states`
- `public.oauth_codes`
- `public.oauth_tokens`

These tables have RLS enabled and no authenticated user policies. The Worker accesses them with the Supabase service role key server-side.

If Supabase Data API table exposure is restricted, `003_oauth_service_role_grants.sql` grants only `service_role` the minimum table privileges needed by the Worker. It does not grant `anon` or `authenticated` access.

## Supabase Auth Configuration

In Supabase, enable the Google auth provider and configure the Google OAuth client according to the Supabase dashboard instructions.

Add the Worker callback URL to Supabase Auth redirect URLs:

```text
https://app.calorie-track.com/oauth/supabase/callback
```

The Worker uses that endpoint as the Supabase PKCE callback, then redirects back to ChatGPT with the Custom GPT authorization code. Supabase should not redirect to `localhost` for this flow.

## Custom GPT Action Configuration

Use `openai/custom-gpt-action-schema.yaml` as the action schema.

In the Custom GPT Action authentication settings, configure OAuth:

- Authorization URL: `https://app.calorie-track.com/oauth/authorize`
- Token URL: `https://app.calorie-track.com/oauth/token`
- Scope: optional for this MVP
- Client ID: any value provided by ChatGPT is accepted for this MVP
- Client Secret: not used by this MVP

Set the OpenAPI server URL to `https://app.calorie-track.com`. Product API paths are exposed under `/api/*`, while OAuth endpoints stay under `/oauth/*`.

## Expected Test Flow

1. User asks the GPT: `Who am I?`
2. GPT tries to call `GET /api/me`.
3. ChatGPT prompts the user to connect their account.
4. User completes Google login through Supabase.
5. Supabase redirects to `/oauth/supabase/callback` on the Worker.
6. The Worker creates an OAuth authorization code and redirects back to ChatGPT.
7. ChatGPT exchanges the code for an access token.
8. GPT retries `GET /api/me`.
9. GPT displays the authenticated user's details.

## Environment Variables

Configure these as Cloudflare Worker variables or secrets:

- `WORKER_PUBLIC_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_CODE_TTL_SECONDS`
- `OAUTH_TOKEN_TTL_SECONDS`

Do not commit real secrets.

## MVP Security Notes

- The Worker never trusts `user_id` from requests.
- Authorization codes and access tokens are stored only as hashes.
- The Supabase service role key is used only server-side by the Worker.
- OAuth client IDs are intentionally unrestricted for this POC.
- Redirect URI validation is restricted to ChatGPT Action callback URL patterns.
- OAuth client secrets are not implemented for this POC.

## TODO: Production Hardening

- Add OAuth client-secret validation or dynamic client registration as appropriate.
- Add stronger redirect URI management per Custom GPT if the public-alpha threat model requires it.
- Add token revocation and account unlinking.
- Add cleanup jobs for expired login states, codes, and tokens.
- Add rate limiting for OAuth endpoints.
- Add audit logging for token exchange and protected endpoint calls.
- Review Supabase PKCE behavior in the deployed environment before public use.
