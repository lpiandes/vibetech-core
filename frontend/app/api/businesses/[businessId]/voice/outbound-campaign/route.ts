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
  createOutboundCampaign,
  dialNextOutboundCampaignContact,
  readOutboundCampaigns,
} from "../../../../../../../backend/core/integrations/voice/OutboundVoiceCampaign.js";

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, campaigns: readOutboundCampaigns(installation) });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
    const action = String(body.action ?? "create");
    let installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const actorId = scope?.user?.id ?? "outbound_voice";

    async function persist(nextInstallation: any) {
      await platformStore.upsertBusinessOSInstallation({
        id: nextInstallation.id ?? nextInstallation.installationId ?? `install_${businessId}`,
        businessId,
        specificationRowId: nextInstallation.specificationRowId ?? null,
        specificationId: nextInstallation.specificationId ?? `spec_${businessId}`,
        specificationVersion: nextInstallation.specificationVersion ?? 1,
        specificationContentHash: nextInstallation.specificationContentHash ?? nextInstallation.contentHash ?? "outbound_voice",
        planId: nextInstallation.planId ?? `plan_${businessId}`,
        status: nextInstallation.status ?? "installed",
        plan: nextInstallation.plan ?? {},
        actionCheckpoints: Array.isArray(nextInstallation.actionCheckpoints) ? nextInstallation.actionCheckpoints : [],
        configuration: nextInstallation.configuration ?? {},
        history: Array.isArray(nextInstallation.history) ? nextInstallation.history.slice(-50) : [],
        installedAt: nextInstallation.installedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
    }

    if (action === "create") {
      const created = createOutboundCampaign({
        installation,
        name: body.name,
        contacts: body.contacts,
      });
      if (!created.ok) return NextResponse.json(created, { status: 400 });
      await persist(created.installation);
      return NextResponse.json({ ok: true, campaign: created.campaign });
    }

    if (action === "dial_next") {
      const { executeLiveProveAction } = await import(
        "../../../../../../../backend/core/integrations/prove/executeLiveProveAction.js"
      );
      const result = await dialNextOutboundCampaignContact({
        installation,
        campaignId: body.campaignId,
        outboundApproved: body.outboundApproved === true,
        placeCall: async ({ to }) => {
          const call = await executeLiveProveAction({
            action: "place_test_call",
            businessId,
            platformStore,
            provePhone: to,
            knowledgeCount: 0,
          });
          if (call?.ok && call.externalReference) {
            try {
              const { recordUsageSafe } = await import(
                "../../../../../../../backend/core/platform/billing/UsageMetering.js"
              );
              recordUsageSafe({
                businessId,
                meterId: "voice_minutes_outbound",
                quantity: 1,
                platformStore,
              });
            } catch { /* ignore */ }
          }
          return call;
        },
      });
      if (result.installation) await persist(result.installation);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
