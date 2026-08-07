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
  createDraftPost,
  approveAndQueuePublish,
  listDrafts,
} from "../../../../../../backend/core/platform/content/SocialContentAutomation.js";
import {
  fromBrief,
  listJobs,
} from "../../../../../../backend/core/platform/content/MarketingContentEngine.js";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const kind = new URL(request.url).searchParams.get("kind") || "social";
    if (kind === "marketing") {
      return NextResponse.json({ ok: true, jobs: listJobs(installation) });
    }
    return NextResponse.json({ ok: true, drafts: listDrafts(installation) });
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
    const action = String(body.action ?? "draft");
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const actorId = scope?.user?.id ?? "content_api";

    if (action === "marketing_brief") {
      const result = await fromBrief({
        platformStore,
        installation,
        brief: body.brief ?? { headline: body.headline, offer: body.offer },
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json(result);
    }

    if (action === "draft") {
      const result = await createDraftPost({
        platformStore,
        installation,
        channel: body.channel,
        brief: body.brief,
        body: body.body,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json(result);
    }

    if (action === "approve") {
      const result = await approveAndQueuePublish({
        platformStore,
        installation,
        draftId: body.draftId,
        actorId,
      });
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
