const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function resolveInvitationAppBaseUrl() {
  return String(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "").trim().replace(/\/$/, "");
}

export function validateProductionInvitationAppUrl() {
  if (process.env.NODE_ENV !== "production") {
    return { valid: true, baseUrl: resolveInvitationAppBaseUrl() || "http://localhost:3000" };
  }

  const baseUrl = resolveInvitationAppBaseUrl();
  if (!baseUrl) {
    return { valid: false, reason: "missing_app_url", message: "APP_URL or NEXTAUTH_URL must be configured in production." };
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { valid: false, reason: "invalid_app_url", message: "APP_URL must be a valid absolute URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "insecure_app_url", message: "Production APP_URL must use HTTPS." };
  }

  if (LOCALHOST_PATTERN.test(baseUrl)) {
    return { valid: false, reason: "localhost_app_url", message: "Production APP_URL cannot point to localhost." };
  }

  return { valid: true, baseUrl };
}
