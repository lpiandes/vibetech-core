import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function normalizePriority(p) {
  const s = String(p ?? "").toUpperCase();
  if (s === "HIGH") return "HIGH";
  if (s === "MEDIUM") return "MEDIUM";
  if (s === "LOW") return "LOW";
  return "MEDIUM";
}

export function createCompanyHealthRecommendation({
  id,
  label,
  type,
  target,
  priority,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("CompanyHealthRecommendation: id required.");
  if (!label || typeof label !== "string") throw new Error("CompanyHealthRecommendation: label required.");
  if (!type || typeof type !== "string") throw new Error("CompanyHealthRecommendation: type required.");
  if (!target || typeof target !== "string") throw new Error("CompanyHealthRecommendation: target required.");

  return deepFreeze({
    id,
    label,
    type,
    target,
    priority: normalizePriority(priority),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

