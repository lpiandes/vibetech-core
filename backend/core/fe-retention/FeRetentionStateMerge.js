/**
 * Merge concurrent FE Retention snapshots so scheduler ticks do not wipe
 * Settings or client edits written during the same window.
 */
export function mergeFeRetentionSnapshots(freshState, workingState) {
  const clientMap = new Map();
  for (const c of freshState?.clients ?? []) clientMap.set(c.id, c);
  for (const c of workingState?.clients ?? []) {
    const prev = clientMap.get(c.id);
    if (!prev || String(c.updatedAt ?? "") >= String(prev.updatedAt ?? "")) {
      clientMap.set(c.id, c);
    }
  }
  const logIds = new Set();
  const mergedLog = [];
  for (const row of [...(workingState?.messageLog ?? []), ...(freshState?.messageLog ?? [])]) {
    const id = String(row?.id ?? "");
    if (id && logIds.has(id)) continue;
    if (id) logIds.add(id);
    mergedLog.push(row);
    if (mergedLog.length >= 500) break;
  }
  const freshNotices = Array.isArray(freshState?.unmatchedCarrierNotices)
    ? freshState.unmatchedCarrierNotices
    : [];
  const workingNotices = Array.isArray(workingState?.unmatchedCarrierNotices)
    ? workingState.unmatchedCarrierNotices
    : [];
  const noticeIds = new Set();
  const unmatchedCarrierNotices = [];
  for (const row of [...workingNotices, ...freshNotices]) {
    const id = String(row?.id ?? row?.gmailMessageId ?? "");
    if (id && noticeIds.has(id)) continue;
    if (id) noticeIds.add(id);
    unmatchedCarrierNotices.push(row);
    if (unmatchedCarrierNotices.length >= 50) break;
  }
  return {
    ...freshState,
    clients: [...clientMap.values()],
    messageLog: mergedLog,
    unmatchedCarrierNotices,
    settings: {
      ...(freshState?.settings ?? {}),
      lastSchedulerRunAt: workingState?.settings?.lastSchedulerRunAt
        ?? freshState?.settings?.lastSchedulerRunAt
        ?? null,
      lastGmailLapseRunAt: workingState?.settings?.lastGmailLapseRunAt
        ?? freshState?.settings?.lastGmailLapseRunAt
        ?? null,
    },
  };
}
