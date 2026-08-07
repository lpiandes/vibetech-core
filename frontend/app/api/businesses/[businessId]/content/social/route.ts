import { NextResponse } from "next/server";

import { getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation, getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  createDraftPost,
  listDrafts,
  approveAndQueuePublish,
  runSocialContentDraftProve,
  SOCIAL_CONTENT_CHANNELS,
} from "../../../../../../../backend/core/platform/content/SocialContentAutomation.js";

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
      drafts: listDrafts(installation),
      channels: SOCIAL_CONTENT_CHANNELS,
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
    const action = String(body.action ?? "create");
    const actorId = String(scope?.user?.id ?? "owner");

    const installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    if (action === "create") {
      const result = await createDraftPost({
        platformStore,
        installation,
        channel: body.channel,
        brief: body.brief,
        body: body.body,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, draft: result.draft, drafts: result.drafts });
    }

    if (action === "approve") {
      const draftId = String(body.draftId ?? "");
      if (!draftId) {
        return NextResponse.json({ ok: false, error: "draftId required" }, { status: 400 });
      }
      const result = await approveAndQueuePublish({
        platformStore,
        installation,
        businessId,
        draftId,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.message, reason: result.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, draft: result.draft, drafts: result.drafts });
    }

    if (action === "prove") {
      const result = await runSocialContentDraftProve({
        platformStore,
        installation,
        businessId,
        channel: body.channel,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({ ok: true, draft: result.draft, message: result.message });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
