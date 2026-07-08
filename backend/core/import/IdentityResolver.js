import { formatExternalReference } from "./ImportSourceDescriptor.js";
import { IMPORT_MATCH_TIERS } from "./ImportRunStatus.js";
import {
  normalizeEmail,
  normalizePhone,
  stablePartyIdFromEmail,
  stablePartyIdFromPhone,
} from "./normalizers/ContactFieldNormalizer.js";

function partyHasExternalRef(party, externalReference) {
  const refs = party?.externalReferences ?? [];
  return refs.some((r) => String(r) === String(externalReference));
}

function partyHasContactMethod(party, value) {
  const methods = party?.contactMethods ?? [];
  return methods.some((m) => String(m).toLowerCase() === String(value).toLowerCase());
}

function findPartyByExternalRef(snapshot, externalReference) {
  return snapshot.parties.find((p) => partyHasExternalRef(p, externalReference)) ?? null;
}

function findPartyByEmail(snapshot, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const byId = snapshot.parties.find((p) => String(p.id) === stablePartyIdFromEmail(normalized));
  if (byId) return byId;
  return snapshot.parties.find((p) => partyHasContactMethod(p, normalized)) ?? null;
}

function findPartyByPhone(snapshot, phone) {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  const byId = snapshot.parties.find((p) => String(p.id) === stablePartyIdFromPhone(digits));
  if (byId) return byId;
  return (
    snapshot.parties.find((p) =>
      (p.contactMethods ?? []).some((m) => normalizePhone(m) === digits),
    ) ?? null
  );
}

function findNameSuggestions(snapshot, displayName) {
  const name = String(displayName ?? "").trim().toLowerCase();
  if (!name || name.length < 3) return [];
  return snapshot.parties.filter((p) => String(p.displayName ?? "").trim().toLowerCase() === name);
}

export function resolveIdentity({ normalizedRow, sourceSystem, canonicalSnapshot } = {}) {
  const externalId = normalizedRow?.externalContactId;
  const externalReference = externalId ? formatExternalReference(sourceSystem, externalId) : null;

  let emailParty = null;
  let phoneParty = null;
  let externalParty = null;

  if (externalReference) {
    externalParty = findPartyByExternalRef(canonicalSnapshot, externalReference);
    if (externalParty) {
      return {
        partyId: String(externalParty.id),
        matchTier: IMPORT_MATCH_TIERS.EXTERNAL_REF,
        isNew: false,
        suggestedParties: [],
        externalReference,
      };
    }
  }

  if (normalizedRow.email) {
    emailParty = findPartyByEmail(canonicalSnapshot, normalizedRow.email);
  }

  if (normalizedRow.phone) {
    phoneParty = findPartyByPhone(canonicalSnapshot, normalizedRow.phone);
  }

  if (emailParty && phoneParty && String(emailParty.id) !== String(phoneParty.id)) {
    return {
      partyId: null,
      matchTier: null,
      isNew: false,
      suggestedParties: [emailParty, phoneParty],
      externalReference,
      identityConflict: {
        code: "email_phone_conflict",
        emailPartyId: String(emailParty.id),
        phonePartyId: String(phoneParty.id),
      },
    };
  }

  if (emailParty) {
    return {
      partyId: String(emailParty.id),
      matchTier: IMPORT_MATCH_TIERS.EMAIL,
      isNew: false,
      suggestedParties: [],
      externalReference,
    };
  }

  if (phoneParty) {
    return {
      partyId: String(phoneParty.id),
      matchTier: IMPORT_MATCH_TIERS.PHONE,
      isNew: false,
      suggestedParties: [],
      externalReference,
    };
  }

  const suggestions = findNameSuggestions(canonicalSnapshot, normalizedRow.displayName);
  if (suggestions.length) {
    return {
      partyId: null,
      matchTier: IMPORT_MATCH_TIERS.NAME_SUGGESTED,
      isNew: false,
      suggestedParties: suggestions,
      externalReference,
    };
  }

  const newPartyId =
    stablePartyIdFromEmail(normalizedRow.email) ??
    stablePartyIdFromPhone(normalizedRow.phone) ??
    (externalReference ? `party_import_${externalReference.replace(/[^a-zA-Z0-9]/g, "_")}` : null) ??
    `party_import_${sourceSystem}_${normalizedRow.rowNumber}`;

  return {
    partyId: newPartyId,
    matchTier: IMPORT_MATCH_TIERS.NEW,
    isNew: true,
    suggestedParties: [],
    externalReference,
  };
}
