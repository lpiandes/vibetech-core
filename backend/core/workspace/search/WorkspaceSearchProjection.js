import { deepFreeze } from "../_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function norm(s) {
  return String(s ?? "").toLowerCase();
}

const PROPERTY_SUBJECT_TYPES = new Set(["property", "listing", "unit"]);

function subjectHref(businessId, subject) {
  const bid = String(businessId ?? "");
  if (!bid) return "/properties";
  const subjectType = String(subject.subjectType ?? "").toLowerCase();
  if (PROPERTY_SUBJECT_TYPES.has(subjectType)) {
    return `/b/${bid}/properties/${subject.id}`;
  }
  return `/b/${bid}/properties`;
}

/**
 * Universal workspace search over parties, subjects, and work.
 */
export function searchWorkspace({ query, ctx, businessId, limit = 8 } = {}) {
  const q = norm(query).trim();
  if (!q) return deepFreeze({ results: [] });

  const bid = String(businessId ?? "");
  const results = [];

  for (const party of safeArray(ctx?.businessGraphRuntime?.getParties?.())) {
    if (norm(party.displayName).includes(q) || norm(party.id).includes(q)) {
      results.push({
        id: `search_party_${party.id}`,
        type: "party",
        label: party.displayName,
        sublabel: "Person",
        href: bid ? `/b/${bid}/people` : "/people",
      });
    }
  }

  for (const subject of safeArray(ctx?.businessSubjectRuntime?.getSubjects?.())) {
    if (norm(subject.displayName).includes(q) || norm(subject.id).includes(q)) {
      results.push({
        id: `search_subject_${subject.id}`,
        type: "subject",
        label: subject.displayName,
        sublabel: subject.subjectType ?? "Subject",
        href: subjectHref(bid, subject),
      });
    }
  }

  for (const w of safeArray(ctx?.workRuntime?.getWorkItems?.())) {
    if (norm(w.title).includes(q) || norm(w.workType).includes(q)) {
      results.push({
        id: `search_work_${w.id}`,
        type: "work",
        label: w.title ?? w.id,
        sublabel: String(w.workType ?? "work").replace(/_/g, " "),
        href: bid ? `/b/${bid}/work` : "/work",
      });
    }
  }

  return deepFreeze({ results: deepFreeze(results.slice(0, limit)) });
}
