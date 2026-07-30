import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { fetchAdsMetrics } from "../../../../../../../backend/core/integrations/ads/AdsMetricsAggregator.js";

/**
 * GET ?days=7|30 (defaults to 30) — normalized ad performance across every
 * connected ads provider (Meta / Google / TikTok). Never fabricates numbers:
 * providers without a stored credential (or platform config) come back
 * `not_connected` / `not_configured` with empty totals instead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PERFORMANCE_VIEW);
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days")) === 7 ? 7 : 30;
    const result = await fetchAdsMetrics({ businessId, platformStore, days });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
