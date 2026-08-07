import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation, getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { composeSalesAnalyticsDashboard } from "../../../../../../../backend/core/platform/analytics/SalesAnalyticsDashboard.js";
import {
  readDigestSchedule,
  scheduleDigest,
  presentDigestNow,
} from "../../../../../../../backend/core/platform/analytics/ReportingAutomationDigest.js";

/**
 * Sales Analytics Dashboard (sales_analytics) + Reporting/Dashboard Automation
 * digest (reporting_automation) — composed live from CRM + Outcomes state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.PERFORMANCE_VIEW);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    const workRuntime = (ctx.service as any)?.workRuntime ?? null;
    const workItems = typeof workRuntime?.getWorkItems === "function" ? workRuntime.getWorkItems() : null;
    const assignments = typeof workRuntime?.getAssignments === "function" ? workRuntime.getAssignments() : [];

    const dashboard = composeSalesAnalyticsDashboard({
      installation,
      businessId,
      workItems,
      assignments,
    });

    return NextResponse.json({
      ok: true,
      dashboard,
      digestSchedule: readDigestSchedule(installation),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const scope = await getAuthorizedBusinessScope(businessId, PERMISSIONS.SETTINGS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "scheduleDigest");
    const actorId = String(scope?.user?.id ?? "owner");

    invalidateCachedBusinessOsInstallation(businessId);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    if (action === "scheduleDigest") {
      const schedule = await scheduleDigest({
        platformStore,
        installation,
        enabled: body.enabled,
        frequency: body.frequency,
        hourUtc: body.hourUtc,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, digestSchedule: schedule });
    }

    if (action === "presentDigestNow") {
      const { schedule, digest } = await presentDigestNow({
        platformStore,
        installation,
        businessId,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, digestSchedule: schedule, digest });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
