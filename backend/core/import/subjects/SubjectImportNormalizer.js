export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeIdentityText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNumber(value) {
  const raw = normalizeText(value).replace(/[$,]/g, "");
  return raw ? Number(raw) : null;
}

function emptyToNull(value) {
  const clean = normalizeText(value);
  return clean ? clean : null;
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  );
}

export function normalizeAddress({ address, unit, city, state, postalCode } = {}) {
  const parts = [address, unit, city, state, postalCode].map(normalizeIdentityText).filter(Boolean);
  return parts.join("|");
}

export function mapSourceRowToSubjectFields({ sourceRow, columnMap = {}, profile = null } = {}) {
  const canonical = {};
  const unmapped = {};
  for (const [sourceKey, rawValue] of Object.entries(sourceRow ?? {})) {
    const target = columnMap[sourceKey] ?? profile?.columnMap?.[sourceKey];
    if (target) canonical[target] = rawValue;
    else unmapped[sourceKey] = rawValue;
  }
  return { canonical, unmapped };
}

export function buildNormalizedSubjectRow({
  canonical = {},
  sourceSystem,
  rowNumber,
  profile = null,
} = {}) {
  const externalSubjectId =
    emptyToNull(canonical.externalSubjectId) ??
    emptyToNull(canonical.externalPropertyId) ??
    emptyToNull(canonical.externalListingId) ??
    emptyToNull(canonical.propertyId) ??
    emptyToNull(canonical.listingId);
  const subjectType =
    emptyToNull(canonical.subjectType) ??
    emptyToNull(profile?.defaultSubjectType) ??
    emptyToNull(profile?.subjectType) ??
    "listing";
  const address = emptyToNull(canonical.address);
  const unit = emptyToNull(canonical.unit);
  const city = emptyToNull(canonical.city);
  const state = emptyToNull(canonical.state);
  const postalCode = emptyToNull(canonical.postalCode ?? canonical.zip);
  const displayName =
    emptyToNull(canonical.displayName) ??
    emptyToNull(canonical.name) ??
    emptyToNull(canonical.propertyName) ??
    address;
  const normalizedAddress = normalizeAddress({ address, unit, city, state, postalCode });
  const normalizedDisplayName = normalizeIdentityText(displayName);
  const externalReference = externalSubjectId ? `${String(sourceSystem)}:${externalSubjectId}` : null;
  const keyAttributes = compactObject({
    address,
    unit,
    city,
    state,
    postalCode,
    price: cleanNumber(canonical.price ?? canonical.rent),
    bedrooms: cleanNumber(canonical.bedrooms ?? canonical.beds),
    bathrooms: cleanNumber(canonical.bathrooms ?? canonical.baths),
    propertyType: emptyToNull(canonical.propertyType),
    listingStatus: emptyToNull(canonical.status ?? canonical.listingStatus),
    listingUrl: emptyToNull(canonical.listingUrl ?? canonical.url),
    description: emptyToNull(canonical.description),
  });

  return {
    rowNumber: Number(rowNumber ?? 0),
    sourceSystem: String(sourceSystem ?? ""),
    externalSubjectId,
    externalReference,
    subjectType: String(subjectType),
    displayName,
    normalizedDisplayName,
    address,
    normalizedAddress,
    keyAttributes,
    externalReferences: externalReference ? [externalReference] : [],
    propertyOfInterest: emptyToNull(canonical.propertyOfInterest),
    hasTrustedIdentity: Boolean(externalReference || normalizedAddress),
  };
}
