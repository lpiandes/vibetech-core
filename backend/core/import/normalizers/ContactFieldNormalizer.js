export function normalizeEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (!normalized.includes("@")) return null;
  return normalized;
}

export function normalizePhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits;
}

export function stablePartyIdFromEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return `party_${normalized.replace(/[@.]/g, "_")}`;
}

export function stablePartyIdFromPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `party_phone_${digits}`;
}

export function composeDisplayName({ firstName, lastName, fullName } = {}) {
  const full = String(fullName ?? "").trim();
  if (full) return full;
  const first = String(firstName ?? "").trim();
  const last = String(lastName ?? "").trim();
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || null;
}

export function parseBoolean(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return null;
}

export function parseIsoDate(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
}

export function mapSourceRowToCanonicalFields({ sourceRow, columnMap, profile } = {}) {
  const canonical = {};
  const unmapped = { ...sourceRow };

  for (const [sourceColumn, canonicalField] of Object.entries(columnMap ?? {})) {
    if (!canonicalField || !(sourceColumn in sourceRow)) continue;
    canonical[String(canonicalField)] = sourceRow[sourceColumn];
    delete unmapped[sourceColumn];
  }

  const relationshipKey = canonical.relationshipType;
  if (relationshipKey && profile?.relationshipMappings) {
    const mapped = profile.relationshipMappings[String(relationshipKey).trim().toLowerCase()];
    if (mapped) canonical.relationshipType = mapped;
  }

  const statusKey = canonical.status;
  if (statusKey && profile?.statusMappings) {
    const mapped = profile.statusMappings[String(statusKey).trim().toLowerCase()];
    if (mapped) canonical.status = mapped;
  }

  return { canonical, unmapped };
}

export function buildNormalizedContactRow({ canonical, sourceSystem, rowNumber } = {}) {
  const email = normalizeEmail(canonical.email);
  const phone = normalizePhone(canonical.phone);
  const displayName = composeDisplayName({
    firstName: canonical.firstName,
    lastName: canonical.lastName,
    fullName: canonical.fullName,
  });

  return {
    rowNumber,
    sourceSystem,
    externalContactId: String(canonical.externalContactId ?? "").trim() || null,
    displayName,
    email,
    phone,
    status: String(canonical.status ?? "").trim() || null,
    tags: normalizeTags(canonical.tags),
    clientType: String(canonical.clientType ?? "").trim() || null,
    leadSource: String(canonical.leadSource ?? "").trim() || null,
    assignedAgentName: String(canonical.assignedAgentName ?? "").trim() || null,
    notes: String(canonical.notes ?? "").trim() || null,
    createdDate: parseIsoDate(canonical.createdDate),
    updatedDate: parseIsoDate(canonical.updatedDate),
    relationshipType: String(canonical.relationshipType ?? "").trim() || null,
    lifecycleFrom: String(canonical.lifecycleFrom ?? "").trim() || null,
    lifecycleTo: String(canonical.lifecycleTo ?? "").trim() || null,
    emailOptIn: parseBoolean(canonical.emailOptIn),
    emailOptOut: parseBoolean(canonical.emailOptOut),
    smsOptIn: parseBoolean(canonical.smsOptIn),
    smsOptOut: parseBoolean(canonical.smsOptOut),
    doNotContact: parseBoolean(canonical.doNotContact),
    consentSource: String(canonical.consentSource ?? "").trim() || null,
    consentTimestamp: parseIsoDate(canonical.consentTimestamp),
    qualification: extractQualificationFields(canonical),
  };
}

function extractQualificationFields(canonical) {
  const keys = [
    "intent",
    "preferredLocation",
    "priceRange",
    "propertyType",
    "bedrooms",
    "bathrooms",
    "decisionTimeline",
    "financingStatus",
    "currentHomeOwnership",
    "needsToSellBeforeBuying",
    "bestTimeForFollowUp",
    "propertyOfInterest",
    "showingAvailability",
    "timeline",
  ];
  const out = {};
  for (const key of keys) {
    if (canonical[key] !== undefined && canonical[key] !== null && String(canonical[key]).trim() !== "") {
      out[key] = canonical[key];
    }
  }
  return out;
}
