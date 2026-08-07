const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function isLocalhostUrl(value) {
  return /localhost|127\.0\.0\.1/i.test(String(value ?? ""));
}

/**
 * Prefer an explicit redirect URI, but never send production Microsoft OAuth
 * callbacks to localhost when APP_URL / NEXTAUTH_URL is a real host.
 */
export function resolveMicrosoftOAuthRedirectUri() {
  const explicit = safeString(process.env.MICROSOFT_REDIRECT_URI || process.env.OUTLOOK_REDIRECT_URI);
  const appBase = safeString(process.env.APP_URL || process.env.NEXTAUTH_URL).replace(/\/$/, "");
  const fromApp = appBase ? `${appBase}/api/integrations/oauth/microsoft/callback` : "";

  if (explicit && !isLocalhostUrl(explicit)) return explicit;
  if (fromApp && !isLocalhostUrl(fromApp)) return fromApp;
  return explicit || fromApp;
}

// Connect only needs send. offline_access is required to receive a refresh token.
export const OUTLOOK_MAIL_OAUTH_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
];

export const OUTLOOK_CALENDAR_OAUTH_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/User.Read",
];

export function getMicrosoftTenantId() {
  return safeString(process.env.MICROSOFT_TENANT_ID).trim() || "common";
}

export function isMicrosoftOAuthAppConfigured() {
  return Boolean(
    safeString(process.env.MICROSOFT_CLIENT_ID)
    && safeString(process.env.MICROSOFT_CLIENT_SECRET)
    && resolveMicrosoftOAuthRedirectUri(),
  );
}

/** @deprecated Alias — prefer isMicrosoftOAuthAppConfigured */
export function isMicrosoftOAuthConfigured() {
  return isMicrosoftOAuthAppConfigured();
}

export function getMicrosoftOAuthAppConfig() {
  return {
    clientId: safeString(process.env.MICROSOFT_CLIENT_ID),
    clientSecret: safeString(process.env.MICROSOFT_CLIENT_SECRET),
    tenantId: getMicrosoftTenantId(),
    redirectUri: resolveMicrosoftOAuthRedirectUri(),
  };
}

function authorityUrl(tenantId, path) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/${path}`;
}

/**
 * @param {{state?: string, scopes?: string[], redirectUri?: string, prompt?: string}} options
 */
export function buildMicrosoftAuthorizeUrl({
  state,
  scopes,
  redirectUri,
  prompt = "select_account",
} = {}) {
  const config = getMicrosoftOAuthAppConfig();
  if (!config.clientId) {
    throw new Error("Microsoft OAuth app is not configured (MICROSOFT_CLIENT_ID).");
  }
  const url = new URL(authorityUrl(config.tenantId, "authorize"));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri || config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", (Array.isArray(scopes) ? scopes : []).join(" "));
  url.searchParams.set("state", safeString(state));
  if (prompt) url.searchParams.set("prompt", prompt);
  return url.toString();
}

export async function exchangeMicrosoftAuthorizationCode({
  code,
  redirectUri,
  scopes,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = getMicrosoftOAuthAppConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Microsoft OAuth app is not configured (CLIENT_ID / CLIENT_SECRET).");
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code: safeString(code),
    redirect_uri: redirectUri || config.redirectUri,
    ...(Array.isArray(scopes) && scopes.length ? { scope: scopes.join(" ") } : {}),
  });

  const res = await fetchImpl(authorityUrl(config.tenantId, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Microsoft OAuth token exchange failed: ${safeString(data?.error_description || data?.error || res.status)}`,
    );
  }

  const accessToken = safeString(data.access_token);
  const senderEmail = accessToken ? await fetchMicrosoftAccountEmail({ accessToken, fetchImpl }) : "";

  return {
    accessToken,
    refreshToken: safeString(data.refresh_token),
    expiryDate: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null,
    scope: safeString(data.scope),
    tokenType: safeString(data.token_type),
    senderEmail,
    tokens: data,
  };
}

/**
 * Microsoft access tokens are short-lived (~60-90 min) and there is no client-side
 * SDK (like googleapis) transparently refreshing them here — callers must refresh
 * explicitly using the stored refresh token before/while calling Graph.
 */
export async function refreshMicrosoftAccessToken({
  refreshToken,
  redirectUri,
  scopes,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = getMicrosoftOAuthAppConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Microsoft OAuth app is not configured (CLIENT_ID / CLIENT_SECRET).");
  }
  const token = safeString(refreshToken);
  if (!token) throw new Error("refreshMicrosoftAccessToken: refreshToken required.");

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: token,
    redirect_uri: redirectUri || config.redirectUri,
    ...(Array.isArray(scopes) && scopes.length ? { scope: scopes.join(" ") } : {}),
  });

  const res = await fetchImpl(authorityUrl(config.tenantId, "token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Microsoft OAuth token refresh failed: ${safeString(data?.error_description || data?.error || res.status)}`,
    );
  }
  return {
    accessToken: safeString(data.access_token),
    // Microsoft sometimes rotates the refresh token; fall back to the one we sent.
    refreshToken: safeString(data.refresh_token) || token,
    expiryDate: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null,
    scope: safeString(data.scope),
    tokenType: safeString(data.token_type),
  };
}

async function fetchMicrosoftAccountEmail({ accessToken, fetchImpl = globalThis.fetch } = {}) {
  try {
    const res = await fetchImpl(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${safeString(accessToken)}` },
    });
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    return safeString(data?.mail || data?.userPrincipalName);
  } catch {
    return "";
  }
}

export function microsoftScopesIncludeMailSend(...scopeParts) {
  const joined = scopeParts.map((part) => safeString(part)).filter(Boolean).join(" ");
  return /Mail\.Send/i.test(joined);
}

export function microsoftScopesIncludeCalendar(...scopeParts) {
  const joined = scopeParts.map((part) => safeString(part)).filter(Boolean).join(" ");
  return /Calendars\.(ReadWrite|Read)/i.test(joined);
}

/**
 * Call Microsoft Graph with a Bearer token, refreshing once via the stored refresh
 * token when there is no access token yet or Graph returns 401 (expired token).
 * Returns the raw fetch Response plus whatever access token was actually used, so
 * callers can reuse it for a follow-up call (e.g. draft-then-send) without refreshing twice.
 */
export async function callMicrosoftGraph({
  path,
  method = "GET",
  body = null,
  accessToken = null,
  refreshToken = null,
  fetchImpl = globalThis.fetch,
  headers = {},
} = {}) {
  const url = /^https?:\/\//i.test(String(path ?? "")) ? path : `${GRAPH_BASE}${path}`;
  const doFetch = (token) => fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let token = safeString(accessToken);
  let res = token ? await doFetch(token) : null;

  if ((!res || res.status === 401) && safeString(refreshToken)) {
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken, fetchImpl });
    token = refreshed.accessToken;
    res = await doFetch(token);
    return { res, accessToken: token, refreshedToken: refreshed };
  }

  if (!res) {
    throw new Error("callMicrosoftGraph: no access token and no refresh token available.");
  }
  return { res, accessToken: token, refreshedToken: null };
}
