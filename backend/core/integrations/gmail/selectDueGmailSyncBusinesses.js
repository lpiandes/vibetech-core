/**
 * Pure selection logic for the recurring Gmail inbox sync tick (see
 * runHostedPlatformJobTick.ts). Kept side-effect-free so the "which N
 * businesses get synced this tick" decision is unit-testable without a
 * database or live Gmail API calls.
 *
 * Never-synced businesses go first, then oldest-synced-first, so every
 * connected business eventually gets a turn instead of only the first N
 * (alphabetically/by-connection-order) ever syncing.
 */

const DEFAULT_MIN_INTERVAL_MS = 10 * 60 * 1000; // don't re-sync the same business more than once per ~10 min
const DEFAULT_MAX_PER_TICK = 3; // each sync makes live Gmail API calls — keep small per tick

/**
 * @param {object} params
 * @param {Array<{ businessId: string, installation: object|null }>} params.candidates
 * @param {string} [params.nowISO]
 * @param {number} [params.minIntervalMs]
 * @param {number} [params.maxPerTick]
 * @returns {string[]} businessIds due for a sync this tick, oldest-synced first
 */
export function selectDueGmailSyncBusinesses({
  candidates = [],
  nowISO = new Date().toISOString(),
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  maxPerTick = DEFAULT_MAX_PER_TICK,
} = {}) {
  const now = Date.parse(nowISO);
  const withLastSync = candidates
    .filter((c) => c && c.businessId && c.installation)
    .map((c) => {
      const lastSyncAt = c.installation?.configuration?.gmailInboxSync?.lastSyncAt ?? null;
      const lastSyncMs = lastSyncAt ? Date.parse(lastSyncAt) : null;
      return { businessId: String(c.businessId), lastSyncMs: Number.isFinite(lastSyncMs) ? lastSyncMs : null };
    });

  const due = withLastSync.filter(
    (c) => c.lastSyncMs == null || now - c.lastSyncMs >= minIntervalMs,
  );

  due.sort((a, b) => (a.lastSyncMs ?? -Infinity) - (b.lastSyncMs ?? -Infinity));

  return due.slice(0, maxPerTick).map((c) => c.businessId);
}
