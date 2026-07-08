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
  importKind = "contact",
  defaultSubjectType = null,
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
    importKind: String(importKind ?? "contact"),
    defaultSubjectType: defaultSubjectType ? String(defaultSubjectType) : null,
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
  const importKind = String(profile?.importKind ?? "contact");

  for (const header of normalizedHeaders) {
    const lower = header.toLowerCase();
    if (suggestions[header]) continue;
    if (importKind === "subject") {
      if (lower.includes("external") || lower.includes("property id") || lower.includes("listing id")) {
        suggestions[header] = "externalSubjectId";
      } else if (lower === "name" || lower.includes("property name") || lower.includes("listing name")) {
        suggestions[header] = "displayName";
      } else if (lower.includes("address")) suggestions[header] = "address";
      else if (lower === "unit" || lower.includes("unit")) suggestions[header] = "unit";
      else if (lower === "city") suggestions[header] = "city";
      else if (lower === "state") suggestions[header] = "state";
      else if (lower.includes("zip") || lower.includes("postal")) suggestions[header] = "postalCode";
      else if (lower.includes("price") || lower.includes("rent")) suggestions[header] = "price";
      else if (lower.includes("bed")) suggestions[header] = "bedrooms";
      else if (lower.includes("bath")) suggestions[header] = "bathrooms";
      else if (lower.includes("property type")) suggestions[header] = "propertyType";
      else if (lower === "status" || lower.includes("listing status")) suggestions[header] = "status";
      else if (lower.includes("url") || lower.includes("link")) suggestions[header] = "listingUrl";
      else if (lower.includes("description")) suggestions[header] = "description";
      else if (lower.includes("property of interest")) suggestions[header] = "propertyOfInterest";
      continue;
    }

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
