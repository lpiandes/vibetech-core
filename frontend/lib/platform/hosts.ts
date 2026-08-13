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

/** Absolute or same-origin URL for the insurance landing page. */
export function insuranceEntryUrl() {
  return INSURANCE_HOST_URL ? `${INSURANCE_HOST_URL}/insurance` : "/insurance";
}

/** Absolute or same-origin URL for an agent's dashboard. */
export function insuranceDashboardUrl(businessId: string) {
  const path = insuranceDashboardPath(businessId);
  return INSURANCE_HOST_URL ? `${INSURANCE_HOST_URL}${path}` : path;
}
