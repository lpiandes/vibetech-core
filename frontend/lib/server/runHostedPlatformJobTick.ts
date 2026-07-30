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
const GMAIL_SYNC_CANDIDATE_POOL = 20;
const GMAIL_SYNC_MAX_PER_TICK = 3;
const GMAIL_SYNC_MIN_INTERVAL_MS = 10 * 60 * 1000;

async function runHostedGmailInboxSyncSweep() {
  const outcome = { attempted: 0, synced: 0, errors: [] as Array<{ businessId: string; reason: string }> };
  const listCandidates = (platformStore as any)?.listWorkspaceIdsWithIntegrationCredentialType;
  if (typeof listCandidates !== "function") return outcome;

  let candidateBusinessIds: string[] = [];
  try {
    candidateBusinessIds = await listCandidates.call(platformStore, "gmail", { limit: GMAIL_SYNC_CANDIDATE_POOL });
  } catch {
    return outcome;
  }
  if (!candidateBusinessIds.length) return outcome;

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
