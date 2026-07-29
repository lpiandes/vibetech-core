import { NextResponse } from "next/server";

import {
  checkSocialCheckerRateLimit,
  clientKeyFromRequest,
  runPublicSocialCheck,
} from "../../../../../backend/core/social-checker/publicSocialChecker.js";

export const runtime = "nodejs";
export const maxDuration = 90;

const ALLOWED_PLATFORMS = new Set([
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "x",
  "facebook",
  "threads",
  "reddit",
  "github",
  "pinterest",
  "twitch",
  "snapchat",
]);

function parseHandlesByPlatform(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  /** @type {Record<string, string>} */
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const network = String(key).toLowerCase().trim();
    if (!ALLOWED_PLATFORMS.has(network)) continue;
    const handle = String(value ?? "").trim().replace(/^@/, "");
    if (handle.length >= 2) out[network] = handle;
  }
  return out;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const handle = String(body.handle ?? body.username ?? "").trim();
  const handlesByPlatform = parseHandlesByPlatform(
    body.handlesByPlatform ?? body.handlesByNetwork ?? {},
  );

  if (!name && !handle && Object.keys(handlesByPlatform).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Enter a name (handles are optional but recommended)." },
      { status: 400 },
    );
  }

  const rate = checkSocialCheckerRateLimit({
    key: clientKeyFromRequest(request),
  });
  if (!rate.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Daily search limit reached for this network. Try again tomorrow.",
        remaining: 0,
        limit: rate.limit,
      },
      { status: 429 },
    );
  }

  const result = await runPublicSocialCheck({ name, handle, handlesByPlatform });
  if (!result.ok) {
    const status = result.reason === "serper_api_key_missing" ? 503 : 400;
    const error = result.reason === "serper_api_key_missing"
      ? "Social Checker is not configured yet (missing SERPER_API_KEY)."
      : result.reason === "name_required"
        ? "Enter a name (handles are optional but recommended)."
        : "Could not complete social search.";
    return NextResponse.json({ ok: false, error, reason: result.reason }, { status });
  }

  const { ok: _ok, ...payload } = result;
  return NextResponse.json({
    ok: true,
    remaining: rate.remaining,
    limit: rate.limit,
    ...payload,
  });
}
