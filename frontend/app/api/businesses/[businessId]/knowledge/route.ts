import { NextResponse } from "next/server";

import { businessKnowledgeService } from "@/lib/server/compose";
import { platformStore } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId);
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const categoryId = url.searchParams.get("categoryId");
    const panel = url.searchParams.get("panel");

    if (panel === "powers-ai") {
      const powersAi = await businessKnowledgeService.listPowersAiPanel(businessId);
      return NextResponse.json({
        powersAi,
        categories: businessKnowledgeService.listUniversalCategories(),
      });
    }

    if (q || categoryId) {
      const documents = await businessKnowledgeService.searchDocuments(businessId, q, {
        categoryId: categoryId || null,
      });
      return NextResponse.json({
        documents,
        categories: businessKnowledgeService.listUniversalCategories(),
      });
    }

    const documents = await businessKnowledgeService.listDocuments(businessId);
    return NextResponse.json({
      documents,
      categories: businessKnowledgeService.listUniversalCategories(),
    });
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
    const categoryIdsRaw = formData.getAll("categoryIds");
    const categoryIdsCsv = formData.get("categoryIdsCsv");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const categoryIds = [
      ...categoryIdsRaw.map(String),
      ...(typeof categoryIdsCsv === "string" ? categoryIdsCsv.split(",") : []),
    ];

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await businessKnowledgeService.uploadDocument({
      businessId,
      userId: ctx.user.id,
      buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      title: typeof title === "string" ? title : undefined,
      categoryIds,
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    ctx.service.refreshOperationalState(knowledgeCount);

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    try {
      return authorizationErrorResponse(err);
    } catch (unexpected) {
      console.error("[knowledge-upload]", unexpected);
      const message =
        unexpected instanceof Error && unexpected.message
          ? unexpected.message
          : "Could not upload document.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
