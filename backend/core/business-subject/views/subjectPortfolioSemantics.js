import { ENTITY_TYPES } from "../../references/EntityRef.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function resolvePortfolioSemantics(presentation = {}) {
  const semantics = presentation?.portfolioSemantics ?? {};
  return {
    inquiryRequestTypes: safeArray(semantics.inquiryRequestTypes).map(String),
    followUpWorkTypes: safeArray(semantics.followUpWorkTypes).map(String),
  };
}

export function isPortfolioInquiryRequest(request, presentation = {}) {
  if (!request) return false;
  const { inquiryRequestTypes } = resolvePortfolioSemantics(presentation);
  if (!inquiryRequestTypes.length) return false;
  return inquiryRequestTypes.includes(String(request.requestType));
}

export function isPortfolioFollowUpWork(work, presentation = {}) {
  if (!work) return false;
  const { followUpWorkTypes } = resolvePortfolioSemantics(presentation);
  if (!followUpWorkTypes.length) return false;
  return followUpWorkTypes.includes(String(work.workType));
}

export function isOpenRequest(request) {
  return !["closed", "cancelled", "rejected"].includes(String(request?.status ?? ""));
}

export function isOpenWork(work) {
  return !["completed", "cancelled", "closed"].includes(String(work?.status ?? ""));
}

export function isOverdueWork(work, nowISO) {
  if (!isOpenWork(work) || !work?.dueAt) return false;
  const dueMs = new Date(String(work.dueAt)).getTime();
  const nowMs = new Date(String(nowISO)).getTime();
  if (Number.isNaN(dueMs) || Number.isNaN(nowMs)) return false;
  return dueMs < nowMs;
}

export function entityRefMatches(ref, entityType, entityId) {
  return String(ref?.entityType) === String(entityType) && String(ref?.entityId) === String(entityId);
}

/**
 * Collect every subject identity that should be treated as the same canonical subject.
 * Includes canonical id, inbound alias ids (subj_<externalObjectId>), and linked external refs.
 */
export function collectSubjectIdentityIds(subjectId, businessSubjectRuntime) {
  const seed = String(subjectId ?? "");
  if (!seed) return [];

  const ids = new Set([seed]);

  const subject =
    businessSubjectRuntime?.getSubject?.(seed) ??
    (seed.startsWith("subj_") ? null : businessSubjectRuntime?.getSubject?.(`subj_${seed}`)) ??
    null;

  if (subject) {
    ids.add(String(subject.id));
    for (const ext of safeArray(subject.externalReferences)) {
      const extId = String(ext);
      if (!extId) continue;
      ids.add(extId);
      ids.add(`subj_${extId}`);
    }
  }

  if (seed.startsWith("subj_")) {
    const suffix = seed.slice("subj_".length);
    if (suffix) {
      ids.add(suffix);
      const suffixSubject =
        businessSubjectRuntime?.getSubject?.(suffix) ??
        businessSubjectRuntime?.getSubject?.(`subj_${suffix}`) ??
        null;
      if (suffixSubject) ids.add(String(suffixSubject.id));
    }
  } else {
    ids.add(`subj_${seed}`);
  }

  const seedIds = [...ids];
  for (const candidate of safeArray(businessSubjectRuntime?.getSubjects?.())) {
    const candidateId = String(candidate.id);
    const extRefs = safeArray(candidate.externalReferences).map(String);
    const overlaps =
      seedIds.includes(candidateId) ||
      extRefs.some((ext) => seedIds.includes(ext) || seedIds.includes(`subj_${ext}`));
    if (!overlaps) continue;

    ids.add(candidateId);
    for (const ext of extRefs) {
      ids.add(ext);
      ids.add(`subj_${ext}`);
    }
  }

  return [...ids];
}

export function resolveRequestSubjectIds(request, businessSubjectRuntime) {
  const ids = new Set();

  for (const ref of safeArray(request?.subjectRefs)) {
    if (String(ref?.entityType) !== ENTITY_TYPES.SUBJECT || !ref?.entityId) continue;
    for (const identityId of collectSubjectIdentityIds(ref.entityId, businessSubjectRuntime)) {
      ids.add(identityId);
    }
  }

  const externalObjectId = request?.inboundAttribution?.externalObjectId;
  if (externalObjectId) {
    for (const identityId of collectSubjectIdentityIds(String(externalObjectId), businessSubjectRuntime)) {
      ids.add(identityId);
    }
  }

  return [...ids];
}

export function requestReferencesSubject(request, subjectId, businessSubjectRuntime) {
  const pageIds = new Set(collectSubjectIdentityIds(subjectId, businessSubjectRuntime));
  const requestIds = resolveRequestSubjectIds(request, businessSubjectRuntime);
  return requestIds.some((id) => pageIds.has(id));
}

export function resolveWorkSubjectIds(work, requestRuntime, businessSubjectRuntime) {
  const ids = new Set();
  let requestId = work?.requestId ? String(work.requestId) : null;

  for (const ref of safeArray(work?.relatedObjects)) {
    if (ref?.requestId) requestId = String(ref.requestId);
    if (String(ref?.entityType) === ENTITY_TYPES.REQUEST && ref?.entityId) {
      requestId = String(ref.entityId);
    }
    if (String(ref?.entityType) === ENTITY_TYPES.SUBJECT && ref?.entityId) {
      for (const identityId of collectSubjectIdentityIds(ref.entityId, businessSubjectRuntime)) {
        ids.add(identityId);
      }
    }
    if (ref?.subjectId) {
      for (const identityId of collectSubjectIdentityIds(ref.subjectId, businessSubjectRuntime)) {
        ids.add(identityId);
      }
    }
  }

  if (requestId) {
    const request = requestRuntime?.getRequest?.(requestId);
    for (const identityId of resolveRequestSubjectIds(request, businessSubjectRuntime)) {
      ids.add(identityId);
    }
  }

  return [...ids];
}

export function latestIsoTimestamp(...values) {
  const times = values
    .filter(Boolean)
    .map((v) => new Date(String(v)).getTime())
    .filter((n) => !Number.isNaN(n));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export function isWithinRecentDays(iso, nowISO, days) {
  if (!iso || !nowISO) return false;
  const at = new Date(String(iso)).getTime();
  const now = new Date(String(nowISO)).getTime();
  if (Number.isNaN(at) || Number.isNaN(now)) return false;
  const windowMs = Number(days) * 24 * 60 * 60 * 1000;
  return now - at <= windowMs;
}
