/**
 * Public Social Checker surface. Kept as a plain constant (no server-only
 * imports) so it is safe to use from both server components and middleware.
 */
export const SOCIAL_CHECKER_HOST_URL =
  process.env.NEXT_PUBLIC_SOCIAL_CHECKER_URL ?? "https://social.vtechdevelopment.com/social-checker";

/**
 * Optional dedicated FE host. Empty = same app origin (`/insurance` on app.vtechdevelopment.com).
 * Set NEXT_PUBLIC_INSURANCE_HOST_URL=https://insurance.vtechdevelopment.com once DNS is live.
 */
export const INSURANCE_HOST_URL = String(process.env.NEXT_PUBLIC_INSURANCE_HOST_URL ?? "")
  .trim()
  .replace(/\/$/, "");

export function insuranceDashboardPath(businessId: string) {
  return `/insurance/${encodeURIComponent(businessId)}`;
}

export function insuranceSetupPath(businessId: string) {
  return `/insurance/setup/${encodeURIComponent(businessId)}`;
}

export function insuranceAgreementPath(businessId: string) {
  return `/insurance/setup/${encodeURIComponent(businessId)}/agreement`;
}

export function insuranceBillingPath(businessId?: string | null) {
  const id = String(businessId ?? "").trim();
  return id ? `/insurance/billing?businessId=${encodeURIComponent(id)}` : "/insurance/billing";
}

/** Append extra query params to a same-origin path that may already have a query. */
export function withQuery(path: string, extra: Record<string, string | null | undefined> = {}) {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of Object.entries(extra)) {
    const next = value == null ? "" : String(value).trim();
    if (next) url.searchParams.set(key, next);
  }
  return `${url.pathname}${url.search}`;
}

/** Absolute or same-origin URL for the insurance landing page. */
export function insuranceEntryUrl() {
  return INSURANCE_HOST_URL ? `${INSURANCE_HOST_URL}/insurance` : "/insurance";
}

/** Absolute or same-origin URL for an agent's dashboard. */
export function insuranceDashboardUrl(businessId: string) {
  const path = insuranceDashboardPath(businessId);
  return INSURANCE_HOST_URL ? `${INSURANCE_HOST_URL}${path}` : path;
}
