import { NextResponse } from "next/server";

import { getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation, getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  fromBrief,
  listJobs,
  approveMarketingContentJob,
  MARKETING_CONTENT_CHANNELS,
} from "../../../../../../../backend/core/platform/content/MarketingContentEngine.js";

async function loadInstallation(businessId: string) {
  invalidateCachedBusinessOsInstallation(businessId);
  return platformStore.getBusinessOSInstallation(businessId).catch(() => null);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    return NextResponse.json({
      ok: true,
      jobs: listJobs(installation),
      channels: MARKETING_CONTENT_CHANNELS,
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
    const scope = await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "fromBrief");
    const actorId = String(scope?.user?.id ?? "owner");

    const installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    if (action === "fromBrief") {
      const brief = body.brief && typeof body.brief === "object" ? body.brief : {};
      try {
        const result = await fromBrief({ platformStore, installation, brief, actorId });
        invalidateCachedBusinessOsInstallation(businessId);
        return NextResponse.json({ ok: true, job: result.job, jobs: result.jobs });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }, { status: 400 });
      }
    }

    if (action === "approve") {
      const jobId = String(body.jobId ?? "");
      if (!jobId) {
        return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
      }
      const result = await approveMarketingContentJob({
        platformStore,
        installation,
        jobId,
        channels: Array.isArray(body.channels) ? body.channels : undefined,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.message, reason: result.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, job: result.job, jobs: result.jobs });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
