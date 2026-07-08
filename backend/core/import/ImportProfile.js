import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createImportProfile({
  profileId,
  sourceSystem,
  label,
  columnMap = {},
  relationshipMappings = {},
  statusMappings = {},
  consentMappings = {},
  qualificationFieldMap = {},
} = {}) {
  if (!profileId) throw new Error("ImportProfile: profileId required.");
  if (!sourceSystem) throw new Error("ImportProfile: sourceSystem required.");

  return deepFreeze({
    profileId: String(profileId),
    sourceSystem: String(sourceSystem),
    label: String(label ?? profileId),
    columnMap: deepFreeze({ ...columnMap }),
    relationshipMappings: deepFreeze({ ...relationshipMappings }),
    statusMappings: deepFreeze({ ...statusMappings }),
    consentMappings: deepFreeze({ ...consentMappings }),
    qualificationFieldMap: deepFreeze({ ...qualificationFieldMap }),
  });
}

export function resolveImportProfile({ installationResult, sourceSystem, profileId } = {}) {
  const profiles = installationResult?.importProfiles ?? [];
  if (!profiles.length) return null;

  if (profileId) {
    const byId = profiles.find((p) => String(p.profileId) === String(profileId));
    if (byId) return byId;
  }

  const bySystem = profiles.find((p) => String(p.sourceSystem) === String(sourceSystem));
  if (bySystem) return bySystem;

  return profiles.find((p) => String(p.profileId) === "generic_csv") ?? profiles[0] ?? null;
}

export function buildEffectiveColumnMap({ profile, columnMapping = {} } = {}) {
  const base = profile?.columnMap ?? {};
  const overrides = columnMapping && typeof columnMapping === "object" ? columnMapping : {};
  return { ...base, ...overrides };
}

export function suggestColumnMapFromHeaders(headers = [], profile = null) {
  const base = profile?.columnMap ?? {};
  const suggestions = { ...base };
  const normalizedHeaders = headers.map((h) => String(h ?? "").trim());

  for (const header of normalizedHeaders) {
    const lower = header.toLowerCase();
    if (suggestions[header]) continue;
    if (lower.includes("email")) suggestions[header] = "email";
    else if (lower.includes("phone") || lower.includes("mobile")) suggestions[header] = "phone";
    else if (lower === "first name" || lower === "firstname") suggestions[header] = "firstName";
    else if (lower === "last name" || lower === "lastname") suggestions[header] = "lastName";
    else if (lower === "name" || lower === "full name") suggestions[header] = "fullName";
    else if (lower.includes("contact id") || lower.includes("external id")) suggestions[header] = "externalContactId";
    else if (lower === "status" || lower.includes("client type")) suggestions[header] = "relationshipType";
    else if (lower.includes("note")) suggestions[header] = "notes";
    else if (lower.includes("tag")) suggestions[header] = "tags";
    else if (lower.includes("source") && !lower.includes("consent")) suggestions[header] = "leadSource";
  }

  return suggestions;
}
