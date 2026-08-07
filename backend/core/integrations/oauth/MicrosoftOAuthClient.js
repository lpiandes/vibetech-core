/**
 * Microsoft OAuth client for Outlook / Microsoft 365 Graph.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function isMicrosoftOAuthConfigured() {
  return Boolean(
    String(process.env.MICROSOFT_CLIENT_ID ?? "").trim()
    && String(process.env.MICROSOFT_CLIENT_SECRET ?? "").trim(),
  );
}

export function microsoftTenantId() {
  return String(process.env.MICROSOFT_TENANT_ID ?? "common").trim() || "common";
}

export function buildMicrosoftAuthorizeUrl({
  redirectUri,
  state,
  scopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "Mail.Send",
    "Calendars.ReadWrite",
    "User.Read",
  ],
} = {}) {
  const clientId = String(process.env.MICROSOFT_CLIENT_ID ?? "").trim();
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID missing");
  const url = new URL(`https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", String(redirectUri));
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scopes.join(" "));
  if (state) url.searchParams.set("state", String(state));
  return url.toString();
}

export async function exchangeMicrosoftCode({
  code,
  redirectUri,
  fetchImpl = fetch,
} = {}) {
  const clientId = String(process.env.MICROSOFT_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    return deepFreeze({ ok: false, reason: "microsoft_oauth_not_configured" });
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code ?? ""),
    redirect_uri: String(redirectUri ?? ""),
    grant_type: "authorization_code",
  });
  const res = await fetchImpl(
    `https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.access_token) {
    return deepFreeze({
      ok: false,
      reason: "token_exchange_failed",
      detail: payload,
    });
  }
  return deepFreeze({
    ok: true,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresIn: payload.expires_in ?? null,
    scope: payload.scope ?? null,
  });
}

export async function refreshMicrosoftAccessToken({
  refreshToken,
  fetchImpl = fetch,
} = {}) {
  const clientId = String(process.env.MICROSOFT_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET ?? "").trim();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(refreshToken ?? ""),
    grant_type: "refresh_token",
  });
  const res = await fetchImpl(
    `https://login.microsoftonline.com/${microsoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.access_token) {
    return deepFreeze({ ok: false, reason: "refresh_failed", detail: payload });
  }
  return deepFreeze({
    ok: true,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresIn: payload.expires_in ?? null,
  });
}
