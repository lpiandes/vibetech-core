import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "@/lib/server/compose";
import { resolveImportDryRunContext } from "../../../../../../backend/core/import/resolveImportDryRunContext.js";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

function importErrorResponse(err: unknown) {
  if (err instanceof Error && "code" in err) {
    const code = String((err as Error & { code?: string }).code);
    if (code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
  }
  return authorizationErrorResponse(err);
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const { installationResult } = await resolveImportDryRunContext({
      workspaceId: businessId,
      activation: ctx.authz.activation,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    const sourceSystem = String(formData.get("sourceSystem") ?? "").trim();
    const profileId = String(formData.get("profileId") ?? "").trim() || undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }
    if (!sourceSystem) {
      return NextResponse.json({ error: "sourceSystem is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await crmImportOrchestrationService.upload({
      businessId,
      userId: ctx.user.id,
      buffer,
      filename: file.name,
      mimeType: file.type || "text/csv",
      sourceSystem,
      profileId,
      installationResult,
    });

    return NextResponse.json({ importRun: result.importRun }, { status: 201 });
  } catch (err) {
    return importErrorResponse(err);
  }
}
