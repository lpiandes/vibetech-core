/**
 * Hosted job tick — drains due platform_jobs without a separate long-running worker.
 *
 * Call via:
 * - Vercel Cron / GitHub Actions / external cron every few minutes
 * - Local: curl -X POST http://localhost:3000/api/platform/jobs/tick -H "Authorization: Bearer $CRON_SECRET"
 *
 * Optional dedicated `npm run worker` is still better for high volume; this makes
 * a single hosted Next.js app able to run reminders + approved sends.
 */
import { NextResponse } from "next/server";

import { runHostedPlatformJobTick } from "@/lib/server/runHostedPlatformJobTick";

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || process.env.PLATFORM_JOB_TICK_SECRET || "").trim();
  if (!secret) {
    // Local/dev: allow without secret when NODE_ENV is not production
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = new URL(request.url);
  const query = url.searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 8);
    const result = await runHostedPlatformJobTick({
      limit,
      workerId: "http_tick",
      via: "api_tick",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "tick_failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
