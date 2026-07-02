import {
  impactFromScore,
  effortFromSize,
  priorityFromSignals,
  OPPORTUNITY_IMPACT_RANK,
  OPPORTUNITY_EFFORT_RANK,
} from "./CompanyOpportunityDefaults.js";

function urgencyScoreFromSignals({ urgency, backlogSize, readinessDelta } = {}) {
  if (typeof backlogSize === "number") return clamp01(backlogSize / 10) * 100;
  if (typeof urgency === "number") return clamp01(urgency / 100) * 100;
  if (typeof readinessDelta === "number") return clamp01(Math.abs(readinessDelta) / 30) * 100;
  return 0;
}

function clamp01(n) {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, num));
}

export function scoreOpportunity({ impactScore, impactSize, effortSize, urgency, backlogSize, readinessDelta } = {}) {
  const impact = impactFromScore(typeof impactScore === "number" ? impactScore : 0);
  const effort = effortFromSize(effortSize ?? effortSizeFromSignals({ urgency, backlogSize, readinessDelta }));
  const priority = priorityFromSignals({ impact, urgencyScore: urgencyScoreFromSignals({ urgency, backlogSize, readinessDelta }) });

  // Confidence: deterministic mapping based on available impact & urgency.
  const confidence =
    impact === "Very High" ? 0.9 : impact === "High" ? 0.8 : impact === "Medium" ? 0.65 : impact === "Low" ? 0.55 : 0.5;

  return { impact, effort, priority, confidence };
}

function effortSizeFromSignals({ backlogSize, readinessDelta } = {}) {
  if (typeof backlogSize === "number" && backlogSize >= 6) return "MEDIUM";
  if (typeof backlogSize === "number" && backlogSize >= 3) return "SMALL";
  if (typeof readinessDelta === "number" && Math.abs(readinessDelta) >= 15) return "MEDIUM";
  return "SMALL";
}

export function recommendedOrderKey({ priority, impact, effort }) {
  const p = ({ IMMEDIATE: 0, SOON: 1, LATER: 2 })[priority] ?? 99;
  const i = OPPORTUNITY_IMPACT_RANK[impact] ?? 99;
  const e = OPPORTUNITY_EFFORT_RANK[effort] ?? 99;
  return p * 100 + i * 10 + e;
}

