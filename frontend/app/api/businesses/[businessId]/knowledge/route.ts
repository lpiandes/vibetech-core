import { NextResponse } from "next/server";

import { businessKnowledgeService } from "../../../../../../backend/core/platform/knowledge/BusinessKnowledgeService.js";
import { platformStore } from "../../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId);
    const documents = await businessKnowledgeService.listDocuments(businessId);
    return NextResponse.json({ documents });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await businessKnowledgeService.uploadDocument({
      businessId,
      userId: ctx.user.id,
      buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      title: typeof title === "string" ? title : undefined,
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    ctx.service.refreshOperationalState(knowledgeCount);

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return authorizationErrorResponse(err);
  }
}
