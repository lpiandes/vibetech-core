/**
 * Shared hosted job drain used by /api/platform/jobs/tick and health self-heal.
 */
import { withClient, platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { PostgresPlatformJobQueue } from "../../../backend/core/platform/jobs/PostgresPlatformJobQueue.js";
import { runPlatformJobTick } from "../../../backend/core/platform/jobs/createPlatformJobExecutor.js";
import { GmailInboundSyncService } from "../../../backend/core/integrations/gmail/GmailInboundSyncService.js";
import { selectDueGmailSyncBusinesses } from "../../../backend/core/integrations/gmail/selectDueGmailSyncBusinesses.js";

// Gmail inbox sync has no dedicated JOB_TYPES entry / claimNext dispatch branch in
// createPlatformJobExecutor.js (see TODO in GmailInboundSyncService.js) — wiring a
// full recurring job would mean a new job type + something to enqueue it on a
// schedule, which is more machinery than this v1 warrants. Instead, piggyback a
// small best-effort sweep on the existing hosted tick (already invoked by cron +
// health self-heal): look up a bounded pool of businesses with a Gmail credential,
// pick a handful that are overdue for a sync (see selectDueGmailSyncBusinesses),
// and run GmailInboundSyncService for just those. Failures here must never break
// the primary platform_jobs drain.
//
// The candidate pool (100) and offset rotation below exist so that once a
// deployment has more Gmail-connected businesses than fit in one pool, every
// business still eventually gets pulled into a tick instead of only ever the
// first `GMAIL_SYNC_CANDIDATE_POOL` (ordered by workspace_id) ever syncing.
const GMAIL_SYNC_CANDIDATE_POOL = 100;
const GMAIL_SYNC_MAX_PER_TICK = 8;
const GMAIL_SYNC_MIN_INTERVAL_MS = 10 * 60 * 1000;

// Best-effort in-memory rotation cursor: advances by the pool size each tick
// (within this process) so successive ticks sweep through different slices of
// the ordered workspace_id list, then wraps back to 0 once a sweep returns
// fewer candidates than requested (i.e. it reached the end of the list). This
// is intentionally process-local — with multiple hosted instances each keeps
// its own cursor, which just means the pools they sweep can overlap; it never
// causes a business to be skipped forever, only (at worst) swept more than
// once before every instance's cursor has wrapped.
let gmailSyncPoolOffset = 0;

async function runHostedGmailInboxSyncSweep() {
  const outcome = {
    attempted: 0,
    synced: 0,
    errors: [] as Array<{ businessId: string; reason: string }>,
    poolOffset: 0,
  };
  const listCandidates = (platformStore as any)?.listWorkspaceIdsWithIntegrationCredentialType;
  if (typeof listCandidates !== "function") return outcome;

  const poolOffset = gmailSyncPoolOffset;
  let candidateBusinessIds: string[] = [];
  try {
    candidateBusinessIds = await listCandidates.call(platformStore, "gmail", {
      limit: GMAIL_SYNC_CANDIDATE_POOL,
      offset: poolOffset,
    });
  } catch {
    return outcome;
  }
  // Advance (or wrap) the rotation cursor for the next tick regardless of
  // whether any business in this pool turns out to be due for a sync.
  gmailSyncPoolOffset = candidateBusinessIds.length < GMAIL_SYNC_CANDIDATE_POOL
    ? 0
    : poolOffset + candidateBusinessIds.length;
  if (!candidateBusinessIds.length) {
    // Pool came back empty at a non-zero offset (fewer total businesses than
    // the offset implied, e.g. some were disconnected) — reset and retry once
    // from the start so a tick right after a big drop in connections isn't wasted.
    if (poolOffset > 0) {
      gmailSyncPoolOffset = 0;
      try {
        candidateBusinessIds = await listCandidates.call(platformStore, "gmail", { limit: GMAIL_SYNC_CANDIDATE_POOL, offset: 0 });
      } catch {
        return outcome;
      }
      gmailSyncPoolOffset = candidateBusinessIds.length < GMAIL_SYNC_CANDIDATE_POOL ? 0 : candidateBusinessIds.length;
    }
    if (!candidateBusinessIds.length) return outcome;
  }

  const candidates = await Promise.all(
    candidateBusinessIds.map(async (businessId) => ({
      businessId,
      installation: await platformStore.getBusinessOSInstallation(businessId).catch(() => null),
    })),
  );

  const dueBusinessIds = selectDueGmailSyncBusinesses({
    candidates,
    minIntervalMs: GMAIL_SYNC_MIN_INTERVAL_MS,
    maxPerTick: GMAIL_SYNC_MAX_PER_TICK,
  });
  outcome.attempted = dueBusinessIds.length;
  outcome.poolOffset = poolOffset;

  for (const businessId of dueBusinessIds) {
    try {
      const installation = candidates.find((c) => c.businessId === businessId)?.installation
        ?? (await platformStore.getBusinessOSInstallation(businessId).catch(() => null));
      if (!installation) continue;
      const { service } = await getSystemWorkspaceForBusiness(businessId);
      const platform = (service as any)?.connected?.integrationPlatform ?? null;
      const connection = platform?.connectionRuntime?.getConnectionByType?.("business_email") ?? null;
      const credentialResolver = platform?.credentialResolver ?? null;
      if (!connection) continue;
      const result = await new GmailInboundSyncService().sync({
        businessId,
        platformStore,
        installation,
        connection,
        credentialResolver,
        maxResults: 25,
        actorId: "gmail_inbox_sync_job",
        onNewInbound: async (msg) => {
          if (!msg?.gmailMessageId) return false;
          await (service as any).emitSpecialtyBusinessEvent({
            eventType: "INBOUND_SALES_EMAIL",
            brief: `Inbound sales email${msg.subject ? `: ${msg.subject}` : ""} from ${msg.from?.email ?? "unknown"}`,
            payload: {
              gmailMessageId: msg.gmailMessageId,
              from: msg.from,
              subject: msg.subject,
              personId: msg.personId,
              channel: "gmail",
            },
            actorId: "gmail_inbox_sync_job",
          });
          return true;
        },
      });
      if (result.ok) outcome.synced += 1;
      else if (result.reason !== "gmail_not_connected") {
        outcome.errors.push({ businessId, reason: String(result.reason ?? "sync_failed") });
      }
    } catch (err) {
      outcome.errors.push({ businessId, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return outcome;
}

export async function runHostedPlatformJobTick({
  limit = 8,
  workerId = "http_tick",
  via = "api_tick",
}: {
  limit?: number;
  workerId?: string;
  via?: string;
} = {}) {
  const queue = new PostgresPlatformJobQueue({ withClient });
  const result = await runPlatformJobTick({
    queue,
    platformStore,
    limit,
    workerId,
  });

  let gmailInboxSync: Awaited<ReturnType<typeof runHostedGmailInboxSyncSweep>> | null = null;
  try {
    gmailInboxSync = await runHostedGmailInboxSyncSweep();
  } catch {
    /* best-effort only — never fail the primary jobs drain over Gmail sync */
  }

  try {
    await withClient((client) =>
      client.query(
        `INSERT INTO platform_worker_heartbeat (worker_id, status, detail, last_seen_at)
         VALUES ($1, 'ok', $2::jsonb, NOW())
         ON CONFLICT (worker_id) DO UPDATE SET
           status = EXCLUDED.status,
           detail = EXCLUDED.detail,
           last_seen_at = NOW()`,
        [workerId, JSON.stringify({ processed: result.processed, via, gmailInboxSync })],
      ),
    );
  } catch {
    /* table may not exist in older envs */
  }
  return { ...result, gmailInboxSync };
}
