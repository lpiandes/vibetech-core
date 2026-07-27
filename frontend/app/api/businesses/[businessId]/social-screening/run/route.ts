import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { JOB_TYPES } from "../../../../../../../../backend/core/platform/jobs/PlatformJobQueue.js";
import { processSocialBackgroundScreenJob } from "../../../../../../../../backend/core/platform/jobs/processSocialBackgroundScreenJob.js";
import { loadSpecialtyWorkerWorkspace } from "../../../../../../../../backend/core/platform/jobs/loadSpecialtyWorkerWorkspace.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

/**
 * Enqueue (or run) a social background screen for a contact / subject.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const body = await request.json().catch(() => ({}));
    const subjectName = String(body.subjectName ?? body.name ?? "").trim();
    if (!subjectName) {
      return NextResponse.json({ error: "Name is required.", code: "SUBJECT_REQUIRED" }, { status: 400 });
    }

    const payload = {
      subjectName,
      name: subjectName,
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      handles: Array.isArray(body.handles) ? body.handles.map(String) : [],
      location: String(body.location ?? "").trim(),
      contactId: String(body.contactId ?? "").trim() || null,
      employeeId: String(body.employeeId ?? "emp_social_background_screener_default"),
    };

    const queue = (platformStore as any)?.platformJobQueue
      ?? (globalThis as any).__vibetechPlatformJobQueue
      ?? null;

    if (queue?.enqueue) {
      const job = await queue.enqueue({
        businessId,
        jobType: JOB_TYPES.SOCIAL_BACKGROUND_SCREEN,
        idempotencyKey: `social_screen_${businessId}_${payload.contactId || subjectName}_${Date.now()}`.slice(0, 140),
        payload,
      });
      return NextResponse.json({
        ok: true,
        enqueued: true,
        jobId: job?.id ?? null,
        message: "Social background screen queued. Report will appear in Needs Attention / Work.",
      });
    }

    // Sync fallback when no durable queue (local/dev).
    const result = await processSocialBackgroundScreenJob({
      job: { businessId, payload },
      platformStore,
      loadWorkspace: async (id: string) => {
        const loaded = await loadSpecialtyWorkerWorkspace({
          businessId: id,
          platformStore,
          employeeId: payload.employeeId,
        });
        if (!loaded.ok) return loaded;
        return {
          ...loaded,
          credentialVault: getSharedCredentialVault(),
        };
      },
    });

    if (!result.ok) {
      return NextResponse.json({
        error: result.reason ?? "Screen failed",
        code: String(result.reason ?? "SCREEN_FAILED").toUpperCase(),
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      enqueued: false,
      workItemId: result.workItemId,
      profilesFound: result.profilesFound,
      report: result.report,
      message: "Social background screen complete — review in Needs Attention / Work.",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
