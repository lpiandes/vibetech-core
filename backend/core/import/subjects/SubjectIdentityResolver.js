import crypto from "node:crypto";
import { normalizeAddress, normalizeIdentityText } from "./SubjectImportNormalizer.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function subjectAddressKey(subject) {
  const attrs = subject?.keyAttributes ?? {};
  return normalizeAddress({
    address: attrs.address,
    unit: attrs.unit,
    city: attrs.city,
    state: attrs.state,
    postalCode: attrs.postalCode,
  });
}

export function deterministicSubjectId({ workspaceId, sourceSystem, normalizedRow } = {}) {
  const identity = normalizedRow?.externalReference || normalizedRow?.normalizedAddress;
  return `subj_${normalizeIdentityText(normalizedRow?.subjectType || "subject").replace(/[^a-z0-9]/g, "_")}_${hashId(
    `${workspaceId}:${sourceSystem}:${identity}`,
  )}`;
}

export function resolveSubjectIdentity({
  normalizedRow,
  canonicalSnapshot,
  workspaceId,
  sourceSystem,
} = {}) {
  const subjects = safeArray(canonicalSnapshot?.subjects);
  if (!normalizedRow?.hasTrustedIdentity) {
    return {
      subjectId: null,
      matchTier: "weak",
      isNew: false,
      matchedSubject: null,
      identityConflict: false,
      conflictingSubjectIds: [],
      reviewReason: "weak_or_missing_subject_identity",
    };
  }

  const matches = new Map();
  if (normalizedRow.externalReference) {
    for (const subject of subjects) {
      if (safeArray(subject.externalReferences).map(String).includes(String(normalizedRow.externalReference))) {
        matches.set(String(subject.id), { subject, tier: "external_ref" });
      }
    }
  }

  if (normalizedRow.normalizedAddress) {
    for (const subject of subjects) {
      if (subjectAddressKey(subject) === normalizedRow.normalizedAddress) {
        matches.set(String(subject.id), { subject, tier: matches.get(String(subject.id))?.tier ?? "address" });
      }
    }
  }

  const matched = [...matches.values()];
  if (matched.length > 1) {
    return {
      subjectId: null,
      matchTier: "conflict",
      isNew: false,
      matchedSubject: null,
      identityConflict: true,
      conflictingSubjectIds: matched.map((m) => String(m.subject.id)),
      reviewReason: "conflicting_subject_identity",
    };
  }

  if (matched.length === 1) {
    return {
      subjectId: String(matched[0].subject.id),
      matchTier: matched[0].tier,
      isNew: false,
      matchedSubject: matched[0].subject,
      identityConflict: false,
      conflictingSubjectIds: [],
      reviewReason: null,
    };
  }

  const subjectId = deterministicSubjectId({ workspaceId, sourceSystem, normalizedRow });
  return {
    subjectId,
    matchTier: "new",
    isNew: true,
    matchedSubject: null,
    identityConflict: false,
    conflictingSubjectIds: [],
    reviewReason: null,
  };
}
