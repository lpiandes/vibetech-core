import { namesConflictMaterially, consentWouldWeakenExisting } from "./ImportMergePolicy.js";
import { IMPORT_MATCH_TIERS } from "./ImportRunStatus.js";

function warning(code, message, details = {}) {
  return { code, message, ...details };
}

function error(code, message, details = {}) {
  return { code, message, ...details };
}

export function detectIntraFileDuplicate({ normalizedRow, seenExternalRefs, seenEmails, seenPhones } = {}) {
  const warnings = [];
  const errors = [];

  const ext = normalizedRow.externalContactId
    ? `${normalizedRow.sourceSystem}:${normalizedRow.externalContactId}`
    : null;
  if (ext && seenExternalRefs.has(ext)) {
    errors.push(error("duplicate_external_id_in_file", "Duplicate external contact id in file.", { externalId: ext }));
  } else if (ext) {
    seenExternalRefs.add(ext);
  }

  if (normalizedRow.email) {
    if (seenEmails.has(normalizedRow.email)) {
      errors.push(error("duplicate_email_in_file", "Duplicate email in file.", { email: normalizedRow.email }));
    } else {
      seenEmails.add(normalizedRow.email);
    }
  }

  if (normalizedRow.phone) {
    if (seenPhones.has(normalizedRow.phone)) {
      warnings.push(warning("duplicate_phone_in_file", "Duplicate phone in file.", { phone: normalizedRow.phone }));
    } else {
      seenPhones.add(normalizedRow.phone);
    }
  }

  return { warnings, errors };
}

export function detectCanonicalConflicts({
  normalizedRow,
  identity,
  canonicalSnapshot,
} = {}) {
  const warnings = [];
  const errors = [];

  if (identity.identityConflict) {
    errors.push(
      error("email_phone_identity_conflict", "Email and phone resolve to different existing parties.", {
        ...identity.identityConflict,
      }),
    );
    return { warnings, errors };
  }

  if (identity.matchTier === IMPORT_MATCH_TIERS.NAME_SUGGESTED) {
    warnings.push(
      warning("name_suggested_match", "Name matches existing party but email/phone do not — review required.", {
        suggestedPartyIds: identity.suggestedParties.map((p) => String(p.id)),
      }),
    );
    return { warnings, errors };
  }

  if (!identity.partyId || identity.isNew) {
    if (!normalizedRow.email && !normalizedRow.phone && !normalizedRow.externalContactId) {
      warnings.push(warning("weak_identity", "No email, phone, or external id — new party identity is weak."));
    }
    return { warnings, errors };
  }

  const party = canonicalSnapshot.parties.find((p) => String(p.id) === String(identity.partyId));
  if (!party) return { warnings, errors };

  if (
    normalizedRow.displayName &&
    namesConflictMaterially(party.displayName, normalizedRow.displayName)
  ) {
    warnings.push(
      warning("name_conflict", "Imported name differs from existing party name.", {
        existingName: party.displayName,
        incomingName: normalizedRow.displayName,
      }),
    );
  }

  if (identity.externalReference && !party.externalReferences?.includes(identity.externalReference)) {
    warnings.push(
      warning("cross_source_match", "Matched existing party via email/phone; external reference will be additive.", {
        partyId: party.id,
        externalReference: identity.externalReference,
      }),
    );
  }

  return { warnings, errors };
}

export function detectConsentConflicts({ normalizedRow, partyId, canonicalSnapshot, plannedConsents = [] } = {}) {
  const warnings = [];
  const errors = [];
  if (!partyId) return { warnings, errors };

  const existing = canonicalSnapshot.preferencesByPartyId?.[partyId] ?? [];

  for (const planned of plannedConsents) {
    const match = existing.find(
      (p) => String(p.channel) === String(planned.channel) && String(p.scope) === String(planned.scope ?? "all"),
    );
    if (match && consentWouldWeakenExisting(match.status, planned.status)) {
      errors.push(
        error("consent_weaken_blocked", "Import would weaken existing opt-out/suppressed consent.", {
          channel: planned.channel,
          existingStatus: match.status,
          plannedStatus: planned.status,
        }),
      );
    } else if (match && match.status !== planned.status) {
      warnings.push(
        warning("consent_conflict", "Consent evidence conflicts with existing preference.", {
          channel: planned.channel,
          existingStatus: match.status,
          plannedStatus: planned.status,
        }),
      );
    }
  }

  if (!plannedConsents.length && (normalizedRow.email || normalizedRow.phone)) {
    // Explicit: contact info alone produces no consent action — no warning needed.
  }

  return { warnings, errors };
}

export function detectRelationshipConflicts({
  relationshipType,
  partyId,
  canonicalSnapshot,
  lifecycleTransitions = [],
  lifecycleFrom,
  lifecycleTo,
} = {}) {
  const warnings = [];
  const errors = [];
  if (!relationshipType || !partyId) return { warnings, errors };

  const activeTypes = canonicalSnapshot.activeRelationshipTypesByPartyId?.[partyId] ?? [];
  if (activeTypes.includes(relationshipType)) {
    return { warnings, errors };
  }

  if (lifecycleFrom && lifecycleTo) {
    const allowed = lifecycleTransitions.some(
      (t) => String(t.from) === String(lifecycleFrom) && String(t.to) === String(lifecycleTo),
    );
    if (!allowed) {
      errors.push(
        error("invalid_lifecycle_transition", "Lifecycle transition is not permitted by package.", {
          from: lifecycleFrom,
          to: lifecycleTo,
        }),
      );
    }
  }

  return { warnings, errors };
}
