import { AVAILABILITY_SCORE, MATCH_SCORING, WORKLOAD_PENALTY_THRESHOLDS } from "./CapabilityMatchDefaults.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function safeNumber(v, fallback = 0) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function getMemberUtilization(member) {
  // Prefer metrics.utilization if present.
  if (member?.metrics && typeof member.metrics.utilization === "number") return safeNumber(member.metrics.utilization, 0);
  // Otherwise compute from assignedWork/capacity when possible.
  const assigned = safeNumber(member?.metrics?.assignedWork, safeNumber(member?.workload?.assignedWork, 0));
  const capacity = safeNumber(member?.metrics?.capacity, 0);
  if (capacity <= 0) return 0;
  return (assigned / capacity) * 100;
}

function getProviderAvailabilityBonus(member) {
  const status = String(member?.status ?? "available");
  const score = AVAILABILITY_SCORE[status] ?? 0;
  // availability (0-100) can further adjust.
  const availability = safeNumber(member?.availability, null);
  const availabilityAdj = availability === null ? 0 : clamp((availability / 100) * 10, 0, 10);
  return clamp(score + availabilityAdj - 5, 0, 25); // shift to avoid high defaults
}

export function scoreCapabilityMatch({
  requiredCapabilities,
  coveredCapabilities,
  capabilityDetailsById,
  workItem,
  providerMember,
} = {}) {
  const requiredIds = Array.isArray(requiredCapabilities) ? requiredCapabilities.map(String) : [];
  const coveredIds = Array.isArray(coveredCapabilities) ? coveredCapabilities.map(String) : [];
  const requiredCount = requiredIds.length;
  const coveredCount = coveredIds.length;

  const coverageFraction = requiredCount > 0 ? coveredCount / requiredCount : coveredCount > 0 ? 1 : 0;

  // Priority weighting:
  // - exact required id match (high)
  // - category match (medium)
  // - provider availability/status
  // - workload penalty
  let exactMatches = 0;
  let categoryMatches = 0;
  const workType = String(workItem?.workType ?? "");

  for (const cid of coveredIds) {
    if (requiredIds.includes(String(cid))) exactMatches += 1;
    const cap = capabilityDetailsById[cid];
    if (cap && String(cap.category) === workType) categoryMatches += 1;
  }

  const baseCoverageScore = coverageFraction * 70; // 0..70
  const exactScore = Math.min(exactMatches, requiredCount) * MATCH_SCORING.exactCapabilityMatchWeight / Math.max(1, requiredCount);
  const categoryScore = Math.min(categoryMatches, requiredCount) * MATCH_SCORING.categoryMatchWeight / Math.max(1, requiredCount);

  const availabilityBonus = getProviderAvailabilityBonus(providerMember) * (MATCH_SCORING.providerAvailabilityWeight / 20); // normalize

  const utilization = getMemberUtilization(providerMember);
  const highPenalty = utilization >= WORKLOAD_PENALTY_THRESHOLDS.highUtilization ? MATCH_SCORING.workloadPenaltyWeight : 0;
  const severePenalty = utilization >= WORKLOAD_PENALTY_THRESHOLDS.severeUtilization ? MATCH_SCORING.workloadPenaltyWeight : 0;
  const workloadPenalty = highPenalty + severePenalty;

  const raw = baseCoverageScore + exactScore + categoryScore + availabilityBonus - workloadPenalty;
  const score = clamp(Math.round(raw), 0, 100);

  // Confidence is deterministic: higher coverage and availability, lower workload.
  const confidence = clamp(coverageFraction * 0.7 + (score / 100) * 0.3 - (workloadPenalty / 100) * 0.1, 0, 1);

  const matchReasons = [];
  if (requiredCount > 0) matchReasons.push(`coverage:${coveredCount}/${requiredCount}`);
  if (exactMatches > 0) matchReasons.push(`exact_required_matches:${exactMatches}`);
  if (categoryMatches > 0) matchReasons.push(`category_matches:${categoryMatches}`);
  matchReasons.push(`provider_status:${String(providerMember?.status ?? "available")}`);

  const limitations = [];
  if (requiredCount > 0 && coveredCount < requiredCount) {
    limitations.push(`missing_required_capabilities:${requiredCount - coveredCount}`);
  }
  if (utilization >= WORKLOAD_PENALTY_THRESHOLDS.highUtilization) {
    limitations.push(`high_workload_utilization:${Math.round(utilization)}`);
  }

  return { score, confidence, matchReasons, limitations };
}

