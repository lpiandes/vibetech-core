import crypto from "node:crypto";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { INTELLIGENCE_THRESHOLDS } from "./CapabilityIntelligenceDefaults.js";

import { createCapabilityIntelligenceReport } from "./CapabilityIntelligenceReport.js";
import { createCapabilityGap } from "./CapabilityGap.js";
import { createCapabilityRisk } from "./CapabilityRisk.js";
import { createCapabilityStrength } from "./CapabilityStrength.js";
import { createCapabilityRecommendation } from "./CapabilityRecommendation.js";

function fail(message) {
  throw new Error(`CapabilityIntelligenceBuilder: ${message}`);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const s = String(x);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function isCapabilityActive(cap) {
  return String(cap?.status ?? "") === "active";
}

function getAvailableMembersByType(teamRuntime) {
  const members = safeArray(teamRuntime?.getMembers?.());
  const byType = {};
  for (const m of members) {
    const mt = String(m?.memberType ?? "");
    const st = String(m?.status ?? "available");
    if (!mt) continue;
    // "Available" means productive capacity for deterministic evaluation.
    if (st !== "available") continue;
    (byType[mt] ??= []).push(m);
  }
  return byType;
}

function getOverloadedMemberTypes(teamRuntime) {
  const members = safeArray(teamRuntime?.getMembers?.());
  const overloadedTypes = new Set();
  for (const m of members) {
    const mt = String(m?.memberType ?? "");
    const util = m?.metrics?.utilization;
    if (!mt) continue;
    if (typeof util === "number" && util >= INTELLIGENCE_THRESHOLDS.overloadedUtilization) overloadedTypes.add(mt);
  }
  return Array.from(overloadedTypes);
}

function determineGaps({ requiredCapabilityIds, capabilityRuntime } = {}) {
  const gaps = [];
  for (const reqId of requiredCapabilityIds) {
    const cap = capabilityRuntime.getCapability?.(reqId);
    if (!cap || !isCapabilityActive(cap)) {
      gaps.push(createCapabilityGap({ capabilityId: reqId, reason: "missing_or_inactive_capability" }));
    }
  }
  return gaps;
}

function determineCoverage({ requiredCapabilityIds, capabilityRuntime } = {}) {
  const covered = [];
  for (const reqId of requiredCapabilityIds) {
    const cap = capabilityRuntime.getCapability?.(reqId);
    if (cap && isCapabilityActive(cap)) covered.push(String(reqId));
  }
  return uniq(covered);
}

function determineStrengths({ coveredCapabilityIds, capabilityRuntime, teamRuntime } = {}) {
  const availableByType = getAvailableMembersByType(teamRuntime);
  const strengths = [];
  for (const capId of coveredCapabilityIds) {
    const cap = capabilityRuntime.getCapability?.(capId);
    if (!cap || !isCapabilityActive(cap)) continue;
    const providedBy = safeArray(cap.providedBy);
    const providerTypeCount = providedBy.filter((pt) => (availableByType[String(pt)] ?? []).length > 0).length;
    if (providerTypeCount >= 2) {
      strengths.push(
        createCapabilityStrength({
          capabilityId: capId,
          providerCount: providerTypeCount,
          message: "covered_with_diverse_provider_types",
          metadata: { providedBy: safeArray(cap.providedBy) },
        }),
      );
    }
  }
  return strengths;
}

function determineRisks({ requiredCapabilityIds, capabilityRuntime, teamRuntime, companyWorkspaceRuntime } = {}) {
  const risks = [];
  const availableByType = getAvailableMembersByType(teamRuntime);
  const overloadedMemberTypes = new Set(getOverloadedMemberTypes(teamRuntime));

  const connectedSystems = safeArray(companyWorkspaceRuntime?.getConnectedSystems?.());
  const connectedIdsReady = new Set(connectedSystems.filter((s) => String(s?.status) === "READY").map((s) => String(s.id)));

  const knowledgeRepo = companyWorkspaceRuntime?.getKnowledgeRepository?.();
  const knowledgeItems = safeArray(knowledgeRepo?.items);
  const knowledgeIdsActive = new Set(knowledgeItems.filter((i) => String(i?.status) !== "ARCHIVED").map((i) => String(i?.id)));

  // Single-provider risk + inactive provider risk.
  for (const capId of requiredCapabilityIds) {
    const cap = capabilityRuntime.getCapability?.(capId);
    if (!cap || !isCapabilityActive(cap)) continue;

    const providedBy = safeArray(cap.providedBy);
    const availableProviderTypes = providedBy.filter((pt) => (availableByType[String(pt)] ?? []).length > 0);

    if (providedBy.length > 0) {
      if (availableProviderTypes.length === 1) {
        risks.push(
          createCapabilityRisk({
            type: "single_provider_dependency",
            capabilityId: capId,
            providerType: availableProviderTypes[0] ?? null,
            severity: 60,
            message: "capability_depends_on_single_provider_type",
          }),
        );
      }

      // Inactive provider types (capability can be provided by something but team lacks availability for it).
      for (const pt of providedBy) {
        if ((availableByType[String(pt)] ?? []).length === 0) {
          risks.push(
            createCapabilityRisk({
              type: "inactive_provider",
              capabilityId: capId,
              providerType: String(pt),
              severity: 40,
              message: "provider_type_inactive_for_capability",
            }),
          );
        }
      }
    }

    // Connected system requirement gaps (capabilities require integration readiness).
    for (const cs of safeArray(cap.requiredConnectedSystems)) {
      const csId = String(cs);
      if (!connectedIdsReady.has(csId)) {
        risks.push(
          createCapabilityRisk({
            type: "missing_connected_system_requirement",
            capabilityId: capId,
            providerType: null,
            severity: 70,
            message: `missing_connected_system:${csId}`,
          }),
        );
      }
    }

    // Knowledge requirement gaps.
    for (const kn of safeArray(cap.requiredKnowledge)) {
      const knId = String(kn);
      if (!knowledgeIdsActive.has(knId)) {
        risks.push(
          createCapabilityRisk({
            type: "missing_knowledge_requirement",
            capabilityId: capId,
            providerType: null,
            severity: 50,
            message: `missing_knowledge:${knId}`,
          }),
        );
      }
    }
  }

  // Overloaded providers risk.
  for (const pt of Array.from(overloadedMemberTypes)) {
    risks.push(
      createCapabilityRisk({
        type: "overloaded_provider",
        capabilityId: null,
        providerType: pt,
        severity: 50,
        message: "provider_type_members_overloaded",
      }),
    );
  }

  return risks;
}

function determineRecommendations({ requiredCapabilityIds, capabilityRuntime, teamRuntime, companyWorkspaceRuntime, gaps, risks } = {}) {
  const recs = [];
  const added = new Set();

  const connectedSystems = safeArray(companyWorkspaceRuntime?.getConnectedSystems?.());
  const connectedIdsReady = new Set(connectedSystems.filter((s) => String(s?.status) === "READY").map((s) => String(s.id)));

  const knowledgeRepo = companyWorkspaceRuntime?.getKnowledgeRepository?.();
  const knowledgeItems = safeArray(knowledgeRepo?.items);
  const knowledgeIdsActive = new Set(knowledgeItems.filter((i) => String(i?.status) !== "ARCHIVED").map((i) => String(i?.id)));

  const demandCounts = {};
  // Caller must provide non-deduped demand signal (work-item occurrences). We still tolerate deduped input.
  for (const reqId of requiredCapabilityIds) demandCounts[String(reqId)] = (demandCounts[String(reqId)] ?? 0) + 1;
  const requiredCapabilityIdsUnique = uniq(requiredCapabilityIds);

  const availableByType = getAvailableMembersByType(teamRuntime);

  const addRec = (rec) => {
    if (!rec || !rec.id) return;
    if (added.has(rec.id)) return;
    added.add(rec.id);
    recs.push(rec);
  };

  // add capability for each gap
  for (const g of gaps) {
    addRec(
      createCapabilityRecommendation({
        type: "add_capability",
        relatedCapabilityIds: [g.capabilityId],
        description: `Add capability:${g.capabilityId}`,
        priority: 80,
        metadata: { gapReason: g.reason },
      }),
    );
  }

  // risks-based recs
  const byType = (t) => risks.filter((r) => r.type === t);

  if (byType("single_provider_dependency").length > 0) {
    addRec(
      createCapabilityRecommendation({
        type: "reduce_provider_dependency",
        description: "Reduce provider dependency by adding provider diversity.",
        relatedCapabilityIds: requiredCapabilityIdsUnique.slice(0, 3),
        priority: 60,
      }),
    );
  }

  if (byType("inactive_provider").length > 0) {
    const providerTypes = uniq(byType("inactive_provider").map((r) => r.providerType).filter(Boolean));
    for (const pt of providerTypes) {
      addRec(
        createCapabilityRecommendation({
          type: pt === "digital_employee" ? "deploy_digital_employee" : "train_team_member",
          description: `Add provider capability for type:${pt}`,
          relatedCapabilityIds: requiredCapabilityIdsUnique.slice(0, 3),
          priority: 55,
        }),
      );
    }
  }

  // missing connected systems / knowledge
  const missingConnected = byType("missing_connected_system_requirement").map((r) => r.message.split(":")[1] ?? "");
  if (missingConnected.length > 0) {
    const uniqMissing = uniq(missingConnected).filter(Boolean);
    for (const csId of uniqMissing) {
      addRec(
        createCapabilityRecommendation({
          type: "connect_system",
          description: `Connect required system:${csId}`,
          relatedCapabilityIds: requiredCapabilityIdsUnique.slice(0, 3),
          priority: 70,
        }),
      );
    }
  }

  const missingKnowledge = byType("missing_knowledge_requirement").map((r) => r.message.split(":")[1] ?? "");
  if (missingKnowledge.length > 0) {
    const uniqMissing = uniq(missingKnowledge).filter(Boolean);
    for (const knId of uniqMissing) {
      addRec(
        createCapabilityRecommendation({
          type: "publish_required_knowledge",
          description: `Publish required knowledge:${knId}`,
          relatedCapabilityIds: requiredCapabilityIdsUnique.slice(0, 3),
          priority: 65,
        }),
      );
    }
  }

  // high demand capabilities recommendations
  const highDemand = uniq(requiredCapabilityIds).filter((cid) => demandCounts[String(cid)] >= INTELLIGENCE_THRESHOLDS.highDemandCount);

  for (const capId of highDemand) {
    const cap = capabilityRuntime.getCapability?.(capId);
    if (!cap) continue;
    const providedBy = safeArray(cap.providedBy);
    const hasDigital = providedBy.includes("digital_employee") && (availableByType["digital_employee"] ?? []).length > 0;
    const hasHuman = providedBy.includes("human") && (availableByType["human"] ?? []).length > 0;

    if (providedBy.includes("digital_employee") && !hasDigital) {
      addRec(
        createCapabilityRecommendation({
          type: "deploy_digital_employee",
          description: `Deploy digital employee for high-demand capability:${capId}`,
          relatedCapabilityIds: [capId],
          priority: 50,
        }),
      );
    } else if (providedBy.includes("human") && !hasHuman) {
      addRec(
        createCapabilityRecommendation({
          type: "train_team_member",
          description: `Train team member for high-demand capability:${capId}`,
          relatedCapabilityIds: [capId],
          priority: 50,
        }),
      );
    }
  }

  return recs;
}

export function buildCapabilityIntelligenceReport({
  capabilityRuntime,
  teamRuntime,
  workRuntime,
  companyWorkspaceRuntime,
  companyId,
  nowISO,
} = {}) {
  if (!capabilityRuntime) fail("capabilityRuntime required.");
  if (!teamRuntime) fail("teamRuntime required.");
  if (!workRuntime) fail("workRuntime required.");
  if (!companyId) fail("companyId required.");

  const requiredFromWorkItems = safeArray(workRuntime?.getWorkItems?.()).flatMap((w) => safeArray(w?.metadata?.requiredCapabilities));
  const requiredCapabilityIds = uniq(requiredFromWorkItems);
  const requiredCapabilityDemandIds = requiredFromWorkItems.map((x) => String(x));

  const coveredCapabilities = determineCoverage({ requiredCapabilityIds, capabilityRuntime });
  const gaps = determineGaps({ requiredCapabilityIds, capabilityRuntime });

  const strengths = determineStrengths({ coveredCapabilityIds: coveredCapabilities, capabilityRuntime, teamRuntime });
  const risks = determineRisks({ requiredCapabilityIds, capabilityRuntime, teamRuntime, companyWorkspaceRuntime });

  const coverageScore = requiredCapabilityIds.length > 0 ? (coveredCapabilities.length / requiredCapabilityIds.length) * 100 : 100;
  const gapScore = requiredCapabilityIds.length > 0 ? (gaps.length / requiredCapabilityIds.length) * 100 : 0;
  const riskScore = clamp(risks.length * 10, 0, 100);
  const overallReadiness = clamp(Math.round(coverageScore - riskScore * 0.5 - gapScore * 0.1), 0, 100);

  const recommendations = determineRecommendations({
    requiredCapabilityIds: requiredCapabilityDemandIds,
    capabilityRuntime,
    teamRuntime,
    companyWorkspaceRuntime,
    gaps,
    risks,
  });

  const generatedAt = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const reportFingerprint = sha256(
    JSON.stringify({
      companyId: String(companyId),
      requiredCapabilityIds,
      coveredCapabilities,
      gaps: gaps.map((g) => g.id),
      risks: risks.map((r) => r.id),
      recommendations: recommendations.map((r) => r.id),
      generatedAt,
    }),
  );

  const reportId = `report_cap_intel_${reportFingerprint.slice(0, 16)}`;

  return createCapabilityIntelligenceReport({
    reportId,
    companyId,
    generatedAt,
    summary: `Coverage:${coveredCapabilities.length}/${requiredCapabilityIds.length} strengths:${strengths.length} gaps:${gaps.length} risks:${risks.length}`,
    overallReadiness,
    strengths,
    gaps,
    risks,
    recommendations,
    coverage: {
      requiredCapabilities: requiredCapabilityIds,
      coveredCapabilities,
      coverageScore,
      gapScore,
      riskScore,
      unmatchedWorkRequirements: gaps.map((g) => g.capabilityId).filter(Boolean),
    },
    metadata: deepFreeze({
      derivedFrom: { workItems: (workRuntime.getWorkItems?.() ?? []).length },
      intelligenceVersion: 1,
    }),
  });
}

