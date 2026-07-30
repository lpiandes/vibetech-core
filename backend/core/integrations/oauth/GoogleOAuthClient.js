import { google } from "googleapis";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Read-only access. Search Console is an SEO reporting source; it never
// changes a site's search ranking or publishes website content.
export const GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleOAuthAppConfigured() {
  return Boolean(
    safeString(process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)
    && safeString(process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)
    && safeString(process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI),
  );
}

export function getGoogleOAuthAppConfig() {
  return {
    clientId: safeString(process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID),
    clientSecret: safeString(process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: safeString(process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI),
  };
}

export function createGoogleOAuth2Client({ redirectUri } = {}) {
  const config = getGoogleOAuthAppConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google OAuth app is not configured (CLIENT_ID / CLIENT_SECRET).");
  }
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    redirectUri || config.redirectUri,
  );
}

/**
 * @param {{state?: string, scopes?: string[], redirectUri?: string, accessType?: string, prompt?: string}} options
 */
export function buildGoogleAuthorizeUrl({
  state,
  scopes,
  redirectUri,
  accessType = "offline",
  prompt = "consent",
  includeGrantedScopes = true,
} = {}) {
  const client = createGoogleOAuth2Client({ redirectUri });
  return client.generateAuthUrl({
    access_type: accessType,
    prompt,
    scope: Array.isArray(scopes) ? scopes : [],
    state: String(state ?? ""),
    include_granted_scopes: includeGrantedScopes,
  });
}

export async function exchangeGoogleAuthorizationCode({ code, redirectUri } = {}) {
  const client = createGoogleOAuth2Client({ redirectUri });
  const { tokens } = await client.getToken(String(code ?? ""));
  client.setCredentials(tokens);

  let senderEmail = "";
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    senderEmail = safeString(me?.data?.email);
  } catch {
    senderEmail = "";
  }

  return {
    accessToken: safeString(tokens.access_token),
    refreshToken: safeString(tokens.refresh_token),
    expiryDate: tokens.expiry_date ?? null,
    scope: safeString(tokens.scope),
    tokenType: safeString(tokens.token_type),
    senderEmail,
    tokens,
  };
}

export function createGoogleAuthedClient({ refreshToken, accessToken = null } = {}) {
  const client = createGoogleOAuth2Client();
  client.setCredentials({
    refresh_token: safeString(refreshToken),
    ...(accessToken ? { access_token: safeString(accessToken) } : {}),
  });
  return client;
}
