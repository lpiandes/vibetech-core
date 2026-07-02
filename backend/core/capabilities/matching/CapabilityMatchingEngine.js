import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createCapabilityMatch } from "./CapabilityMatch.js";
import { createCapabilityMatchResult } from "./CapabilityMatchResult.js";
import { scoreCapabilityMatch } from "./CapabilityMatchScorer.js";
import { validateCapabilityMatchResult } from "./CapabilityMatchValidator.js";

import { CAPABILITY_PROVIDER_TYPES } from "./CapabilityMatchDefaults.js";

function fail(message) {
  throw new Error(`CapabilityMatchingEngine: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function requireRuntime(runtime, name, requiredFnNames = []) {
  if (!runtime || typeof runtime !== "object") fail(`${name} required.`);
  for (const fn of requiredFnNames) {
    if (typeof runtime[fn] !== "function") fail(`${name}.${fn} required.`);
  }
}

function normalizeWorkItem(workItemOrInput) {
  if (!workItemOrInput || typeof workItemOrInput !== "object") fail("workItem required.");
  const wi = workItemOrInput.workItem ?? workItemOrInput;
  const workItemId = String(wi.id ?? workItemOrInput.id ?? "");
  if (!workItemId) fail("workItem.id required.");
  return {
    id: workItemId,
    workType: wi.workType ?? "",
    requirements: safeArray(wi.requirements),
    metadata: wi.metadata && typeof wi.metadata === "object" && !Array.isArray(wi.metadata) ? wi.metadata : {},
  };
}

function deriveRequiredCapabilityIds({ workItem, capabilityRuntime, capabilityById } = {}) {
  const requiredFromMeta = safeArray(workItem?.metadata?.requiredCapabilities).map((x) => String(x));
  if (requiredFromMeta.length > 0) {
    // Keep unknown ids (unmatched requirements) deterministic.
    return requiredFromMeta;
  }

  // If no explicit requiredCapabilities, derive from workItem.requirements:
  // - first treat requirement strings as capability ids when they exist
  // - otherwise match against capability.requirements[].id
  const reqs = safeArray(workItem.requirements).map((x) => String(x));
  if (reqs.length > 0) {
    const direct = reqs.filter((rid) => capabilityById[String(rid)]);
    if (direct.length > 0) return direct;

    const matchedViaRequirementId = Object.values(capabilityById)
      .filter((c) => Array.isArray(c.requirements) && c.requirements.some((r) => reqs.includes(String(r.id))))
      .map((c) => String(c.id));
    if (matchedViaRequirementId.length > 0) return matchedViaRequirementId;
  }

  // Last fallback: category match on workType.
  const wt = String(workItem.workType ?? "");
  if (!wt) return [];
  return Object.values(capabilityById).filter((c) => String(c.category) === wt).map((c) => String(c.id));
}

export class CapabilityMatchingEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  match({ workItem, capabilityRuntime, teamRuntime, companyWorkspaceRuntime, knowledgeRepository, connectedSystems } = {}) {
    requireRuntime(capabilityRuntime, "capabilityRuntime", ["getCapabilities", "getCapability"]);
    requireRuntime(teamRuntime, "teamRuntime", ["getMembers"]);

    const wi = normalizeWorkItem(workItem);
    const workItemId = wi.id;

    // Build capability lookup for deterministic derived logic.
    const capabilities = safeArray(capabilityRuntime.getCapabilities?.());
    const capabilityById = {};
    for (const c of capabilities) capabilityById[String(c.id)] = c;

    const requiredCapabilityIds = deriveRequiredCapabilityIds({ workItem: wi, capabilityRuntime, capabilityById });

    // Determine for each provider which required capabilities they can provide.
    const matches = [];
    const capabilityDetailsById = capabilityById;

    const members = safeArray(teamRuntime.getMembers?.());
    for (const member of members) {
      const memberType = String(member.memberType ?? "human");
      if (!CAPABILITY_PROVIDER_TYPES.includes(memberType)) continue;

      const canProvideIds = requiredCapabilityIds
        .filter((cid) => capabilityById[String(cid)])
        .filter((cid) => {
          const cap = capabilityById[String(cid)];
          return Array.isArray(cap.providedBy) && cap.providedBy.includes(memberType);
        });

      if (canProvideIds.length === 0) continue;

      const scored = scoreCapabilityMatch({
        requiredCapabilities: requiredCapabilityIds,
        coveredCapabilities: canProvideIds,
        capabilityDetailsById,
        workItem: { workType: wi.workType },
        providerMember: member,
      });

      const matchId = `match_${workItemId}_${member.id}`;
      const match = createCapabilityMatch({
        id: matchId,
        providerId: member.id,
        providerType: memberType,
        providerName: member.name,
        capabilityIds: canProvideIds,
        score: scored.score,
        confidence: scored.confidence,
        matchReasons: scored.matchReasons,
        limitations: scored.limitations,
        recommendedAction: "future_assignment_service.applyBestMatch",
        metadata: deepFreeze({
          derivedFrom: {
            workItemId,
            providerType: memberType,
          },
        }),
      });

      matches.push(match);
    }

    // Sort by score desc, tie-break by providerId asc.
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.providerId).localeCompare(String(b.providerId));
    });

    const bestMatch = matches.length > 0 ? matches[0] : null;

    // Unmatched requirements are required capability ids (including unknown ids) that are not covered by any match.
    const covered = new Set(matches.flatMap((m) => safeArray(m.capabilityIds).map(String)));
    const unmatchedRequirements = safeArray(requiredCapabilityIds).filter((cid) => !covered.has(String(cid)));

    const summary =
      bestMatch && bestMatch.capabilityIds.length > 0
        ? `Best provider ${bestMatch.providerName} can cover ${bestMatch.capabilityIds.length} capability(s).`
        : `No providers matched required capabilities.`;

    const result = createCapabilityMatchResult({
      matchResultId: `cap_match_${workItemId}_${this.nowISO}`,
      workItemId,
      generatedAt: this.nowISO,
      requiredCapabilities: requiredCapabilityIds,
      matches,
      bestMatch,
      unmatchedRequirements,
      summary,
      metadata: deepFreeze({
        derivedFrom: { workItemId },
        nowISO: this.nowISO,
      }),
    });

    validateCapabilityMatchResult(result);
    return result;
  }
}

