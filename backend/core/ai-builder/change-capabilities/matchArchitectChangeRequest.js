import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Score NL text against declarative capability requestPatterns.
 * Returns matched | ambiguous | unsupported (needs_information is decided by the runner).
 */
export function matchArchitectChangeRequest({ text, capabilities = [], context = {} } = {}) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return deepFreeze({
      status: "unsupported",
      summary: "Empty request",
      reason: "empty_request",
      recommendation: "Describe the change you want in plain language.",
      gapHint: null,
      candidates: [],
    });
  }

  const lower = raw.toLowerCase();
  const scored = [];

  for (const capability of capabilities) {
    if (capability.packageAvailability?.prohibitedIf?.length) {
      const prohibited = new Set(capability.packageAvailability.prohibitedIf);
      const active = new Set(context.activeCapabilityIds ?? []);
      if ([...prohibited].some((id) => active.has(id))) continue;
    }

    let best = 0;
    let evidence = [];
    for (const pattern of capability.requestPatterns ?? []) {
      if ((pattern.excludeKeywords ?? []).some((kw) => lower.includes(kw))) continue;
      if ((pattern.allKeywords ?? []).length && !(pattern.allKeywords.every((kw) => lower.includes(kw)))) {
        continue;
      }
      const hits = (pattern.keywords ?? []).filter((kw) => lower.includes(kw));
      if (!hits.length && !(pattern.examples ?? []).some((ex) => similar(lower, String(ex).toLowerCase()))) {
        continue;
      }
      const exampleBoost = (pattern.examples ?? []).some((ex) => similar(lower, String(ex).toLowerCase()))
        ? 0.15
        : 0;
      const keywordScore = hits.length
        ? Math.min(0.95, 0.35 + hits.length * 0.15 + exampleBoost)
        : exampleBoost;
      const score = (keywordScore + Number(pattern.weight ?? 1) * 0.01)
        * (Number(capability.matchPriority ?? 100) / 100);
      if (score > best) {
        best = score;
        evidence = [
          ...hits.map((kw) => `keyword:${kw}`),
          ...(exampleBoost ? ["example_similarity"] : []),
          `pattern:${pattern.id}`,
        ];
      }
    }
    if (best > 0) {
      scored.push({
        capabilityId: capability.capabilityId,
        legacyKind: capability.legacyKindAliases?.[0] ?? null,
        confidence: Math.min(0.99, best),
        evidence,
        capability,
      });
    }
  }

  scored.sort((a, b) => b.confidence - a.confidence || b.capability.matchPriority - a.capability.matchPriority);

  if (!scored.length) {
    return deepFreeze({
      status: "unsupported",
      summary: summarizeUnderstood(raw),
      reason: "no_matching_capability",
      recommendation: "This change is not available yet. We can record it as a capability gap.",
      gapHint: { requestedOutcome: raw },
      candidates: [],
    });
  }

  const top = scored[0];
  const second = scored[1];
  const ambiguous = second
    && (top.confidence - second.confidence) < 0.12
    && second.confidence >= 0.45;

  if (ambiguous) {
    return deepFreeze({
      status: "ambiguous",
      summary: summarizeUnderstood(raw),
      candidates: scored.slice(0, 3).map((entry) => ({
        capabilityId: entry.capabilityId,
        title: entry.capability.title,
        confidence: entry.confidence,
        evidence: entry.evidence,
      })),
      message: "I found more than one possible change. Which did you mean?",
    });
  }

  if (top.confidence < 0.4) {
    return deepFreeze({
      status: "unsupported",
      summary: summarizeUnderstood(raw),
      reason: "low_confidence",
      recommendation: "Try rephrasing, or choose a supported change like hiring a team member or updating a location.",
      gapHint: { requestedOutcome: raw },
      candidates: scored.slice(0, 2).map((entry) => ({
        capabilityId: entry.capabilityId,
        title: entry.capability.title,
        confidence: entry.confidence,
      })),
    });
  }

  return deepFreeze({
    status: "matched",
    capabilityId: top.capabilityId,
    legacyKind: top.legacyKind,
    confidence: top.confidence,
    evidence: top.evidence,
    capability: top.capability,
    summary: summarizeUnderstood(raw),
  });
}

function similar(a, b) {
  if (a.includes(b) || b.includes(a)) return true;
  const ta = new Set(a.split(/\s+/).filter((t) => t.length > 2));
  const tb = b.split(/\s+/).filter((t) => t.length > 2);
  if (!tb.length) return false;
  const overlap = tb.filter((t) => ta.has(t)).length;
  return overlap / tb.length >= 0.6;
}

function summarizeUnderstood(text) {
  const clipped = String(text).trim().replace(/\s+/g, " ");
  return clipped.length > 160 ? `${clipped.slice(0, 157)}…` : clipped;
}
