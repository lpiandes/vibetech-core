import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { withClient, getPlatformStore } from "@/lib/server/compose";

/**
 * Admin platform health — worker heartbeat, jobs schema, queue depth.
 */
export async function GET() {
  await requirePlatformAdmin();
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  let jobsSchema: "ok" | "missing" | "unavailable" = "unavailable";
  let worker: "ok" | "stale" | "missing" | "unavailable" = "unavailable";
  let heartbeat: any = null;
  let queue: { pending: number; running: number; failed: number; dead: number } | null = null;

  try {
    await withClient((client) => client.query("SELECT 1 AS ok"));
    database = "ok";
  } catch {
    database = "unavailable";
  }

  if (database === "ok") {
    try {
      const { rows } = await withClient((client) =>
        client.query(
          `SELECT
             to_regclass('public.platform_jobs') IS NOT NULL AS jobs,
             to_regclass('public.capability_proof_records') IS NOT NULL AS proofs,
             to_regclass('public.platform_worker_heartbeat') IS NOT NULL AS heartbeat`,
        ),
      );
      const row = rows[0] ?? {};
      jobsSchema = row.jobs && row.proofs && row.heartbeat ? "ok" : "missing";
    } catch {
      jobsSchema = "unavailable";
    }

    try {
      const maxAge = Number(process.env.WORKER_HEARTBEAT_MAX_AGE_SECONDS) || 360;
      heartbeat = await getPlatformStore().getLatestWorkerHeartbeat({ maxAgeSeconds: maxAge });
      if (heartbeat?.ok) worker = "ok";
      else if (heartbeat?.reason === "no_heartbeat") worker = "missing";
      else worker = "stale";
    } catch {
      worker = "unavailable";
    }

    if (jobsSchema === "ok") {
      try {
        const { rows } = await withClient((client) =>
          client.query(
            `SELECT status, COUNT(*)::int AS n
             FROM platform_jobs
             WHERE status IN ('pending', 'running', 'failed', 'dead')
             GROUP BY status`,
          ),
        );
        const by = Object.fromEntries((rows ?? []).map((r: any) => [r.status, Number(r.n)]));
        queue = {
          pending: by.pending ?? 0,
          running: by.running ?? 0,
          failed: by.failed ?? 0,
          dead: by.dead ?? 0,
        };
      } catch {
        queue = null;
      }
    }
  }

  const status = database !== "ok"
    ? "degraded"
    : worker === "ok" && jobsSchema === "ok"
      ? "healthy"
      : "degraded";

  return NextResponse.json({
    ok: database === "ok",
    status,
    database,
    jobsSchema,
    worker,
    heartbeat,
    queue,
    guidance: {
      preferWorker: "Production requires a durable worker: `npm run worker` must stay running.",
      tickBackup: "Also schedule POST /api/platform/jobs/tick every 1–2 minutes (CRON_SECRET) as HA backup.",
    },
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}
