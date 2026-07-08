/**
 * Universal merge policies for import planning (dry-run simulation).
 */

const GENERIC_NAMES = new Set(["contact", "unknown", "n/a", "na", "-", ""]);

export function isGenericDisplayName(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  return !normalized || GENERIC_NAMES.has(normalized);
}

export function shouldFillIfEmpty(existing, incoming) {
  const ex = String(existing ?? "").trim();
  const inc = String(incoming ?? "").trim();
  if (!inc) return false;
  if (!ex) return true;
  if (isGenericDisplayName(ex) && !isGenericDisplayName(inc)) return true;
  return false;
}

export function namesConflictMaterially(existingName, incomingName) {
  const a = String(existingName ?? "").trim().toLowerCase();
  const b = String(incomingName ?? "").trim().toLowerCase();
  if (!a || !b || a === b) return false;
  if (isGenericDisplayName(a) || isGenericDisplayName(b)) return false;
  return !a.includes(b) && !b.includes(a);
}

export function strongerConsentStatus(existing, incoming) {
  const rank = { suppressed: 3, opt_out: 2, opt_in: 1 };
  const ex = rank[String(existing ?? "").toLowerCase()] ?? 0;
  const inc = rank[String(incoming ?? "").toLowerCase()] ?? 0;
  if (ex > inc) return existing;
  if (inc > ex) return incoming;
  return existing ?? incoming;
}

export function consentWouldWeakenExisting(existingStatus, plannedStatus) {
  const rank = { suppressed: 3, opt_out: 2, opt_in: 1 };
  const ex = rank[String(existingStatus ?? "").toLowerCase()] ?? 0;
  const inc = rank[String(plannedStatus ?? "").toLowerCase()] ?? 0;
  return ex > inc;
}
