import { NextResponse } from "next/server";

import {
  checkSocialCheckerRateLimit,
  clientKeyFromRequest,
  runPublicSocialCheck,
} from "../../../../../backend/core/social-checker/publicSocialChecker.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const handle = String(body.handle ?? body.username ?? "").trim();

  if (!name && !handle) {
    return NextResponse.json(
      { ok: false, error: "Enter a name (and optionally a username/handle)." },
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

  const result = await runPublicSocialCheck({ name, handle });
  if (!result.ok) {
    const status = result.reason === "serper_api_key_missing" ? 503 : 400;
    const error = result.reason === "serper_api_key_missing"
      ? "Social Checker is not configured yet (missing SERPER_API_KEY)."
      : result.reason === "name_required"
        ? "Enter a name (and optionally a username/handle)."
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
