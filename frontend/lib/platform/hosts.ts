/**
 * Public Social Checker surface. Kept as a plain constant (no server-only
 * imports) so it is safe to use from both server components and middleware.
 */
export const SOCIAL_CHECKER_HOST_URL =
  process.env.NEXT_PUBLIC_SOCIAL_CHECKER_URL ?? "https://social.vtechdevelopment.com/social-checker";
