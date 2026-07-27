import { NextResponse } from "next/server";
import { withClient, getPlatformStore } from "@/lib/server/compose";

/**
 * Production health probe for load balancers and uptime monitors.
 * Does not expose secrets.
 *
 * In production (or HEALTH_REQUIRE_WORKER=1), worker + jobs schema are required
 * for ok=true / HTTP 200 — reminders and deferred sends die without them.
 * Local/dev: set HEALTH_REQUIRE_WORKER=0 to keep DB-only green while iterating.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  let jobsSchema: "ok" | "missing" | "unavailable" = "unavailable";
  let worker: "ok" | "stale" | "missing" | "unavailable" = "unavailable";

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
      const maxAge = Number(process.env.WORKER_HEARTBEAT_MAX_AGE_SECONDS) || 90;
      const hb = await getPlatformStore().getLatestWorkerHeartbeat({ maxAgeSeconds: maxAge });
      if (hb.ok) worker = "ok";
      else if (hb.reason === "no_heartbeat") worker = "missing";
      else worker = "stale";
    } catch {
      worker = "unavailable";
    }
  }

  const requireWorker =
    process.env.HEALTH_REQUIRE_WORKER === "1"
    || (process.env.NODE_ENV === "production" && process.env.HEALTH_REQUIRE_WORKER !== "0");

  const runtimeReady = worker === "ok" && jobsSchema === "ok";
  const ok = database === "ok" && (!requireWorker || runtimeReady);
  const status = !ok
    ? "degraded"
    : runtimeReady
      ? "healthy"
      : "degraded";

  return NextResponse.json(
    {
      ok,
      service: "vibetech",
      status,
      database,
      jobsSchema,
      worker,
      requireWorker,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    { status: ok ? 200 : 503 },
  );
}
