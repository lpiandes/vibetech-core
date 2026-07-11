import { NextResponse } from "next/server";
import { withClient } from "../../../../backend/core/platform/db/pool.js";

/**
 * Production health probe for load balancers and uptime monitors.
 * Does not expose secrets.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  try {
    await withClient((client: { query: (sql: string) => Promise<unknown> }) => client.query("SELECT 1 AS ok"));
    database = "ok";
  } catch {
    database = "unavailable";
  }

  const ok = database === "ok";
  return NextResponse.json(
    {
      ok,
      service: "vibetech",
      status: ok ? "healthy" : "degraded",
      database,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    },
    { status: ok ? 200 : 503 },
  );
}
