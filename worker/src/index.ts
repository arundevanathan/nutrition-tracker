type Env = {
  WORKER_PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OAUTH_CODE_TTL_SECONDS?: string;
  OAUTH_TOKEN_TTL_SECONDS?: string;
};

type OAuthLoginState = {
  client_id: string;
  redirect_uri: string;
  state: string | null;
  response_type: string;
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
};

type FoodEntryRow = {
  id: string;
  user_id: string;
  logged_at: string;
  consumption_date: string;
  consumption_time: string | null;
  meal_type: MealType | null;
  entry_type: EntryType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WeightEntryRow = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContext = {
  userId: string;
};

type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink" | "other";
type EntryType = "Core" | "Junk" | "Alcohol" | "Eating Out";
type Confidence = "high" | "medium" | "low";
type ValidationFields = Record<string, string>;

const DEFAULT_CODE_TTL_SECONDS = 5 * 60;
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const MEAL_TYPES = new Set<MealType>(["breakfast", "lunch", "dinner", "snack", "drink", "other"]);
const ENTRY_TYPES = new Set<EntryType>(["Core", "Junk", "Alcohol", "Eating Out"]);
const CONFIDENCE_VALUES = new Set<Confidence>(["high", "medium", "low"]);
const DASHBOARD_DAYS = 7;
const RECENT_LIMIT = 10;

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

      if (request.method === "GET" && url.pathname === "/oauth/supabase/callback") {
        return supabaseCallback(request, env);
      }

      if (request.method === "POST" && url.pathname === "/oauth/token") {
        return token(request, env);
      }

      if (request.method === "GET" && url.pathname === "/me") {
        return me(request, env);
      }

      if (request.method === "POST" && url.pathname === "/food-entry") {
        return createFoodEntry(request, env);
      }

      const foodEntryId = foodEntryIdFromPath(url.pathname);
      if (foodEntryId && request.method === "PATCH") {
        return updateFoodEntry(request, env, foodEntryId);
      }

      if (foodEntryId && request.method === "DELETE") {
        return deleteFoodEntry(request, env, foodEntryId);
      }

      if (request.method === "POST" && url.pathname === "/weight-entry") {
        return createWeightEntry(request, env);
      }

      const weightEntryId = weightEntryIdFromPath(url.pathname);
      if (weightEntryId && request.method === "PATCH") {
        return updateWeightEntry(request, env, weightEntryId);
      }

      if (weightEntryId && request.method === "DELETE") {
        return deleteWeightEntry(request, env, weightEntryId);
      }

      if (request.method === "POST" && url.pathname === "/delete-all-data") {
        return deleteAllUserData(request, env);
      }

      if (request.method === "GET" && url.pathname === "/dashboard") {
        return dashboard(request, env);
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
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope");

  console.log("oauth_authorize_start", {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    has_state: Boolean(state),
    scope,
  });

  if (!responseType || !clientId || !redirectUri) {
    console.log("oauth_authorize_invalid_request");
    return json({ error: "invalid_request", error_description: "response_type, client_id, and redirect_uri are required" }, 400);
  }

  if (responseType !== "code") {
    console.log("oauth_authorize_unsupported_response_type", { response_type: responseType });
    return redirectWithOAuthError(redirectUri, state, "unsupported_response_type");
  }

  if (!isAllowedChatGptRedirectUri(redirectUri)) {
    console.log("oauth_authorize_invalid_redirect_uri", { redirect_uri: redirectUri });
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
    response_type: responseType,
    scope,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  });

  const callbackUrl = new URL("/oauth/supabase/callback", publicBaseUrl(env));
  callbackUrl.searchParams.set("login_state", stateId);

  const authUrl = new URL("/auth/v1/authorize", env.SUPABASE_URL);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", callbackUrl.toString());
  // Supabase JS calls this option redirectTo. The REST authorize endpoint uses redirect_to.
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "s256");

  console.log("oauth_authorize_redirect_to_supabase", {
    login_state: stateId,
    supabase_callback: callbackUrl.toString(),
  });

  return Response.redirect(authUrl.toString(), 302);
}

async function supabaseCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const supabaseCode = url.searchParams.get("code");
  const loginStateId = url.searchParams.get("login_state");
  const error = url.searchParams.get("error");

  console.log("oauth_supabase_callback_start", {
    has_code: Boolean(supabaseCode),
    has_login_state: Boolean(loginStateId),
    error,
  });

  if (error) {
    console.log("oauth_supabase_callback_error", { error });
    return json({ error: "supabase_auth_error", error_description: error }, 400);
  }

  if (!supabaseCode || !loginStateId) {
    console.log("oauth_supabase_callback_invalid_request");
    return json({ error: "invalid_request", error_description: "code and login_state are required" }, 400);
  }

  const states = await supabaseSelect<OAuthLoginState>(
    env,
    `oauth_login_states?id=eq.${encodeURIComponent(loginStateId)}&select=client_id,redirect_uri,state,response_type,scope,code_verifier,expires_at,used_at`
  );
  const loginState = states[0];

  if (!loginState || loginState.used_at || new Date(loginState.expires_at).getTime() < Date.now()) {
    console.log("oauth_supabase_callback_invalid_or_expired_state", { login_state: loginStateId });
    return json({ error: "invalid_or_expired_login_state" }, 400);
  }

  if (loginState.response_type !== "code") {
    console.log("oauth_supabase_callback_invalid_response_type", { response_type: loginState.response_type });
    return redirectWithOAuthError(loginState.redirect_uri, loginState.state, "unsupported_response_type");
  }

  const session = await exchangeSupabaseCode(env, supabaseCode, loginState.code_verifier);
  const userId = session.user?.id;

  if (!userId) {
    console.log("oauth_supabase_callback_no_user");
    return redirectWithOAuthError(loginState.redirect_uri, loginState.state, "access_denied");
  }

  console.log("oauth_supabase_callback_user_identified", { user_id: userId });

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

  console.log("oauth_supabase_callback_redirect_to_chatgpt", {
    user_id: userId,
    redirect_uri: loginState.redirect_uri,
    has_state: Boolean(loginState.state),
  });

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
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const user = await getUser(env, auth.userId);

  if (!user) {
    return json({ error: "user_not_found" }, 404);
  }

  return json(userResponse(user));
}

async function createFoodEntry(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonObject(request);
  if ("response" in parsed) return parsed.response;

  const validated = validateFoodEntryBody(parsed.body);
  if ("response" in validated) return validated.response;

  const entry = await supabaseInsertReturning<FoodEntryRow>(env, "food_entries", {
    user_id: auth.userId,
    source: "gpt",
    ...validated.row,
  });
  const today = await todaySnapshot(env, auth.userId, entry.consumption_date);

  return json(
    {
      food_entry: foodEntryResponse(entry),
      summary: `Logged ${entry.description} for ${entry.consumption_date}: ${entry.calories} calories, ${formatNumber(entry.protein_g)}g protein.`,
      today,
    },
    201
  );
}

async function updateFoodEntry(request: Request, env: Env, entryId: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const user = await getUser(env, auth.userId);
  if (!user) {
    return json({ error: "user_not_found" }, 404);
  }

  const parsed = await parseJsonObject(request);
  if ("response" in parsed) return parsed.response;

  const validated = validateFoodEntryUpdateBody(parsed.body);
  if ("response" in validated) return validated.response;

  const entry = await supabasePatchReturning<FoodEntryRow>(
    env,
    `food_entries?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(auth.userId)}`,
    validated.row
  );

  if (!entry) {
    return json({ error: "food_entry_not_found" }, 404);
  }

  const today = await todaySnapshot(env, auth.userId, entry.consumption_date);

  return json({
    food_entry: foodEntryResponse(entry),
    summary: `Updated ${entry.description} for ${entry.consumption_date}.`,
    today,
  });
}

async function deleteFoodEntry(request: Request, env: Env, entryId: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const user = await getUser(env, auth.userId);
  if (!user) {
    return json({ error: "user_not_found" }, 404);
  }

  const entry = await supabaseDeleteReturning<FoodEntryRow>(
    env,
    `food_entries?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(auth.userId)}`
  );

  if (!entry) {
    return json({ error: "food_entry_not_found" }, 404);
  }

  const today = await todaySnapshot(env, auth.userId, entry.consumption_date);

  return json({
    deleted_food_entry: foodEntryResponse(entry),
    summary: `Deleted ${entry.description} from ${entry.consumption_date}.`,
    today,
  });
}

async function createWeightEntry(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonObject(request);
  if ("response" in parsed) return parsed.response;

  const validated = validateWeightEntryBody(parsed.body);
  if ("response" in validated) return validated.response;

  const entry = await supabaseUpsertReturning<WeightEntryRow>(env, "weight_entries", "user_id,date", {
    user_id: auth.userId,
    ...validated.row,
  });

  return json(
    {
      weight_entry: weightEntryResponse(entry),
      summary: `Saved ${formatNumber(entry.weight_kg)} kg for ${entry.date}.`,
    },
    201
  );
}

async function updateWeightEntry(request: Request, env: Env, entryId: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonObject(request);
  if ("response" in parsed) return parsed.response;

  const validated = validateWeightEntryUpdateBody(parsed.body);
  if ("response" in validated) return validated.response;

  const entry = await supabasePatchReturning<WeightEntryRow>(
    env,
    `weight_entries?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(auth.userId)}`,
    validated.row
  );

  if (!entry) {
    return json({ error: "weight_entry_not_found" }, 404);
  }

  return json({
    weight_entry: weightEntryResponse(entry),
    summary: `Updated weight for ${entry.date}: ${formatNumber(entry.weight_kg)} kg.`,
  });
}

async function deleteWeightEntry(request: Request, env: Env, entryId: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const entry = await supabaseDeleteReturning<WeightEntryRow>(
    env,
    `weight_entries?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(auth.userId)}`
  );

  if (!entry) {
    return json({ error: "weight_entry_not_found" }, 404);
  }

  return json({
    deleted_weight_entry: weightEntryResponse(entry),
    summary: `Deleted weight entry for ${entry.date}.`,
  });
}

async function deleteAllUserData(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonObject(request);
  if ("response" in parsed) return parsed.response;

  const confirmation = stringField(parsed.body, "confirmation");
  if (confirmation !== "DELETE ALL MY DATA") {
    return validationError({ confirmation: 'confirmation must exactly equal "DELETE ALL MY DATA"' });
  }

  const userFilter = `user_id=eq.${encodeURIComponent(auth.userId)}`;
  const [foodEntries, weightEntries, dailySummaries, apiLogs] = await Promise.all([
    supabaseDeleteReturningMany<FoodEntryRow>(env, `food_entries?${userFilter}`),
    supabaseDeleteReturningMany<WeightEntryRow>(env, `weight_entries?${userFilter}`),
    supabaseDeleteReturningMany(env, `daily_summaries?${userFilter}`),
    supabaseDeleteReturningMany(env, `api_logs?${userFilter}`),
  ]);

  return json({
    summary: "Deleted all nutrition tracking data for this account.",
    deleted: {
      food_entries: foodEntries.length,
      weight_entries: weightEntries.length,
      daily_summaries: dailySummaries.length,
      api_logs: apiLogs.length,
    },
  });
}

async function dashboard(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const user = await getUser(env, auth.userId);
  if (!user) {
    return json({ error: "user_not_found" }, 404);
  }

  const today = localDateString(user.timezone);
  const dates = lastNDates(today, DASHBOARD_DAYS);
  const startDate = dates[0];

  const [rangeFoods, recentFoods, recentWeights] = await Promise.all([
    supabaseSelect<FoodEntryRow>(
      env,
      `food_entries?user_id=eq.${encodeURIComponent(auth.userId)}&consumption_date=gte.${startDate}&consumption_date=lte.${today}&select=*&order=consumption_date.desc,logged_at.desc`
    ),
    supabaseSelect<FoodEntryRow>(
      env,
      `food_entries?user_id=eq.${encodeURIComponent(auth.userId)}&select=*&order=logged_at.desc&limit=${RECENT_LIMIT}`
    ),
    supabaseSelect<WeightEntryRow>(
      env,
      `weight_entries?user_id=eq.${encodeURIComponent(auth.userId)}&select=*&order=date.desc&limit=${RECENT_LIMIT}`
    ),
  ]);

  const dailyTotals = dates.map((date) => summarizeFoodEntries(date, rangeFoods.filter((entry) => entry.consumption_date === date)));
  const todayTotals = dailyTotals[dailyTotals.length - 1];
  const averages = averageDailyTotals(dailyTotals);
  const latestWeight = recentWeights[0] ? weightEntryResponse(recentWeights[0]) : null;

  return json({
    user: userResponse(user),
    today: {
      date: today,
      totals: todayTotals,
      latest_weight: latestWeight,
    },
    last_7_days: {
      start_date: startDate,
      end_date: today,
      days: dailyTotals,
      averages,
    },
    recent_food_entries: recentFoods.map(foodEntryResponse),
    recent_weight_entries: recentWeights.map(weightEntryResponse),
    metadata: {
      generated_at: new Date().toISOString(),
      timezone: user.timezone,
      recent_limit: RECENT_LIMIT,
    },
  });
}

async function authenticate(request: Request, env: Env): Promise<AuthContext | Response> {
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

  return { userId: tokenRow.user_id };
}

async function getUser(env: Env, userId: string): Promise<UserRow | null> {
  const users = await supabaseSelect<UserRow>(
    env,
    `users?id=eq.${encodeURIComponent(userId)}&select=id,email,display_name,timezone`
  );
  return users[0] ?? null;
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

async function supabaseInsertReturning<T>(env: Env, table: string, row: Record<string, unknown>): Promise<T> {
  const response = await supabaseFetch(env, table, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const rows = (await response.json()) as T[];
  return rows[0];
}

async function supabaseUpsertReturning<T>(env: Env, table: string, onConflict: string, row: Record<string, unknown>): Promise<T> {
  const response = await supabaseFetch(env, `${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  const rows = (await response.json()) as T[];
  return rows[0];
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

async function supabasePatchReturning<T>(env: Env, pathAndQuery: string, row: Record<string, unknown>): Promise<T | null> {
  const response = await supabaseFetch(env, pathAndQuery, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

async function supabaseDeleteReturning<T>(env: Env, pathAndQuery: string): Promise<T | null> {
  const response = await supabaseFetch(env, pathAndQuery, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

async function supabaseDeleteReturningMany<T = Record<string, unknown>>(env: Env, pathAndQuery: string): Promise<T[]> {
  const response = await supabaseFetch(env, pathAndQuery, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });
  return (await response.json()) as T[];
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

async function parseJsonObject(request: Request): Promise<{ body: Record<string, unknown> } | { response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { response: validationError({ body: "Content-Type must be application/json" }) };
  }

  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { response: validationError({ body: "JSON body must be an object" }) };
    }
    return { body: body as Record<string, unknown> };
  } catch {
    return { response: validationError({ body: "JSON body must be valid JSON" }) };
  }
}

function validateFoodEntryBody(body: Record<string, unknown>): { row: Record<string, unknown> } | { response: Response } {
  const fields: ValidationFields = {};

  if ("user_id" in body) fields.user_id = "user_id is not accepted; ownership comes from the bearer token";

  const description = stringField(body, "description");
  if (!description) fields.description = "description is required";

  const consumptionDate = stringField(body, "consumption_date");
  if (!consumptionDate) fields.consumption_date = "consumption_date is required";
  else if (!isIsoDate(consumptionDate)) fields.consumption_date = "consumption_date must be YYYY-MM-DD";

  const calories = integerField(body, "calories");
  if (calories === null) fields.calories = "calories is required";
  else if (calories < 0) fields.calories = "calories must be a non-negative integer";

  const consumptionTime = optionalStringField(body, "consumption_time", fields);
  if (consumptionTime !== null && !isTime(consumptionTime)) fields.consumption_time = "consumption_time must be HH:MM or HH:MM:SS";

  const mealType = optionalStringField(body, "meal_type", fields);
  if (mealType !== null && !MEAL_TYPES.has(mealType as MealType)) fields.meal_type = "meal_type is invalid";

  const entryType = optionalStringField(body, "entry_type", fields) ?? "Core";
  if (!ENTRY_TYPES.has(entryType as EntryType)) fields.entry_type = "entry_type is invalid";

  const confidence = optionalStringField(body, "confidence", fields);
  if (confidence !== null && !CONFIDENCE_VALUES.has(confidence as Confidence)) fields.confidence = "confidence is invalid";

  const proteinG = optionalNonNegativeNumber(body, "protein_g", fields);
  const carbsG = optionalNonNegativeNumber(body, "carbs_g", fields);
  const fatG = optionalNonNegativeNumber(body, "fat_g", fields);
  const notes = optionalStringField(body, "notes", fields);

  if (Object.keys(fields).length > 0) return { response: validationError(fields) };

  return {
    row: {
      description,
      consumption_date: consumptionDate,
      consumption_time: consumptionTime,
      meal_type: mealType,
      entry_type: entryType,
      calories,
      protein_g: proteinG ?? 0,
      carbs_g: carbsG ?? 0,
      fat_g: fatG ?? 0,
      confidence,
      notes,
    },
  };
}

function validateFoodEntryUpdateBody(body: Record<string, unknown>): { row: Record<string, unknown> } | { response: Response } {
  const fields: ValidationFields = {};
  const row: Record<string, unknown> = {};

  if ("user_id" in body) fields.user_id = "user_id is not accepted; ownership comes from the bearer token";
  if ("source" in body) fields.source = "source cannot be updated";

  if ("description" in body) {
    const description = stringField(body, "description");
    if (!description) fields.description = "description must be a non-empty string";
    else row.description = description;
  }

  if ("consumption_date" in body) {
    const consumptionDate = stringField(body, "consumption_date");
    if (!consumptionDate) fields.consumption_date = "consumption_date must be a non-empty string";
    else if (!isIsoDate(consumptionDate)) fields.consumption_date = "consumption_date must be YYYY-MM-DD";
    else row.consumption_date = consumptionDate;
  }

  if ("calories" in body) {
    const calories = integerField(body, "calories");
    if (calories === null || calories < 0) fields.calories = "calories must be a non-negative integer";
    else row.calories = calories;
  }

  if ("consumption_time" in body) {
    const consumptionTime = optionalStringField(body, "consumption_time", fields);
    if (consumptionTime !== null && !isTime(consumptionTime)) fields.consumption_time = "consumption_time must be HH:MM or HH:MM:SS";
    else row.consumption_time = consumptionTime;
  }

  if ("meal_type" in body) {
    const mealType = optionalStringField(body, "meal_type", fields);
    if (mealType !== null && !MEAL_TYPES.has(mealType as MealType)) fields.meal_type = "meal_type is invalid";
    else row.meal_type = mealType;
  }

  if ("entry_type" in body) {
    const entryType = optionalStringField(body, "entry_type", fields);
    if (entryType === null || !ENTRY_TYPES.has(entryType as EntryType)) fields.entry_type = "entry_type is invalid";
    else row.entry_type = entryType;
  }

  if ("confidence" in body) {
    const confidence = optionalStringField(body, "confidence", fields);
    if (confidence !== null && !CONFIDENCE_VALUES.has(confidence as Confidence)) fields.confidence = "confidence is invalid";
    else row.confidence = confidence;
  }

  for (const key of ["protein_g", "carbs_g", "fat_g"]) {
    if (key in body) {
      const value = numberField(body, key);
      if (value === null || value < 0) fields[key] = `${key} must be a non-negative number`;
      else row[key] = value;
    }
  }

  if ("notes" in body) {
    row.notes = optionalStringField(body, "notes", fields);
  }

  if (Object.keys(fields).length > 0) return { response: validationError(fields) };
  if (Object.keys(row).length === 0) return { response: validationError({ body: "At least one editable field is required" }) };

  return { row };
}

function validateWeightEntryBody(body: Record<string, unknown>): { row: Record<string, unknown> } | { response: Response } {
  const fields: ValidationFields = {};

  if ("user_id" in body) fields.user_id = "user_id is not accepted; ownership comes from the bearer token";

  const date = stringField(body, "date");
  if (!date) fields.date = "date is required";
  else if (!isIsoDate(date)) fields.date = "date must be YYYY-MM-DD";

  const weightKg = numberField(body, "weight_kg");
  if (weightKg === null) fields.weight_kg = "weight_kg is required";
  else if (weightKg <= 0) fields.weight_kg = "weight_kg must be a positive number";

  const note = optionalStringField(body, "note", fields);

  if (Object.keys(fields).length > 0) return { response: validationError(fields) };

  return {
    row: {
      date,
      weight_kg: weightKg,
      note,
    },
  };
}

function validateWeightEntryUpdateBody(body: Record<string, unknown>): { row: Record<string, unknown> } | { response: Response } {
  const fields: ValidationFields = {};
  const row: Record<string, unknown> = {};

  if ("user_id" in body) fields.user_id = "user_id is not accepted; ownership comes from the bearer token";

  if ("date" in body) {
    const date = stringField(body, "date");
    if (!date) fields.date = "date must be a non-empty string";
    else if (!isIsoDate(date)) fields.date = "date must be YYYY-MM-DD";
    else row.date = date;
  }

  if ("weight_kg" in body) {
    const weightKg = numberField(body, "weight_kg");
    if (weightKg === null || weightKg <= 0) fields.weight_kg = "weight_kg must be a positive number";
    else row.weight_kg = weightKg;
  }

  if ("note" in body) {
    row.note = optionalStringField(body, "note", fields);
  }

  if (Object.keys(fields).length > 0) return { response: validationError(fields) };
  if (Object.keys(row).length === 0) return { response: validationError({ body: "At least one editable field is required" }) };

  return { row };
}

async function todaySnapshot(env: Env, userId: string, date: string) {
  const foods = await supabaseSelect<FoodEntryRow>(
    env,
    `food_entries?user_id=eq.${encodeURIComponent(userId)}&consumption_date=eq.${date}&select=*`
  );
  const totals = summarizeFoodEntries(date, foods);

  return {
    date,
    totals,
  };
}

function summarizeFoodEntries(date: string, entries: FoodEntryRow[]) {
  const totals = {
    date,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    junk_calories: 0,
    alcohol_calories: 0,
    eating_out_calories: 0,
    entries_count: entries.length,
  };

  for (const entry of entries) {
    totals.calories += Number(entry.calories);
    totals.protein_g += Number(entry.protein_g);
    totals.carbs_g += Number(entry.carbs_g);
    totals.fat_g += Number(entry.fat_g);
    if (entry.entry_type === "Junk") totals.junk_calories += Number(entry.calories);
    if (entry.entry_type === "Alcohol") totals.alcohol_calories += Number(entry.calories);
    if (entry.entry_type === "Eating Out") totals.eating_out_calories += Number(entry.calories);
  }

  return roundTotals(totals);
}

function averageDailyTotals(days: ReturnType<typeof summarizeFoodEntries>[]) {
  const divisor = days.length || 1;
  return roundTotals({
    calories: sum(days, "calories") / divisor,
    protein_g: sum(days, "protein_g") / divisor,
    carbs_g: sum(days, "carbs_g") / divisor,
    fat_g: sum(days, "fat_g") / divisor,
    junk_calories: sum(days, "junk_calories") / divisor,
    alcohol_calories: sum(days, "alcohol_calories") / divisor,
    eating_out_calories: sum(days, "eating_out_calories") / divisor,
    entries_count: sum(days, "entries_count") / divisor,
  });
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function roundTotals<T extends Record<string, unknown>>(totals: T): T {
  const rounded: Record<string, unknown> = { ...totals };
  for (const key of ["protein_g", "carbs_g", "fat_g", "entries_count"] as const) {
    if (typeof rounded[key] === "number") {
      rounded[key] = Number(rounded[key].toFixed(2));
    }
  }
  for (const key of ["calories", "junk_calories", "alcohol_calories", "eating_out_calories"] as const) {
    if (typeof rounded[key] === "number") {
      rounded[key] = Math.round(rounded[key]);
    }
  }
  return rounded as T;
}

function userResponse(user: UserRow) {
  return {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    timezone: user.timezone,
  };
}

function foodEntryResponse(entry: FoodEntryRow) {
  return {
    id: entry.id,
    logged_at: entry.logged_at,
    consumption_date: entry.consumption_date,
    consumption_time: entry.consumption_time,
    meal_type: entry.meal_type,
    entry_type: entry.entry_type,
    description: entry.description,
    calories: Number(entry.calories),
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    confidence: entry.confidence,
    source: entry.source,
    notes: entry.notes,
  };
}

function weightEntryResponse(entry: WeightEntryRow) {
  return {
    id: entry.id,
    date: entry.date,
    weight_kg: Number(entry.weight_kg),
    note: entry.note,
  };
}

function validationError(fields: ValidationFields): Response {
  return json(
    {
      error: "validation_error",
      message: "Request validation failed",
      fields,
    },
    400
  );
}

function stringField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalStringField(body: Record<string, unknown>, key: string, fields: ValidationFields): string | null {
  if (!(key in body) || body[key] === null) return null;
  if (typeof body[key] !== "string") {
    fields[key] = `${key} must be a string`;
    return null;
  }
  return body[key].trim() || null;
}

function integerField(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberField(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalNonNegativeNumber(body: Record<string, unknown>, key: string, fields: ValidationFields): number | null {
  if (!(key in body) || body[key] === null) return null;
  const value = numberField(body, key);
  if (value === null || value < 0) {
    fields[key] = `${key} must be a non-negative number`;
    return null;
  }
  return value;
}

function isIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  return hours <= 23 && minutes <= 59 && seconds <= 59;
}

function localDateString(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function lastNDates(endDate: string, count: number): string[] {
  const dates: string[] = [];
  const [year, month, day] = endDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  for (let offset = count - 1; offset >= 0; offset--) {
    const current = new Date(date);
    current.setUTCDate(date.getUTCDate() - offset);
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

function formatNumber(value: number): string {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function foodEntryIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/food-entry\/([0-9a-fA-F-]{36})$/);
  return match?.[1] ?? null;
}

function weightEntryIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/weight-entry\/([0-9a-fA-F-]{36})$/);
  return match?.[1] ?? null;
}

function redirectWithOAuthError(redirectUri: string, state: string | null, error: string): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}

function isAllowedChatGptRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    const allowedHosts = new Set(["chat.openai.com", "chatgpt.com"]);

    return (
      url.protocol === "https:" &&
      allowedHosts.has(url.hostname) &&
      /^\/aip\/g-[A-Za-z0-9]+\/oauth\/callback$/.test(url.pathname) &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
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
