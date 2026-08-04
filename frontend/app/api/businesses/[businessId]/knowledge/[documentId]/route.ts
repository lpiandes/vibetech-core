import { NextResponse } from "next/server";

import { businessKnowledgeService } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(req: Request, { params }: { params: Promise<{ businessId: string; documentId: string }> }) {
  try {
    const { businessId, documentId } = await params;
    await getAuthorizedWorkspace(businessId);
    const wantContent = new URL(req.url).searchParams.get("content") === "1";
    if (wantContent) {
      const payload = await businessKnowledgeService.getDocumentContent(businessId, documentId);
      return NextResponse.json(payload);
    }
    const document = await businessKnowledgeService.getDocument(businessId, documentId);
    if (!document) {
      return NextResponse.json({ error: "Knowledge document not found." }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Knowledge document not found." }, { status: 404 });
    }
    return authorizationErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string; documentId: string }> }) {
  try {
    const { businessId, documentId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await request.json().catch(() => ({}));
    const document = await businessKnowledgeService.updateDocumentCategories({
      businessId,
      documentId,
      userId: ctx.user.id,
      categoryIds: body?.categoryIds ?? [],
    });
    return NextResponse.json({ document });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Knowledge document not found." }, { status: 404 });
    }
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
