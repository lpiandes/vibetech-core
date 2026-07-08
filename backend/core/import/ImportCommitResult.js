import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function emptyCommitStats() {
  return {
    totalRows: 0,
    committedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    committedActions: {},
  };
}

export function incrementCommitStat(stats, key, by = 1) {
  stats[key] = Number(stats[key] ?? 0) + by;
}

export function incrementCommittedAction(stats, actionType, by = 1) {
  if (!stats.committedActions) stats.committedActions = {};
  stats.committedActions[actionType] = Number(stats.committedActions[actionType] ?? 0) + by;
}

export function createImportCommitResult({ importRunId, status, stats = {}, rows = [] } = {}) {
  return deepFreeze({
    importRunId: String(importRunId ?? ""),
    status: String(status ?? ""),
    stats: deepFreeze({ ...stats }),
    rows: deepFreeze(Array.isArray(rows) ? rows : []),
  });
}
