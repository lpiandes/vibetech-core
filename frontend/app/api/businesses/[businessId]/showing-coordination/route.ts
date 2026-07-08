import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);

    const body = await request.json();
    const requestId = String(body?.requestId ?? "").trim();
    const note = String(body?.note ?? "").trim();
    const preferredTiming = String(body?.preferredTiming ?? "").trim();

    if (!requestId) {
      return NextResponse.json(
        { error: "Prospect inquiry request is required.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await ctx.service.submitShowingCoordination(
      {
        requestId,
        note: note || undefined,
        preferredTiming: preferredTiming || undefined,
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      const status =
        result.reason === "request_not_found" ||
        result.reason === "subject_not_found" ||
        result.reason === "property_inactive"
          ? 404
          : 400;
      return NextResponse.json(
        {
          error: result.message ?? result.reason ?? "Showing coordination failed.",
          code: result.reason ?? "FAILED",
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate ?? false,
      requestId: result.requestId,
      partyId: result.partyId,
      subjectId: result.subjectId,
      interactionId: result.interactionId,
      showingCoordinationWork: result.showingCoordinationWork
        ? {
            id: result.showingCoordinationWork.id,
            title: result.showingCoordinationWork.title,
            workType: result.showingCoordinationWork.workType,
            assignedTo: result.showingCoordinationWork.assignedTo,
          }
        : null,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
