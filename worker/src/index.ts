type Env = {
  WORKER_PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OAUTH_ALLOWED_CLIENT_IDS: string;
  OAUTH_ALLOWED_REDIRECT_URIS: string;
  OAUTH_CODE_TTL_SECONDS?: string;
  OAUTH_TOKEN_TTL_SECONDS?: string;
};

type OAuthLoginState = {
  client_id: string;
  redirect_uri: string;
  state: string | null;
  scope: string | null;
  code_verifier: string;
  expires_at: string;
  used_at: string | null;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  calorie_target: number;
  protein_target_g: number;
};

const DEFAULT_CODE_TTL_SECONDS = 5 * 60;
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/oauth/authorize") {
        return authorize(request, env);
      }

      if (request.method === "POST" && url.pathname === "/oauth/token") {
        return token(request, env);
      }

      if (request.method === "GET" && url.pathname === "/me") {
        return me(request, env);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "internal_error" }, 500);
    }
  },
};

async function authorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const supabaseCode = url.searchParams.get("code");
  const loginStateId = url.searchParams.get("login_state");

  if (supabaseCode && loginStateId) {
    return completeSupabaseLogin(env, supabaseCode, loginStateId);
  }

  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope");

  if (!responseType || !clientId || !redirectUri) {
    return json({ error: "invalid_request", error_description: "response_type, client_id, and redirect_uri are required" }, 400);
  }

  if (responseType !== "code") {
    return redirectWithOAuthError(redirectUri, state, "unsupported_response_type");
  }

  if (!isAllowed(clientId, env.OAUTH_ALLOWED_CLIENT_IDS)) {
    return json({ error: "unauthorized_client" }, 400);
  }

  if (!isAllowed(redirectUri, env.OAUTH_ALLOWED_REDIRECT_URIS)) {
    return json({ error: "invalid_redirect_uri" }, 400);
  }

  const stateId = randomToken(24);
  const codeVerifier = randomToken(64);
  const codeChallenge = await base64UrlSha256(codeVerifier);
  const expiresAt = new Date(Date.now() + codeTtl(env) * 1000).toISOString();

  await supabaseInsert(env, "oauth_login_states", {
    id: stateId,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  });

  const callbackUrl = new URL("/oauth/authorize", publicBaseUrl(env));
  callbackUrl.searchParams.set("login_state", stateId);

  const authUrl = new URL("/auth/v1/authorize", env.SUPABASE_URL);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", callbackUrl.toString());
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "s256");

  return Response.redirect(authUrl.toString(), 302);
}

async function completeSupabaseLogin(env: Env, supabaseCode: string, loginStateId: string): Promise<Response> {
  const states = await supabaseSelect<OAuthLoginState>(
    env,
    `oauth_login_states?id=eq.${encodeURIComponent(loginStateId)}&select=client_id,redirect_uri,state,scope,code_verifier,expires_at,used_at`
  );
  const loginState = states[0];

  if (!loginState || loginState.used_at || new Date(loginState.expires_at).getTime() < Date.now()) {
    return json({ error: "invalid_or_expired_login_state" }, 400);
  }

  const session = await exchangeSupabaseCode(env, supabaseCode, loginState.code_verifier);
  const userId = session.user?.id;

  if (!userId) {
    return redirectWithOAuthError(loginState.redirect_uri, loginState.state, "access_denied");
  }

  const appCode = randomToken(48);
  const codeHash = await sha256Hex(appCode);
  const expiresAt = new Date(Date.now() + codeTtl(env) * 1000).toISOString();

  await supabaseInsert(env, "oauth_codes", {
    code_hash: codeHash,
    user_id: userId,
    client_id: loginState.client_id,
    redirect_uri: loginState.redirect_uri,
    scope: loginState.scope,
    expires_at: expiresAt,
  });

  await supabasePatch(env, `oauth_login_states?id=eq.${encodeURIComponent(loginStateId)}`, {
    used_at: new Date().toISOString(),
  });

  const redirectUrl = new URL(loginState.redirect_uri);
  redirectUrl.searchParams.set("code", appCode);
  if (loginState.state) {
    redirectUrl.searchParams.set("state", loginState.state);
  }

  return Response.redirect(redirectUrl.toString(), 302);
}

async function token(request: Request, env: Env): Promise<Response> {
  const body = await parseFormOrJson(request);
  const grantType = body.get("grant_type");
  const code = body.get("code");
  const clientId = body.get("client_id");
  const redirectUri = body.get("redirect_uri");

  if (grantType !== "authorization_code" || !code) {
    return json({ error: "unsupported_grant_type" }, 400);
  }

  const codeHash = await sha256Hex(code);
  const rows = await supabaseSelect<{
    id: string;
    user_id: string;
    client_id: string;
    redirect_uri: string;
    scope: string | null;
    expires_at: string;
    used_at: string | null;
  }>(
    env,
    `oauth_codes?code_hash=eq.${encodeURIComponent(codeHash)}&select=id,user_id,client_id,redirect_uri,scope,expires_at,used_at`
  );
  const authCode = rows[0];

  if (!authCode || authCode.used_at || new Date(authCode.expires_at).getTime() < Date.now()) {
    return json({ error: "invalid_grant" }, 400);
  }

  if (clientId && clientId !== authCode.client_id) {
    return json({ error: "invalid_grant" }, 400);
  }

  if (redirectUri && redirectUri !== authCode.redirect_uri) {
    return json({ error: "invalid_grant" }, 400);
  }

  const accessToken = randomToken(48);
  const tokenHash = await sha256Hex(accessToken);
  const expiresIn = tokenTtl(env);

  await supabaseInsert(env, "oauth_tokens", {
    token_hash: tokenHash,
    user_id: authCode.user_id,
    scope: authCode.scope,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });

  await supabasePatch(env, `oauth_codes?id=eq.${authCode.id}`, {
    used_at: new Date().toISOString(),
  });

  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
  });
}

async function me(request: Request, env: Env): Promise<Response> {
  const tokenValue = bearerToken(request);

  if (!tokenValue) {
    return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  const tokenHash = await sha256Hex(tokenValue);
  const tokens = await supabaseSelect<{ user_id: string; expires_at: string; revoked_at: string | null }>(
    env,
    `oauth_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&select=user_id,expires_at,revoked_at`
  );
  const tokenRow = tokens[0];

  if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  const users = await supabaseSelect<UserRow>(
    env,
    `users?id=eq.${encodeURIComponent(tokenRow.user_id)}&select=id,email,display_name,timezone,calorie_target,protein_target_g`
  );
  const user = users[0];

  if (!user) {
    return json({ error: "user_not_found" }, 404);
  }

  return json({
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    timezone: user.timezone,
    calorie_target: user.calorie_target,
    protein_target_g: user.protein_target_g,
  });
}

async function exchangeSupabaseCode(env: Env, authCode: string, codeVerifier: string): Promise<{ user?: { id?: string } }> {
  const response = await fetch(`${trimTrailingSlash(env.SUPABASE_URL)}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_code: authCode,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase token exchange failed: ${response.status}`);
  }

  return response.json();
}

async function supabaseSelect<T>(env: Env, pathAndQuery: string): Promise<T[]> {
  const response = await supabaseFetch(env, pathAndQuery, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  return response.json();
}

async function supabaseInsert(env: Env, table: string, row: Record<string, unknown>): Promise<void> {
  await supabaseFetch(env, table, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

async function supabasePatch(env: Env, pathAndQuery: string, row: Record<string, unknown>): Promise<void> {
  await supabaseFetch(env, pathAndQuery, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

async function supabaseFetch(env: Env, pathAndQuery: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${trimTrailingSlash(env.SUPABASE_URL)}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST request failed: ${response.status} ${body}`);
  }

  return response;
}

async function parseFormOrJson(request: Request): Promise<Map<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  const values = new Map<string, string>();

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") values.set(key, value);
    }
    return values;
  }

  const form = await request.formData();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") values.set(key, value);
  }
  return values;
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function redirectWithOAuthError(redirectUri: string, state: string | null, error: string): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}

function isAllowed(value: string, csv: string): boolean {
  return csv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(value);
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function base64UrlSha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(hash));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function publicBaseUrl(env: Env): string {
  return trimTrailingSlash(env.WORKER_PUBLIC_URL);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function codeTtl(env: Env): number {
  return Number(env.OAUTH_CODE_TTL_SECONDS ?? DEFAULT_CODE_TTL_SECONDS);
}

function tokenTtl(env: Env): number {
  return Number(env.OAUTH_TOKEN_TTL_SECONDS ?? DEFAULT_TOKEN_TTL_SECONDS);
}
