/**
 * API: run sports/dental golden path against durable job queue + Work deep-links.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { getPlatformStore, withClient } from "@/lib/server/compose";
import { PostgresPlatformJobQueue } from "../../../../../../../backend/core/platform/jobs/PostgresPlatformJobQueue.js";
import { runVerticalGoldenPathLive } from "../../../../../../../backend/core/platform/golden-paths/runVerticalGoldenPathLive.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; vertical: string }> },
) {
  try {
    const { businessId, vertical } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const outboundApproved = body?.outboundApproved !== false;

    const queue = new PostgresPlatformJobQueue({ withClient });
    const result = await runVerticalGoldenPathLive({
      vertical,
      businessId,
      queue,
      outboundApproved,
      workspaceGate: {
        industry: vertical,
        operatingPackId: vertical === "sports" ? "youth_sports_v1" : "dental_v1",
      },
    });

    if (result?.proof?.ok) {
      await getPlatformStore().upsertCapabilityProofRecord({
        businessId,
        capabilityId: result.capabilityId,
        proveAction: result.proveAction,
        ok: true,
        verified: true,
        detail: result.proof.detail ?? {},
      });
    }

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof Error && /Unsupported golden path|PM workspace/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return authorizationErrorResponse(err);
  }
}
