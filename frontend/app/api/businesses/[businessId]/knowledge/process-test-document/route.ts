import { NextResponse } from "next/server";

import { getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  processDocumentAndUpsertContact,
  runProcessTestDocumentProve,
} from "../../../../../../../backend/core/knowledge/processing/DocumentContactExtraction.js";

/**
 * Document Processing Automation (document_processing) — extracts
 * structured contact fields (name/email/phone/company) from a document and
 * upserts a real CRM contact. With no body.content, runs the canned
 * process_test_document prove sample end-to-end.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const scope = await getAuthorizedBusinessScope(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await request.json().catch(() => ({}));
    const actorId = String(scope?.user?.id ?? "owner");

    invalidateCachedBusinessOsInstallation(businessId);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    const hasContent = typeof body.content === "string" && body.content.trim().length > 0;
    const result = hasContent
      ? await processDocumentAndUpsertContact({
        platformStore,
        installation,
        id: body.id ?? `doc_${Date.now()}`,
        sourceType: String(body.sourceType ?? "TXT"),
        filename: body.filename ?? "document.txt",
        content: body.content,
        actorId,
      })
      : await runProcessTestDocumentProve({ platformStore, installation, actorId });

    invalidateCachedBusinessOsInstallation(businessId);
    return NextResponse.json({
      ok: result.ok,
      extracted: result.extracted ?? null,
      contact: result.contact ?? null,
      contactCreated: Boolean(result.contactCreated),
      reason: result.reason ?? null,
      message: result.message ?? null,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
