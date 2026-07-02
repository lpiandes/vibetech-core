import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityCategoryView({ id, name, summary, status, requiredCount, coveredCount, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    name: String(name ?? ""),
    summary: String(summary ?? ""),
    status: String(status ?? "unknown"),
    requiredCount: Number(requiredCount ?? 0),
    coveredCount: Number(coveredCount ?? 0),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

