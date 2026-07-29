/**
 * Shared hosted job drain used by /api/platform/jobs/tick and health self-heal.
 */
import { withClient, platformStore } from "@/lib/server/compose";
import { PostgresPlatformJobQueue } from "../../../backend/core/platform/jobs/PostgresPlatformJobQueue.js";
import { runPlatformJobTick } from "../../../backend/core/platform/jobs/createPlatformJobExecutor.js";

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
  try {
    await withClient((client) =>
      client.query(
        `INSERT INTO platform_worker_heartbeat (worker_id, status, detail, last_seen_at)
         VALUES ($1, 'ok', $2::jsonb, NOW())
         ON CONFLICT (worker_id) DO UPDATE SET
           status = EXCLUDED.status,
           detail = EXCLUDED.detail,
           last_seen_at = NOW()`,
        [workerId, JSON.stringify({ processed: result.processed, via })],
      ),
    );
  } catch {
    /* table may not exist in older envs */
  }
  return result;
}
