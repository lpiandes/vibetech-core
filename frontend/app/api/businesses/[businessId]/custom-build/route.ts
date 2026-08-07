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
  advanceCustomBuildOnInstallation,
  persistCustomBuild,
  presentCustomBuildFromInstallation,
  startCustomBuildOnInstallation,
} from "../../../../../../backend/core/platform/commercial/persistCustomBuild.js";
import { canSellOffer } from "../../../../../../backend/core/platform/commercial/CanSellOffer.js";

function jsonRouteError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return authorizationErrorResponse(error);
  }
  console.error("[custom-build]", error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

async function loadInstallation(businessId: string) {
  invalidateCachedBusinessOsInstallation(businessId);
  return platformStore.getBusinessOSInstallation(businessId).catch(() => null);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "Installation not found" }, { status: 404 });
    }
    const view = presentCustomBuildFromInstallation(installation);
    return NextResponse.json({ ok: true, customBuild: view });
  } catch (error) {
    return jsonRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "start");
    const scope = await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_MANAGE);
    let installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "Installation not found" }, { status: 404 });
    }
    const actorId = scope?.user?.id ?? "custom_build";

    if (action === "start") {
      const sheetLine = body.sheetLine ? String(body.sheetLine) : "Custom AI Application";
      const gate = canSellOffer({ sheetLine, offerId: body.offerId });
      if (!gate.allowed) {
        return NextResponse.json({ ok: false, error: gate.reason, blockers: gate.blockers }, { status: 400 });
      }
      const started = startCustomBuildOnInstallation(installation, {
        businessId,
        sheetLine,
        offerId: body.offerId,
        packageIds: body.packageIds,
        brief: body.brief,
        force: Boolean(body.force),
      });
      await persistCustomBuild({
        platformStore,
        installation: started.installation,
        record: started.record,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, customBuild: started.view, created: started.created });
    }

    if (action === "advance") {
      const stepId = String(body.stepId ?? "");
      const advanced = advanceCustomBuildOnInstallation(installation, stepId, {
        evidence: body.evidence ?? null,
      });
      await persistCustomBuild({
        platformStore,
        installation: advanced.installation,
        record: advanced.record,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, customBuild: advanced.view });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return jsonRouteError(error);
  }
}
