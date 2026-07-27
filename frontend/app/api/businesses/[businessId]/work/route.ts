import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { WorkCreationService } from "../../../../../../backend/core/pipelines/request-to-work/WorkCreationService.js";
import { persistAffectedRuntimes } from "../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";

/**
 * Owner-created Work items (manual follow-ups when the queue is empty).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
    }

    const workRuntime = (ctx.service as any)?.workRuntime
      ?? (ctx.service as any)?.connected?.ctx?.workRuntime;
    if (!workRuntime) {
      return NextResponse.json({ ok: false, error: "Work runtime unavailable" }, { status: 503 });
    }

    const now = new Date().toISOString();
    const workItemId = `work_owner_${Date.now().toString(36)}`;
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const service = new WorkCreationService();
    const created = service.createWorkItem({
      workRuntime,
      workItemInput: {
        id: workItemId,
        title,
        description: String(body.description ?? "").trim(),
        workType: String(body.workType ?? "owner_follow_up"),
        status: "OPEN",
        priority: String(body.priority ?? "NORMAL"),
        stageId: body.stageId ?? null,
        queueId: body.queueId ?? null,
        assignedTo: body.assignedTo ?? null,
        requestedBy: actorId,
        source: "owner",
        dueAt: body.dueAt ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        blockedReason: null,
        relatedObjects: body.contactId
          ? [{ objectType: "contact", objectId: String(body.contactId) }]
          : [],
        requirements: [],
        metadata: {
          ownerCreated: true,
          contactId: body.contactId ?? null,
        },
      },
      convertedAtISO: now,
    });

    if (!created.created) {
      return NextResponse.json({
        ok: false,
        error: created.errors?.[0] ?? "Could not create work",
      }, { status: 400 });
    }

    try {
      await persistAffectedRuntimes({
        workspaceId: businessId,
        stack: (ctx.service as any)?.connected?.operatingStack
          ?? (ctx.service as any)?.connected?.ctx,
        integrationPlatform: (ctx.service as any)?.connected?.integrationPlatform,
        kinds: [RUNTIME_SNAPSHOT_KINDS.WORK],
      });
    } catch {
      /* best effort */
    }

    return NextResponse.json({
      ok: true,
      workItemId: created.workItemId,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
