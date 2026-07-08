import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { businessKnowledgeService } from "../../../../../../../../../backend/core/platform/knowledge/BusinessKnowledgeService.js";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const knowledgeDocuments = await businessKnowledgeService.listDocuments(businessId);
    const result = await ctx.service.prepareRelationshipFollowUpDraft(
      {
        workId,
        actorId: String(ctx.user.id),
        knowledgeDocuments: knowledgeDocuments as Array<Record<string, unknown>>,
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      const status = result.reason === "work_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.errors?.[0] ?? result.reason, code: result.reason, errors: result.errors ?? [] }, { status });
    }

    return NextResponse.json({
      ok: true,
      workId: result.workId,
      threadId: result.threadId,
      messageId: result.messageId,
      draft: {
        subject: result.draft?.subject ?? "",
        body: result.draft?.body ?? "",
        status: result.draft?.status ?? "draft",
        channel: result.draft?.channel ?? "internal",
        metadata: result.draft?.metadata ?? {},
      },
      context: result.context,
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
