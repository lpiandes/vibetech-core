import { INSIGHT_SEVERITY_RANK } from "./CompanyInsightDefaults.js";

function categoryRank(cat) {
  const rank = [
    "health",
    "knowledge",
    "communications",
    "connected_systems",
    "work_queue",
    "workforce",
    "capabilities",
    "profile",
    "workspace",
    "activities",
  ];
  const idx = rank.indexOf(cat);
  return idx >= 0 ? idx : 999;
}

export function compareInsights(a, b) {
  if (!a || !b) return 0;
  const sa = INSIGHT_SEVERITY_RANK[String(a.severity)] ?? 99;
  const sb = INSIGHT_SEVERITY_RANK[String(b.severity)] ?? 99;
  if (sa !== sb) return sa - sb;
  const ca = categoryRank(a.category);
  const cb = categoryRank(b.category);
  if (ca !== cb) return ca - cb;
  // Deterministic tie-break: direction + id.
  return String(a.id).localeCompare(String(b.id));
}

export function compareAttention(a, b) {
  return compareInsights(a, b);
}

