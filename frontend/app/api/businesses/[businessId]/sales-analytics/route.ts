import { NextResponse } from "next/server";
import {
  getAuthorizedBusinessScope,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { AuthorizationError } from "@/lib/server/compose";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  composeSalesAnalyticsDashboard,
} from "../../../../../../backend/core/platform/analytics/SalesAnalyticsDashboard.js";
import {
  readDigestSchedule,
  scheduleDigest,
  presentDigestNow,
} from "../../../../../../backend/core/platform/analytics/ReportingAutomationDigest.js";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const analytics = composeSalesAnalyticsDashboard({ installation, businessId });
    return NextResponse.json({
      ok: true,
      analytics,
      digestSchedule: readDigestSchedule(installation),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const scope = await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "present_now");
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const actorId = scope?.user?.id ?? "sales_analytics_api";

    if (action === "schedule_digest") {
      const schedule = await scheduleDigest({
        platformStore,
        installation,
        enabled: body.enabled,
        frequency: body.frequency,
        hourUtc: body.hourUtc,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, schedule });
    }

    if (action === "present_now") {
      const { schedule, digest } = await presentDigestNow({
        platformStore,
        installation,
        businessId,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, schedule, digest });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
