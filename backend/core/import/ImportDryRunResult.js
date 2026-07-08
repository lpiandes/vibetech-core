import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createImportDryRunResult({
  importRunId,
  status,
  stats = {},
  planSummary = {},
} = {}) {
  return deepFreeze({
    importRunId: String(importRunId ?? ""),
    status: String(status ?? "dry_run_complete"),
    stats: deepFreeze({ ...stats }),
    planSummary: deepFreeze({ ...planSummary }),
  });
}

export function emptyDryRunStats() {
  return {
    totalRows: 0,
    wouldCreate: 0,
    wouldUpdate: 0,
    wouldSkip: 0,
    warnings: 0,
    errors: 0,
    reviewRequired: 0,
    byAction: {},
  };
}

export function incrementStat(stats, key, by = 1) {
  stats[key] = Number(stats[key] ?? 0) + by;
}

export function incrementActionStat(stats, actionType, by = 1) {
  if (!stats.byAction) stats.byAction = {};
  stats.byAction[actionType] = Number(stats.byAction[actionType] ?? 0) + by;
}
