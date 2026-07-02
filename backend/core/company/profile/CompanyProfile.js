function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * Canonical CompanyProfile (immutable).
 *
 * Notes:
 * - This module does not contain business orchestration; it simply freezes validated profile data.
 * - Use CompanyProfileBuilder to create a complete profile deterministically.
 */
export function createCompanyProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("createCompanyProfile: profile object required.");
  }
  return deepFreeze(profile);
}

