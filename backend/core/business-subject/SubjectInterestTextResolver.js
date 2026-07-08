import { normalizeIdentityText } from "../import/subjects/SubjectImportNormalizer.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasStrongAddressSignal(value) {
  return /\d/.test(String(value ?? "")) && normalizeIdentityText(value).length >= 6;
}

function textContainsIdentity(text, identity) {
  const haystack = ` ${normalizeIdentityText(text)} `;
  const needle = normalizeIdentityText(identity);
  if (!needle || !hasStrongAddressSignal(needle)) return false;
  return haystack.includes(` ${needle} `);
}

function subjectIdentities(subject) {
  const attrs = subject?.keyAttributes ?? {};
  return [
    subject?.displayName,
    attrs.address,
    [attrs.address, attrs.unit, attrs.city, attrs.state, attrs.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean);
}

export function resolveExactSubjectInterestFromText({ text, businessSubjectRuntime } = {}) {
  const matches = [];
  for (const subject of safeArray(businessSubjectRuntime?.getSubjects?.())) {
    if (String(subject?.status ?? "active") !== "active") continue;
    if (subjectIdentities(subject).some((identity) => textContainsIdentity(text, identity))) {
      matches.push(subject);
    }
  }

  if (matches.length !== 1) {
    return {
      matched: false,
      reason: matches.length > 1 ? "ambiguous_subject_interest" : "no_exact_subject_interest",
      subject: null,
      subjectId: null,
    };
  }

  return {
    matched: true,
    reason: "exact_subject_interest",
    subject: matches[0],
    subjectId: String(matches[0].id),
  };
}
