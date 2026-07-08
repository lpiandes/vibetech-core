import { NextResponse } from "next/server";

import { businessKnowledgeService } from "../../../../../../../backend/core/platform/knowledge/BusinessKnowledgeService.js";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string; documentId: string }> }) {
  try {
    const { businessId, documentId } = await params;
    await getAuthorizedWorkspace(businessId);
    const document = await businessKnowledgeService.getDocument(businessId, documentId);
    if (!document) {
      return NextResponse.json({ error: "Knowledge document not found." }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ businessId: string; documentId: string }> }) {
  try {
    const { businessId, documentId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const document = await businessKnowledgeService.deleteDocument({
      businessId,
      documentId,
      userId: ctx.user.id,
    });
    return NextResponse.json({ document, deleted: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Knowledge document not found." }, { status: 404 });
    }
    return authorizationErrorResponse(err);
  }
}
